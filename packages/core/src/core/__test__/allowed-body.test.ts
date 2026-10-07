import { describe, expect, it } from "vitest";
import { ALL_BLOCKS } from "../../../../blocks/src/definitions";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { defineCollection, defineSite, fields } from "../../index";
import { bodyVocabulary, disallowedInDocument } from "../../schema/allowed";
import { createContentService } from "../../services/content-service";
import { createSite } from "../../site";
import { checkDocument } from "../body-check";
import { prepareSnapshot } from "../snapshot";

/**
 * A body that limits its blocks and marks: what validation reports, what a write may add, and that a body written before the list changed stays as it is.
 * `memo` allows a few blocks and marks; `post` has no list.
 */
const title = fields.text({ label: "Title", required: true });
const slug = fields.slug({ label: "Slug", from: "title", required: true });

const config = (body: unknown) =>
	defineSite({
		collections: {
			post: defineCollection({ label: "Post", kind: "document", fields: { title, slug } }),
			memo: defineCollection({
				label: "Memo",
				kind: "document",
				fields: { title, slug },
				body: body as never,
			}),
		},
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		],
		defaultLocale: "en",
		blocks: [...ALL_BLOCKS],
	});

const LIST = { blocks: ["callout", "table", "image"], marks: ["bold", "link"], headings: [2, 3] } as const;
const site = createSite(config(LIST));

const text = (value: string, ...marks: string[]): CmsNode => ({
	type: "text",
	text: value,
	...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (id: string, ...content: CmsNode[]): CmsNode => ({ id, type: "paragraph", content });
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 3, content });
const tabs: CmsNode = {
	id: "tabsblk1",
	type: "tabs",
	content: [{ id: "tabblk01", type: "tab", attrs: { title: "A" }, content: [paragraph("p0000001", text("x"))] }],
};
const columns: CmsNode = {
	id: "columns1",
	type: "columns",
	content: [{ id: "column01", type: "column", content: [paragraph("p0000002", text("y"))] }],
};
const callout: CmsNode = { id: "callout1", type: "callout", content: [paragraph("p0000003", text("z"))] };
const heading = (id: string, level: number): CmsNode => ({
	id,
	type: "heading",
	attrs: { level },
	content: [text("h")],
});

const input = (body: StoredDocument, collection = "memo") =>
	({ collection, slug: "a", metadata: { title: "T" }, doc: body }) as never;

describe("the allowed list of a body", () => {
	it("names the core blocks and marks, and the blocks and marks the site adds, but not the children of a block", () => {
		const names = bodyVocabulary(site);
		expect(names.blocks).toEqual(
			expect.arrayContaining(["table", "taskList", "math", "codeBlock", "callout", "tabs", "columns"]),
		);
		expect(names.blocks).not.toContain("tab");
		expect(names.blocks).not.toContain("column");
		expect(names.blocks).not.toContain("row");
		expect(names.marks).toEqual(expect.arrayContaining(["bold", "superscript", "tooltip", "color"]));
		expect(names.marks).not.toContain("callout");
	});

	it("is read from the object form of `body`, which also means the collection has a body", () => {
		expect(site.schemaOf("memo")).toMatchObject({ body: true, allowed: LIST });
		expect(site.schemaOf("post").allowed).toBeUndefined();
	});

	it("rejects a name the site does not have, and a heading level that does not exist", () => {
		expect(() => config({ blocks: ["callot"] })).toThrow(/memo\.body\.blocks has unknown block "callot"/);
		expect(() => config({ blocks: ["tab"] })).toThrow(/unknown block "tab"/);
		expect(() => config({ marks: ["callout"] })).toThrow(/unknown mark "callout"/);
		expect(() => config({ headings: [2, 7] })).toThrow(/memo\.body\.headings/);
		expect(() => config({ blocks: ["table", "table"] })).toThrow(/lists "table" twice/);
	});

	it("allows everything when a key is left out", () => {
		const open = createSite(config({ marks: ["bold"] }));
		const found = disallowedInDocument(open, open.schemaOf("memo").allowed, doc(tabs, columns, heading("h0000001", 5)));
		expect(found).toEqual([]);
	});
});

describe("what validation reports", () => {
	const body = doc(
		callout,
		tabs,
		columns,
		heading("h0000002", 2),
		heading("h0000003", 4),
		paragraph("p0000004", text("a", "bold"), text("b", "italic"), text("c", "tooltip")),
		{ id: "quote001", type: "blockquote", content: [paragraph("p0000005", text("q"))] },
	);

	it("warns about each block and mark that is not allowed, with the block id, and only warns", () => {
		const check = checkDocument(site, body, site.schemaOf("memo").allowed);
		const warnings = check.warnings.filter((issue) => issue.code.startsWith("disallowed_"));
		expect(warnings.map((issue) => [issue.code, issue.message, issue.position?.blockId])).toEqual([
			["disallowed_block", "tabs", "tabsblk1"],
			["disallowed_block", "columns", "columns1"],
			["disallowed_block", "heading 4", "h0000003"],
			["disallowed_mark", "italic", "p0000004"],
			["disallowed_mark", "tooltip", "p0000004"],
			["disallowed_block", "blockquote", "quote001"],
		]);
		expect(check.issues.filter((issue) => issue.code.startsWith("disallowed_"))).toEqual([]);
	});

	it("reports nothing for a body without a list", () => {
		const check = checkDocument(site, body, undefined);
		expect(check.warnings.filter((issue) => issue.code.startsWith("disallowed_"))).toEqual([]);
	});

	it("counts a checked list item as a task list, and the rows and cells of an allowed table as part of it", () => {
		const tasks: CmsNode = {
			id: "tasks001",
			type: "bulletList",
			content: [{ type: "listItem", attrs: { checked: false }, content: [paragraph("p0000006", text("t"))] }],
		};
		const table: CmsNode = {
			id: "table001",
			type: "table",
			content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraph("p0000007", text("c"))] }] }],
		};
		const found = disallowedInDocument(site, site.schemaOf("memo").allowed, doc(tasks, table));
		expect(found.map((item) => item.name)).toEqual(["taskList"]);
	});
});

describe("what a save does with content the list does not allow", () => {
	const held = doc(tabs, paragraph("p0000008", text("m", "italic")));
	const disallowed = (snapshot: { warnings?: readonly { code: string }[] }) =>
		(snapshot.warnings ?? []).map((issue) => issue.code).filter((code) => code.startsWith("disallowed_"));

	it("never rejects a write that adds a disallowed block, and warns about it with the block id", async () => {
		const snapshot = await prepareSnapshot(site, input(doc(columns)), { previousDoc: doc(callout) });
		expect(snapshot.doc.content.map((node) => node.type)).toEqual(["columns"]);
		expect(snapshot.warnings?.filter((issue) => issue.code === "disallowed_block")).toMatchObject([
			{ message: "columns", position: { blockId: "columns1" } },
		]);
	});

	it("never rejects a new body, and keeps what it holds as written with warnings", async () => {
		const snapshot = await prepareSnapshot(site, input(held));
		expect(snapshot.doc.content.map((node) => node.type)).toEqual(["tabs", "paragraph"]);
		expect(snapshot.doc.content[0]?.content?.[0]?.type).toBe("tab");
		expect(disallowed(snapshot)).toEqual(["disallowed_block", "disallowed_mark"]);
	});

	it("gives the same warnings for a write that keeps what the draft holds", async () => {
		const snapshot = await prepareSnapshot(site, input(held), { previousDoc: held });
		expect(disallowed(snapshot)).toEqual(["disallowed_block", "disallowed_mark"]);
	});

	it("does not limit a collection without a list", async () => {
		const snapshot = await prepareSnapshot(site, input(doc(tabs, columns), "post"));
		expect(disallowed(snapshot)).toEqual([]);
	});
});

describe("the content service", () => {
	it("creates a translation of an entry whose body holds a block that is not allowed", async () => {
		const created: string[] = [];
		const service = createContentService(
			{
				getWorking: async () => ({
					collection: "memo",
					slug: "a",
					metadata: { title: "T" },
					doc: doc(tabs),
					locale: "en",
				}),
				createEntryWithReferences: async ({ snapshot }: { snapshot: { doc: StoredDocument } }) => {
					created.push(...snapshot.doc.content.map((node) => node.type));
					return {};
				},
			} as never,
			{ site },
		);
		await service.createTranslation({ sourceId: "00000000-0000-4000-8000-000000000001", locale: "ko" });
		expect(created).toEqual(["tabs"]);
	});
});
