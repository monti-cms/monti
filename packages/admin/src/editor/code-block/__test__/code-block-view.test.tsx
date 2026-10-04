import { createTranslator } from "@monti-cms/core/client";
import { CODE_LINE_EFFECTS, type CodeLineEffect, type CodeRule } from "@monti-cms/core/code-block";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { findBlockDOM, refineBlock } from "../../drag";
import { buildEditorExtensions } from "../../extensions";
import { inlineBubbleTarget } from "../../inline-marks";
import { mdxToTiptap, tiptapToMdx } from "../../tiptap-content";
import { codeBlockMessages } from "../messages";

const t = createTranslator(codeBlockMessages);
/** 강조 효과 이름(효과 정의에서 온다). */
const HIGHLIGHT_LABEL = CODE_LINE_EFFECTS.find((effect) => effect.name === "highlight")?.label ?? "";

afterEach(cleanup);

// jsdom에는 글자 범위의 좌표가 없다. 커서를 옮긴 뒤 ProseMirror가 위치를 잴 때 쓴다.
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

const mount = async (source: string) => {
	let editor: Editor | null = null;
	render(
		<Harness
			source={source}
			onReady={(ready) => {
				editor = ready;
			}}
		/>,
	);
	await waitFor(() => expect(document.querySelector("[data-code-block-wrapper]")).not.toBeNull());
	return editor as unknown as Editor;
};

const block = (editor: Editor) => editor.state.doc.child(0);
const gutterRow = (line: number) => document.querySelector(`[data-code-gutter] [data-line="${line}"]`) as HTMLElement;
const gutterLines = () =>
	[...document.querySelectorAll("[data-code-gutter] [data-line]")].map((row) => Number(row.getAttribute("data-line")));

/** 줄 번호를 눌러(끌어) 줄을 고른다. */
const pickLines = (from: number, to = from) => {
	fireEvent.mouseDown(gutterRow(from), { button: 0 });
	if (to !== from) fireEvent.mouseEnter(gutterRow(to));
	fireEvent.mouseUp(window);
};

/** 줄 번호를 오른쪽 클릭해 줄 효과 메뉴를 연다. */
const openLineMenu = async (line = 0) => {
	await waitFor(() => expect(gutterRow(line)).toBeTruthy());
	act(() => {
		fireEvent.contextMenu(gutterRow(line));
	});
};

const CODE = "```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```";

describe("코드 블록 편집 화면", () => {
	it("머리 도구에 언어·파일 경로·줄 효과·정규식 규칙·줄 번호·복사가 있다", async () => {
		await mount(CODE);
		expect(screen.getByLabelText(t("view.language"))).toBeTruthy();
		expect(screen.getByLabelText(t("view.filePath"))).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.lineEffects") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("rulesPanel.title") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.lineNumbers") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.copy") })).toBeTruthy();
	});

	it("읽기 전용이면 언어·파일 경로·효과 도구를 숨기고 줄을 고르지 않는다", async () => {
		const editor = await mount('```ts title="src/a.ts"\nconst a = 1;\n```');
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByLabelText(t("view.language"))).toBeNull());
		expect(screen.queryByLabelText(t("view.filePath"))).toBeNull();
		expect(screen.queryByRole("button", { name: t("view.lineEffects") })).toBeNull();
		expect(screen.queryByRole("button", { name: t("rulesPanel.title") })).toBeNull();
		expect(screen.queryByRole("button", { name: t("view.lineNumbers") })).toBeNull();
		expect(screen.getByText("src/a.ts")).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.copy") })).toBeTruthy();
		await openLineMenu(0);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("파일 경로와 줄 번호 표시는 meta로 저장한다", async () => {
		const editor = await mount(CODE);
		fireEvent.change(screen.getByLabelText(t("view.filePath")), { target: { value: "src/a.ts" } });
		await waitFor(() => expect((screen.getByLabelText(t("view.filePath")) as HTMLInputElement).value).toBe("src/a.ts"));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("view.lineNumbers") })));
		await waitFor(() => expect(block(editor).attrs.meta).toBe('title="src/a.ts" lnum'));
	});

	it("줄 번호를 누르면 줄만 고르고, 오른쪽 클릭으로 연 메뉴에서 강조를 켜면 저장 형식에 반영된다", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(1));
		expect(screen.queryByRole("menu")).toBeNull();
		// 글자는 고르지 않고(커서만 그 줄 앞) 줄 배경으로 보인다.
		expect(editor.state.selection.empty).toBe(true);
		expect(editor.state.selection.from).toBe(1 + "const a = 1;\n".length);
		await waitFor(() =>
			expect(document.querySelectorAll("[data-code-block-wrapper] .bg-cms-primary\\/15")).toHaveLength(1),
		);
		await openLineMenu(1);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.lineEffects", { line: 2 }) });
		act(() => fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: HIGHLIGHT_LABEL })));

		const effects = block(editor).attrs.lineEffects as CodeLineEffect[];
		expect(effects.map(({ name, start, end }) => [name, start, end])).toEqual([["highlight", 1, 2]]);
		await waitFor(() =>
			expect(within(menu).getByRole("menuitemcheckbox", { name: HIGHLIGHT_LABEL }).getAttribute("aria-checked")).toBe(
				"true",
			),
		);
		expect(tiptapToMdx(editor.getJSON())).toContain("// @line highlight {1-1}\nconst b = 2;");
		// 효과를 바꿔도 고른 줄은 그대로다(이어서 다른 효과를 켤 수 있다).
		await waitFor(() =>
			expect(document.querySelectorAll("[data-code-block-wrapper] .bg-cms-primary\\/15")).toHaveLength(1),
		);
	});

	it("여러 줄을 끌어 고르고 접으면 첫 줄만 남고, 화살표로 편집 중에도 여닫는다", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0, 2));
		// 고른 줄 안에서 오른쪽 클릭하면 고른 줄 전체가 대상이다.
		await openLineMenu(1);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.rangeEffects", { start: 1, end: 3 }) });
		act(() => fireEvent.click(within(menu).getByRole("menuitem", { name: t("lineMenu.collapse") })));

		expect((block(editor).attrs.lineEffects as CodeLineEffect[])[0]).toMatchObject({
			name: "collapse",
			start: 0,
			end: 3,
		});
		expect(tiptapToMdx(editor.getJSON())).toContain("// @line collapse {0-2}");
		// 접기를 만든 뒤 커서가 접힌 줄에 있으면 펼쳐 둔다. 화살표로 접는다.
		const toggle = await screen.findByRole("button", {
			name: new RegExp(`^(${t("view.collapseFrom", { line: 1 })}|${t("view.expandFrom", { line: 1 })})$`),
		});
		if (toggle.getAttribute("aria-expanded") === "true") act(() => fireEvent.mouseDown(toggle));
		await waitFor(() => expect(gutterLines()).toEqual([0]));
		const expand = await screen.findByRole("button", { name: t("view.expandFrom", { line: 1 }) });
		act(() => fireEvent.mouseDown(expand));
		await waitFor(() => expect(gutterLines()).toEqual([0, 1, 2]));
	});

	it("정규식 규칙을 더하면 맞는 곳 수를 보이고 규칙 그대로 저장한다", async () => {
		const editor = await mount(CODE);
		act(() => fireEvent.click(screen.getByRole("button", { name: t("rulesPanel.title") })));
		const add = await screen.findByRole("button", { name: t("rulesPanel.add") });
		act(() => fireEvent.click(add));
		fireEvent.change(await screen.findByLabelText(t("rulesPanel.pattern")), { target: { value: "const" } });
		expect(await screen.findByText(t("rulesPanel.matches", { count: 3 }))).toBeTruthy();

		const rules = block(editor).attrs.rules as CodeRule[];
		expect(rules[0]).toMatchObject({ scope: "document", name: "fold", pattern: "const", flags: "g" });
		expect(tiptapToMdx(editor.getJSON())).toContain("// @document fold {re:/const/g}");
	});

	it("에디터가 나타낼 수 없는 주석이 있으면 원문 편집으로 알린다", async () => {
		await mount('```ts\n// @char Tooltip {0-3} content="하나"\n// @char Tooltip {2-5} content="둘"\nabcdef\n```');
		expect(screen.getByText(t("view.rawMode"))).toBeTruthy();
		expect(screen.queryByRole("button", { name: t("rulesPanel.title") })).toBeNull();
	});

	it("복사 버튼은 주석 줄을 뺀 코드를 복사한다", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		await mount("```ts\n// @line plus\nconst a = 1;\n```");
		await act(async () => fireEvent.click(screen.getByRole("button", { name: t("view.copy") })));
		expect(writeText).toHaveBeenCalledWith("const a = 1;");
	});

	it("Shift를 누르고 줄 번호를 누르면 고른 줄을 늘린다", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0));
		act(() => {
			fireEvent.mouseDown(gutterRow(2), { button: 0, shiftKey: true });
			fireEvent.mouseUp(window);
		});
		await openLineMenu(2);
		expect(await screen.findByRole("menu", { name: t("lineMenu.rangeEffects", { start: 1, end: 3 }) })).toBeTruthy();
		expect(editor.state.selection.from).toBe(1);
	});

	it("접기 첫 줄(› 줄)만 골라도 접기 해제와 처음부터 펼치기가 나온다", async () => {
		const editor = await mount("```ts\n// @line collapse {0-2}\na\nb\nc\nd\n```");
		// 줄을 먼저 고르지 않아도 오른쪽 클릭한 줄이 대상이다.
		await openLineMenu(0);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.lineEffects", { line: 1 }) });
		expect(within(menu).getByRole("menuitemcheckbox", { name: t("lineMenu.openFromStart") })).toBeTruthy();
		act(() => fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(t("lineMenu.uncollapse")) })));
		await waitFor(() => expect(block(editor).attrs.lineEffects).toEqual([]));
	});

	it("코드 줄을 가리켜도 드래그 핸들은 코드 블록 전체에 하나만 붙는다", async () => {
		const editor = await mount(`문단\n\n${CODE}`);
		const text = document.querySelector("[data-code-block-wrapper] pre code") as HTMLElement;
		const inner = (text.querySelector("span") ?? text) as HTMLElement;
		const found = findBlockDOM(editor.view.dom, inner);
		expect(found?.classList.contains("node-codeBlock")).toBe(true);
		expect(found && refineBlock(found, 0, 0)).toBe(found);
	});

	it("줄 번호로 줄을 고르는 동안에는 글자 효과 버블을 띄우지 않는다", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0, 1));
		expect(inlineBubbleTarget(editor.state)).toBeNull();
		// 글자를 직접 고르면 다시 띄운다.
		act(() => {
			editor.commands.setTextSelection({ from: 2, to: 5 });
		});
		expect(inlineBubbleTarget(editor.state)).toMatchObject({ kind: "selection" });
	});

	it("경고 물결 밑줄은 줄 전체에 한 번 긋고, 줄 번호로 고른 줄은 줄 배경으로 보인다", async () => {
		await mount("```ts\n// @line warning\nconst a = 1;\nconst b = 2;\n```");
		const underline = document.querySelector("[data-code-block-wrapper] .decoration-wavy");
		expect(underline?.textContent).toBe("const a = 1;");
		expect(document.querySelectorAll("[data-code-block-wrapper] .decoration-wavy")).toHaveLength(1);

		act(() => pickLines(1));
		await waitFor(() =>
			expect(document.querySelector("[data-code-block-wrapper] pre")?.className).toContain("caret-transparent"),
		);
		expect(document.querySelectorAll("[data-code-block-wrapper] .bg-cms-primary\\/15")).toHaveLength(1);
	});
});
