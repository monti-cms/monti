import { defineBlock } from "@monti-cms/core";
import { createTranslator } from "@monti-cms/core/client";
import { charEffectByName } from "@monti-cms/core/code-block";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, type EditorMarkExtension } from "../../admin-components";
import { addedMarkName, createAddedMark } from "../added-marks";
import { buildEditorExtensions } from "../extensions";
import { BubbleButton, InlineBubble } from "../inline-bubble";
import { inlineBubbleTarget } from "../inline-marks";
import { editorMessages } from "../messages";

const t = createTranslator(editorMessages);

/**
 * 사이트 설정과 상관없이 시험하는 글자 꾸밈(확장이 더하는 `:note[글]{text="…"}`). 편집기에 마크를 직접 더하고
 * `CmsAdminComponentsProvider`의 `marks`로 버블 버튼·내용을 등록한다.
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
		extensions: [...buildEditorExtensions(), createAddedMark(noteBlock, { inclusive: true })],
		content: html,
	});
	editors.push(editor);
	return editor;
};

/** Tiptap의 focus 명령은 다음 프레임에 초점을 준다. 테스트에서는 바로 준다. */
const focusAt = (editor: Editor, position: number | { from: number; to: number }) => {
	editor.commands.setTextSelection(position);
	editor.view.focus();
};

// 위치: 가나(1–3) 굵게 다라(4–6) 링크 마바(7–9) 메모 꾸밈 사아(10–12)
const HTML =
	'<p>가나 <strong>다라</strong> <a href="https://example.com">마바</a> <span data-cms-mark="note" data-mark-text="설명">사아</span> 자</p><pre><code>code</code></pre>';

describe("inlineBubbleTarget", () => {
	it("글자를 고르면 선택 도구를 띄운다", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection({ from: 1, to: 3 });
		expect(inlineBubbleTarget(editor.state)).toEqual({ kind: "selection", from: 1, to: 3 });
	});

	it("커서가 효과 안이나 끝에 있으면 그 효과와 범위를 돌려준다", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection(5);
		expect(inlineBubbleTarget(editor.state)).toMatchObject({
			kind: "marks",
			marks: [{ name: "bold", from: 4, to: 6 }],
		});
		// 링크 끝(경계)에 둔 커서도 링크로 본다.
		editor.commands.setTextSelection(9);
		expect(inlineBubbleTarget(editor.state)).toMatchObject({
			kind: "marks",
			marks: [{ name: "link", from: 7, to: 9, attrs: { href: "https://example.com" } }],
		});
		// 확장 꾸밈 시작(경계)에 둔 커서도 그 꾸밈으로 본다(확장이 내용을 그리는 꾸밈만).
		editor.commands.setTextSelection(10);
		expect(inlineBubbleTarget(editor.state)).toBeNull();
		expect(inlineBubbleTarget(editor.state, [NOTE_MARK])).toMatchObject({
			kind: "marks",
			marks: [{ name: NOTE_MARK, from: 10, to: 12, attrs: { text: "설명" } }],
		});
	});

	it("효과 없는 곳의 커서, 원문 편집 중인 코드 블록, 코드 블록을 넘나드는 선택에는 띄우지 않는다", () => {
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
	const renderBubble = (editor: Editor) => render(<InlineBubble editor={editor} />);

	it("글자를 고르면 효과 도구가 뜨고 바로 적용된다", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		expect(toolbar).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineMarks.italic") })));
		expect(editor.isActive("italic")).toBe(true);
		expect(screen.getByRole("button", { name: t("inlineMarks.italic") }).getAttribute("aria-pressed")).toBe("true");
	});

	it("편집기에 초점이 없으면 띄우지 않는다", () => {
		const editor = createEditor(HTML);
		editor.commands.setTextSelection({ from: 1, to: 3 });
		renderBubble(editor);
		expect(screen.queryByRole("toolbar")).toBeNull();
	});

	it("커서를 효과 안에 두면 해제 버튼으로 그 효과 전체를 지운다", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 5);
		renderBubble(editor);

		act(() =>
			fireEvent.click(screen.getByRole("button", { name: t("markText.remove", { name: t("inlineMarks.bold") }) })),
		);
		expect(editor.getHTML()).not.toContain("<strong>");
		expect(editor.state.selection.from).toBe(5);
	});

	it("링크 안에서 주소를 보이고, 버블 안 폼으로 주소를 고친다", () => {
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

	it("링크 해제 버튼은 링크만 지우고 글자는 남긴다", () => {
		const editor = createEditor(HTML);
		focusAt(editor, 8);
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.remove") })));
		expect(editor.getHTML()).not.toContain("<a");
		expect(editor.getText()).toContain("마바");
	});

	it("확장의 글자 꾸밈은 등록한 버블 버튼·내용·입력 칸을 그린다", () => {
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
			render(
				<CmsAdminComponentsProvider components={{ marks: { [noteBlock.name]: extension } }}>
					<InlineBubble editor={editor} />
				</CmsAdminComponentsProvider>,
			);

		// 글자를 고르면 등록한 버튼이 링크 앞(`order: -1`)에 온다.
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

		// 커서가 꾸밈 경계에 있으면 등록한 내용을 그리고, 해제는 버블을 닫지 않는다.
		focusAt(editor, 10);
		renderWith();
		expect(screen.getByText("설명")).toBeTruthy();
		act(() => fireEvent.click(screen.getByRole("button", { name: "메모 해제" })));
		expect(editor.getHTML()).not.toContain('data-mark-text="설명"');
	});

	it("선택한 글자에 버블에서 링크를 넣는다", () => {
		const editor = createEditor(HTML);
		focusAt(editor, { from: 1, to: 3 });
		renderBubble(editor);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.add") })));
		act(() => fireEvent.change(screen.getByLabelText(t("link.href")), { target: { value: "/posts/hello" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("popoverForm.apply") })));
		expect(editor.getHTML()).toMatch(/<a [^>]*href="\/posts\/hello"[^>]*>가나<\/a>/);
	});

	it("글자를 입력하는 동안에는 효과 버블을 숨기고, 커서를 옮기면 다시 보인다", () => {
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

	it("코드 블록에서는 코드가 받는 효과와 글자 접기만 보인다", () => {
		const editor = createEditor("<pre><code>call(a, b)</code></pre>");
		focusAt(editor, { from: 6, to: 10 });
		renderBubble(editor);

		const toolbar = screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") });
		const labels = [...toolbar.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
		expect(labels).toEqual([
			t("inlineMarks.bold"),
			t("inlineMarks.italic"),
			t("inlineMarks.underline"),
			t("inlineMarks.strike"),
			t("inlineBubble.tooltipAdd"),
			t("inlineBubble.fold"),
		]);

		act(() => fireEvent.click(screen.getByRole("button", { name: t("inlineBubble.fold") })));
		expect(editor.getHTML()).toMatch(/call\(<span data-code-fold=""[^>]*>a, b<\/span>\)/);
	});

	it("코드의 글자 접기 옆 커서에서 해제·열림 설정을 한다", () => {
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

	it("정규식 규칙으로 접은 곳에서는 규칙째 지우거나 개별 효과로 풀 수 있다", () => {
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
