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

// jsdom에는 글자 범위의 좌표가 없다. 커서를 옮긴 뒤 ProseMirror가 스크롤 위치를 잴 때 쓴다.
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

/** 관리자 화면처럼 블록 확장 네 개의 편집 화면을 넣는다. */
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
	// NodeView(React 포털)가 그려질 때까지 기다린다.
	await waitFor(() => expect(document.querySelector("[data-cms-container-node]")).not.toBeNull());
	return editor as unknown as Editor;
};

const parentTypeOfSelection = (editor: Editor) => {
	const $from = editor.state.selection.$from;
	return $from.node($from.depth - 1).type.name;
};

const TABS = '::::tabs{defaultValue="둘"}\n:::tab{label="하나"}\n첫째\n:::\n:::tab{label="둘"}\n둘째\n:::\n::::';

describe("컨테이너 NodeView(공개 모양 + 제자리 편집)", () => {
	it("탭은 처음 열 탭만 보이고, 다른 탭을 누르면 그 탭 본문으로 커서가 간다", async () => {
		const editor = await mount(TABS);
		const tabs = await screen.findAllByRole("tab");
		expect(tabs.map((tab) => tab.textContent)).toEqual(["하나", "둘"]);
		expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");

		fireEvent.click(tabs[0] as HTMLElement, { detail: 1 });
		await waitFor(() => expect(screen.getAllByRole("tab")[0]?.getAttribute("aria-selected")).toBe("true"));
		expect(parentTypeOfSelection(editor)).toBe("cmsTab");
		expect(editor.state.selection.$from.parent.textContent).toBe("첫째");
	});

	it("탭 이름은 입력하는 대로 바뀌고 Escape로 되돌린다", async () => {
		const editor = await mount(TABS);
		fireEvent.click(screen.getByRole("button", { name: "이 탭 이름 바꾸기" }));
		const input = await screen.findByRole("textbox", { name: "탭 이름" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "둘째 탭" } });
		// 처음 열 탭(defaultValue)도 이름을 따라간다.
		expect(tiptapToMdx(editor.getJSON())).toContain('defaultValue="둘째 탭"');
		fireEvent.keyDown(input, { key: "Escape" });
		expect(tiptapToMdx(editor.getJSON())).toBe(tiptapToMdx(mdxToTiptap(TABS)));
	});

	it("탭 이름을 비우면 넣지 않는다", async () => {
		const editor = await mount(TABS);
		fireEvent.click(screen.getByRole("button", { name: "이 탭 이름 바꾸기" }));
		const input = await screen.findByRole("textbox", { name: "탭 이름" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "" } });
		expect(tiptapToMdx(editor.getJSON())).toContain('label="둘"');
	});

	it("단을 더하고 커서가 있는 단을 지운다(최소 2단)", async () => {
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

	it("콜아웃 제목을 비우면 속성에서 뺀다", async () => {
		const source = ':::callout{variant="tip" title="제목"}\n본문\n:::';
		const editor = await mount(source);
		const input = screen.getByRole("textbox", { name: "콜아웃 제목" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "" } });
		expect(editor.state.doc.firstChild?.attrs.values).toEqual({ variant: "tip" });
		expect(tiptapToMdx(editor.getJSON())).not.toContain("title=");
	});

	it("콜아웃 종류는 도구 줄 메뉴에서 바꾼다", async () => {
		const editor = await mount(':::callout{variant="tip"}\n본문\n:::');
		fireEvent.click(screen.getByRole("button", { name: /콜아웃 종류/ }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "경고" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs.values).toEqual({ variant: "warning" }));
	});

	it("접기의 처음부터 펼치기는 설정 팝오버의 스위치로 바꾼다", async () => {
		const editor = await mount(':::collapsible{title="제목"}\n숨은 본문\n:::');
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		fireEvent.click(await screen.findByRole("switch", { name: "처음부터 펼치기" }));
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain("defaultOpen"));
	});

	it("접기는 defaultOpen을 따라 처음에 닫혀 있고, 화살표로 펼치면 본문으로 커서가 간다", async () => {
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

describe("단 너비", () => {
	it("똑같이 나누기는 저장된 너비를 지우고, 단을 더하면 너비를 똑같이 되돌린다", async () => {
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
