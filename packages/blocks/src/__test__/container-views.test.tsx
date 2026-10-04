import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CalloutProvider } from "../callout/provider";
import { CollapsibleProvider } from "../collapsible/provider";
import { ColumnsProvider } from "../columns/provider";
import { TabsProvider } from "../tabs/provider";

afterEach(cleanup);

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the scroll position after the cursor moves.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

function Harness({ source, onReady }: { source: string; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(),
		content: mdxToTiptap(source),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

/** Registers the editing views of the four block extensions, like the admin UI does. */
const BlockViews = ({ children }: { children: ReactNode }) => (
	<CalloutProvider>
		<CollapsibleProvider>
			<TabsProvider>
				<ColumnsProvider>{children}</ColumnsProvider>
			</TabsProvider>
		</CollapsibleProvider>
	</CalloutProvider>
);

const mount = async (source: string) => {
	let editor: Editor | null = null;
	render(
		<BlockViews>
			<Harness
				source={source}
				onReady={(ready) => {
					editor = ready;
				}}
			/>
		</BlockViews>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	// Wait until the NodeView (React portal) has rendered.
	await waitFor(() => expect(document.querySelector("[data-cms-container-node]")).not.toBeNull());
	return editor as unknown as Editor;
};

const parentTypeOfSelection = (editor: Editor) => {
	const $from = editor.state.selection.$from;
	return $from.node($from.depth - 1).type.name;
};

const TABS = '::::tabs{defaultValue="둘"}\n:::tab{label="하나"}\n첫째\n:::\n:::tab{label="둘"}\n둘째\n:::\n::::';

describe("container NodeView (public look + in-place editing)", () => {
	it("shows only the initial tab, and clicking another tab moves the cursor into its body", async () => {
		const editor = await mount(TABS);
		const tabs = await screen.findAllByRole("tab");
		expect(tabs.map((tab) => tab.textContent)).toEqual(["하나", "둘"]);
		expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");

		fireEvent.click(tabs[0] as HTMLElement, { detail: 1 });
		await waitFor(() => expect(screen.getAllByRole("tab")[0]?.getAttribute("aria-selected")).toBe("true"));
		expect(parentTypeOfSelection(editor)).toBe("cmsTab");
		expect(editor.state.selection.$from.parent.textContent).toBe("첫째");
	});

	it("updates the tab name as you type and reverts on Escape", async () => {
		const editor = await mount(TABS);
		fireEvent.click(screen.getByRole("button", { name: "이 탭 이름 바꾸기" }));
		const input = await screen.findByRole("textbox", { name: "탭 이름" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "둘째 탭" } });
		// The initial tab (defaultValue) follows the rename too.
		expect(tiptapToMdx(editor.getJSON())).toContain('defaultValue="둘째 탭"');
		fireEvent.keyDown(input, { key: "Escape" });
		expect(tiptapToMdx(editor.getJSON())).toBe(tiptapToMdx(mdxToTiptap(TABS)));
	});

	it("omits the tab name when it is cleared", async () => {
		const editor = await mount(TABS);
		fireEvent.click(screen.getByRole("button", { name: "이 탭 이름 바꾸기" }));
		const input = await screen.findByRole("textbox", { name: "탭 이름" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "" } });
		expect(tiptapToMdx(editor.getJSON())).toContain('label="둘"');
	});

	it("adds a column and removes the one with the cursor (minimum 2 columns)", async () => {
		const editor = await mount("::::columns\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::");
		const remove = screen.getByRole("button", { name: "마지막 단 삭제" });
		expect((remove as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "단 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(3));
		expect(parentTypeOfSelection(editor)).toBe("cmsColumn");
		fireEvent.click(await screen.findByRole("button", { name: "이 단 삭제" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(2));
		expect(editor.state.doc.firstChild?.textContent).toBe("왼쪽오른쪽");
	});

	it("removes the callout title attribute when it is cleared", async () => {
		const source = ':::callout{variant="tip" title="제목"}\n본문\n:::';
		const editor = await mount(source);
		const input = screen.getByRole("textbox", { name: "콜아웃 제목" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "" } });
		expect(editor.state.doc.firstChild?.attrs.values).toEqual({ variant: "tip" });
		expect(tiptapToMdx(editor.getJSON())).not.toContain("title=");
	});

	it("changes the callout variant from the toolbar menu", async () => {
		const editor = await mount(':::callout{variant="tip"}\n본문\n:::');
		fireEvent.click(screen.getByRole("button", { name: /콜아웃 종류/ }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "경고" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs.values).toEqual({ variant: "warning" }));
	});

	it("toggles the collapsible's open-by-default with the switch in the settings popover", async () => {
		const editor = await mount(':::collapsible{title="제목"}\n숨은 본문\n:::');
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		fireEvent.click(await screen.findByRole("switch", { name: "처음부터 펼치기" }));
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain("defaultOpen"));
	});

	it("starts closed per defaultOpen, and expanding with the arrow moves the cursor into the body", async () => {
		const editor = await mount(':::collapsible{title="제목"}\n숨은 본문\n:::');
		const toggle = screen.getByRole("button", { name: "펼치기" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(document.querySelector(".node-cmsCollapsible [data-node-view-content]")?.classList).toContain("hidden");
		act(() => {
			fireEvent.click(toggle);
		});
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "접기" }).getAttribute("aria-expanded")).toBe("true"),
		);
		expect(parentTypeOfSelection(editor)).toBe("cmsCollapsible");
	});
});

describe("column widths", () => {
	it("equal split clears the stored widths, and adding a column resets widths to equal", async () => {
		const source = '::::columns{widths="70,30"}\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::';
		const editor = await mount(source);
		expect(screen.getByText("70 : 30")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "단 너비 똑같이 나누기" }));
		expect(tiptapToMdx(editor.getJSON())).not.toContain("widths");
		editor.commands.undo();
		expect(tiptapToMdx(editor.getJSON())).toContain('widths="70,30"');
		fireEvent.click(screen.getByRole("button", { name: "단 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(3));
		expect(tiptapToMdx(editor.getJSON())).not.toContain("widths");
	});
});
