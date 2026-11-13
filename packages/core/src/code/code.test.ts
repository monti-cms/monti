import { describe, expect, it } from "vitest";
import { checkDoc, createBlockKit } from "../body/blocks";
import type { Block, Doc } from "../body/doc";
import { type CreateElement, renderDocument } from "../render";
import { siteDoc } from "../translations/source";
import { codeHighlighter } from "./highlight";
import { brokenCodeRefs } from "./links";
import { readFence, writeFence } from "./notation";
import { codeBlockSettings } from "./settings";
import { type LineEffect, moveLineEffects } from "./shape";

const html: CreateElement<string> = (type, props, ...children) => {
	const attrs = Object.entries(props ?? {})
		.filter(([name, value]) => name !== "key" && value !== undefined && value !== null)
		.map(([name, value]) =>
			typeof value === "object"
				? ` ${name}="${Object.entries(value as object)
						.map(([key, each]) => `${key}:${each}`)
						.join(";")}"`
				: ` ${name}="${value}"`,
		)
		.join("");
	return `<${type}${attrs}>${children.flat(Infinity).join("")}</${type}>`;
};

const code = (text: string, attrs: Record<string, unknown> = {}, id = "b_code"): Block => ({
	id,
	type: "codeBlock",
	attrs: { language: "ts", ...attrs },
	content: [{ type: "text", text }],
});
const doc = (...blocks: Block[]): Doc => ({ type: "doc", blocks });
const kit = createBlockKit([], []);
const SIX = "a\nb\nc\nd\ne\nf";

describe("code block shape", () => {
	it("17-1 a code block keeps its language, file name, line numbers, line effects, rules and marks in code", () => {
		const block: Block = {
			...code(SIX, {
				title: "src/app.ts",
				lineNumbers: true,
				lines: [
					{ name: "plus", start: 1, end: 3 },
					{ name: "collapse", start: 2, end: 5, attrs: { open: true } },
					{ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } },
				],
				rules: [{ scope: "document", name: "codeTip", pattern: "b", flags: "g", attrs: { text: "bee" } }],
			}),
			content: [
				{ type: "text", text: "a\n" },
				{ type: "text", text: "b", marks: [{ type: "bold" }, { type: "codeTip", text: "bee" }] },
				{ type: "text", text: "\nc\nd\ne\nf" },
			],
		};
		expect(checkDoc(doc(block), kit, null)).toEqual([]);
	});

	it("17-1 a save refuses lines outside the code, crossing folds, a label twice, a bad regex and other marks in code", () => {
		const problems = (attrs: Record<string, unknown>, content?: Block["content"]) =>
			checkDoc(doc({ ...code(SIX, attrs), ...(content ? { content } : {}) }), kit, null).map((each) => each.code);
		expect(problems({ lines: [{ name: "plus", start: 4, end: 7 }] })).toEqual(["badBlock"]);
		expect(
			problems({
				lines: [
					{ name: "collapse", start: 0, end: 3 },
					{ name: "collapse", start: 2, end: 5 },
				],
			}),
		).toEqual(["badBlock"]);
		expect(
			problems({
				lines: [
					{ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } },
					{ name: "anchor", start: 2, end: 3, attrs: { id: "c1" } },
				],
			}),
		).toEqual(["badBlock"]);
		expect(problems({ rules: [{ scope: "document", name: "bold", pattern: "(", flags: "g" }] })).toEqual(["badBlock"]);
		expect(problems({}, [{ type: "text", text: SIX, marks: [{ type: "link", href: "https://x.dev" }] }])).toEqual([
			"badBlock",
		]);
		// A code block's own marks stay in code.
		expect(
			checkDoc(
				doc({
					id: "p",
					type: "paragraph",
					content: [{ type: "text", text: "x", marks: [{ type: "codeTip", text: "t" }] }],
				}),
				kit,
				null,
			).map((each) => each.code),
		).toEqual(["badMark"]);
	});
});

describe("17-2 line effects follow the lines", () => {
	const effect = (start: number, end: number): LineEffect => ({ name: "plus", start, end });
	const move = (effects: LineEffect[], from: number, to: number, inserted: string) =>
		moveLineEffects(effects, SIX, from, to, inserted).map(({ start, end }) => [start, end]);
	// SIX: a(0) \n b(2) \n c(4) \n d(6) \n e(8) \n f(10)

	it("17-2 a line put in above moves the effect down; typing inside a line moves nothing", () => {
		expect(move([effect(2, 4)], 0, 0, "x\n")).toEqual([[3, 5]]);
		expect(move([effect(2, 4)], 4, 4, "zz")).toEqual([[2, 4]]);
	});

	it("17-2 Enter at the start of a line takes its effect down with it; at its end it stays", () => {
		expect(move([effect(2, 3)], 4, 4, "\n")).toEqual([[3, 4]]);
		expect(move([effect(2, 3)], 5, 5, "\n")).toEqual([[2, 3]]);
	});

	it("17-2 lines put in inside an effect widen it; lines taken out shrink it", () => {
		expect(move([effect(1, 4)], 5, 5, "\nx\ny")).toEqual([[1, 6]]);
		// Taking out lines c and d whole (from the start of c to the start of e).
		expect(move([effect(1, 5)], 4, 8, "")).toEqual([[1, 3]]);
	});

	it("17-2 an effect whose lines are all taken out is gone", () => {
		expect(move([effect(2, 4)], 4, 8, "")).toEqual([]);
		expect(move([effect(5, 6)], 9, 11, "")).toEqual([[4, 5]]);
	});
});

describe("17-3 the site's code block settings", () => {
	it("17-3 a site's languages, tools and effects replace and add to the core's", () => {
		const settings = codeBlockSettings({
			languages: ["ts", "zig"],
			tools: { rules: false },
			omitLineEffects: ["focus"],
			lineEffects: [{ name: "info", label: "정보", class: "line-info", editor: { tone: "neutral", marker: "i" } }],
		});
		expect(settings.languages).toEqual(["ts", "zig"]);
		expect(settings.tools).toMatchObject({ rules: false, fold: true, links: true });
		expect(settings.lineEffects.map((each) => [each.name, each.offered])).toEqual([
			["highlight", true],
			["focus", false],
			["plus", true],
			["minus", true],
			["warning", true],
			["error", true],
			["info", true],
		]);
		expect(() => codeBlockSettings({ lineEffects: [{ name: "collapse", label: "x" }] })).toThrow();
	});
});

describe("17-4 colours", () => {
	it("17-4 the highlighter colours with the site's two themes and leaves a language it did not load plain", async () => {
		const colors = await codeHighlighter({ languages: ["ts"], themes: { light: "github-light", dark: "github-dark" } });
		const [line] = colors.lines("const a = 1;", "ts");
		expect(line.length).toBeGreaterThan(1);
		expect(line[0]).toMatchObject({ text: "const", light: expect.any(String), dark: expect.any(String) });
		expect(colors.has("python")).toBe(false);
		expect(colors.lines("x = 1", "python")).toEqual([[{ text: "x = 1" }]]);
	});
});

describe("17-9 the site's code block", () => {
	it("17-9 a code block draws its file name, copy button, lines, effects, labels and folds", () => {
		const out = renderDocument(
			doc(
				code("a\nb\nc\nd", {
					title: "src/app.ts",
					lineNumbers: true,
					lines: [
						{ name: "plus", start: 0, end: 1 },
						{ name: "collapse", start: 1, end: 3 },
						{ name: "anchor", start: 3, end: 4, attrs: { id: "c1" } },
					],
				}),
			),
			{ createElement: html, locale: "ko" },
		).join("");
		expect(out).toContain("<figcaption>src/app.ts</figcaption>");
		expect(out).toContain('<button type="button" data-code-copy="" data-copied="복사함">복사</button>');
		expect(out).toContain('data-line-numbers=""');
		expect(out).toContain('<span className="line" data-line="1" data-effect="plus">a</span>');
		expect(out).toContain(
			'<details data-code-collapse=""><summary><span className="line" data-line="2">b</span></summary>',
		);
		expect(out).toContain('id="code-b_code-c1"');
	});

	it("17-9 marks and rules in code become styles, folds and tooltips with a list of notes", () => {
		const block: Block = {
			...code("let useA = useB;", {
				rules: [{ scope: "document", name: "codeTip", pattern: "use\\w", flags: "g", attrs: { text: "hook" } }],
			}),
			content: [
				{ type: "text", text: "let", marks: [{ type: "bold" }] },
				{ type: "text", text: " useA = " },
				{ type: "text", text: "useB", marks: [{ type: "codeFold" }] },
				{ type: "text", text: ";" },
			],
		};
		const out = renderDocument(doc(block), { createElement: html }).join("");
		expect(out).toContain("<strong>let</strong>");
		expect(out).toContain('data-code-tip="hook"');
		expect(out).toContain('<span data-code-fold=""><button type="button" data-code-ui="" aria-label="…">…</button>');
		expect(out).toContain('<ol data-code-notes=""><li data-note="1">hook</li><li data-note="2">hook</li></ol>');
	});

	it("17-9 with the site's highlighter each piece carries both theme colours", async () => {
		const colors = await codeHighlighter({ languages: ["ts"] });
		const out = renderDocument(doc(code("const a = 1;")), { createElement: html, code: colors }).join("");
		expect(out).toMatch(/style="--shiki-light:#[0-9a-fA-F]+;--shiki-dark:#[0-9a-fA-F]+">const/);
	});
});

describe("code links", () => {
	const linked = (anchor: string, block = "b_code"): Block => ({
		id: "p1",
		type: "paragraph",
		content: [{ type: "text", text: "see here", marks: [{ type: "codeRef", block, anchor }] }],
	});
	const labelled = code("a\nb", { lines: [{ name: "anchor", start: 1, end: 2, attrs: { id: "c1" } }] });

	it("17-8 a link to a label the body has goes to its lines; one to nothing is broken and drawn as words", () => {
		expect(brokenCodeRefs(doc(linked("c1"), labelled))).toEqual([]);
		expect(brokenCodeRefs(doc(linked("c2"), labelled))).toEqual([
			{ block: "p1", ref: { block: "b_code", anchor: "c2" } },
		]);
		expect(brokenCodeRefs(doc(linked("c1", "b_gone"), labelled))).toHaveLength(1);
		expect(renderDocument(doc(linked("c1"), labelled), { createElement: html }).join("")).toContain(
			'<a href="#code-b_code-c1" data-code-ref="b_code c1">see here</a>',
		);
		expect(renderDocument(doc(linked("c2"), labelled), { createElement: html }).join("")).toContain("<p>see here</p>");
	});

	it("17-8 a translation's link named after the source's code block goes to the block the translation draws", () => {
		const translation = doc(
			{ ...linked("c1"), link: { from: "p1src", seen: "", state: "translated" } },
			{ ...labelled, id: "b_tr", link: { from: "b_code", seen: "", state: "keepSource" } },
		);
		expect(brokenCodeRefs(translation)).toEqual([]);
		const drawn = siteDoc(translation, null);
		expect(brokenCodeRefs(drawn)).toEqual([]);
		expect(renderDocument(drawn, { createElement: html }).join("")).toContain('href="#code-b_tr-c1"');
	});
});

describe("17-10 notation in MDX", () => {
	it("17-10 Shiki's notation becomes line effects and comes out of the code", () => {
		const read = readFence({
			lang: "ts",
			meta: 'title="src/app.ts" showLineNumbers {1,3}',
			value: [
				"const a = 1; // [!code ++]",
				"const b = 2; // [!code --]",
				"// [!code highlight:2]",
				"const c = 3;",
				"const d = 4; // [!code focus] [!code error]",
				"// [!code word:useState]",
			].join("\n"),
		});
		expect(read.content).toEqual([{ type: "text", text: "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;" }]);
		expect(read.attrs).toEqual({
			language: "ts",
			title: "src/app.ts",
			lineNumbers: true,
			meta: "{1,3}",
			lines: [
				{ name: "plus", start: 0, end: 1 },
				{ name: "minus", start: 1, end: 2 },
				{ name: "highlight", start: 2, end: 4 },
				{ name: "focus", start: 3, end: 4 },
				{ name: "error", start: 3, end: 4 },
			],
			rules: [{ scope: "document", name: "bold", pattern: "useState", flags: "g" }],
		});
	});

	it("17-10 the old Monti comments are read, in the language's own comment syntax too", () => {
		const read = readFence({
			lang: "py",
			value: [
				'# @document Tooltip {re:/use\\w+/g} content="hook"',
				"# @line collapse {0-1} open",
				"def a():",
				"    # @char strong {4-10}",
				"    return 1",
			].join("\n"),
		});
		expect(read.attrs.lines).toEqual([{ name: "collapse", start: 0, end: 2, attrs: { open: true } }]);
		expect(read.attrs.rules).toEqual([
			{ scope: "document", name: "codeTip", pattern: "use\\w+", flags: "g", attrs: { text: "hook" } },
		]);
		expect(read.content).toEqual([
			{ type: "text", text: "def a():\n    " },
			{ type: "text", text: "return", marks: [{ type: "bold" }] },
			{ type: "text", text: " 1" },
		]);
	});

	it("17-10 what is written reads back to the same block", () => {
		const block = {
			attrs: {
				language: "ts",
				title: "a.ts",
				lines: [
					{ name: "plus", start: 0, end: 2 },
					{ name: "highlight", start: 0, end: 1 },
					{ name: "collapse", start: 2, end: 4 },
					{ name: "anchor", start: 3, end: 4, attrs: { id: "c1" } },
					{ name: "minus", start: 4, end: 5 },
				],
				rules: [
					{ scope: "document", name: "codeTip", pattern: "a/b", flags: "g", attrs: { text: "slash" } },
					{ scope: "line", line: 1, name: "italic", pattern: "x", flags: "g" },
				],
			},
			content: [
				{ type: "text", text: "one\ntwo x\n" },
				{ type: "text", text: "three", marks: [{ type: "codeFold", open: true }] },
				{ type: "text", text: "\nfour\n" },
			] as Block["content"],
		};
		const fence = writeFence(block);
		expect(fence.value).toContain("one // [!code ++:2] [!code highlight]");
		expect(fence.value).toContain('// @line anchor {0-0} id="c1"');
		const read = readFence({ lang: fence.lang, meta: fence.meta, value: fence.value });
		expect(read.content).toEqual(block.content);
		expect(read.attrs.title).toBe("a.ts");
		const sorted = (lines: unknown) =>
			[...(lines as LineEffect[])].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
		expect(sorted(read.attrs.lines)).toEqual(sorted(block.attrs.lines));
		expect(read.attrs.rules).toEqual(block.attrs.rules);
	});
});
