import { describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../test/any-site";
import { docOf as docOfText } from "../../../test/stored-content";
import { entryLinkHref, linkMarkAttrs, mapLinkAttrs } from "../../doc/entry-links";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import { createWritePipeline } from "../../services/write-pipeline";
import { checkDocument } from "../body-check";
import { internalLinkAddresses, linkAddressKey, withEntryLinks } from "../link-ids";
import { contentPath } from "../links";
import { prepareSnapshot, validateForPublish } from "../snapshot";
import type { ServiceInput } from "../types";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const pathOf = (slug: string) => contentPath(contentCollection, slug) as string;

/** The text read by the test reader, with a link to `entry:<id>` made an entry link, as a format that knows the notation writes it. */
const docOf = (text: string): StoredDocument => {
	const doc = docOfText(text);
	const content = mapLinkAttrs(doc.content, (attrs) =>
		typeof attrs.href === "string"
			? linkMarkAttrs(attrs.href, typeof attrs.title === "string" ? attrs.title : null)
			: undefined,
	);
	return { ...doc, content: content as CmsNode[] };
};

const formats = async () => createFormatRegistry([paragraphsFormat]);

/** A write of a body given as a document (the text read by the test reader). */
const input = async (text: string): Promise<ServiceInput> =>
	({
		collection: contentCollection,
		slug: "post",
		metadata: await requiredMetadata(contentCollection, "Post", async () => "00000000-0000-4000-8000-000000000009"),
		doc: docOf(text),
	}) as ServiceInput;

/** A write of the same body given as text in a format. */
const textInput = async (text: string): Promise<ServiceInput> => {
	const { doc: _doc, ...rest } = (await input("")) as ServiceInput & { doc?: unknown };
	return { ...rest, format: "paragraphs", body: text } as ServiceInput;
};

describe("checking links by entry id", () => {
	it("records one reference per target, with the block of every link, and no href check for it", async () => {
		const snapshot = await prepareSnapshot(
			await input(`One [a](${entryLinkHref(ID)}).\n\nTwo [b](${entryLinkHref(ID)}).`),
		);

		const reference = snapshot.references.find((ref) => ref.kind === "entry" && ref.targetId === ID);
		expect(reference?.occurrences).toHaveLength(2);
		expect(reference?.occurrences.every((o) => o.type === "body" && typeof o.blockId === "string")).toBe(true);
		expect(new Set(reference?.occurrences.map((o) => (o.type === "body" ? o.blockId : "")))).toHaveProperty("size", 2);
		expect(snapshot.internalLinks).toEqual([]);
	});

	it("an id that is not an id is a body error and the body's references are not trusted", () => {
		const check = checkDocument(docOf("[x](entry:00000000-0000-4000-8000-000000000001)"));
		expect(check.entryLinks).toHaveLength(1);
		const bad = checkDocument({
			type: "doc",
			version: 3,
			content: [
				{
					id: "aaaaaaaa",
					type: "paragraph",
					content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { entryId: "nope" } }] }],
				},
			],
		});
		expect(bad.issues.map((issue) => issue.code)).toContain("invalid_reference_id");
		expect(bad.incomplete).toBe(true);
	});

	it("publishing reports a target that is gone, unpublished, a translation or not linkable with the link codes, at the link's block", async () => {
		const snapshot = await prepareSnapshot(await input(`[a](${entryLinkHref(ID)})`));
		const blockId = snapshot.references.find((ref) => ref.targetId === ID)?.occurrences.find((o) => o.type === "body");
		const result = (target: Parameters<typeof validateForPublish>[1]["targets"][number] | undefined) =>
			validateForPublish(snapshot, { targets: target ? [target] : [], media: [] });
		const codes = (target: Parameters<typeof validateForPublish>[1]["targets"][number] | undefined) =>
			result(target).issues.filter((issue) => issue.code.endsWith("internal_link"));

		expect(codes(undefined).map((issue) => issue.code)).toEqual(["unresolved_internal_link"]);
		// A target that is not published is a warning, at the link's block: it does not block publishing (the link is plain text until the target is published).
		const unpublished = result({ id: ID, collection: contentCollection, isPublished: false });
		expect(unpublished.issues.filter((issue) => issue.code.endsWith("internal_link"))).toEqual([]);
		expect(unpublished.warnings.filter((issue) => issue.code === "unpublished_internal_link")).toEqual([
			expect.objectContaining({ position: blockId?.type === "body" ? { blockId: blockId.blockId } : {} }),
		]);
		expect(
			codes({ id: ID, collection: contentCollection, isPublished: true, isSource: false }).map((i) => i.code),
		).toEqual(["unresolved_internal_link"]);
		expect(codes({ id: ID, collection: contentCollection, isPublished: true, isSource: true })).toEqual([]);
		expect(codes(undefined)[0]?.position).toEqual(
			blockId && blockId.type === "body" ? { blockId: blockId.blockId } : {},
		);
	});
});

describe("turning links by address into links by id", () => {
	it("finds the addresses of this site's content, each once, and no others", () => {
		const doc = docOf(
			`[a](${pathOf("a")}) [again](${pathOf("a")}) [b](${pathOf("b")}) [out](https://example.com/a) [id](${entryLinkHref(ID)})`,
		);

		expect(internalLinkAddresses(doc.content)).toEqual([
			{ collection: contentCollection, slug: "a" },
			{ collection: contentCollection, slug: "b" },
		]);
	});

	it("changes a link whose address resolves, leaves one that does not, and returns the same document when nothing changes", () => {
		const doc = docOf(`[a](${pathOf("a")}) [b](${pathOf("b")})`);
		const found = new Map([[linkAddressKey({ collection: contentCollection, slug: "a" }), ID]]);

		const next = withEntryLinks(doc, found);

		const text = JSON.stringify(next);
		expect(text).toContain(`"entryId":"${ID}"`);
		expect(text).toContain(pathOf("b"));
		expect(text).not.toContain(pathOf("a"));
		expect(withEntryLinks(doc, new Map())).toBe(doc);
	});

	it("the write pipeline does it for text and for a document, and keeps the input as it came when there is nothing to do", async () => {
		const seen: string[] = [];
		const pipeline = createWritePipeline({
			formats,
			links: async (addresses) => {
				seen.push(...addresses.map(linkAddressKey));
				return new Map(addresses.map((address) => [linkAddressKey(address), ID]));
			},
		});
		const run = (given: ServiceInput) => pipeline.run({ operation: "create", locale: "ko", input: given });

		const fromText = await run(await textInput(`[a](${pathOf("a")})`));
		const fromDoc = await run(await input(`[a](${pathOf("a")})`));
		const plain = await run(await input("No links."));

		for (const result of [fromText, fromDoc]) {
			expect(JSON.stringify(result.snapshot.doc)).toContain(`"entryId":"${ID}"`);
			expect(result.snapshot.references.some((ref) => ref.kind === "entry" && ref.targetId === ID)).toBe(true);
		}
		expect(JSON.stringify(plain.snapshot.doc)).not.toContain("entryId");
		expect(seen).toEqual([
			linkAddressKey({ collection: contentCollection, slug: "a" }),
			linkAddressKey({ collection: contentCollection, slug: "a" }),
		]);
	});

	it("without a resolver, links keep their address", async () => {
		const result = await createWritePipeline().run({
			operation: "create",
			locale: "ko",
			input: await input(`[a](${pathOf("a")})`),
		});

		expect(JSON.stringify(result.snapshot.doc)).toContain(pathOf("a"));
		expect(result.snapshot.internalLinks).toHaveLength(1);
	});
});
