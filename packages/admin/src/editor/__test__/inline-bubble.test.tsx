import { defineBlock } from "@monti-cms/core";
import { charEffectByName } from "@monti-cms/core/code-block";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { CmsAdminComponentsProvider, type EditorMarkExtension } from "../../admin-components";
import { renderWithSite } from "../../test/site";
import { addedMarkName, createAddedMark } from "../added-marks";
import { buildEditorExtensions } from "../extensions";
import { BubbleButton, InlineBubble } from "../inline-bubble";
import { inlineBubbleTarget } from "../inline-marks";
import { editorMessages } from "../messages";

const t = testSite.createTranslator(editorMessages);

/**
 * Text decoration used for testing regardless of site config (the `:note[text]{text="…"}` an extension adds). Adds the mark to the editor directly and
 * registers the bubble button and content via `marks` of `CmsAdminComponentsProvider`.
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

vi.mock("../../ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => (render ? React.cloneElement(render, {}, children ?? render.props.children) : children),
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const editors: Editor[] = [];
afterEach(() => {
	cleanup();
	for (const editor of editors.splice(0)) {
		const element = editor.view.dom.parentElement;
		editor.destroy();
		element?.remove();
	}
});

const createEditor = (html: string) => {
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({
		element,
		extensions: [...buildEditorExtensions(testSite), createAddedMark(noteBlock, { inclusive: true })],
		content: html,
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
const HTML =
	'<p>가나 <strong>다라</strong> <a href="https://example.com">마바</a> <span data-cms-mark="note" data-mark-text="설명">사아</span> 자</p><pre><code>code</code></pre>';

describe("inlineBubbleTarget", () => {
	it("shows the selection tool when text is selected", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection({ from: 1, to: 3 });
		expect(inlineBubbleTarget(editor.state)).toEqual({ kind: "selection", from: 1, to: 3 });
	});

	it("returns the effect and its range when the cursor is inside or at the end of an effect", () => {
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
			marks: [{ name: NOTE_MARK, from: 10, to: 12, attrs: { text: "설명" } }],
		});
	});

	it("does not show for a cursor outside any effect, a code block being edited as source, or a selection spanning code blocks", () => {
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

	it("shows the effect tool when text is selected and applies immediately", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		expect(toolbar).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineMarks.italic") })));
		expect(editor.isActive("italic")).toBe(true);
		expect(screen.getByRole("button", { name: t("inlineMarks.italic") }).getAttribute("aria-pressed")).toBe("true");
	});

	it("does not show when the editor has no focus", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection({ from: 1, to: 3 });
		renderBubble(editor);
		expect(screen.queryByRole("toolbar")).toBeNull();
	});

	it("removes the whole effect with the remove button when the cursor is inside it", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 5);
		renderBubble(editor);

		act(() =>
			fireEvent.click(screen.getByRole("button", { name: t("markText.remove", { name: t("inlineMarks.bold") }) })),
		);
		expect(editor.getHTML()).not.toContain("<strong>");
		expect(editor.state.selection.from).toBe(5);
	});

	it("shows the address inside a link and edits it with the form in the bubble", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 8);
		renderBubble(editor);

		expect(screen.getByRole("link", { name: "https://example.com" })).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		const input = screen.getByLabelText(t("link.href")) as HTMLInputElement;
		expect(input.value).toBe("https://example.com");
		act(() => fireEvent.change(input, { target: { value: "https://changed.dev" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("popoverForm.apply") })));

		expect(editor.getHTML()).toContain('href="https://changed.dev/"');
		expect(editor.getHTML()).toContain(">마바</a>");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("the unlink button removes only the link and keeps the text", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 8);
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.remove") })));
		expect(editor.getHTML()).not.toContain("<a");
		expect(editor.getText()).toContain("마바");
	});

	it("an extension text decoration renders its registered bubble button, content and input", () => {
		const extension: EditorMarkExtension = {
			bubble: {
				group: "link",
				order: -1,
				Button: ({ editor: current, openPanel, closePanel }) => (
					<BubbleButton
						label="메모 넣기"
						onClick={() =>
							openPanel({
								label: "메모 편집",
								content: (
									<button
										type="button"
										onClick={() => {
											current.chain().setMark(NOTE_MARK, { text: "새 메모" }).run();
											closePanel();
										}}
									>
										메모 적용
									</button>
								),
							})
						}
					>
						메모
					</BubbleButton>
				),
			},
			detail: ({ mark, act, editor: current }) => (
				<>
					<span>{String(mark.attrs.text)}</span>
					<BubbleButton
						label="메모 해제"
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
				<CmsAdminComponentsProvider components={{ marks: { [noteBlock.name]: extension } }}>
					<InlineBubble editor={editor} />
				</CmsAdminComponentsProvider>,
			);

		// When text is selected, the registered button comes before the link button (`order: -1`).
		focusAt(editor, { from: 1, to: 3 });
		const { unmount } = renderWith();
		const labels = [
			...screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") }).querySelectorAll("button"),
		].map((button) => button.getAttribute("aria-label"));
		expect(labels.indexOf("메모 넣기")).toBe(labels.indexOf(t("link.add")) - 1);
		act(() => fireEvent.click(screen.getByRole("button", { name: "메모 넣기" })));
		expect(screen.getByRole("dialog", { name: "메모 편집" })).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: "메모 적용" })));
		expect(editor.getHTML()).toMatch(/<span data-cms-mark="note" data-mark-text="새 메모">가나<\/span>/);
		unmount();

		// With the cursor at the decoration boundary, the registered content renders, and removing does not close the bubble.
		focusAt(editor, 10);
		renderWith();
		expect(screen.getByText("설명")).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: "메모 해제" })));
		expect(editor.getHTML()).not.toContain('data-mark-text="설명"');
	});

	it("adds a link to the selected text from the bubble", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.add") })));
		act(() => fireEvent.change(screen.getByLabelText(t("link.href")), { target: { value: "/posts/hello" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("popoverForm.apply") })));
		expect(editor.getHTML()).toMatch(/<a [^>]*href="\/posts\/hello"[^>]*>가나<\/a>/);
	});

	it("hides the effect bubble while typing and shows it again when the cursor moves", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 5);
		renderBubble(editor);
		expect(screen.getByRole("toolbar", { name: t("inlineBubble.effectLabel") })).toBeTruthy();

		act(() => {
			editor.commands.insertContent("x");
		});
		expect(screen.queryByRole("toolbar")).toBeNull();

		act(() => {
			editor.commands.setTextSelection(5);
		});
		expect(screen.getByRole("toolbar", { name: t("inlineBubble.effectLabel") })).toBeTruthy();
	});

	it("in a code block, shows only the effects code accepts and text folding", () => {
		const editor = createEditor("<pre><code>call(a, b)</code></pre>");
		focusAt(editor, { from: 6, to: 10 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		const labels = [...toolbar.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
		expect(labels).toContain(t("inlineBubble.fold"));
		// Code does not accept a link.
		expect(labels).not.toContain(t("link.add"));

		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineBubble.fold") })));
		expect(editor.getHTML()).toMatch(/call\(<span data-code-fold=""[^>]*>a, b<\/span>\)/);
	});

	it("sets unfold and open options at the cursor next to a code fold", () => {
		const editor = createEditor("<pre><code>call(a, b)</code></pre>");
		editor.chain().setTextSelection({ from: 6, to: 10 }).setMark("codeFold").run();
		focusAt(editor, 6);
		renderBubble(editor);

		expect(screen.getByRole("toolbar", { name: t("inlineBubble.effectLabel") })).toBeTruthy();
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

	it("for a fold made by a regex rule, the whole rule can be removed or individual effects unfolded", () => {
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
		).toBeTruthy();

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
		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineBubble.ruleDelete") })));
		expect(editor.state.doc.child(0).attrs.rules).toEqual([]);
	});
});
