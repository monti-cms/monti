import { describe, expect, it } from "vitest";
import { contentOf } from "../../../../test/stored-content";
import type { SeedTemplate } from "../../../config/define";
import { forEachBlock, isBlockId } from "../../../doc/block-ids";
import { doc as docWith, paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import { createFormatRegistry, NO_FORMATS } from "../../../format/registry";
import { seedTemplateDocument } from "../store/seed-templates";

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("seed templates", () => {
	it("takes a template written as a document, checks it like any stored document and gives its blocks ids", async () => {
		const given = docWith({ type: "paragraph", content: [{ type: "text", text: "Seeded" }] });
		const template: SeedTemplate = { id: ID, name: "Doc", doc: given };

		const seeded = await seedTemplateDocument(template, NO_FORMATS);

		expect(contentOf(seeded)).toEqual(contentOf(given));
		let blocks = 0;
		forEachBlock(seeded.content, (block) => {
			blocks += 1;
			expect(isBlockId(block.id)).toBe(true);
		});
		expect(blocks).toBe(1);
	});

	it("rejects a document that is not a stored document, naming the template", async () => {
		const template = { id: ID, name: "Broken", doc: { type: "doc", content: "nope" } } as unknown as SeedTemplate;

		await expect(seedTemplateDocument(template, NO_FORMATS)).rejects.toThrow(
			/seed template "Broken" is not a stored document/,
		);
	});

	it("reads a template written as text with its format", async () => {
		const registry = createFormatRegistry([paragraphsFormat]);
		const custom = await seedTemplateDocument(
			{ id: ID, name: "Custom", format: "paragraphs", body: "One\n\nTwo" },
			registry,
		);
		expect(custom.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
		for (const block of custom.content) expect(isBlockId(block.id)).toBe(true);
	});

	it("stops the migration with a message that names the missing plugin when no installed plugin provides the format", async () => {
		await expect(seedTemplateDocument({ id: ID, name: "Text", format: "hugo", body: "x" }, NO_FORMATS)).rejects.toThrow(
			/seed template "Text" is written in the format "hugo", which no installed plugin provides/,
		);

		// A site that never installed the MDX package is told which package it is missing.
		const withoutMdx = createFormatRegistry([paragraphsFormat]);
		await expect(seedTemplateDocument({ id: ID, name: "Text", format: "mdx", body: "x" }, withoutMdx)).rejects.toThrow(
			/install @monti-cms\/mdx/,
		);
	});

	it("stops the migration for a seed text the format cannot read: a mistake in the config is not stored data", async () => {
		const registry = createFormatRegistry([paragraphsFormat]);
		await expect(
			seedTemplateDocument({ id: ID, name: "Open", format: "paragraphs", body: "Words <<< open" }, registry),
		).rejects.toThrow(/seed template "Open" could not be read as "paragraphs"/);
	});
});
