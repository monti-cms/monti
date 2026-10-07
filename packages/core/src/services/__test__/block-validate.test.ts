import { describe, expect, it, vi } from "vitest";
import { chartBlock } from "../../../../blocks/src/chart/definition";
import { mermaidBlock } from "../../../../blocks/src/mermaid/definition";
import { defineBlock } from "../../blocks/define";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { defineCollection, defineSite, fields } from "../../index";
import { createSite } from "../../site";
import type { WriteOperation } from "../hooks";
import { createWritePipeline } from "../write-pipeline";

/**
 * The `validate` slot of a block definition: core calls it for every node of the block in the write pipeline, and what it finds comes back as
 * warnings with the block's id. It never blocks a save or a publish.
 */

/** A site's own fence block (` ```map `): one `lat,lng` pair per line. */
const mapBlock = defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "Map",
	attributes: {},
	editor: { view: "opaque" },
	validate: (node, { operation, locale }) =>
		(node.source ?? "")
			.split("\n")
			.flatMap((line, index) =>
				/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(line.trim())
					? []
					: [{ code: "map_line", message: `${locale}/${operation}: line ${index + 1}`, params: { line: index + 1 } }],
			),
});

/** A site's own directive block that checks its attributes. */
const noteBlock = defineBlock({
	name: "note",
	label: "Note",
	syntax: { kind: "leaf", directive: "note" },
	component: "Note",
	attributes: { tone: { type: "string", label: "Tone" } },
	editor: { view: "opaque" },
	validate: (node) => (node.attributes.tone === "loud" ? [{ code: "note_loud" }] : undefined),
});

/** A block whose check throws. */
const brokenBlock = defineBlock({
	name: "broken",
	label: "Broken",
	syntax: { kind: "leaf", directive: "broken" },
	component: "Broken",
	attributes: {},
	editor: { view: "opaque" },
	validate: () => {
		throw new Error("boom");
	},
});

const site = createSite(
	defineSite({
		collections: {
			post: defineCollection({
				label: "Post",
				kind: "document",
				fields: {
					title: fields.text({ label: "Title", required: true }),
					slug: fields.slug({ label: "Slug", from: "title" }),
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		blocks: [chartBlock, mermaidBlock, mapBlock, noteBlock, brokenBlock],
	}),
);
const pipeline = createWritePipeline({ site });

const fence = (id: string, language: string, code: string): CmsNode => ({
	id,
	type: "codeBlock",
	attrs: { language, meta: "", code },
});
const docOf = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 3, content });

const run = (doc: StoredDocument, operation: WriteOperation = "save") =>
	pipeline.run({
		operation,
		locale: "en",
		input: { collection: "post", slug: "a", metadata: { title: "A" }, doc } as never,
	});

const VALID_CHART = "chart bar\nx month\nseries views | Views | chart-1\n\ndata\nmonth | views\nJan | 1200";

describe("block validate", () => {
	it("warns with the block id when a chart is broken", async () => {
		const { warnings, snapshot } = await run(docOf(fence("chart001", "chart", "chart radar\ndata")));
		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "chart_syntax",
				position: { blockId: "chart001" },
				path: "body",
				params: expect.objectContaining({ block: "chart", line: 1 }),
			}),
		);
		expect(warnings[0]?.message).toContain("radar");
		// A warning never blocks: the snapshot has no issues of its own.
		expect(snapshot.issues).toEqual([]);
	});

	it("gives no warning for a valid chart", async () => {
		const { warnings } = await run(docOf(fence("chart001", "chart", VALID_CHART)));
		expect(warnings).toEqual([]);
	});

	it("warns on save and on publish alike, and never blocks the publish", async () => {
		const doc = docOf(fence("chart001", "chart", "nonsense"));
		for (const operation of ["create", "save", "publish", "restore"] as const) {
			const { warnings } = await run(doc, operation);
			expect(warnings.map((warning) => warning.code)).toContain("chart_syntax");
		}
	});

	it("checks mermaid with its own parser", async () => {
		const good = await run(docOf(fence("diag0001", "mermaid", "graph TD\n  A --> B")));
		expect(good.warnings).toEqual([]);
		const bad = await run(docOf(fence("diag0002", "mermaid", "graph TD\n  A -->")));
		expect(bad.warnings).toContainEqual(
			expect.objectContaining({ code: "mermaid_syntax", position: { blockId: "diag0002" } }),
		);
	});

	it("lets a site's own block add validate, to a fence and to a directive block", async () => {
		const { warnings } = await run(
			docOf(
				fence("map00001", "map", "37.5,127.0\nnowhere"),
				{ id: "note0001", type: "note", attrs: { tone: "loud" } },
				{ id: "note0002", type: "note", attrs: { tone: "soft" } },
			),
		);
		expect(warnings).toEqual([
			expect.objectContaining({
				code: "map_line",
				message: "en/save: line 2",
				position: { blockId: "map00001" },
				params: { line: 2, block: "map" },
			}),
			expect.objectContaining({ code: "note_loud", position: { blockId: "note0001" }, params: { block: "note" } }),
		]);
	});

	it("checks every node of the block, in body order", async () => {
		const { warnings } = await run(
			docOf(
				fence("chart001", "chart", "bad"),
				fence("chart002", "chart", VALID_CHART),
				fence("chart003", "chart", "bad"),
			),
		);
		expect(warnings.map((warning) => warning.position?.blockId)).toEqual(["chart001", "chart003"]);
	});

	it("takes the block id of a node nested in another block", async () => {
		const { warnings } = await run(
			docOf({ id: "outer001", type: "paragraph", content: [{ type: "note", attrs: { tone: "loud" } }] }),
		);
		expect(warnings).toContainEqual(expect.objectContaining({ code: "note_loud", position: { blockId: "outer001" } }));
	});

	it("turns a check that throws into a warning and goes on with the write", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const { warnings } = await run(docOf({ id: "brk00001", type: "broken" }));
			expect(warnings).toEqual([
				expect.objectContaining({ code: "block_validate_failed", position: { blockId: "brk00001" } }),
			]);
		} finally {
			error.mockRestore();
		}
	});

	it("does not change the saved content", async () => {
		const doc = docOf(fence("chart001", "chart", "bad"));
		const { snapshot } = await run(doc);
		const { snapshot: clean } = await run(docOf(fence("chart001", "chart", "bad")));
		expect(snapshot.contentHash).toBe(clean.contentHash);
	});
});
