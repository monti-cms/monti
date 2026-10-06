import { describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../test/stored-content";
import { entryLinkHref, entryLinkIds } from "../../mdx/entry-links";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../mdx/stored-document";
import { syntaxBlocks, syntaxCodeLineEffects } from "../../mdx/syntax";
import { mdxFormat } from "../mdx";
import type { FormatExportContext, FormatIssue, FormatLink, FormatMedia } from "../types";

const ENTRY_ID = "123e4567-e89b-42d3-a456-426614174000";
const MEDIA_ID = "223e4567-e89b-42d3-a456-426614174000";

const link = (url: string): FormatLink => ({ url, title: "Target", locale: "ko" });
const media = (url: string): FormatMedia => ({
	url,
	filename: "photo.png",
	mimeType: "image/png",
	byteSize: 10,
	width: 4,
	height: 3,
});

const exportContext = (
	options: { purpose?: "read" | "sync"; links?: Record<string, FormatLink>; media?: Record<string, FormatMedia> } = {},
) => {
	const reported: FormatIssue[] = [];
	const ctx: FormatExportContext = {
		locale: "ko",
		blocks: syntaxBlocks,
		codeLineEffects: syntaxCodeLineEffects,
		purpose: options.purpose ?? "read",
		link: (id) => options.links?.[id] ?? null,
		media: (id) => options.media?.[id] ?? null,
		report: (issue) => reported.push(issue),
	};
	return { ctx, reported };
};

/** A document with an internal link by id and a registered image, as the stored document holds them. */
const documentWith = (body: string): StoredDocument => docOf(body);

describe("the built-in mdx format", () => {
	it("is a two-way format with the usual file facts", () => {
		expect(mdxFormat).toMatchObject({ name: "mdx", extension: "mdx", mimeType: "text/mdx" });
		expect(typeof mdxFormat.import).toBe("function");
	});

	describe("export", () => {
		it("writes an internal link as the real path of its target, never as an id", async () => {
			const doc = documentWith(`See [the target](${entryLinkHref(ENTRY_ID)}) now.`);
			expect(entryLinkIds(doc.content)).toEqual([ENTRY_ID]);
			const { ctx, reported } = exportContext({ links: { [ENTRY_ID]: link("/en/posts/the-target") } });

			const text = await mdxFormat.export(doc, ctx);

			expect(text).toContain("[the target](/en/posts/the-target)");
			expect(text).not.toContain(ENTRY_ID);
			expect(text).not.toContain("entry:");
			expect(reported).toEqual([]);
		});

		it("follows the target when its address changes: the same document is written with the new path", async () => {
			const doc = documentWith(`[x](${entryLinkHref(ENTRY_ID)})`);
			const before = await mdxFormat.export(doc, exportContext({ links: { [ENTRY_ID]: link("/posts/old") } }).ctx);
			const after = await mdxFormat.export(doc, exportContext({ links: { [ENTRY_ID]: link("/posts/new") } }).ctx);

			expect(before).toContain("(/posts/old)");
			expect(after).toContain("(/posts/new)");
		});

		it("drops a link whose target cannot be resolved when the text is for readers, keeping its label, and reports it", async () => {
			const doc = documentWith(`See [the target](${entryLinkHref(ENTRY_ID)}) now.`);
			const { ctx, reported } = exportContext({ purpose: "read" });

			const text = await mdxFormat.export(doc, ctx);

			expect(text).toContain("See the target now.");
			expect(text).not.toContain("](");
			expect(reported).toEqual([expect.objectContaining({ code: "unresolved_internal_link", message: ENTRY_ID })]);
		});

		it("keeps the id of an unresolved link when the text is meant to be imported again", async () => {
			const doc = documentWith(`See [the target](${entryLinkHref(ENTRY_ID)}) now.`);
			const { ctx, reported } = exportContext({ purpose: "sync" });

			const text = await mdxFormat.export(doc, ctx);

			expect(text).toContain(`[the target](${entryLinkHref(ENTRY_ID)})`);
			expect(reported).toHaveLength(1);
		});

		it("leaves external links alone", async () => {
			const text = await mdxFormat.export(documentWith("[out](https://example.com/a)"), exportContext().ctx);
			expect(text).toContain("[out](https://example.com/a)");
		});

		it("writes a registered image by its public URL for readers, and by its id when the text is to be imported again", async () => {
			const doc = documentWith(`<Image mediaId="${MEDIA_ID}" alt="a photo" />`);
			const resolved = { [MEDIA_ID]: media("https://cdn.test/photo.png") };

			const forReaders = await mdxFormat.export(doc, exportContext({ purpose: "read", media: resolved }).ctx);
			const forSync = await mdxFormat.export(doc, exportContext({ purpose: "sync", media: resolved }).ctx);

			expect(forReaders).toContain("https://cdn.test/photo.png");
			expect(forReaders).not.toContain(MEDIA_ID);
			expect(forSync).toContain(MEDIA_ID);
			expect(forSync).not.toContain("cdn.test");
		});

		it("reports an image whose media is not ready, and keeps it as it is", async () => {
			const doc = documentWith(`<Image mediaId="${MEDIA_ID}" alt="a photo" />`);
			const { ctx, reported } = exportContext({ purpose: "read" });

			const text = await mdxFormat.export(doc, ctx);

			expect(text).toContain(MEDIA_ID);
			expect(reported).toEqual([expect.objectContaining({ code: "unresolved_media", message: MEDIA_ID })]);
		});

		it("writes a file card as a link to the file for readers", async () => {
			const doc: StoredDocument = {
				type: "doc",
				version: STORED_DOCUMENT_VERSION,
				content: [{ type: "file", attrs: { mediaId: MEDIA_ID, label: "The report" } }],
			};
			const text = await mdxFormat.export(
				doc,
				exportContext({ media: { [MEDIA_ID]: media("https://cdn.test/report.pdf") } }).ctx,
			);

			expect(text).toContain("[The report](https://cdn.test/report.pdf)");
		});

		it("does not change the document it is given", async () => {
			const doc = documentWith(`[x](${entryLinkHref(ENTRY_ID)}) <Image mediaId="${MEDIA_ID}" alt="a" />`);
			const snapshot = JSON.stringify(doc);

			await mdxFormat.export(
				doc,
				exportContext({
					links: { [ENTRY_ID]: link("/posts/x") },
					media: { [MEDIA_ID]: media("https://cdn.test/a.png") },
				}).ctx,
			);

			expect(JSON.stringify(doc)).toBe(snapshot);
		});
	});

	describe("import", () => {
		const importContext = { locale: "ko", blocks: syntaxBlocks, codeLineEffects: syntaxCodeLineEffects };

		it("reads a text into a stored document, without block ids (core gives them)", async () => {
			const result = await mdxFormat.import?.("# Title\n\nSome *words*\n", importContext);

			expect(result?.ok).toBe(true);
			if (!result?.ok) return;
			expect(result.doc.version).toBe(STORED_DOCUMENT_VERSION);
			expect(result.doc.content.map((block) => block.type)).toEqual(["heading", "paragraph"]);
			expect(JSON.stringify(result.doc)).not.toContain('"id"');
		});

		it("reads a path back as a plain href: turning it into an id is core's job, whatever the format", async () => {
			const result = await mdxFormat.import?.("[a post](/posts/the-target)", importContext);

			expect(result?.ok).toBe(true);
			if (!result?.ok) return;
			expect(JSON.stringify(result.doc)).toContain('"href":"/posts/the-target"');
			expect(entryLinkIds(result.doc.content)).toEqual([]);
		});

		it("reads the entry:<id> form into a link by id", async () => {
			const result = await mdxFormat.import?.(`[a post](${entryLinkHref(ENTRY_ID)})`, importContext);

			expect(result?.ok).toBe(true);
			if (!result?.ok) return;
			expect(entryLinkIds(result.doc.content)).toEqual([ENTRY_ID]);
		});

		it("rejects a text that does not parse, with the line and column in that text", async () => {
			const result = await mdxFormat.import?.("Words\n\n<Unclosed", importContext);

			expect(result?.ok).toBe(false);
			if (result?.ok !== false) return;
			expect(result.issues.length).toBeGreaterThan(0);
			for (const issue of result.issues) {
				expect(issue.code).toBe("mdx_error");
				expect(issue.position?.line).toBeGreaterThanOrEqual(1);
				expect(issue.position?.column).toBeGreaterThanOrEqual(1);
			}
		});

		it("rejects a text with front matter, which a document cannot hold", async () => {
			const result = await mdxFormat.import?.("---\ntitle: x\n---\n\nBody", importContext);

			expect(result?.ok).toBe(false);
			if (result?.ok !== false) return;
			expect(result.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));
		});

		it("reports a code annotation that reaches past the code, naming the block by its index", async () => {
			const text = "Intro\n\n```ts\n// @line plus {3-9}\nconst a = 1;\nconst b = 2;\n```\n";
			const result = await mdxFormat.import?.(text, importContext);

			expect(result?.ok).toBe(true);
			if (!result?.ok) return;
			expect(result.warnings).toEqual([
				expect.objectContaining({ code: "code_annotation_out_of_range", blockIndex: 1 }),
			]);
		});
	});

	it("reads back what it wrote: export then import gives the same content, for a body without internal links or media", async () => {
		const body = "# Title\n\nSome *words* and **more** with `code`.\n\n- one\n- two\n\n> quoted\n";
		const doc = docOf(body);
		const text = await mdxFormat.export(doc, exportContext().ctx);
		const back = await mdxFormat.import?.(text, {
			locale: "ko",
			blocks: syntaxBlocks,
			codeLineEffects: syntaxCodeLineEffects,
		});

		expect(back?.ok).toBe(true);
		if (!back?.ok) return;
		expect(contentOf(back.doc)).toEqual(contentOf(doc));
	});

	it("reads back a link it wrote for another consumer as a link to that path", async () => {
		const doc = documentWith(`[x](${entryLinkHref(ENTRY_ID)})`);
		const text = await mdxFormat.export(doc, exportContext({ links: { [ENTRY_ID]: link("/en/posts/x") } }).ctx);
		const back = await mdxFormat.import?.(text, {
			locale: "ko",
			blocks: syntaxBlocks,
			codeLineEffects: syntaxCodeLineEffects,
		});

		expect(back?.ok).toBe(true);
		if (!back?.ok) return;
		expect(JSON.stringify(back.doc)).toContain('"href":"/en/posts/x"');
	});
});
