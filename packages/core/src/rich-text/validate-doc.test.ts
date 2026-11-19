import { expect, it } from "vitest";
import { z } from "zod";
import type { Block, BlockDefinition, Doc, Inline, Mark, MarkDefinition } from "./types";
import { validateDoc } from "./validate-doc";

function pathsOf(doc: unknown, options?: Parameters<typeof validateDoc>[1]): string[] {
	return validateDoc(doc, options).map((issue) => issue.path);
}

function under(paths: string[], root: string): string[] {
	return paths.filter((path) => path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`));
}

function text(value: string, marks?: unknown[]): Record<string, unknown> {
	return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

it("RT-1 returns no issues for a valid document", () => {
	const marks: Mark[] = [
		{ type: "bold" },
		{ type: "italic" },
		{ type: "underline" },
		{ type: "strike" },
		{ type: "code" },
		{ type: "link", href: "https://example.com" },
		{ type: "sup" },
		{ type: "sub" },
	];
	const inlines: Inline[] = [
		{ type: "text", text: "안녕하세요", marks },
		{ type: "hardBreak" },
		{ type: "footnoteRef", id: "fn-1" },
	];
	const listItem = (id: string, children: Block[] = []): Block => ({
		id,
		type: "listItem",
		children: [{ id: `${id}-p`, type: "paragraph", content: [{ type: "text", text: "항목" }] }, ...children],
	});
	const blocks: Block[] = [
		{ id: "b1", type: "paragraph", content: inlines },
		{ id: "b2", type: "heading", attrs: { level: 2 }, content: [] },
		{ id: "b3", type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "let a = 1;" }] },
		{ id: "b4", type: "footnote", attrs: { id: "fn-1" } },
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
	];
	const doc: Doc = { blocks };
	// RT-1.1
	expect(validateDoc(doc)).toEqual([]);
});

it("RT-2 returns an issue instead of throwing when the top-level structure is wrong", () => {
	const paths = pathsOf({ blocks: {} });
	// RT-2.1
	expect(paths).toContain("blocks");
});

it("RT-3 returns an issue at every broken required property or shape of a block", () => {
	const paths = pathsOf({
		blocks: [
			null,
			{ type: "paragraph" },
			{ id: "b2" },
			{ id: "b3", type: "paragraph", attrs: "big" },
			{ id: "b4", type: "paragraph", content: "text" },
			{ id: "b5", type: "quote", children: {} },
		],
	});
	// RT-3.1
	expect(paths).toContain("blocks[0]");
	// RT-3.2
	expect(paths).toContain("blocks[1].id");
	// RT-3.3
	expect(paths).toContain("blocks[2].type");
	// RT-3.4
	expect(paths).toContain("blocks[3].attrs");
	// RT-3.5
	expect(paths).toContain("blocks[4].content");
	// RT-3.6
	expect(paths).toContain("blocks[5].children");
});

it("RT-4 reports the later block when two blocks share an id", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "same", type: "paragraph" },
			{ id: "quote", type: "quote", children: [{ id: "same", type: "paragraph" }] },
		],
	});
	// RT-4.1
	expect(paths).toContain("blocks[1].children[0].id");
	// RT-4.2
	expect(paths).not.toContain("blocks[0].id");
});

it("RT-5 reports a block type that is not registered", () => {
	const paths = pathsOf({ blocks: [{ id: "b0", type: "carousel" }] });
	// RT-5.1
	expect(paths).toContain("blocks[0].type");
});

it("RT-6 keeps and overrides built-in blocks with registered definitions and checks attrs with their schema", () => {
	const blocks: BlockDefinition[] = [
		{ type: "callout", holds: "blocks", attrs: z.object({ tone: z.enum(["info", "warning"]) }) },
		{ type: "codeBlock", holds: "text", attrs: z.object({ language: z.string() }) },
	];
	const paths = pathsOf(
		{
			blocks: [
				{ id: "b0", type: "paragraph", content: [{ type: "text", text: "본문" }] },
				{ id: "b1", type: "callout", attrs: { tone: "info" }, children: [{ id: "b1-0", type: "paragraph" }] },
				{ id: "b2", type: "callout", attrs: { tone: "loud" } },
				{ id: "b3", type: "codeBlock", attrs: { language: 3 } },
			],
		},
		{ blocks },
	);
	// RT-6.1
	expect(paths).toContain("blocks[2].attrs");
	// RT-6.2
	expect(paths).toContain("blocks[3].attrs");
	// RT-6.3
	expect(under(paths, "blocks[0]")).toEqual([]);
	// RT-6.4
	expect(under(paths, "blocks[1]")).toEqual([]);
});

it("RT-7 reports content or children that the block's holds does not allow", () => {
	const paragraph = { id: "p", type: "paragraph" };
	const inline = { type: "text", text: "글" };
	const paths = pathsOf({
		blocks: [
			{ id: "b0", type: "paragraph", children: [paragraph] },
			{ id: "b1", type: "quote", content: [inline] },
			{ id: "b2", type: "divider", content: [inline], children: [{ ...paragraph, id: "p2" }] },
		],
	});
	// RT-7.1
	expect(paths).toContain("blocks[0].children");
	// RT-7.2
	expect(paths).toContain("blocks[1].content");
	// RT-7.3
	expect(paths).toContain("blocks[2].content");
	// RT-7.4
	expect(paths).toContain("blocks[2].children");
});

it("RT-8 reports a child block that is not in the allowed children", () => {
	const blocks: BlockDefinition[] = [
		{ type: "tabs", holds: "blocks", children: ["tab"] },
		{ type: "tab", holds: "blocks" },
	];
	const paths = pathsOf(
		{
			blocks: [
				{ id: "b0", type: "bulletList", children: [{ id: "b0-0", type: "paragraph" }] },
				{
					id: "b1",
					type: "tabs",
					children: [
						{ id: "b1-0", type: "tab", children: [{ id: "b1-0-0", type: "paragraph" }] },
						{ id: "b1-1", type: "paragraph" },
					],
				},
			],
		},
		{ blocks },
	);
	// RT-8.1
	expect(paths).toContain("blocks[0].children[0]");
	// RT-8.2
	expect(paths).toContain("blocks[1].children[1]");
	// RT-8.3
	expect(under(paths, "blocks[1].children[0]")).toEqual([]);
});

it("RT-9 reports a broken inline node or an unregistered mark", () => {
	const paths = pathsOf({
		blocks: [
			{
				id: "b0",
				type: "paragraph",
				content: [
					{ type: "emoji", name: "smile" },
					{ type: "text", text: 42 },
					text("이름 없는 마크", [{ href: "https://example.com" }]),
					text("모르는 마크", [{ type: "glow" }]),
				],
			},
		],
	});
	// RT-9.1
	expect(paths).toContain("blocks[0].content[0].type");
	// RT-9.2
	expect(paths).toContain("blocks[0].content[1].text");
	// RT-9.3
	expect(paths).toContain("blocks[0].content[2].marks[0].type");
	// RT-9.4
	expect(paths).toContain("blocks[0].content[3].marks[0].type");
});

it("RT-10 keeps and overrides built-in marks with registered definitions and checks the flat attributes without type", () => {
	const marks: MarkDefinition[] = [
		{ type: "highlight", attrs: z.strictObject({ color: z.enum(["yellow", "green"]) }) },
		{ type: "link", attrs: z.strictObject({ href: z.url() }) },
	];
	const paths = pathsOf(
		{
			blocks: [
				{
					id: "b0",
					type: "paragraph",
					content: [
						text("굵게", [{ type: "bold" }]),
						text("형광", [{ type: "highlight", color: "yellow" }]),
						text("잘못된 형광", [{ type: "highlight", color: "purple" }]),
						text("잘못된 링크", [{ type: "link", href: "not a url" }]),
					],
				},
			],
		},
		{ marks },
	);
	// RT-10.1
	expect(paths).toContain("blocks[0].content[2].marks[0]");
	// RT-10.2
	expect(paths).toContain("blocks[0].content[3].marks[0]");
	// RT-10.3
	expect(under(paths, "blocks[0].content[0]")).toEqual([]);
	// RT-10.4
	expect(under(paths, "blocks[0].content[1]")).toEqual([]);
});

it("RT-11 checks the reserved attrs.mediaId and attrs.mediaIds as UUIDs when they are given", () => {
	const paths = pathsOf({
		blocks: [
			{ id: "b0", type: "image", attrs: { mediaId: "0b9b5f0e-3c1a-4a52-9d8e-6f1f0d6c2a11" } },
			{
				id: "b1",
				type: "file",
				attrs: { mediaIds: ["4f2c8e7a-1b3d-4c5e-8f9a-0b1c2d3e4f50", "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d"] },
			},
			{ id: "b2", type: "image", attrs: { mediaId: "not-a-uuid" } },
			{ id: "b3", type: "image", attrs: { mediaId: null } },
			{ id: "b4", type: "file", attrs: { mediaIds: ["4f2c8e7a-1b3d-4c5e-8f9a-0b1c2d3e4f50", "nope"] } },
			{ id: "b5", type: "file", attrs: { mediaIds: "4f2c8e7a-1b3d-4c5e-8f9a-0b1c2d3e4f50" } },
		],
	});
	// RT-11.1
	expect(paths).toContain("blocks[2].attrs.mediaId");
	// RT-11.2
	expect(paths).toContain("blocks[3].attrs.mediaId");
	// RT-11.3
	expect(paths).toContain("blocks[4].attrs.mediaIds");
	// RT-11.4
	expect(paths).toContain("blocks[5].attrs.mediaIds");
	// RT-11.5
	expect(under(paths, "blocks[0]")).toEqual([]);
	// RT-11.5
	expect(under(paths, "blocks[1]")).toEqual([]);
});
