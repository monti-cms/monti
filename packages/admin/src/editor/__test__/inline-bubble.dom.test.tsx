import { defineBlock } from "@monti-cms/core";
import { charEffectByName } from "@monti-cms/core/code-block";
import type { CmsNode } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { AdminComponentsProvider, type EditorMarkExtension } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { renderWithSite } from "../../test/site";
import { para, storedDoc, text } from "../../test/stored-doc";
import { addedMarkName, createAddedMark } from "../added-marks";
import { buildEditorExtensions } from "../extensions";
import { BubbleButton, InlineBubble, runFormatItem } from "../inline-bubble";
import { inlineBubbleTarget } from "../inline-marks";
import { editorMessages } from "../messages";
import { storedToTiptap } from "../tiptap-content";

const ref = (label: string): CmsNode => ({ type: "footnoteReference", attrs: { label } });
const def = (label: string, ...content: CmsNode[]): CmsNode => ({
	type: "footnoteDefinition",
	attrs: { label },
	content,
});
const line = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });

const t = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);

/**
 * Text decoration used for testing regardless of site config (the `:note[text]{text="…"}` an extension adds). Adds the mark to the editor directly and
 * registers the bubble button and content via `marks` of `AdminComponentsProvider`.
 */
const noteBlock = defineBlock({
	name: "note",
	label: "메모",
	syntax: { kind: "text", directive: "note" },
	component: "Note",
	attributes: { text: { type: "string", label: "메모", required: true } },
	editor: { view: "mark" },
});
const NOTE_MARK = addedMarkName(noteBlock.name);
/** The names the test's own note extension gives its format, panel and buttons: test data, not the admin's dictionary. */
const NOTE = {
	add: "메모 넣기",
	edit: "메모 고치기",
	panel: "메모 편집",
	apply: "메모 적용",
	release: "메모 해제",
	text: "설명",
};

const editors: Editor[] = [];
afterEach(() => {
	cleanup();
	for (const editor of editors.splice(0)) {
		const element = editor.view.dom.parentElement;
		editor.destroy();
		element?.remove();
	}
});

const createEditor = (content: string | JSONContent) => {
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({
		element,
		extensions: [...buildEditorExtensions(testSite), createAddedMark(noteBlock, { inclusive: true })],
		content,
	});
	editors.push(editor);
	return editor;
};

/** Tiptap's focus command focuses on the next frame. In tests, focus immediately. */
const focusAt = (editor: Editor, position: number | { from: number; to: number }) => {
	editor.commands.setTextSelection(position);
	editor.view.focus();
};

// Positions: "가나" (1–3), bold "다라" (4–6), link "마바" (7–9), note decoration "사아" (10–12)
const HTML = `<p>가나 <strong>다라</strong> <a href="https://example.com">마바</a> <span data-monti-mark="note" data-mark-text="${NOTE.text}">사아</span> 자</p><pre><code>code</code></pre>`;

describe("inlineBubbleTarget", () => {
	it("EDIT-M1 returns the effect and its range when the cursor is inside or at the end of an effect", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection(5);
		expect(inlineBubbleTarget(editor.state)).toMatchObject({
			kind: "marks",
			marks: [{ name: "bold", from: 4, to: 6 }],
		});
		// A cursor at the link end (boundary) also counts as in the link.
		editor.commands.setTextSelection(9);
		expect(inlineBubbleTarget(editor.state)).toMatchObject({
			kind: "marks",
			marks: [{ name: "link", from: 7, to: 9, attrs: { href: "https://example.com" } }],
		});
		// A cursor at the start (boundary) of an extension decoration also counts as in it (only decorations whose content the extension renders).
		editor.commands.setTextSelection(10);
		expect(inlineBubbleTarget(editor.state)).toBeNull();
		expect(inlineBubbleTarget(editor.state, [NOTE_MARK])).toMatchObject({
			kind: "marks",
			marks: [{ name: NOTE_MARK, from: 10, to: 12, attrs: { text: NOTE.text } }],
		});
	});

	it("EDIT-M1 does not show for a cursor outside any effect, a code block being edited as source, or a selection spanning code blocks", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection(2);
		expect(inlineBubbleTarget(editor.state)).toBeNull();

		const codeStart = editor.state.doc.firstChild?.nodeSize ?? 0;
		editor.commands.setTextSelection({ from: codeStart + 1, to: codeStart + 3 });
		expect(inlineBubbleTarget(editor.state)).toMatchObject({ kind: "selection" });
		editor.commands.setTextSelection({ from: 2, to: codeStart + 3 });
		expect(inlineBubbleTarget(editor.state)).toBeNull();

		editor.commands.command(({ tr }) => {
			tr.setNodeMarkup(codeStart, undefined, { ...editor.state.doc.child(1).attrs, rawMode: true });
			return true;
		});
		editor.commands.setTextSelection({ from: codeStart + 1, to: codeStart + 3 });
		expect(inlineBubbleTarget(editor.state)).toBeNull();
	});
});

describe("InlineBubble", () => {
	const renderBubble = (editor: Editor) => renderWithSite(<InlineBubble editor={editor} />);

	it("EDIT-M1 shows the effect tool when text is selected and applies immediately", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		expect(toolbar).toBeInTheDocument();
		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineMarks.italic") })));
		expect(editor.isActive("italic")).toBe(true);
		expect(screen.getByRole("button", { name: t("inlineMarks.italic") }).getAttribute("aria-pressed")).toBe("true");
	});

	it("EDIT-M1 removes the whole effect with the remove button when the cursor is inside it", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 5);
		renderBubble(editor);

		act(() =>
			fireEvent.click(screen.getByRole("button", { name: t("markText.remove", { name: t("inlineMarks.bold") }) })),
		);
		expect(editor.getHTML()).not.toContain("<strong>");
		expect(editor.state.selection.from).toBe(5);
	});

	it("EDIT-L1 shows the address inside a link and edits it with the form in the bubble", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 8);
		renderBubble(editor);

		expect(screen.getByRole("link", { name: "https://example.com" })).toBeInTheDocument();
		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		const input = screen.getByLabelText(t("link.href")) as HTMLInputElement;
		expect(input.value).toBe("https://example.com");
		act(() => fireEvent.change(input, { target: { value: "https://changed.dev" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: tc("apply") })));

		expect(editor.getHTML()).toContain('href="https://changed.dev/"');
		expect(editor.getHTML()).toContain(">마바</a>");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("EDIT-L1 the unlink button removes only the link and keeps the text", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 8);
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.remove") })));
		expect(editor.getHTML()).not.toContain("<a");
		expect(editor.getText()).toContain("마바");
	});

	it("PLUG-A8 an extension text decoration lists its format under the ⋯, and renders its registered content and input", () => {
		const extension: EditorMarkExtension = {
			formatItems: [
				{
					id: "note",
					label: (current) => (current.isActive(NOTE_MARK) ? NOTE.edit : NOTE.add),
					isAvailable: ({ inCode }) => !inCode,
					isActive: (current) => current.isActive(NOTE_MARK),
					run: ({ editor: current, openPanel, closePanel }) =>
						openPanel({
							label: NOTE.panel,
							content: (
								<button
									type="button"
									onClick={() => {
										current.chain().setMark(NOTE_MARK, { text: "새 메모" }).run();
										closePanel();
									}}
								>
									{NOTE.apply}
								</button>
							),
						}),
				},
			],
			detail: ({ mark, act, editor: current }) => (
				<>
					<span>{String(mark.attrs.text)}</span>
					<BubbleButton
						label={NOTE.release}
						onClick={act(() => current.chain().setTextSelection(mark).unsetMark(NOTE_MARK).run())}
					>
						해제
					</BubbleButton>
				</>
			),
		};
		const editor = createEditor(HTML);
		const renderWith = () =>
			renderWithSite(
				<AdminComponentsProvider components={{ marks: { [noteBlock.name]: extension } }}>
					<InlineBubble editor={editor} />
				</AdminComponentsProvider>,
			);

		// When text is selected, the format sits under the ⋯: not a button of the card itself.
		focusAt(editor, { from: 1, to: 3 });
		const { unmount } = renderWith();
		const card = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		expect(within(card).queryByRole("button", { name: NOTE.add })).toBeNull();
		act(() => fireEvent.click(within(card).getByRole("button", { name: t("formatBar.more") })));
		act(() => fireEvent.click(screen.getByRole("menuitem", { name: NOTE.add })));
		expect(screen.getByRole("dialog", { name: NOTE.panel })).toBeInTheDocument();
		act(() => fireEvent.click(screen.getByRole("button", { name: NOTE.apply })));
		expect(editor.getHTML()).toMatch(/<span data-monti-mark="note" data-mark-text="새 메모">가나<\/span>/);
		unmount();

		// With the cursor at the decoration boundary, the registered content renders, and removing does not close the bubble.
		focusAt(editor, 10);
		renderWith();
		expect(screen.getByText(NOTE.text)).toBeInTheDocument();
		act(() => fireEvent.click(screen.getByRole("button", { name: NOTE.release })));
		expect(editor.getHTML()).not.toContain(`data-mark-text="${NOTE.text}"`);
	});

	describe("the ⋯ of the card (formats a site added)", () => {
		const noteFormat = {
			id: "note",
			label: "메모 넣기",
			isAvailable: ({ inCode }: { inCode: boolean }) => !inCode,
			isActive: (current: Editor) => current.isActive(NOTE_MARK),
			run: ({ editor: current }: { editor: Editor }) =>
				current.chain().focus().toggleMark(NOTE_MARK, { text: "메모" }).run(),
		};
		const renderWith = (editor: Editor, formats: EditorMarkExtension["formatItems"]) =>
			renderWithSite(
				<AdminComponentsProvider components={{ marks: { [noteBlock.name]: { formatItems: formats } } }}>
					<InlineBubble editor={editor} />
				</AdminComponentsProvider>,
			);

		it("PLUG-A8 runs a format by its id on the selection (what a slash item uses)", async () => {
			const editor = createEditor(HTML);
			focusAt(editor, { from: 1, to: 3 });
			renderWith(editor, [noteFormat]);
			act(() => runFormatItem("note"));
			await waitFor(() => expect(editor.getHTML()).toContain('data-monti-mark="note"'));
		});
	});

	it("EDIT-L1 adds a link to the selected text from the bubble", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.add") })));
		act(() => fireEvent.change(screen.getByLabelText(t("link.href")), { target: { value: "/posts/hello" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: tc("apply") })));
		expect(editor.getHTML()).toMatch(/<a [^>]*href="\/posts\/hello"[^>]*>가나<\/a>/);
	});

	it("EDIT-M2 in a code block, shows only the effects code accepts and text folding", () => {
		const editor = createEditor("<pre><code>call(a, b)</code></pre>");
		focusAt(editor, { from: 6, to: 10 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		// Code does not accept a link.
		expect(within(toolbar).queryByRole("button", { name: t("link.add") })).toBeNull();

		act(() => fireEvent.click(within(toolbar).getByRole("button", { name: t("inlineBubble.fold") })));
		expect(editor.getHTML()).toMatch(/call\(<span data-code-fold=""[^>]*>a, b<\/span>\)/);
	});

	it("EDIT-C2 sets unfold and open options at the cursor next to a code fold", () => {
		const editor = createEditor("<pre><code>call(a, b)</code></pre>");
		editor.chain().setTextSelection({ from: 6, to: 10 }).setMark("codeFold").run();
		focusAt(editor, 6);
		renderBubble(editor);

		expect(screen.getByRole("toolbar", { name: t("inlineBubble.effectLabel") })).toBeInTheDocument();
		const openByDefault = screen.getByRole("button", { name: t("inlineBubble.openByDefault") });
		expect(openByDefault.getAttribute("aria-pressed")).toBe("false");
		act(() => fireEvent.click(openByDefault));
		expect(editor.getHTML()).toContain('data-open="true"');
		expect(screen.getByRole("button", { name: t("inlineBubble.openByDefault") }).getAttribute("aria-pressed")).toBe(
			"true",
		);
		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineBubble.foldRemove") })));
		expect(editor.getHTML()).not.toContain("data-code-fold");
	});

	it("EDIT-C2 for a fold made by a regex rule, the whole rule can be removed or individual effects unfolded", () => {
		const rule = { id: "r", scope: "document", name: "fold", pattern: "b", flags: "g", attrs: {} };
		const editor = createEditor("<pre><code>abab</code></pre>");
		editor.commands.command(({ tr }) => {
			tr.setNodeMarkup(0, undefined, { ...editor.state.doc.child(0).attrs, rules: [rule] });
			return true;
		});
		focusAt(editor, 3);
		const { unmount } = renderBubble(editor);
		expect(
			screen.getByText(t("inlineBubble.ruleSummary", { label: charEffectByName("fold")?.label ?? "fold", count: 2 })),
		).toBeInTheDocument();

		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineBubble.ruleExpand") })));
		expect(editor.state.doc.child(0).attrs.rules).toEqual([]);
		expect(editor.getHTML().match(/data-code-fold/g)).toHaveLength(2);
		unmount();

		editor.commands.command(({ tr }) => {
			tr.setNodeMarkup(0, undefined, { ...editor.state.doc.child(0).attrs, rules: [rule] });
			return true;
		});
		editor.commands.unsetMark("codeFold", { extendEmptyMarkRange: true });
		focusAt(editor, 3);
		renderBubble(editor);
		const remove = screen.getByRole("button", { name: t("inlineBubble.ruleDelete") });
		act(() => fireEvent.click(remove));
		expect(editor.state.doc.child(0).attrs.rules).toEqual([]);
	});

	it("EDIT-F2 shows footnote preview bubble and allows editing in popup and removing footnote", () => {
		const doc = storedDoc(line(text("Hello"), ref("1")), def("1", para("Footnote description")));
		const editor = createEditor(storedToTiptap(testSite, doc));
		let refPos = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "footnoteReference") refPos = pos;
		});
		editor.commands.setNodeSelection(refPos);
		editor.view.focus();
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.footnoteTitle") });
		expect(toolbar).toBeInTheDocument();
		expect(within(toolbar).getByText("1")).toBeInTheDocument();
		expect(within(toolbar).getByText("Footnote description")).toBeInTheDocument();

		// Clicking edit opens the footnote editing popup
		act(() => fireEvent.click(within(toolbar).getByRole("button", { name: t("inlineBubble.footnoteEdit") })));
		const dialog = screen.getByRole("dialog", { name: t("inlineBubble.footnotePanel") });
		expect(dialog).toBeInTheDocument();

		// Textarea contains the current footnote description
		const textarea = within(dialog).getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toBe("Footnote description");

		// Edit the footnote description and apply
		act(() => fireEvent.change(textarea, { target: { value: "Updated footnote" } }));
		act(() => fireEvent.click(within(dialog).getByRole("button", { name: tc("apply") })));

		// Footnote definition in editor document is updated
		let defText = "";
		editor.state.doc.descendants((node) => {
			if (node.type.name === "footnoteDefinition") defText = node.textContent;
		});
		expect(defText).toBe("Updated footnote");

		// Removing the footnote
		act(() => {
			editor.commands.setNodeSelection(refPos);
			editor.view.focus();
		});
		const footnoteToolbar = screen.getByRole("toolbar", { name: t("inlineBubble.footnoteTitle") });
		act(() => fireEvent.click(within(footnoteToolbar).getByRole("button", { name: t("inlineBubble.footnoteRemove") })));
		let hasRef = false;
		editor.state.doc.descendants((node) => {
			if (node.type.name === "footnoteReference") hasRef = true;
		});
		expect(hasRef).toBe(false);
	});
});
