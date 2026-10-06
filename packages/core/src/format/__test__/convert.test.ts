import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { linkAddressKey } from "../../core/link-ids";
import { contentPath } from "../../core/links";
import type { CmsNode } from "../../mdx/types";
import { createWritePipeline } from "../../services/write-pipeline";
import { exportText, importText } from "../convert";
import { createFormatRegistry } from "../registry";
import { defineFormat } from "../types";
import { doc, paragraphsFormat } from "./paragraphs-format";

const ENTRY_ID = "123e4567-e89b-42d3-a456-426614174000";
const MEDIA_ID = "223e4567-e89b-42d3-a456-426614174000";

const paragraph = (text: string, id?: string): CmsNode => ({
	type: "paragraph",
	...(id ? { id } : {}),
	content: [{ type: "text", text }],
});

const registry = createFormatRegistry([paragraphsFormat]);
const options = { locale: "ko" };

describe("importText", () => {
	it("reads a text with the format that is named, and gives every block an id", async () => {
		const imported = await importText(registry, "paragraphs", "One\n\nTwo", options);

		expect(imported.issues).toEqual([]);
		expect(imported.doc.content).toHaveLength(2);
		for (const block of imported.doc.content) expect(block.id).toMatch(/^[0-9a-z]{8}$/);
	});

	it("pairs the blocks with the body it replaces, so they keep their ids", async () => {
		const first = await importText(registry, "paragraphs", "One\n\nTwo\n\nThree", options);
		const second = await importText(registry, "paragraphs", "One\n\nTwo, edited\n\nThree", {
			...options,
			previous: first.doc,
		});

		expect(second.doc.content.map((block) => block.id)).toEqual(first.doc.content.map((block) => block.id));
	});

	it("ignores the ids a format puts in the document it returns: ids are core's", async () => {
		const greedy = createFormatRegistry([
			defineFormat({
				name: "greedy",
				label: "Greedy",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: () => ({ ok: true, doc: doc(paragraph("a", "abcdefgh"), paragraph("b", "abcdefgh")) }),
			}),
		]);
		const previous = (await importText(registry, "paragraphs", "Other", options)).doc;

		const imported = await importText(greedy, "greedy", "x", { ...options, previous });

		const ids = imported.doc.content.map((block) => block.id);
		expect(ids).not.toContain("abcdefgh");
		expect(new Set(ids).size).toBe(2);
	});

	it("fails with unknown_format for a format nobody provides", async () => {
		await expect(importText(registry, "hugo", "x", options)).rejects.toMatchObject({
			code: "unknown_format",
			issues: [expect.objectContaining({ params: { format: "hugo" } })],
		});
	});

	it("fails with format_not_importable for a format that only writes", async () => {
		const oneWay = createFormatRegistry([
			defineFormat({ name: "oneway", label: "One way", mimeType: "text/plain", extension: "txt", export: () => "x" }),
		]);

		await expect(importText(oneWay, "oneway", "x", options)).rejects.toMatchObject({ code: "format_not_importable" });
	});

	it("keeps a text the format rejects as an unparsed document, with the format's findings", async () => {
		const imported = await importText(registry, "paragraphs", "Bad <<< text", options);

		expect(imported.issues).toEqual([
			expect.objectContaining({ code: "bad_marker", position: { line: 1, column: 1 } }),
		]);
		expect(imported.doc.content).toEqual([
			expect.objectContaining({ type: "unparsed", attrs: { format: "paragraphs", source: "Bad <<< text" } }),
		]);
	});

	it("throws the findings instead when the place cannot hold such a text", async () => {
		await expect(
			importText(registry, "paragraphs", "Bad <<< text", { ...options, strict: true }),
		).rejects.toMatchObject({
			code: "format_import_failed",
			issues: [expect.objectContaining({ code: "bad_marker" })],
		});
	});

	it("fails with format_import_failed when the format throws, without the plugin's own message", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const broken = createFormatRegistry([
			defineFormat({
				name: "broken",
				label: "Broken",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: () => {
					throw new Error("secret detail");
				},
			}),
		]);

		const error = await importText(broken, "broken", "x", options).catch((caught) => caught);

		expect(error).toMatchObject({ code: "format_import_failed" });
		expect(JSON.stringify(error.issues)).not.toContain("secret detail");
		quiet.mockRestore();
	});

	it("fails with format_import_failed when the format returns something that is not a stored document", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const wrong = createFormatRegistry([
			defineFormat({
				name: "wrong",
				label: "Wrong",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: () => ({ ok: true, doc: { type: "doc", version: 3, content: "nope" } as never }),
			}),
		]);

		await expect(importText(wrong, "wrong", "x", options)).rejects.toMatchObject({ code: "format_import_failed" });
		quiet.mockRestore();
	});

	it("rejects a text over the size limit, whatever the format", async () => {
		await expect(importText(registry, "paragraphs", "a".repeat(2 * 1024 * 1024 + 1), options)).rejects.toMatchObject({
			code: "body_too_large",
		});
	});

	it("puts the document a format returns in the canonical form every body is stored in", async () => {
		const uneven = createFormatRegistry([
			defineFormat({
				name: "uneven",
				label: "Uneven",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: () => ({
					ok: true,
					doc: doc(
						{
							type: "paragraph",
							content: [
								{ type: "text", text: "Hel" },
								{ type: "text", text: "lo" },
							],
						},
						{ type: "paragraph", content: [] },
					),
				}),
			}),
		]);

		const imported = await importText(uneven, "uneven", "x", options);

		expect(imported.doc.content).toHaveLength(1);
		expect(imported.doc.content[0]?.content).toEqual([{ type: "text", text: "Hello" }]);
	});
});

describe("exportText", () => {
	it("gives the format links and media already resolved, as lookups it can call synchronously", async () => {
		const source = doc(
			{
				type: "paragraph",
				content: [{ type: "text", text: "a post", marks: [{ type: "link", attrs: { entryId: ENTRY_ID } }] }],
			},
			{ type: "image", attrs: { mediaId: MEDIA_ID, alt: "pic" } },
		);

		const { text, warnings } = await exportText(registry, "paragraphs", source, {
			locale: "ko",
			purpose: "read",
			refs: {
				links: new Map([[ENTRY_ID, { url: "/en/posts/a-post", title: "A post", locale: "en" }]]),
				media: new Map([
					[MEDIA_ID, { url: "https://cdn.test/pic.png", filename: "pic.png", mimeType: "image/png", byteSize: 1 }],
				]),
			},
		});

		expect(text).toBe("[a post](/en/posts/a-post)\n\n![pic](https://cdn.test/pic.png)");
		expect(warnings).toEqual([]);
	});

	it("accepts the lookups as plain records too (what a read already holds)", async () => {
		const source = doc({
			type: "paragraph",
			content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { entryId: ENTRY_ID } }] }],
		});

		const { text } = await exportText(registry, "paragraphs", source, {
			locale: "ko",
			purpose: "read",
			refs: { links: { [ENTRY_ID]: { url: "/posts/x", title: null, locale: "ko" } }, media: {} },
		});

		expect(text).toBe("[x](/posts/x)");
	});

	it("returns what the format reported as warnings, and says what the text is for", async () => {
		const seen: string[] = [];
		const reporting = createFormatRegistry([
			defineFormat({
				name: "reporting",
				label: "Reporting",
				mimeType: "text/plain",
				extension: "txt",
				export: (_document, ctx) => {
					seen.push(ctx.purpose, ctx.locale);
					ctx.report({ code: "careful", message: "heads up" });
					return "text";
				},
			}),
		]);

		const { warnings } = await exportText(reporting, "reporting", doc(), {
			locale: "en",
			purpose: "sync",
			refs: { links: new Map(), media: new Map() },
		});

		expect(warnings).toEqual([{ code: "careful", message: "heads up" }]);
		expect(seen).toEqual(["sync", "en"]);
	});

	it("fails with unknown_format, and with format_export_failed when the format throws", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const refs = { links: new Map(), media: new Map() };
		await expect(exportText(registry, "hugo", doc(), { locale: "ko", purpose: "read", refs })).rejects.toMatchObject({
			code: "unknown_format",
		});
		const broken = createFormatRegistry([
			defineFormat({
				name: "broken",
				label: "Broken",
				mimeType: "text/plain",
				extension: "txt",
				export: () => {
					throw new Error("secret detail");
				},
			}),
		]);
		const error = await exportText(broken, "broken", doc(), { locale: "ko", purpose: "read", refs }).catch(
			(caught) => caught,
		);
		expect(error).toMatchObject({ code: "format_export_failed" });
		expect(JSON.stringify(error.issues)).not.toContain("secret detail");
		quiet.mockRestore();
	});
});

describe("a format a third party wrote, used through the write pipeline", () => {
	const pathOf = (slug: string) => contentPath(contentCollection, slug) as string;
	const input = (body: string, format = "paragraphs") =>
		({ collection: contentCollection, slug: "post", metadata: { title: "Post" }, body, format }) as never;

	it("is read, normalised by core (a path becomes an id, a media URL becomes a media id) and prepared like any body", async () => {
		const pipeline = createWritePipeline({
			formats: async () => registry,
			links: async (addresses) => new Map(addresses.map((address) => [linkAddressKey(address), ENTRY_ID])),
			media: async (urls) =>
				new Map(urls.filter((url) => url.startsWith("https://cdn.test/")).map((url) => [url, MEDIA_ID])),
		});

		const { snapshot } = await pipeline.run({
			operation: "create",
			locale: "ko",
			input: input(
				`See [a post](${pathOf("a-post")}).\n\n![pic](https://cdn.test/pic.png)\n\n![out](https://elsewhere.test/pic.png)`,
			),
		});

		const text = JSON.stringify(snapshot.doc);
		expect(text).toContain(`"entryId":"${ENTRY_ID}"`);
		expect(text).not.toContain(pathOf("a-post"));
		expect(snapshot.doc.content[1]?.attrs).toEqual({ alt: "pic", mediaId: MEDIA_ID });
		// An image whose URL is not a registered file stays as written.
		expect(snapshot.doc.content[2]?.attrs).toEqual({ alt: "out", src: "https://elsewhere.test/pic.png" });
		expect(snapshot.references).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "entry", targetId: ENTRY_ID }),
				expect.objectContaining({ kind: "media", targetId: MEDIA_ID }),
			]),
		);
		expect(snapshot.contentHash).toBeTruthy();
	});

	it("cannot get anything past core: a text it rejects is kept as an unparsed draft that cannot be published", async () => {
		const pipeline = createWritePipeline({ formats: async () => registry });

		const { snapshot } = await pipeline.run({ operation: "create", locale: "ko", input: input("Bad <<< text") });

		expect(snapshot.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { format: "paragraphs" } });
		expect(snapshot.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["bad_marker", "unparsed_body"]));
	});

	it("fails the write when the format is not installed", async () => {
		const pipeline = createWritePipeline({ formats: async () => registry });

		await expect(pipeline.run({ operation: "create", locale: "ko", input: input("x", "hugo") })).rejects.toMatchObject({
			code: "unknown_format",
		});
	});

	it("gives the format the language of the entry and the entry being written", async () => {
		const seen: { locale: string; entryId?: string }[] = [];
		const spying = createFormatRegistry([
			defineFormat({
				name: "spying",
				label: "Spying",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: (_text, ctx) => {
					seen.push({ locale: ctx.locale, entryId: ctx.entryId });
					return { ok: true, doc: doc(paragraph("x")) };
				},
			}),
		]);
		const pipeline = createWritePipeline({ formats: async () => spying });

		await pipeline.run({ operation: "save", entryId: ENTRY_ID, locale: "en", input: input("x", "spying") });

		expect(seen).toEqual([{ locale: "en", entryId: ENTRY_ID }]);
	});

	it("keeps block ids across saves: the text replaces the draft's body and its blocks pair up", async () => {
		const pipeline = createWritePipeline({ formats: async () => registry });
		const first = await pipeline.run({ operation: "create", locale: "ko", input: input("One\n\nTwo") });

		const second = await pipeline.run({
			operation: "save",
			entryId: ENTRY_ID,
			locale: "ko",
			input: input("One\n\nTwo, edited"),
			prepare: { previousDoc: first.snapshot.doc },
		});

		expect(second.snapshot.doc.content.map((block) => block.id)).toEqual(
			first.snapshot.doc.content.map((block) => block.id),
		);
	});

	it("hands the findings of a text it could read, such as warnings, to the write", async () => {
		const warning = createFormatRegistry([
			defineFormat({
				name: "warning",
				label: "Warning",
				mimeType: "text/plain",
				extension: "txt",
				export: () => "",
				import: () => ({
					ok: true,
					doc: doc(paragraph("x")),
					warnings: [{ code: "lossy", message: "dropped a thing", blockIndex: 0 }],
				}),
			}),
		]);
		const pipeline = createWritePipeline({ formats: async () => warning });

		const { snapshot } = await pipeline.run({ operation: "create", locale: "ko", input: input("x", "warning") });

		expect(snapshot.warnings).toContainEqual(
			expect.objectContaining({ code: "lossy", position: { blockId: snapshot.doc.content[0]?.id } }),
		);
	});
});
