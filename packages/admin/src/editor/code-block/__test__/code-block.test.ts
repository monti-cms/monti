import type { CodeLineEffect, CodeRule } from "@monti-cms/core/code-block";
import { storedCodeBlockAttrs, storedCodeBlockFence } from "@monti-cms/core/document";
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

/** Code text with annotation comments -> the stored code block -> editor -> stored code block -> code text with annotation comments. */
const load = (value: string, language = "ts") =>
	codeBlockConverter.toTiptap(
		{ type: "codeBlock", attrs: storedCodeBlockAttrs({ language, meta: "", value }) },
		dummyCtx,
	);
const save = (node: JSONContent) => storedCodeBlockFence(codeBlockConverter.toCms(node, dummyCtx)[0]?.attrs ?? {});

/** Loads a stored value into a real editor (goes through the schema and getJSON). */
const mountValue = (value: string, language = "ts") => {
	editor = new Editor({
		extensions: buildEditorExtensions(),
		content: { type: "doc", content: [load(value, language)] },
	});
	return editor;
};
const blockJson = (instance: Editor) => instance.getJSON().content?.[0] ?? {};

describe("code block: keyboard handling and IME exclusion", () => {
	it("does not intercept key events during IME composition and passes them to the browser", () => {
		const instance = createTestEditor();
		const view = instance.view;

		const fakeComposingEvent = { isComposing: true, keyCode: 229 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeComposingEvent)).toBe(true);

		const fakeNonComposingEvent = { isComposing: false, keyCode: 13 } as unknown as KeyboardEvent;
		expect(isComposing(view, fakeNonComposingEvent)).toBe(false);

		// Returns false when run during IME composition
		expect(handleEnterKey(view, fakeComposingEvent)).toBe(false);
		expect(handleTabKey(view, fakeComposingEvent, false)).toBe(false);
		expect(handleModAKey(view, fakeComposingEvent)).toBe(false);
	});

	it("Tab: inserts a tab character at a single cursor position", () => {
		const instance = createTestEditor("hello");
		const view = instance.view;

		// Cursor placed after 'hello' (pos: 6)
		instance.commands.setTextSelection(6);

		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		const handled = handleTabKey(view, tabEvent, false);

		expect(handled).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("hello\t");
	});

	it("Tab/Shift-Tab: indents and outdents when multiple lines are selected", () => {
		const multiline = "line1\nline2\nline3";
		const instance = createTestEditor(multiline);
		const view = instance.view;

		// Select from line1 to line2 (pos 1 to pos 12)
		instance.commands.setTextSelection({ from: 1, to: 12 });

		// Tab indent
		const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
		expect(handleTabKey(view, tabEvent, false)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("\tline1\n\tline2\nline3");

		// Shift-Tab outdent
		const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true });
		expect(handleTabKey(view, shiftTabEvent, true)).toBe(true);
		expect(instance.state.doc.child(0).textContent).toBe("line1\nline2\nline3");
	});

	it("Enter: keeps the current line's indentation on the next line", () => {
		const indented = "\t\tconst x = 10;";
		const instance = createTestEditor(indented);
		const view = instance.view;

		// Move the cursor to the end of the line
		instance.commands.setTextSelection(indented.length + 1);

		const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
		expect(handleEnterKey(view, enterEvent)).toBe(true);

		expect(instance.state.doc.child(0).textContent).toBe("\t\tconst x = 10;\n\t\t");
	});

	it("Mod-a: selects everything inside the code block without including the document outside it", () => {
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

		// Move the cursor into the code block
		// Size of the top paragraph: 1(open) + 4("상단 문단") + 1(close) = 6
		// Code block start pos: 7, text start: 8, text end: 15
		editor.commands.setTextSelection(9);

		const modAEvent = new KeyboardEvent("keydown", { key: "a", metaKey: true });
		expect(handleModAKey(view, modAEvent)).toBe(true);

		const { from, to } = editor.state.selection;
		expect(from).toBe(8);
		expect(to).toBe(15);
		expect(editor.state.doc.textBetween(from, to, "\n")).toBe("코드1\n코드2");
	});

	it("Paste: normalizes \\r\\n to \\n and pastes as plain text only", () => {
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

describe("code block storage format (comment syntax) <-> editor", () => {
	it("plain code without comments round-trips byte for byte", () => {
		const raw = "const greeting = 'hello world';\nconsole.log(greeting);\n";
		const node = codeBlockConverter.toTiptap(
			{ type: "codeBlock", attrs: { language: "ts", meta: 'title="hello.ts"', code: raw } },
			dummyCtx,
		);
		expect(node.attrs?.lineEffects).toEqual([]);
		expect(node.attrs?.rules).toEqual([]);
		const [saved] = codeBlockConverter.toCms(node, dummyCtx);
		expect(saved?.attrs).toEqual({ language: "ts", meta: 'title="hello.ts"', code: raw });
	});

	it("reads line effects (collapse, add, highlight) as line ranges and saves the stored code block as it was when unchanged", () => {
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
			["plus", 1, 2],
			["highlight", 3, 4],
		]);
		// Unchanged, the code block comes back as the stored code block it was loaded from, annotations and all.
		expect(codeBlockConverter.toCms(blockJson(instance), dummyCtx)[0]?.attrs).toEqual(
			storedCodeBlockAttrs({ language: "ts", meta: "", value: raw }),
		);
	});

	it("reads char effects as marks on the code text (including tooltip content and expanded char collapse)", () => {
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

	it("saves newly added char effects as line-based range comments", () => {
		const instance = createTestEditor("abc\nconst item = 1;");
		instance.chain().setTextSelection({ from: 5, to: 10 }).toggleBold().run();
		instance.chain().setTextSelection({ from: 11, to: 15 }).setMark("codeTooltip", { content: "변수명" }).run();
		expect(save(blockJson(instance))).toBe(
			["abc", "// @char strong {0-4}", '// @char Tooltip {6-9} content="변수명"', "const item = 1;"].join("\n"),
		);
	});

	it("saves line effects as line-range comments, and a line collapse that starts expanded as open", () => {
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

	it("reads and saves regex rules as the rule itself, not the matched positions (even after the code is edited)", () => {
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
		// Places found by a rule are not turned into marks.
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

	it("saves with the new language's comment syntax when the language changes", () => {
		const node = load("// @char u {0-2}\nabc");
		const saved = save({ ...node, attrs: { ...node.attrs, language: "python" } });
		expect(saved).toBe("# @char u {0-2}\nabc");
	});

	it("opens in raw editing and preserves the original when the same effect overlaps with a different description, since it cannot be represented", () => {
		const raw = ['// @char Tooltip {0-3} content="하나"', '// @char Tooltip {2-5} content="둘"', "abcdef"].join("\n");
		const node = load(raw);
		expect(node.attrs?.rawMode).toBe(true);
		expect(node.content?.[0]?.text).toBe(raw);
		expect(save(node)).toBe(raw);
	});

	it("preserves explicit false and unknown properties in meta even after the title is edited", async () => {
		const { parseMeta, formatMeta } = await import("../meta");
		const parsed = parseMeta('title="a.ts" focus=false lnum=false');
		expect(parsed.showLineNumbers).toBe(false);
		const formatted = formatMeta({ title: "b.ts", showLineNumbers: parsed.showLineNumbers, raw: parsed.raw });
		expect(formatted).toContain("focus=false");
		expect(formatted).toContain("lnum=false");
	});
});

describe("line effects and line rules follow the text when the code is edited", () => {
	const withEffects = (code: string, lineEffects: CodeLineEffect[], rules: CodeRule[] = []) =>
		createTestEditor(code, { lineEffects, rules });
	const effectsOf = (instance: Editor) =>
		(instance.state.doc.child(0).attrs.lineEffects as CodeLineEffect[]).map(({ name, start, end }) => [
			name,
			start,
			end,
		]);

	it("inserting a line before an effect line pushes it down", () => {
		const instance = withEffects("a\nb\nc", [{ id: "1", name: "highlight", start: 1, end: 3, attrs: {} }]);
		instance.commands.insertContentAt(1, "x\n");
		expect(effectsOf(instance)).toEqual([["highlight", 2, 4]]);
	});

	it("splitting a line inside a range extends the range", () => {
		const instance = withEffects("a\nbc\nd", [{ id: "1", name: "collapse", start: 0, end: 2, attrs: {} }]);
		instance.commands.insertContentAt(4, "\n");
		expect(effectsOf(instance)).toEqual([["collapse", 0, 3]]);
	});

	it("deleting all effect lines removes the effect", () => {
		const instance = withEffects("a\nbb\nc", [{ id: "1", name: "plus", start: 1, end: 2, attrs: {} }]);
		instance.commands.deleteRange({ from: 3, to: 6 });
		expect(instance.state.doc.child(0).textContent).toBe("a\nc");
		expect(effectsOf(instance)).toEqual([]);
	});

	it("single-line rule's line number follows too", () => {
		const rule: CodeRule = { id: "r", scope: "char", name: "fold", pattern: "b", flags: "", line: 1, attrs: {} };
		const instance = withEffects("a\nb", [], [rule]);
		instance.commands.insertContentAt(1, "x\n");
		expect((instance.state.doc.child(0).attrs.rules as CodeRule[])[0]?.line).toBe(2);
	});
});

describe("collapse: shown collapsed in the editor too, and expands when the cursor enters", () => {
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

	it("line collapse keeps only the first line and hides the rest; stays expanded if open", () => {
		const closed = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse()] });
		expect(hiddenDecorations(closed).map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 9]]);
		closed.destroy();
		const open = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse(true)] });
		expect(hiddenDecorations(open)).toHaveLength(0);
	});

	it("expands when the cursor enters a collapsed line, and moves the cursor to the end of the first line when collapsed", () => {
		const instance = createTestEditor("head\nb\nc\nd", { lineEffects: [collapse()] });
		instance.view.dispatch(instance.state.tr.setSelection(TextSelection.create(instance.state.doc, 7)));
		expect(regionsOf(instance)[0]?.open).toBe(true);

		const region = regionsOf(instance)[0];
		if (!region) throw new Error("region");
		setFoldOpen(instance.view, region, false);
		expect(regionsOf(instance)[0]?.open).toBe(false);
		expect(instance.state.selection.head).toBe(5);
	});

	it("char collapse (marks and regex rules) stays expanded in the editor and is hidden when collapsed", () => {
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

describe("code block syntax highlighting", () => {
	it("lazy-loaded shiki syntax highlighting produces dual theme decorations without changing the text", async () => {
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

		// Highlighting decorations do not pollute the text body (plain text)
		const instance = createTestEditor(code, { language: "ts" });
		expect(instance.state.doc.child(0).textContent).toBe(code);
	});

	it("adds the Shiki token offset of multi-line code only once to decorate the second line", async () => {
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

describe("storage fingerprint", () => {
	it("saves the original text as is when only the line effect order changes", () => {
		const raw = ["// @line highlight {0-0}", "a", "// @line plus {1-1}", "b"].join("\n");
		const node = load(raw);
		const effects = node.attrs?.lineEffects as CodeLineEffect[];
		expect(save({ ...node, attrs: { ...node.attrs, lineEffects: [...effects].reverse() } })).toBe(raw);
	});
});
