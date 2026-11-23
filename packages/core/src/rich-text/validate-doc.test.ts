import { expect, it } from "vitest";
import { z } from "zod";
import type { Block, BlockDefinition, Doc, Inline, Mark, MarkDefinition } from "./types";
import { validateDoc } from "./validate-doc";

function pathsOf(doc: unknown, options?: Parameters<typeof validateDoc>[1]): string[] {
	return validateDoc(doc, options).map((issue) => issue.path);
}

/** `root` 자신과 그 하위 경로만 남긴다. */
function under(paths: string[], root: string): string[] {
	return paths.filter((path) => path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`));
}

function text(value: string, marks?: unknown[]): Record<string, unknown> {
	return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

/** 문단 하나와 `children`을 담은 목록 항목. */
function listItem(id: string, children: Block[] = []): Block {
	return {
		id,
		type: "listItem",
		children: [{ id: `${id}-p`, type: "paragraph", content: [{ type: "text", text: "항목" }] }, ...children],
	};
}

const BUILT_IN_MARKS: Mark[] = [
	{ type: "bold" },
	{ type: "italic" },
	{ type: "underline" },
	{ type: "strike" },
	{ type: "code" },
	{ type: "link", href: "https://example.com" },
	{ type: "sup" },
	{ type: "sub" },
];

const INLINES: Inline[] = [
	{ type: "text", text: "안녕하세요", marks: BUILT_IN_MARKS },
	{ type: "hardBreak" },
	{ type: "footnoteRef", id: "fn-1" },
];

const VALID_BLOCKS: Block[] = [
	{ id: "b1", type: "paragraph", content: INLINES },
	{ id: "b2", type: "heading", attrs: { level: 2 }, content: [] },
	{ id: "b3", type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "let a = 1;" }] },
	{ id: "b4", type: "footnote", attrs: { id: "fn-1" }, content: [{ type: "text", text: "각주 내용" }] },
	{
		id: "b5",
		type: "bulletList",
		children: [listItem("b5-1", [{ id: "b5-n", type: "bulletList", children: [listItem("b5-n-1")] }])],
	},
	{ id: "b6", type: "orderedList", children: [listItem("b6-1")] },
	{ id: "b7", type: "checklist", children: [] },
	{ id: "b8", type: "quote" },
	{ id: "b9", type: "divider" },
	{ id: "b10", type: "image", attrs: { mediaId: "6d1f3b2a-8c4e-4f7a-9b2d-3e5f7a9c1b20" } },
	{ id: "b11", type: "file", attrs: { mediaId: "c3a5e7f9-2b4d-4e6f-8a1c-5d7e9f1b3c42" } },
	{ id: "b12", type: "table", attrs: { rows: [["a", "b"]] } },
	{ id: "b13", type: "listItem", children: [] },
	{ id: "b14", type: "paragraph" },
];

const UUID_A = "4f2c8e7a-1b3d-4c5e-8f9a-0b1c2d3e4f50";
const UUID_B = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

it("RT-DOC-1 유효한 본문 문서는 빈 문제 목록을 돌려준다", () => {
	const doc: Doc = { blocks: VALID_BLOCKS };
	// RT-DOC-1.1
	expect(validateDoc(doc)).toEqual([]);
});

it("RT-DOC-2 문서가 객체가 아니거나 블록 목록이 배열이 아니면 예외를 던지지 않고 문제를 돌려준다", () => {
	// RT-DOC-2.1
	expect(pathsOf(null)).toContain("");
	// RT-DOC-2.1
	expect(pathsOf({ blocks: {} })).toContain("blocks");
});

it("RT-DOC-3 블록이 객체가 아니면 해당 블록 경로의 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [null] });
	// RT-DOC-3.1
	expect(paths).toContain("blocks[0]");
});

it("RT-DOC-4 블록에 식별자나 종류가 빠졌으면 해당 속성 경로의 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [{ type: "paragraph" }, { id: "b1" }] });
	// RT-DOC-4.1
	expect(paths).toContain("blocks[0].id");
	// RT-DOC-4.2
	expect(paths).toContain("blocks[1].type");
});

it("RT-DOC-5 블록의 속성·인라인 목록·하위 블록 목록 형식이 잘못되었으면 해당 경로의 문제를 돌려준다", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "b0", type: "paragraph", attrs: "big" },
			{ id: "b1", type: "paragraph", content: "text" },
			{ id: "b2", type: "quote", children: {} },
		],
	});
	// RT-DOC-5.1
	expect(paths).toContain("blocks[0].attrs");
	// RT-DOC-5.2
	expect(paths).toContain("blocks[1].content");
	// RT-DOC-5.3
	expect(paths).toContain("blocks[2].children");
});

it("RT-DOC-6 같은 ID를 가진 블록이 중복되면 나중에 나온 블록을 문제로 돌려준다", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "same", type: "paragraph" },
			{ id: "quote", type: "quote", children: [{ id: "same", type: "paragraph" }] },
		],
	});
	// RT-DOC-6.1
	expect(paths).toContain("blocks[1].children[0].id");
	// RT-DOC-6.2
	expect(paths).not.toContain("blocks[0].id");
});

it("RT-DOC-7 등록되지 않은 종류의 블록은 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [{ id: "b0", type: "carousel" }] });
	// RT-DOC-7.1
	expect(paths).toContain("blocks[0].type");
});

it("RT-BLK-1 추가로 등록한 사용자 정의 블록의 속성을 스키마로 검사한다", () => {
	const blocks: BlockDefinition[] = [
		{ type: "callout", holds: "blocks", attrs: z.object({ tone: z.enum(["info", "warning"]) }) },
	];
	const paths = pathsOf(
		{
			blocks: [
				{ id: "b0", type: "callout", attrs: { tone: "info" }, children: [{ id: "b0-0", type: "paragraph" }] },
				{ id: "b1", type: "callout", attrs: { tone: "loud" } },
			],
		},
		{ blocks },
	);
	// RT-BLK-1.1
	expect(paths).toContain("blocks[1].attrs");
	// RT-BLK-1.2
	expect(under(paths, "blocks[0]")).toEqual([]);
});

it("RT-BLK-2 내장 블록과 같은 이름으로 블록을 등록하면 내장 블록의 속성 검사를 덮어쓴다", () => {
	const blocks: BlockDefinition[] = [{ type: "codeBlock", holds: "text", attrs: z.object({ language: z.string() }) }];
	const paths = pathsOf(
		{
			blocks: [
				{ id: "b0", type: "paragraph", content: [{ type: "text", text: "본문" }] },
				{ id: "b1", type: "codeBlock", attrs: { language: 3 } },
			],
		},
		{ blocks },
	);
	// RT-BLK-2.1
	expect(paths).toContain("blocks[1].attrs");
	// RT-BLK-2.2
	expect(under(paths, "blocks[0]")).toEqual([]);
});

it("RT-BLK-3 글자만 담는 블록에 하위 블록이 들어 있으면 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", children: [{ id: "p", type: "paragraph" }] }] });
	// RT-BLK-3.1
	expect(paths).toContain("blocks[0].children");
});

it("RT-BLK-4 하위 블록만 담는 블록에 인라인 글자가 들어 있으면 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [{ id: "b0", type: "quote", content: [text("글")] }] });
	// RT-BLK-4.1
	expect(paths).toContain("blocks[0].content");
});

it("RT-BLK-5 내용을 담지 않는 블록에 글자나 하위 블록이 들어 있으면 문제를 돌려준다", () => {
	const paths = pathsOf({
		blocks: [{ id: "b0", type: "divider", content: [text("글")], children: [{ id: "p", type: "paragraph" }] }],
	});
	// RT-BLK-5.1
	expect(paths).toContain("blocks[0].content");
	// RT-BLK-5.2
	expect(paths).toContain("blocks[0].children");
});

it("RT-BLK-6 허용된 자식 목록에 없는 하위 블록이 들어 있으면 문제를 돌려준다", () => {
	const blocks: BlockDefinition[] = [
		{ type: "tabs", holds: "blocks", children: ["tab"] },
		{ type: "tab", holds: "blocks" },
	];
	const paths = pathsOf(
		{
			blocks: [
				{
					id: "b0",
					type: "tabs",
					children: [
						{ id: "b0-0", type: "tab", children: [{ id: "b0-0-0", type: "paragraph" }] },
						{ id: "b0-1", type: "paragraph" },
					],
				},
			],
		},
		{ blocks },
	);
	// RT-BLK-6.1
	expect(paths).toContain("blocks[0].children[1]");
	// RT-BLK-6.2
	expect(under(paths, "blocks[0].children[0]")).toEqual([]);
});

/** `quote` 블록이 최상위(1단계)부터 안쪽으로 `levels`단계 중첩된 문서. */
function nestedQuotes(levels: number): Doc {
	let block: Block = { id: `q${levels}`, type: "quote" };
	for (let level = levels - 1; level >= 1; level -= 1) block = { id: `q${level}`, type: "quote", children: [block] };
	return { blocks: [block] };
}

it("RT-BLK-7 블록 중첩이 최대 깊이인 32단계까지는 통과한다", () => {
	// RT-BLK-7.1
	expect(validateDoc(nestedQuotes(32))).toEqual([]);
});

it("RT-BLK-8 블록 중첩이 최대 깊이(32단계)를 넘으면 예외를 던지지 않고 초과 위치 경로의 문제로 돌려준다", () => {
	// RT-BLK-8.1
	expect(pathsOf(nestedQuotes(33))).toContain(`blocks[0]${".children[0]".repeat(32)}`);
});

it("RT-INL-1 인라인 노드가 객체가 아니거나 등록되지 않은 종류이거나 각주 참조 ID가 문자열이 아니면 문제를 돌려준다", () => {
	const content = [null, { type: "emoji", name: "smile" }, { type: "footnoteRef" }];
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content }] });
	// RT-INL-1.1
	expect(paths).toContain("blocks[0].content[0]");
	// RT-INL-1.2
	expect(paths).toContain("blocks[0].content[1].type");
	// RT-INL-1.3
	expect(paths).toContain("blocks[0].content[2].id");
});

it("RT-INL-2 글자 노드의 텍스트가 문자열이 아니면 문제를 돌려준다", () => {
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content: [{ type: "text", text: 42 }] }] });
	// RT-INL-2.1
	expect(paths).toContain("blocks[0].content[0].text");
});

it("RT-INL-3 마크 목록이나 마크 항목 형식이 잘못되었거나 등록되지 않은 마크이면 문제를 돌려준다", () => {
	const content = [
		text("이름 없는 마크", [{ href: "https://example.com" }]),
		text("모르는 마크", [{ type: "glow" }]),
		{ type: "text", text: "배열이 아닌 마크 목록", marks: { type: "bold" } },
		text("객체가 아닌 마크", [null]),
	];
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content }] });
	// RT-INL-3.1
	expect(paths).toContain("blocks[0].content[0].marks[0].type");
	// RT-INL-3.2
	expect(paths).toContain("blocks[0].content[1].marks[0].type");
	// RT-INL-3.3
	expect(paths).toContain("blocks[0].content[2].marks");
	// RT-INL-3.4
	expect(paths).toContain("blocks[0].content[3].marks[0]");
});

it("RT-INL-4 추가로 등록한 사용자 정의 마크의 속성을 스키마로 검사한다", () => {
	const marks: MarkDefinition[] = [
		{ type: "highlight", attrs: z.strictObject({ color: z.enum(["yellow", "green"]) }) },
	];
	const content = [
		text("형광", [{ type: "highlight", color: "yellow" }]),
		text("잘못된 형광", [{ type: "highlight", color: "purple" }]),
	];
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content }] }, { marks });
	// RT-INL-4.1
	expect(paths).toContain("blocks[0].content[1].marks[0]");
	// RT-INL-4.2
	expect(under(paths, "blocks[0].content[0]")).toEqual([]);
});

it("RT-INL-5 내장 마크와 같은 이름으로 마크를 등록하면 내장 마크의 속성 검사를 덮어쓴다", () => {
	const marks: MarkDefinition[] = [{ type: "link", attrs: z.strictObject({ href: z.url() }) }];
	const content = [text("굵게", [{ type: "bold" }]), text("잘못된 링크", [{ type: "link", href: "not a url" }])];
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content }] }, { marks });
	// RT-INL-5.1
	expect(paths).toContain("blocks[0].content[1].marks[0]");
	// RT-INL-5.2
	expect(under(paths, "blocks[0].content[0]")).toEqual([]);
});

it("RT-INL-6 내장 링크 마크의 주소에 허용되지 않은 스킴이나 스킴 없는 네트워크 경로가 들어 있으면 문제를 돌려준다", () => {
	const hrefs = [
		"https://example.com",
		"http://example.com",
		"mailto:a@example.com",
		"/about",
		"#top",
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"data:text/html,<script>",
		"//example.com",
	];
	const content = hrefs.map((href) => text(href, [{ type: "link", href }]));
	const paths = pathsOf({ blocks: [{ id: "b0", type: "paragraph", content }] });
	// RT-INL-6.1
	expect([0, 1, 2].flatMap((n) => under(paths, `blocks[0].content[${n}]`))).toEqual([]);
	// RT-INL-6.2
	expect([3, 4].flatMap((n) => under(paths, `blocks[0].content[${n}]`))).toEqual([]);
	// RT-INL-6.3
	expect(paths).toEqual(expect.arrayContaining([5, 6, 7, 8].map((n) => `blocks[0].content[${n}].marks[0]`)));
});

it("RT-MED-1 블록의 단건 미디어 예약 속성이 유효한 UUID가 아니면 문제를 돌려준다", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "b0", type: "image", attrs: { mediaId: UUID_A } },
			{ id: "b1", type: "image", attrs: { mediaId: "not-a-uuid" } },
			{ id: "b2", type: "image", attrs: { mediaId: null } },
		],
	});
	// RT-MED-1.1
	expect(paths).toContain("blocks[1].attrs.mediaId");
	// RT-MED-1.2
	expect(paths).toContain("blocks[2].attrs.mediaId");
	// RT-MED-1.3
	expect(under(paths, "blocks[0]")).toEqual([]);
});

it("RT-MED-2 블록의 다건 미디어 예약 속성이 유효한 UUID 배열이 아니면 문제를 돌려준다", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "b0", type: "file", attrs: { mediaIds: [UUID_A, UUID_B] } },
			{ id: "b1", type: "file", attrs: { mediaIds: [UUID_A, "nope"] } },
			{ id: "b2", type: "file", attrs: { mediaIds: UUID_A } },
		],
	});
	// RT-MED-2.1
	expect(paths).toContain("blocks[1].attrs.mediaIds");
	// RT-MED-2.2
	expect(paths).toContain("blocks[2].attrs.mediaIds");
	// RT-MED-2.3
	expect(under(paths, "blocks[0]")).toEqual([]);
});
