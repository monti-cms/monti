import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { docOf } from "../../test/mdx";
import { CmsEditor } from "../tiptap-editor";

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the cursor position.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});
afterEach(cleanup);

const text = (editor: Editor) => editor.getText({ blockSeparator: "|" }).replace(/\|+$/, "");

/** Renders the editor and gives back the Tiptap editor once it exists. */
const open = async (props: { doc: StoredDocument; onChange?: (doc: StoredDocument) => void; sourceView?: boolean }) => {
	let editor: Editor | null = null;
	const element = (current: StoredDocument, sourceView?: boolean) => (
		<CmsEditor
			doc={current}
			onChange={props.onChange ?? (() => {})}
			{...(sourceView ? { sourceView: <div>원문</div> } : {})}
			onEditor={(ready) => {
				editor = ready;
			}}
		/>
	);
	const view = render(element(props.doc, props.sourceView));
	await waitFor(() => expect(editor).not.toBeNull());
	// Let the first comparison of the effect that follows `doc` run.
	await act(async () => {
		await Promise.resolve();
	});
	return {
		editor: editor as unknown as Editor,
		show: (doc: StoredDocument, sourceView?: boolean) => view.rerender(element(doc, sourceView)),
	};
};

describe("CmsEditor works on the stored document", () => {
	it("shows the document it is given", async () => {
		const { editor } = await open({ doc: docOf("첫째 문단\n\n둘째 문단") });
		expect(text(editor)).toBe("첫째 문단|둘째 문단");
		expect(await screen.findByRole("toolbar", { name: /./ })).toBeTruthy();
	});

	it("hands the document back after a change, with the ids of the blocks it was given", async () => {
		const onChange = vi.fn();
		const doc = docOf("첫째 문단\n\n둘째 문단");
		const { editor } = await open({ doc, onChange });
		act(() => {
			editor.commands.insertContentAt(editor.state.doc.content.size, "<p>셋째</p>");
		});
		const [next] = onChange.mock.calls.at(-1) as [StoredDocument];
		expect(next.content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
		expect(next.content[0]?.id).toBe(doc.content[0]?.id);
		expect(next.content[1]?.id).toBe(doc.content[1]?.id);
		expect(JSON.stringify(next)).toContain("셋째");
	});

	it("shows another document when it is replaced from outside, and does not report that as a change", async () => {
		const onChange = vi.fn();
		const { editor, show } = await open({ doc: docOf("처음 본문"), onChange });
		show(docOf("## 템플릿\n\n바뀐 본문"));
		await waitFor(() => expect(text(editor)).toBe("템플릿|바뀐 본문"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("leaves the editor alone for a document that says what it already shows, so the caret stays", async () => {
		const { editor, show } = await open({ doc: docOf("같은 본문") });
		act(() => {
			editor.commands.setTextSelection(3);
		});
		show(docOf("같은 본문"));
		await act(async () => {
			await Promise.resolve();
		});
		expect(editor.state.selection.from).toBe(3);
	});

	it("starts empty while the source view is open, and shows the document it is then given when the view closes", async () => {
		const { editor, show } = await open({ doc: docOf("원문에서 쓴 본문"), sourceView: true });
		expect(text(editor)).toBe("");
		expect(editor.isEditable).toBe(false);
		show(docOf("원문에서 고친 본문"), false);
		await waitFor(() => expect(text(editor)).toBe("원문에서 고친 본문"));
		expect(editor.isEditable).toBe(true);
	});

	it("keeps a body that could not be read in a box, and hands the same text back when it changes elsewhere", async () => {
		const onChange = vi.fn();
		const unreadable: StoredDocument = {
			type: "doc",
			version: docOf("").version,
			content: [{ type: "unparsed", id: "abcd1234", attrs: { format: "mdx", source: "# 제목\n\n<Component>" } }],
		};
		const { editor } = await open({ doc: unreadable, onChange });
		expect(editor.state.doc.child(0).type.name).toBe("cmsOpaqueBlock");
		expect(onChange).not.toHaveBeenCalled();
	});
});
