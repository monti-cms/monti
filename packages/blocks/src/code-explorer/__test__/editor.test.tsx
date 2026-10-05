import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BLOCK_INSERT_ACTIONS } from "../../../../admin/src/editor/block-inserts";
import { filesOf, uniquePath } from "../editor-files";
import { CodeExplorerProvider } from "../provider";

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

const SOURCE = [
	'<CodeExplorer open="src/b.ts">',
	"",
	'```ts title="a.ts"',
	"export const a = 1;",
	"```",
	"",
	'```ts title="src/b.ts"',
	"export const b = 2;",
	"```",
	"",
	'```text title="docs/"',
	"",
	"```",
	"",
	"</CodeExplorer>",
].join("\n");

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

const mount = async (source: string, expectBlock = true) => {
	let editor: Editor | null = null;
	render(
		<CodeExplorerProvider>
			<Harness
				source={source}
				onReady={(ready) => {
					editor = ready;
				}}
			/>
		</CodeExplorerProvider>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	// Wait until the NodeView (React portal) has rendered.
	if (expectBlock)
		await waitFor(() => expect(document.querySelector('[data-cms-container-node="cmsCodeExplorer"]')).not.toBeNull());
	return editor as unknown as Editor;
};

const fileList = () => screen.getByRole("list", { name: "파일" });
const fileButtons = () => within(fileList()).getAllByRole("button");
/** The select of the open file in the settings popover (the code blocks' language selects have a label). */
const openTrigger = () =>
	waitFor(() => {
		const trigger = screen.getAllByRole("combobox").find((element) => !element.hasAttribute("aria-label"));
		if (!trigger) throw new Error("open file select not found");
		return trigger;
	});
/** Picks a select option the way a pointer does (the select commits on the click that follows a pointer down). */
const choose = (option: HTMLElement) => {
	fireEvent.pointerDown(option);
	fireEvent.click(option);
};
/** The title of the code block that holds the cursor. */
const cursorTitle = (editor: Editor) => {
	const $from = editor.state.selection.$from;
	return (/title="([^"]*)"/.exec(String($from.parent.attrs.meta)) ?? [])[1];
};

describe("code explorer editing view", () => {
	it("shows the label and a file list built from the code blocks' titles, folders included", async () => {
		const editor = await mount(SOURCE);
		expect(screen.getByText("코드 탐색기")).toBeDefined();
		expect(fileButtons().map((button) => button.textContent)).toEqual(["a.ts", "src/b.ts", "docs/"]);
		// Every file is an ordinary code block below the list (the same node view as everywhere else).
		expect(
			document.querySelectorAll(
				'[data-cms-container-node="cmsCodeExplorer"] pre, [data-cms-container-node="cmsCodeExplorer"] [data-code-ui]',
			).length,
		).toBeGreaterThan(0);
		expect(editor.state.doc.firstChild?.childCount).toBe(3);
	});

	it("clicking a path moves the cursor into that code block, and the file holding the cursor is marked", async () => {
		const editor = await mount(SOURCE);
		expect(fileButtons().some((button) => button.getAttribute("aria-current") === "true")).toBe(false);
		fireEvent.click(fileButtons()[1] as HTMLElement);
		await waitFor(() => expect(cursorTitle(editor)).toBe("src/b.ts"));
		await waitFor(() =>
			expect(fileButtons().map((button) => button.getAttribute("aria-current"))).toEqual([null, "true", null]),
		);
		fireEvent.click(fileButtons()[0] as HTMLElement);
		await waitFor(() => expect(cursorTitle(editor)).toBe("a.ts"));
		await waitFor(() =>
			expect(fileButtons().map((button) => button.getAttribute("aria-current"))).toEqual(["true", null, null]),
		);
	});

	it("follows a path edited in the code block's own title (the list is derived, not stored)", async () => {
		const editor = await mount(SOURCE);
		const pos = 1;
		const node = editor.state.doc.firstChild?.firstChild;
		expect(node?.type.name).toBe("codeBlock");
		act(() => {
			editor.view.dispatch(
				editor.state.tr.setNodeMarkup(pos, undefined, { ...node?.attrs, meta: 'title="src/app/a.ts"' }),
			);
		});
		await waitFor(() => expect(fileButtons()[0]?.textContent).toBe("src/app/a.ts"));
	});

	it("lists only code blocks; a paragraph child is shown in the body but is not a file", async () => {
		const editor = await mount(SOURCE.replace("</CodeExplorer>", "아래 설명\n\n</CodeExplorer>"));
		expect(fileButtons()).toHaveLength(3);
		expect(editor.state.doc.firstChild?.lastChild?.type.name).toBe("paragraph");
		expect(screen.getByText("아래 설명")).toBeDefined();
		expect(filesOf(editor.state.doc.firstChild as never).map((file) => file.index)).toEqual([0, 1, 2]);
	});

	it("adds a file at the end with a unique placeholder path and moves the cursor into it", async () => {
		const editor = await mount(SOURCE);
		fireEvent.click(screen.getByRole("button", { name: "파일 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(4));
		expect(editor.state.doc.firstChild?.lastChild?.attrs).toMatchObject({
			language: "ts",
			meta: 'title="src/new-file.ts"',
		});
		expect(cursorTitle(editor)).toBe("src/new-file.ts");
		fireEvent.click(screen.getByRole("button", { name: "파일 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(5));
		expect(cursorTitle(editor)).toBe("src/new-file-2.ts");
		await waitFor(() =>
			expect(
				fileButtons()
					.map((button) => button.textContent)
					.slice(3),
			).toEqual(["src/new-file.ts", "src/new-file-2.ts"]),
		);
		const saved = tiptapToMdx(editor.getJSON());
		expect(saved).toContain('```ts title="src/new-file.ts"');
		expect(saved).toContain('```ts title="src/new-file-2.ts"');
	});

	it("adds a folder (a title ending in `/`)", async () => {
		const editor = await mount(SOURCE);
		fireEvent.click(screen.getByRole("button", { name: "폴더 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(4));
		expect(editor.state.doc.firstChild?.lastChild?.attrs.meta).toBe('title="src/new-folder/"');
		fireEvent.click(screen.getByRole("button", { name: "폴더 추가" }));
		await waitFor(() => expect(editor.state.doc.firstChild?.lastChild?.attrs.meta).toBe('title="src/new-folder-2/"'));
	});

	it("picks the file shown first from the file paths (folders are not offered)", async () => {
		const editor = await mount(SOURCE);
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		const trigger = await openTrigger();
		fireEvent.click(trigger);
		const options = await screen.findAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual(["첫 파일", "a.ts", "src/b.ts"]);
		choose(options[1] as HTMLElement);
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs.values).toEqual({ open: "a.ts" }));
		expect(tiptapToMdx(editor.getJSON())).toContain('open="a.ts"');
	});

	it("choosing the first file clears the setting", async () => {
		const editor = await mount(SOURCE);
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		fireEvent.click(await openTrigger());
		choose((await screen.findAllByRole("option"))[0] as HTMLElement);
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs.values).toEqual({}));
		expect(tiptapToMdx(editor.getJSON())).not.toContain("open=");
	});

	it("falls back to a text input for the open file while there is no file to pick", async () => {
		const editor = await mount('<CodeExplorer open="x.ts" />');
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		const input = (await screen.findByDisplayValue("x.ts")) as HTMLInputElement;
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "y.ts" } });
		expect(editor.state.doc.firstChild?.attrs.values).toEqual({ open: "y.ts" });
	});

	it("deletes the block from the toolbar", async () => {
		const editor = await mount(`첫 문단\n\n${SOURCE}`);
		fireEvent.click(screen.getByRole("button", { name: "코드 탐색기 삭제" }));
		await waitFor(() => expect(editor.state.doc.childCount).toBe(1));
		expect(tiptapToMdx(editor.getJSON())).not.toContain("CodeExplorer");
		expect(tiptapToMdx(editor.getJSON())).toContain("첫 문단");
	});

	it("has no toolbar when the editor is read-only", async () => {
		let editor: Editor | null = null;
		render(
			<CodeExplorerProvider>
				<Harness
					source={SOURCE}
					onReady={(ready) => {
						editor = ready;
					}}
				/>
			</CodeExplorerProvider>,
		);
		await waitFor(() => expect(editor).not.toBeNull());
		await screen.findByRole("toolbar", { name: "코드 탐색기 도구" });
		act(() => (editor as unknown as Editor).setEditable(false));
		await waitFor(() => expect(screen.queryByRole("toolbar", { name: "코드 탐색기 도구" })).toBeNull());
	});

	it("the slash menu inserts the block with one code block `src/index.ts`, not an empty paragraph", async () => {
		const editor = await mount("첫 문단", false);
		const action = BLOCK_INSERT_ACTIONS["code-explorer"];
		expect(action).toBeDefined();
		act(() => {
			editor.commands.setTextSelection(editor.state.doc.content.size - 1);
			editor.commands.insertContent("/");
			const end = editor.state.selection.to;
			action?.(editor, { from: end - 1, to: end });
		});
		const block = [...Array(editor.state.doc.childCount).keys()]
			.map((index) => editor.state.doc.child(index))
			.find((child) => child.type.name === "cmsCodeExplorer");
		expect(block).toBeDefined();
		expect(block?.childCount).toBe(1);
		expect(block?.firstChild?.type.name).toBe("codeBlock");
		expect(block?.firstChild?.attrs).toMatchObject({ language: "ts", meta: 'title="src/index.ts"' });
		await waitFor(() => expect(fileButtons().map((button) => button.textContent)).toEqual(["src/index.ts"]));
		expect(tiptapToMdx(editor.getJSON())).toContain('<CodeExplorer>\n\n```ts title="src/index.ts"');
	});
});

describe("uniquePath", () => {
	it("returns the plain path first, then numbers from 2 and skips taken numbers", () => {
		expect(uniquePath([], "src/new-file", ".ts")).toBe("src/new-file.ts");
		expect(uniquePath(["src/new-file.ts"], "src/new-file", ".ts")).toBe("src/new-file-2.ts");
		expect(uniquePath(["src/new-file.ts", "src/new-file-2.ts"], "src/new-file", ".ts")).toBe("src/new-file-3.ts");
		expect(uniquePath(["src/new-folder/"], "src/new-folder", "/")).toBe("src/new-folder-2/");
	});
});
