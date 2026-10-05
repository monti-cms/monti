import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { forEachBlock } from "../../mdx/block-ids";
import type { StoredDocument } from "../../mdx/stored-document";
import type { CmsNode } from "../../mdx/types";
import { prepareSnapshot, validateForPublish } from "../snapshot";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";

const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");

/** The block with this id, as `type: text`. */
const describeBlock = (doc: StoredDocument | null, id: string | undefined): string | undefined => {
	let found: string | undefined;
	if (doc) {
		forEachBlock(doc.content, (block) => {
			if (block.id === id) found = `${block.type}: ${textOf(block)}`;
		});
	}
	return found;
};

const prepare = (mdx: string) =>
	prepareSnapshot({ collection: contentCollection, slug: "position", metadata: { title: "Position" }, mdx });

describe("block ids of body positions", () => {
	it("names the block of a missing image alt and an invalid block attribute", async () => {
		const snapshot = await prepare(
			`First paragraph.\n\n<Image mediaId="${MEDIA_ID}" />\n\n<TextAlign align="bogus">\n\nAligned.\n\n</TextAlign>\n`,
		);
		const alt = snapshot.issues.find((issue) => issue.code === "missing_image_alt");
		expect(describeBlock(snapshot.doc, alt?.position?.blockId)).toBe("image: ");
		expect(alt?.position?.line).toBe(3);
		const attribute = snapshot.issues.find((issue) => issue.code === "invalid_block_attribute");
		expect(describeBlock(snapshot.doc, attribute?.position?.blockId)).toBe("text-align: Aligned.");
	});

	it("names the block of a reference occurrence and of an image source", async () => {
		const snapshot = await prepare(
			`Intro.\n\n<Image mediaId="${MEDIA_ID}" alt="a" />\n\n![outside](https://example.com/a.png)\n\ntext ![inline](https://example.com/b.png) text\n`,
		);
		const media = snapshot.references.find((reference) => reference.targetId === MEDIA_ID);
		const [occurrence] = media?.occurrences ?? [];
		expect(occurrence).toMatchObject({ type: "mdx", line: 3, column: 1 });
		expect(describeBlock(snapshot.doc, occurrence?.type === "mdx" ? occurrence.blockId : undefined)).toBe("image: ");
		expect(
			snapshot.imageSources.map((source) => [
				source.mediaId ?? source.src,
				describeBlock(snapshot.doc, source.position.blockId),
			]),
		).toEqual([
			[MEDIA_ID, "image: "],
			["https://example.com/a.png", "image: "],
			["https://example.com/b.png", "paragraph: text  text"],
		]);
	});

	it("names the block of footnote issues", async () => {
		const snapshot = await prepare("Cites[^gone] a note.\n\n[^spare]: Nobody cites me.\n");
		const byCode = (code: string) => snapshot.warnings?.find((warning) => warning.code === code);
		expect(describeBlock(snapshot.doc, byCode("footnote_definition_missing")?.position?.blockId)).toBe(
			"paragraph: Cites a note.",
		);
		expect(describeBlock(snapshot.doc, byCode("footnote_definition_unused")?.position?.blockId)).toBe(
			"footnoteDefinition: Nobody cites me.",
		);
	});

	it("names the block of an untranslated notice", async () => {
		const snapshot = await prepare("Done.\n\n<Untranslated>Source text</Untranslated>\n");
		const untranslated = snapshot.issues.find((issue) => issue.code === "untranslated_text");
		expect(describeBlock(snapshot.doc, untranslated?.position?.blockId)).toMatch(/^paragraph: .*Source text/);
	});

	it("names the block of a Table span warning", async () => {
		const snapshot = await prepare(
			"<Table>\n<TableRow>\n<TableCell>a</TableCell>\n<TableCell>b</TableCell>\n</TableRow>\n<TableRow>\n<TableCell>c</TableCell>\n</TableRow>\n</Table>\n",
		);
		const span = snapshot.warnings?.find((warning) => warning.code === "invalid_table_span");
		expect(span?.position).toMatchObject({ line: 1, column: 1 });
		expect(describeBlock(snapshot.doc, span?.position?.blockId)).toBe("table: abc");
	});

	it("gives no block id to a body without a document", async () => {
		const snapshot = await prepare(`---\ntitle: x\n---\n\n<Image mediaId="${MEDIA_ID}" />\n`);
		expect(snapshot.doc).toBeNull();
		const alt = snapshot.issues.find((issue) => issue.code === "missing_image_alt");
		expect(alt?.position).toBeDefined();
		expect(alt?.position).not.toHaveProperty("blockId");
		const occurrences = snapshot.references.flatMap((reference) => reference.occurrences);
		expect(occurrences.length).toBeGreaterThan(0);
		for (const occurrence of occurrences) expect(occurrence).not.toHaveProperty("blockId");
	});

	it("gives the same occurrences when the same body is prepared again with the document it replaces", async () => {
		const mdx = `# Title\n\n<Image mediaId="${MEDIA_ID}" alt="a" />\n\nText.\n`;
		const first = await prepare(mdx);
		const again = await prepareSnapshot(
			{ collection: contentCollection, slug: "position", metadata: { title: "Position" }, mdx },
			{ previousDoc: first.doc },
		);
		expect(again.references).toEqual(first.references);
		expect(again.references[0]?.occurrences[0]).toHaveProperty("blockId");
		// Written from the document it was read from, the same.
		const fromDoc = await prepareSnapshot(
			{ collection: contentCollection, slug: "position", metadata: { title: "Position" }, doc: first.doc },
			{ previousDoc: first.doc },
		);
		expect(fromDoc.references).toEqual(first.references);
	});

	it("keeps the block id of a previous reference carried over as stale when the body does not parse", async () => {
		const previousReferences = [
			{
				kind: "media" as const,
				targetId: MEDIA_ID,
				isStale: false,
				occurrences: [{ type: "mdx" as const, line: 3, column: 1, blockId: "abcd1234" }],
			},
		];
		const snapshot = await prepareSnapshot(
			{ collection: contentCollection, slug: "position", metadata: { title: "Position" }, mdx: "Words\n\n<Unclosed" },
			{ previousReferences },
		);
		expect(snapshot.doc).toBeNull();
		const carried = snapshot.references.find((reference) => reference.targetId === MEDIA_ID);
		expect(carried).toEqual({ ...previousReferences[0], isStale: true });
	});

	it("carries the stored block id into the issues validation makes from occurrences", async () => {
		const snapshot = await prepare(`Intro.\n\n<Image mediaId="${MEDIA_ID}" alt="a" />\n`);
		const result = validateForPublish(snapshot, { targets: [], media: [] });
		const unresolved = result.issues.find((issue) => issue.code === "unresolved_media");
		expect(unresolved?.position).toMatchObject({ line: 3, column: 1 });
		expect(describeBlock(snapshot.doc, unresolved?.position?.blockId)).toBe("image: ");
	});
});
