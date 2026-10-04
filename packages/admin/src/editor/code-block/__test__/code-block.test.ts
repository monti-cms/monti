import type { CodeLineEffect, CodeRule } from "@monti-cms/core/code-block";
import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codeBlockConverter } from "../../converters/code-block";
import type { ConverterContext } from "../../converters/types";
import { buildEditorExtensions } from "../../extensions";
import { codeEffectsKey, foldRegions, setFoldOpen } from "../effects-plugin";
import { codeBlockHighlightPluginKey, getShikiHighlighter } from "../highlight-plugin";
import { handleEnterKey, handleModAKey, handlePaste, handleTabKey, isComposing } from "../keys";

let editor: Editor | null = null;

const dummyCtx: ConverterContext = {
	blockToTiptap: () => ({}),
	tiptapBlockToCms: () => [],
	isMappableBlock: () => true,
	isMappableInline: () => true,
	inlineToTiptap: () => [],
	inlineToCms: () => [],
};

afterEach(() => {
	editor?.destroy();
	editor = null;
});

const createTestEditor = (code = "const a = 1;", attrs = {}) => {
	editor = new Editor({
		extensions: buildEditorExtensions(),
		content: {
			type: "doc",
			content: [
				{
					type: "codeBlock",
					attrs: { language: "ts", ...attrs },
					content: code.length > 0 ? [{ type: "text", text: code }] : [],
				},
			],
		},
	});
	return editor;
};

/** 저장 값(주석 포함) → 에디터 → 저장 값. */
const load = (value: string, language = "ts") =>
	codeBlockConverter.toTiptap({ type: "codeBlock", attrs: { language, value } }, dummyCtx);
const save = (node: JSONContent) => String(codeBlockConverter.toCms(node, dummyCtx)[0]?.attrs?.value);

/** 저장 값을 실제 에디터에 올린다(스키마·getJSON을 지난다). */
const mountValue = (value: string, language = "ts") => {
	editor = new Editor({
		extensions: buildEditorExtensions(),
		content: { type: "doc", content: [load(value, language)] },
	});
	return editor;
};
const blockJson = (instance: Editor) => instance.getJSON().content?.[0] ?? {};

describe("C5 코드 블록: 키보드 처리 및 IME 제외", () => {
	it("IME 조합 중에는 키 이벤트를 가로채지 않고 브라우저에 넘긴다", () => {
		const instance = createTestEditor();
		const view = instance.view;

		const fakeComposingEvent = { isComposing: true, keyCode: 229 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeComposingEvent)).toBe(true);

		const fakeNonComposingEvent = { isComposing: false, keyCode: 13 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeNonComposingEvent)).toBe(false);

		// IME 조합 중 실행 시 false 반환
		expect(handleEnterKey(view, fakeComposingEvent)).toBe(false);
		expect(handleTabKey(view, fakeComposingEvent, false)).toBe(false);
		expect(handleModAKey(view, fakeComposingEvent)).toBe(false);
	});

	it("Tab: 단일 커서 위치에서 탭 문자를 삽입한다", () => {
		const instance = createTestEditor("hello");
		const view = instance.view;

		// 'hello' 뒤(pos: 6)에 커서 위치
		instance.commands.setTextSelection(6);

		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		const handled = handleTabKey(view, tabEvent, false);

		expect(handled).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("hello\t");
	});

	it("Tab/Shift-Tab: 여러 줄 선택 시 들여쓰기와 내어쓰기를 수행한다", () => {
		const multiline = "line1\nline2\nline3";
		const instance = createTestEditor(multiline);
		const view = instance.view;

		// line1부터 line2까지 선택 (pos 1부터 pos 12까지)
		instance.commands.setTextSelection({ from: 1, to: 12 });

		// Tab 들여쓰기
		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		expect(handleTabKey(view, tabEvent, false)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("\tline1\n\tline2\nline3");

		// Shift-Tab 내어쓰기
		const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true });
		expect(handleTabKey(view, shiftTabEvent, true)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("line1\nline2\nline3");
	});

	it("Enter: 현재 줄의 들여쓰기를 다음 줄에도 유지한다", () => {
		const indented = "\t\tconst x = 10;";
		const instance = createTestEditor(indented);
		const view = instance.view;

		// 줄 끝으로 커서 이동
		instance.commands.setTextSelection(indented.length + 1);

		const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
		expect(handleEnterKey(view, enterEvent)).toBe(true);

		expect(instance.state.doc.child(0).textContent).toBe("\t\tconst x = 10;\n\t\t");
	});

	it("Mod-a: 코드 블록 밖의 문서를 포함하지 않고 코드 블록 안만 전체 선택한다", () => {
		editor = new Editor({
			extensions: buildEditorExtensions(),
			content: {
				type: "doc",
				content: [
					{ type: "paragraph", content: [{ type: "text", text: "상단 문단" }] },
					{ type: "codeBlock", content: [{ type: "text", text: "코드1\n코드2" }] },
					{ type: "paragraph", content: [{ type: "text", text: "하단 문단" }] },
				],
			},
		});
		const view = editor.view;

		// 코드 블록 내부로 커서 이동
		// 상단 문단 크기: 1(open) + 4("상단 문단") + 1(close) = 6
		// 코드 블록 시작 pos: 7, 텍스트 시작: 8, 텍스트 끝: 15
		editor.commands.setTextSelection(9);

		const modAEvent = new KeyboardEvent("keydown", { key: "a", metaKey: true });
		expect(handleModAKey(view, modAEvent)).toBe(true);

		const { from, to } = editor.state.selection;
		expect(from).toBe(8);
		expect(to).toBe(15);
		expect(editor.state.doc.textBetween(from, to, "\n")).toBe("코드1\n코드2");
	});

	it("Paste: \\r\\n을 \\n으로 정규화하고 서식 없는 텍스트로만 붙여넣는다", () => {
		const instance = createTestEditor("");
		const view = instance.view;

		instance.commands.setTextSelection(1);

		const clipboardData = {
			getData: (type: string) => {
				if (type === "text/plain") return "line1\r\nline2\r\nline3";
				if (type === "text/html") return "<b>line1</b><p>line2</p>";
				return "";
			},
		};

		const pasteEvent = new Event("paste") as ClipboardEvent;
		Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });

		expect(handlePaste(view, pasteEvent)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("line1\nline2\nline3");
	});
});

describe("코드 블록 저장 형식(주석 문법) ↔ 에디터", () => {
	it("주석 없는 일반 코드는 왕복해도 바이트가 그대로다", () => {
		const raw = "const greeting = 'hello world';\nconsole.log(greeting);\n";
		const node = codeBlockConverter.toTiptap(
			{ type: "codeBlock", attrs: { language: "ts", meta: 'title="hello.ts"', value: raw } },
			dummyCtx,
		);
		expect(node.attrs?.lineEffects).toEqual([]);
		expect(node.attrs?.rules).toEqual([]);
		const [saved] = codeBlockConverter.toCms(node, dummyCtx);
		expect(saved?.attrs).toEqual({ language: "ts", meta: 'title="hello.ts"', value: raw });
	});

	it("줄 효과(접기·추가·강조)를 줄 범위로 읽고, 고치지 않으면 원문 그대로 저장한다", () => {
		const raw = [
			"// @line collapse",
			"function secret() {",
			"// @line plus",
			"  return 42;",
			"}",
			"// @line collapse end",
			"// @line highlight {3-3}",
			"secret();",
		].join("\n");
		const instance = mountValue(raw);
		const block = instance.state.doc.child(0);
		expect(block.textContent).toBe("function secret() {\n  return 42;\n}\nsecret();");
		expect((block.attrs.lineEffects as CodeLineEffect[]).map(({ name, start, end }) => [name, start, end])).toEqual([
			["collapse", 0, 3],
			["highlight", 3, 4],
			["plus", 1, 2],
		]);
		expect(save(blockJson(instance))).toBe(raw);
	});

	it("글자 효과를 코드 텍스트의 마크로 읽는다(툴팁 설명·글자 접기 펼침 포함)", () => {
		const raw = [
			"// @char u {0-4}",
			'// @char Tooltip {6-9} content="안내 문구"',
			"// @char strong {13-15}",
			"const test = 100;",
			"// @char fold {6-9} open",
			"print(a, b);",
		].join("\n");
		const instance = mountValue(raw);
		const html = instance.getHTML();
		expect(instance.state.doc.child(0).textContent).toBe("const test = 100;\nprint(a, b);");
		expect(html).toContain("<u>const</u>");
		expect(html).toMatch(/<span data-code-tooltip="안내 문구"[^>]*>test<\/span>/);
		expect(html).toContain("<strong>100</strong>");
		expect(html).toMatch(/<span data-open="true" data-code-fold=""[^>]*>a, b<\/span>/);
		expect(save(blockJson(instance))).toBe(raw);
	});

	it("새로 준 글자 효과는 줄 기준 범위의 주석으로 저장한다", () => {
		const instance = createTestEditor("abc\nconst item = 1;");
		instance.chain().setTextSelection({ from: 5, to: 10 }).toggleBold().run();
		instance.chain().setTextSelection({ from: 11, to: 15 }).setMark("codeTooltip", { content: "변수명" }).run();
		expect(save(blockJson(instance))).toBe(
			["abc", "// @char strong {0-4}", '// @char Tooltip {6-9} content="변수명"', "const item = 1;"].join("\n"),
		);
	});

	it("줄 효과는 줄 범위 주석으로, 줄 접기의 처음부터 펼침은 open으로 저장한다", () => {
		const instance = createTestEditor("a\nb\nc");
		const lineEffects: CodeLineEffect[] = [
			{ id: "1", name: "collapse", start: 0, end: 3, attrs: { open: true } },
			{ id: "2", name: "minus", start: 1, end: 2, attrs: {} },
		];
		instance.commands.command(({ tr }) => {
			tr.setNodeMarkup(0, undefined, { ...instance.state.doc.child(0).attrs, lineEffects });
			return true;
		});
		expect(save(blockJson(instance))).toBe(
			["// @line collapse {0-2} open", "a", "// @line minus {1-1}", "b", "c"].join("\n"),
		);
	});

	it("정규식 규칙은 찾은 위치가 아니라 규칙 그대로 읽고 저장한다(코드를 고친 뒤에도)", () => {
		const raw = [
			"// @document fold {re:/import .*/}",
			"import a from 'a';",
			'// @char Tooltip {re:/b{2}/g} content="두 개"',
			"const bb = 'bb';",
		].join("\n");
		const instance = mountValue(raw);
		const rules = instance.state.doc.child(0).attrs.rules as CodeRule[];
		expect(rules.map(({ scope, name, pattern, flags, line }) => [scope, name, pattern, flags, line])).toEqual([
			["document", "fold", "import .*", "", undefined],
			["char", "Tooltip", "b{2}", "g", 1],
		]);
		// 규칙이 찾은 곳은 마크로 바꾸지 않는다.
		expect(instance.getHTML()).not.toContain("data-code-fold");

		instance.commands.insertContentAt(instance.state.doc.child(0).nodeSize - 1, "\nimport c from 'c';");
		expect(save(blockJson(instance))).toBe(
			[
				"// @document fold {re:/import .*/}",
				"import a from 'a';",
				'// @char Tooltip {re:/b{2}/g} content="두 개"',
				"const bb = 'bb';",
				"import c from 'c';",
			].join("\n"),
		);
	});

	it("언어를 바꾸면 새 언어의 주석 문법으로 저장한다", () => {
		const node = load("// @char u {0-2}\nabc");
		const saved = save({ ...node, attrs: { ...node.attrs, language: "python" } });
		expect(saved).toBe("# @char u {0-2}\nabc");
	});

	it("같은 효과가 설명만 달리 겹치면 나타낼 수 없어 원문 편집으로 열고 원문을 지킨다", () => {
		const raw = ['// @char Tooltip {0-3} content="하나"', '// @char Tooltip {2-5} content="둘"', "abcdef"].join("\n");
		const node = load(raw);
		expect(node.attrs?.rawMode).toBe(true);
		expect(node.content?.[0]?.text).toBe(raw);
		expect(save(node)).toBe(raw);
	});

	it("meta의 명시적 false와 알 수 없는 속성을 제목 수정 후에도 보존한다", async () => {
		const { parseMeta, formatMeta } = await import("../meta");
		const parsed = parseMeta('title="a.ts" focus=false lnum=false');
		expect(parsed.showLineNumbers).toBe(false);
		const formatted = formatMeta({ title: "b.ts", showLineNumbers: parsed.showLineNumbers, raw: parsed.raw });
		expect(formatted).toContain("focus=false");
		expect(formatted).toContain("lnum=false");
	});
});

describe("코드를 고치면 줄 효과·줄 규칙이 글자를 따라간다", () => {
	const withEffects = (code: string, lineEffects: CodeLineEffect[], rules: CodeRule[] = []) =>
		createTestEditor(code, { lineEffects, rules });
	const effectsOf = (instance: Editor) =>
		(instance.state.doc.child(0).attrs.lineEffects as CodeLineEffect[]).map(({ name, start, end }) => [
			name,
			start,
			end,
		]);

	it("효과 줄 앞에 줄을 넣으면 아래로 밀린다", () => {
		const instance = withEffects("a\nb\nc", [{ id: "1", name: "highlight", start: 1, end: 3, attrs: {} }]);
		instance.commands.insertContentAt(1, "x\n");
		expect(effectsOf(instance)).toEqual([["highlight", 2, 4]]);
	});

	it("범위 안에서 줄을 나누면 범위가 늘어난다", () => {
		const instance = withEffects("a\nbc\nd", [{ id: "1", name: "collapse", start: 0, end: 2, attrs: {} }]);
		instance.commands.insertContentAt(4, "\n");
		expect(effectsOf(instance)).toEqual([["collapse", 0, 3]]);
	});

	it("효과 줄을 모두 지우면 효과도 사라진다", () => {
		const instance = withEffects("a\nbb\nc", [{ id: "1", name: "plus", start: 1, end: 2, attrs: {} }]);
		instance.commands.deleteRange({ from: 3, to: 6 });
		expect(instance.state.doc.child(0).textContent).toBe("a\nc");
		expect(effectsOf(instance)).toEqual([]);
	});

	it("한 줄 규칙의 줄 번호도 따라간다", () => {
		const rule: CodeRule = { id: "r", scope: "char", name: "fold", pattern: "b", flags: "", line: 1, attrs: {} };
		const instance = withEffects("a\nb", [], [rule]);
		instance.commands.insertContentAt(1, "x\n");
		expect((instance.state.doc.child(0).attrs.rules as CodeRule[])[0]?.line).toBe(2);
	});
});

describe("접기: 에디터에서도 접어 보이고 커서가 들어가면 펼친다", () => {
	const collapse = (open = false): CodeLineEffect => ({
		id: "c",
		name: "collapse",
		start: 0,
		end: 3,
		attrs: open ? { open: true } : {},
	});
	const regionsOf = (instance: Editor) =>
		foldRegions(instance.state.doc.child(0), 0, codeEffectsKey.getState(instance.state)?.overrides ?? new Map());
	const hiddenDecorations = (instance: Editor) => {
		const plugin = codeEffectsKey.get(instance.state);
		const set = plugin?.props.decorations?.call(plugin, instance.state) as DecorationSet;
		return set
			.find()
			.filter(
				(decoration) =>
					(decoration as unknown as { type: { attrs?: { class?: string } } }).type.attrs?.class === "hidden",
			);
	};

	it("줄 접기는 첫 줄만 남기고 나머지 줄을 숨긴다. open이면 펼쳐 둔다", () => {
		const closed = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse()] });
		expect(hiddenDecorations(closed).map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 9]]);
		closed.destroy();
		const open = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse(true)] });
		expect(hiddenDecorations(open)).toHaveLength(0);
	});

	it("커서가 접힌 줄로 들어가면 펼치고, 접으면 커서를 첫 줄 끝으로 옮긴다", () => {
		const instance = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse()] });
		instance.view.dispatch(instance.state.tr.setSelection(TextSelection.create(instance.state.doc, 7)));
		expect(regionsOf(instance)[0]?.open).toBe(true);

		const region = regionsOf(instance)[0];
		if (!region) throw new Error("region");
		setFoldOpen(instance.view, region, false);
		expect(regionsOf(instance)[0]?.open).toBe(false);
		expect(instance.state.selection.head).toBe(5);
	});

	it("글자 접기(마크·정규식 규칙)는 에디터에서 펼쳐 두고, 접으면 숨긴다", () => {
		const rule: CodeRule = { id: "r", scope: "document", name: "fold", pattern: "\\(.*\\)", flags: "", attrs: {} };
		const instance = createTestEditor("f(a, b)", { rules: [rule] });
		instance.chain().setTextSelection({ from: 1, to: 2 }).setMark("codeFold", { open: false }).run();
		expect(hiddenDecorations(instance)).toHaveLength(0);

		for (const region of regionsOf(instance)) setFoldOpen(instance.view, region, false);
		expect(hiddenDecorations(instance).map((decoration) => [decoration.from, decoration.to])).toEqual([
			[1, 2],
			[2, 8],
		]);
	});
});

describe("코드 블록 구문 하이라이팅", () => {
	it("shiki 지연 로드 및 구문 하이라이팅이 텍스트 변경 없이 dual theme 데코레이션을 생성한다", async () => {
		const highlighter = await getShikiHighlighter();
		expect(highlighter).toBeDefined();

		const code = "const message: string = 'hello';";
		const tokens = highlighter.codeToTokensWithThemes(code, {
			lang: "typescript",
			themes: {
				light: "one-light",
				dark: "one-dark-pro",
			},
		});

		expect(tokens.length).toBeGreaterThan(0);
		const firstToken = tokens[0]?.[0];
		expect(firstToken?.content).toBe("const");
		expect(firstToken?.variants?.light?.color).toBeDefined();
		expect(firstToken?.variants?.dark?.color).toBeDefined();

		// 하이라이팅 데코레이션이 텍스트 본문(순수 텍스트)을 오염시키지 않는다
		const instance = createTestEditor(code, { language: "ts" });
		expect(instance.state.doc.child(0).textContent).toBe(code);
	});

	it("여러 줄 코드의 Shiki 토큰 오프셋을 한 번만 더해 둘째 줄에 데코레이션한다", async () => {
		const code = "const a = 1;\nconst b = 2;";
		const instance = createTestEditor(code, { language: "ts" });
		await vi.waitFor(() => {
			const plugin = codeBlockHighlightPluginKey.get(instance.state);
			const decorations = plugin?.props.decorations?.call(plugin, instance.state) as DecorationSet | undefined;
			const secondConst = decorations
				?.find(14, 19)
				.find((decoration) => decoration.from === 14 && decoration.to === 19);
			expect(secondConst).toBeDefined();
		});
	});
});

describe("저장 지문", () => {
	it("줄 효과 순서만 바뀌면 원문 그대로 저장한다", () => {
		const raw = ["// @line highlight {0-0}", "a", "// @line plus {1-1}", "b"].join("\n");
		const node = load(raw);
		const effects = node.attrs?.lineEffects as CodeLineEffect[];
		expect(save({ ...node, attrs: { ...node.attrs, lineEffects: [...effects].reverse() } })).toBe(raw);
	});
});
