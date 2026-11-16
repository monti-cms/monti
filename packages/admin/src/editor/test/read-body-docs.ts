import type { Block, Doc } from "@monti-cms/core";

/**
 * The bodies the read-only body is tried on (the stories of `ReadBody` and its tests): formatting, code with effects and a fold, site blocks, to-dos, a
 * moved block, a block that cannot be made and pictures.
 */

export const text = (value: string) => ({ type: "text" as const, text: value });

export const paragraph = (id: string, ...content: NonNullable<Block["content"]>): Block => ({
	id,
	type: "paragraph",
	content,
});

export const code = (id: string, lines: string): Block => ({
	id,
	type: "codeBlock",
	attrs: { language: "ts", title: "src/counter.ts", lineNumbers: true, lines: [{ name: "plus", start: 0, end: 1 }] },
	content: [{ type: "text", text: lines }],
});

export const FOLDED: Block = {
	id: "c2",
	type: "codeBlock",
	attrs: {
		language: "ts",
		rules: [{ scope: "document", name: "bold", pattern: "count", flags: "" }],
		lines: [{ name: "collapse", start: 1, end: 4 }],
	},
	content: [
		{ type: "text", text: "let count = 0;\nfunction reset() {\n  count = 0;\n}\nconst " },
		{ type: "text", text: "add", marks: [{ type: "codeTip", text: "더하기" }] },
		{ type: "text", text: " = () => count++;" },
	],
};

export const MINE: Doc = {
	type: "doc",
	blocks: [
		paragraph(
			"p1",
			text("버튼을 누를 때마다 "),
			{ type: "text", text: "수를 둘 올린다", marks: [{ type: "bold" }] },
			text(" · "),
			{ type: "text", text: "문서", marks: [{ type: "link", href: "https://example.dev/docs" }] },
			text(" "),
			{ type: "text", text: "npm", marks: [{ type: "code" }] },
		),
		{ id: "h1", type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "새 제목" }] },
		code("c1", "let count = 0;\nconst add = () => count++;"),
		{
			id: "note",
			type: "callout",
			attrs: { tone: "tip", title: "알아 두세요" },
			children: [paragraph("n1", text("콜아웃 본문입니다"))],
		},
		{ id: "m1", type: "math", attrs: { source: "a^2 + b^2 = c^2" } },
		FOLDED,
	],
};

export const THEIRS: Doc = {
	type: "doc",
	blocks: [
		paragraph(
			"p1",
			text("버튼을 누를 때마다 "),
			{ type: "text", text: "수를 하나 올린다", marks: [{ type: "bold" }] },
			text(" · "),
			{ type: "text", text: "문서", marks: [{ type: "link", href: "https://example.dev/docs" }] },
			text(" "),
			{ type: "text", text: "npm", marks: [{ type: "code" }] },
		),
		code("c1", "let count = 0;\nconst add = () => count--;"),
		{
			id: "note",
			type: "callout",
			attrs: { tone: "tip", title: "알아 두세요" },
			children: [paragraph("n1", text("콜아웃 본문입니다 다르게"))],
		},
		{ id: "m1", type: "math", attrs: { source: "a^2 + b^2 = d^2" } },
		FOLDED,
	],
};

export const code2 = (id: string, title: string, text: string): Block => ({
	id,
	type: "codeBlock",
	attrs: { language: "ts", title },
	content: [{ type: "text", text }],
});

export const BLOCKS: Doc = {
	type: "doc",
	blocks: [
		{
			id: "tabs",
			type: "tabs",
			children: [
				{ id: "t1", type: "tab", attrs: { label: "npm" }, children: [paragraph("t1p", text("npm install monti"))] },
				{ id: "t2", type: "tab", attrs: { label: "pnpm" }, children: [paragraph("t2p", text("pnpm add monti"))] },
			],
		},
		{
			id: "explorer",
			type: "codeExplorer",
			children: [code2("e1", "src/app.ts", "export const app = 1;"), code2("e2", "src/db.ts", "export const db = 2;")],
		},
		{
			id: "columns",
			type: "columns",
			children: [
				{ id: "k1", type: "column", children: [paragraph("k1p", text("왼쪽 단"))] },
				{ id: "k2", type: "column", children: [paragraph("k2p", text("오른쪽 단"))] },
			],
		},
	],
};

export const TODO: Doc = {
	type: "doc",
	blocks: [
		{
			id: "todo",
			type: "checklist",
			children: [
				{ id: "i1", type: "listItem", attrs: { checked: true }, content: [text("초안 쓰기")] },
				{ id: "i2", type: "listItem", content: [text("발행하기")] },
			],
		},
		paragraph("p", { type: "text", text: "문서", marks: [{ type: "link", href: "#/c/post/abc" }] }),
	],
};

export const MOVED_A: Doc = {
	type: "doc",
	blocks: [paragraph("a", text("첫째 문단")), paragraph("b", text("둘째 문단"))],
};

export const MOVED_B: Doc = {
	type: "doc",
	blocks: [paragraph("b", text("둘째 문단")), paragraph("a", text("첫째 문단"))],
};

export const BROKEN: Doc = {
	type: "doc",
	blocks: [
		paragraph("ok", text("그려지는 문단")),
		{ id: "bad", type: "table", attrs: { rows: [null] } } as unknown as Block,
	],
};

export const IMAGES = (alt: string): Doc => ({
	type: "doc",
	blocks: [{ id: "img", type: "image", attrs: { media: "m1", alt } }],
});
