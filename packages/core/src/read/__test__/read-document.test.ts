import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, requiredMetadata } from "../../../test/any-site";
import { type Cms, fakeCms } from "../../cms";
import type { Collection } from "../../core/collections";
import { contentPath } from "../../core/links";
import { localizePath } from "../../core/locales";
import type { ContentStore, Entry } from "../../core/store";
import { publishDraft, seedEntry } from "../../core/store/__test__/seed";
import { collectRefs } from "../../mdx/document-refs";
import { entryLinkIds } from "../../mdx/entry-links";
import { CmsContent } from "../../render";
import { createContentService } from "../../services/content-service";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../testing";

/** The read API returns the stored document and what it points to (`doc`, `refs`), and a page renders them with `CmsContent`. */
describe("cms.read returns the document", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let cms: Cms;
	let service: ReturnType<typeof createContentService<Entry>>;
	let relationTarget: (to: Collection) => Promise<string>;

	/** A ready image, a ready attachment and an upload that never finished. */
	const media = { ready: "", other: "", attachment: "", pending: "" };
	const publicUrl = (key: string) => `https://cdn.test/${key}`;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		relationTarget = fillRequiredMetadata(store).relationTarget as typeof relationTarget;
		service = createContentService<Entry>(store);
		cms = fakeCms({
			store,
			mediaStore: { getPublicUrl: publicUrl },
			verifyAdmin: async () => ({ userId: "u", accountId: "a", isAdmin: true }),
		});

		const ready = async (name: string, width: number | null, height: number | null, mimeType: string) => {
			const asset = await store.createMediaAsset({
				filename: name,
				mimeType,
				byteSize: 10,
				stagingKey: `staging/${name}`,
			});
			await store.completeMediaAsset({
				id: asset.id,
				storageKey: `media/${name}`,
				mimeType,
				byteSize: 10,
				width,
				height,
			});
			return asset.id;
		};
		media.ready = await ready("photo.png", 640, 480, "image/png");
		media.other = await ready("other.png", 10, 10, "image/png");
		media.attachment = await ready("deck.pdf", null, null, "application/pdf");
		media.pending = (
			await store.createMediaAsset({
				filename: "pending.png",
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: "staging/pending.png",
			})
		).id;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	/** A draft written the way the app writes one: the body goes through the write pipeline, which stores its document. */
	const draft = async (slug: string, mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug,
			metadata: await requiredMetadata(contentCollection, `Title ${slug}`, relationTarget),
			format: "mdx",
			body: mdx,
		} as never);

	const publish = async (slug: string, mdx: string) => {
		const created = await draft(slug, mdx);
		return publishDraft(store, { id: created.id, expectedVersion: created.version });
	};

	const bodyWith = (...lines: string[]) => lines.join("\n\n");
	const image = (id: string, alt: string) => `<Image mediaId="${id}" alt="${alt}" />`;

	it("one entry: returns the stored document and the resolved media of exactly that document", async () => {
		const published = await publish(
			"doc-detail",
			bodyWith("## Intro", image(media.ready, "photo"), `<File mediaId="${media.attachment}" label="Deck" />`),
		);

		const found = await cms.read.getEntry({ collection: contentCollection, slug: "doc-detail" });
		if (found.status !== "found") throw new Error("not found");
		const { entry } = found;
		// The document that was stored, not one parsed again from `mdx`.
		expect(entry.doc).toEqual((await store.getEntry(published.id)).published?.doc);
		expect(entry.doc).toMatchObject({ type: "doc" });
		// Every media the document uses is resolved, and nothing else is (another ready media exists in the store).
		expect(Object.keys(entry.refs.media).sort()).toEqual([...collectRefs(entry.doc).media].sort());
		expect(entry.refs.media[media.ready]).toEqual({
			url: publicUrl("media/photo.png"),
			width: 640,
			height: 480,
			file: { filename: "photo.png", byteSize: 10, mimeType: "image/png" },
		});
		expect(entry.refs.media[media.attachment]).toMatchObject({
			url: publicUrl("media/deck.pdf"),
			file: { filename: "deck.pdf", mimeType: "application/pdf" },
		});
		expect(entry.refs.media).not.toHaveProperty(media.other);
	});

	it("a media that is not ready resolves to the reason, and an entry without media has empty refs", async () => {
		await publish("doc-pending", image(media.pending, "later"));
		const pending = await cms.read.getEntry({ collection: contentCollection, slug: "doc-pending" });
		if (pending.status !== "found") throw new Error("not found");
		expect(pending.entry.refs.media).toEqual({ [media.pending]: { failure: "not-ready" } });

		await publish("doc-plain", "Just text");
		const plain = await cms.read.getEntry({ collection: contentCollection, slug: "doc-plain" });
		if (plain.status !== "found") throw new Error("not found");
		expect(plain.entry.refs).toEqual({ media: {}, links: {} });
		expect(plain.entry.doc).not.toBeNull();
	});

	it("a page renders the entry with CmsContent, with no image resolver", async () => {
		await publish("doc-render", bodyWith("## Heading", image(media.ready, "the photo")));
		const found = await cms.read.getEntry({ collection: contentCollection, slug: "doc-render", format: "mdx" });
		if (found.status !== "found") throw new Error("not found");

		const markup = renderToStaticMarkup(await CmsContent({ entry: found.entry }));

		expect(markup).toContain("Heading");
		expect(markup).toContain(publicUrl("media/photo.png"));
		// The text of the body in a format gives the same address for the same body (the image is written by its URL).
		const resolve = await cms.read.imageResolver(found.entry.body?.text ?? "");
		expect(resolve({ src: publicUrl("media/photo.png") })).toMatchObject({ url: publicUrl("media/photo.png") });
	});

	it("a list reads the document only with the body, and each item gets only the media its own document uses", async () => {
		const first = await publish("doc-list-1", image(media.ready, "one"));
		const second = await publish("doc-list-2", image(media.other, "two"));

		const bare = await cms.read.listEntries({ collection: contentCollection, pageSize: 100 });
		for (const item of bare.items) {
			expect(item.doc).toBeNull();
			expect(item.refs).toEqual({ media: {}, links: {} });
		}

		const full = await cms.read.listEntries({ collection: contentCollection, pageSize: 100, body: true });
		const byId = new Map(full.items.map((item) => [item.id, item]));
		expect(Object.keys(byId.get(first.id)?.refs.media ?? {})).toEqual([media.ready]);
		expect(Object.keys(byId.get(second.id)?.refs.media ?? {})).toEqual([media.other]);
		for (const item of full.items) {
			expect(item.doc).not.toBeNull();
			expect(Object.keys(item.refs.media).sort()).toEqual([...collectRefs(item.doc).media].sort());
		}
	});

	it("preview returns the draft document and its media, and a published read still shows the published one", async () => {
		const published = await publish("doc-preview", "Published text");
		await service.saveDraft(published.id, {
			collection: contentCollection,
			slug: published.workingSlug,
			metadata: published.working.metadata as never,
			format: "mdx",
			body: image(media.ready, "edited draft"),
			expectedVersion: published.version,
		});
		const edited = await cms.read.getPreview({ collection: contentCollection, slug: "doc-preview" });
		expect(edited?.doc).toEqual((await store.getEntry(published.id)).working.doc);
		expect(collectRefs(edited?.doc).media).toEqual([media.ready]);
		expect(edited?.refs.media[media.ready]).toMatchObject({ url: publicUrl("media/photo.png") });

		// A draft that was never published: its media may not be ready yet.
		const bodyOfDraft = await draft("doc-preview-draft", image(media.pending, "draft only"));
		const preview = await cms.read.getPreview({ collection: contentCollection, slug: "doc-preview-draft" });
		expect(bodyOfDraft.working.doc).not.toBeNull();
		expect(preview?.doc).toEqual(bodyOfDraft.working.doc);
		expect(preview?.refs.media).toEqual({ [media.pending]: { failure: "not-ready" } });

		const stillPublished = await cms.read.getEntry({ collection: contentCollection, slug: "doc-preview" });
		if (stillPublished.status !== "found") throw new Error("not found");
		expect(JSON.stringify(stillPublished.entry.doc)).toContain("Published text");
		expect(stillPublished.entry.refs).toEqual({ media: {}, links: {} });
	});

	it("a draft that could not become a document previews as an unparsed body, with no references", async () => {
		const unparsed = await seedEntry(store, {
			collection: contentCollection,
			slug: "doc-unparsed",
			metadata: { title: "Unparsed" },
			mdx: "---\ntitle: front matter\n---\n\nBody",
		});

		const preview = await cms.read.getPreview({ collection: contentCollection, slug: "doc-unparsed", format: "mdx" });

		expect(unparsed.working.doc.content).toEqual([expect.objectContaining({ type: "unparsed" })]);
		expect(preview).toMatchObject({ refs: { media: {} } });
		expect(preview?.doc?.content[0]).toMatchObject({ type: "unparsed", attrs: { format: "mdx" } });
		expect(preview?.body?.text).toContain("Body");
	});

	describe("with a format", () => {
		const pathOf = (slug: string) => contentPath(contentCollection, slug) as string;

		it("also writes the body as text: a link to a published entry is the real path of its target, an image is its public URL", async () => {
			const target = await publish("fmt-target", "Target body");
			await publish("fmt-source", bodyWith(`See [the target](${pathOf("fmt-target")}).`, image(media.ready, "photo")));

			const found = await cms.read.getEntry({ collection: contentCollection, slug: "fmt-source", format: "mdx" });
			if (found.status !== "found") throw new Error("not found");
			const { entry } = found;

			const path = localizePath(target.locale, pathOf("fmt-target"));
			expect(entry.body?.format).toBe("mdx");
			expect(entry.body?.text).toContain(`[the target](${path})`);
			expect(entry.body?.text).toContain(publicUrl("media/photo.png"));
			expect(entry.body?.text).not.toContain(target.id);
			expect(entry.body?.text).not.toContain(media.ready);
			expect(entry.body?.text).not.toContain("entry:");
			// The document is as it was: a link by id, and the same refs as without a format.
			expect(entryLinkIds(entry.doc?.content)).toEqual([target.translationGroupId]);
			const plain = await cms.read.getEntry({ collection: contentCollection, slug: "fmt-source" });
			if (plain.status !== "found") throw new Error("not found");
			expect(plain.entry.refs).toEqual(entry.refs);
			expect(plain.entry).not.toHaveProperty("body");
		});

		it("follows the target when its address changes, with no change to the document that links to it", async () => {
			const target = await publish("fmt-moving", "Target body");
			const source = await publish("fmt-follows", `[x](${pathOf("fmt-moving")})`);
			const before = await cms.read.getEntry({ collection: contentCollection, slug: "fmt-follows", format: "mdx" });
			if (before.status !== "found") throw new Error("not found");
			expect(before.entry.body?.text).toContain(`(${localizePath(target.locale, pathOf("fmt-moving"))})`);

			const current = await store.getEntry(target.id);
			await service.saveDraft(target.id, {
				collection: contentCollection,
				slug: "fmt-moved",
				metadata: current.working.metadata as never,
				doc: current.working.doc,
				expectedVersion: current.version,
			} as never);
			const saved = await store.getEntry(target.id);
			await service.publish({ id: target.id, expectedVersion: saved.version });

			const after = await cms.read.getEntry({ collection: contentCollection, slug: "fmt-follows", format: "mdx" });
			if (after.status !== "found") throw new Error("not found");
			expect(after.entry.body?.text).toContain(`(${localizePath(target.locale, pathOf("fmt-moved"))})`);
			expect(after.entry.body?.text).not.toContain("fmt-moving");
			expect((await store.getEntry(source.id)).published?.doc).toEqual(before.entry.doc);
		});

		it("a link to an entry that is not published is not a link in the text, as it is not on the page", async () => {
			const unpublished = await draft("fmt-unpublished", "Not yet");
			await publish("fmt-dangling", `A [draft](${pathOf("fmt-unpublished")}) link.`);
			void unpublished;

			const found = await cms.read.getEntry({ collection: contentCollection, slug: "fmt-dangling", format: "mdx" });
			if (found.status !== "found") throw new Error("not found");

			expect(found.entry.body?.text).toContain("A draft link.");
			expect(found.entry.body?.text).not.toContain("fmt-unpublished");
		});

		it("lists and previews take the option too, and a list reads the text only with the body", async () => {
			await publish("fmt-listed", "Listed body");

			const withBody = await cms.read.listEntries({
				collection: contentCollection,
				body: true,
				format: "mdx",
				pageSize: 100,
			});
			const listed = withBody.items.find((item) => item.slug === "fmt-listed");
			expect(listed?.body).toEqual({ format: "mdx", text: "Listed body\n" });

			const withoutBody = await cms.read.listEntries({ collection: contentCollection, format: "mdx", pageSize: 100 });
			for (const item of withoutBody.items) expect(item.body).toBeUndefined();

			const preview = await cms.read.getPreview({ collection: contentCollection, slug: "fmt-listed", format: "mdx" });
			expect(preview?.body?.text).toBe("Listed body\n");
		});

		it("an unknown format throws a ServiceError unknown_format, and no format means no text", async () => {
			await publish("fmt-unknown", "Body");

			await expect(
				cms.read.getEntry({ collection: contentCollection, slug: "fmt-unknown", format: "hugo" }),
			).rejects.toMatchObject({ code: "unknown_format" });
			await expect(
				cms.read.listEntries({ collection: contentCollection, body: true, format: "hugo" }),
			).rejects.toMatchObject({ code: "unknown_format" });
		});
	});
});
