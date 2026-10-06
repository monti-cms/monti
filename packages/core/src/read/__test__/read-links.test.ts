import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, requiredMetadata, secondLocale } from "../../../test/any-site";
import { docOf } from "../../../test/stored-content";
import { type Cms, fakeCms } from "../../cms";
import type { Collection } from "../../core/collections";
import { contentPath } from "../../core/links";
import { DEFAULT_LOCALE, localizePath } from "../../core/locales";
import type { ContentStore, Entry } from "../../core/store";
import { publishDraft } from "../../core/store/__test__/seed";
import { ServiceError } from "../../core/types";
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

/** Links by entry id, from the write that turns an address into an id to the page that draws the link for one reader. */
describe("links by entry id", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let cms: Cms;
	let service: ReturnType<typeof createContentService<Entry>>;
	let relationTarget: (to: Collection) => Promise<string>;
	let rawCreate: ContentStore["createEntryWithReferences"];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		const filled = fillRequiredMetadata(store);
		relationTarget = filled.relationTarget as typeof relationTarget;
		rawCreate = filled.raw.createEntryWithReferences;
		service = createContentService<Entry>(store);
		cms = fakeCms({ store, verifyAdmin: async () => ({ userId: "u", accountId: "a", isAdmin: true }) });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const pathOf = (slug: string) => contentPath(contentCollection, slug) as string;

	const draft = async (slug: string, mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug,
			metadata: await requiredMetadata(contentCollection, `Title ${slug}`, relationTarget),
			mdx,
		} as never);

	const publish = async (slug: string, mdx = `Body ${slug}`) => {
		const created = await draft(slug, mdx);
		return publishDraft(store, { id: created.id, expectedVersion: created.version });
	};

	/** A published translation. Its body is given as text (a link by id is `entry:<id>`); the common values stay with the source. */
	const publishTranslation = async (slug: string, locale: string, sourceId: string, mdx: string) => {
		const created = await rawCreate({
			snapshot: {
				collection: contentCollection,
				slug,
				metadata: { title: `Title ${slug}` },
				doc: docOf(mdx),
				schemaVersion: 1,
				contentHash: `hash-${slug}`,
				references: [],
				issues: [],
				imageSources: [],
			} as never,
			references: [],
			locale,
			translationOf: sourceId,
		});
		return publishDraft(store, { id: created.id, expectedVersion: created.version });
	};

	const publishError = async (id: string, version: number) => {
		const error = await service.publish({ id, expectedVersion: version }).catch((caught) => caught);
		expect(error).toBeInstanceOf(ServiceError);
		return error as ServiceError;
	};

	const references = async (entryId: string) =>
		(
			await pool.query<{ target_id: string; occurrences: { type: string; blockId?: string }[] }>(
				`SELECT target_id, occurrences FROM "${schemaName}".entry_references WHERE entry_id = $1 AND state = 'working' AND kind = 'entry' AND occurrences @> '[{"type":"body"}]'::jsonb`,
				[entryId],
			)
		).rows;

	it("a body written with the address of a post is stored with the id of that post, and the address leaves the document", async () => {
		const target = await publish("links-target");

		const source = await draft(
			"links-source",
			`Read [the target](${pathOf("links-target")}) or [outside](https://example.com/x).`,
		);

		const marks = JSON.stringify(source.working.doc);
		expect(entryLinkIds(source.working.doc.content)).toEqual([target.translationGroupId]);
		expect(marks).not.toContain(pathOf("links-target"));
		expect(marks).toContain("https://example.com/x");
		// The id is a reference like a relation: the draft records where it is used (the block), so the target cannot be deleted from under it.
		const refs = await references(source.id);
		expect(refs).toHaveLength(1);
		expect(refs[0]?.target_id).toBe(target.translationGroupId);
		expect(refs[0]?.occurrences).toEqual([{ type: "body", blockId: expect.stringMatching(/^[0-9a-z]{8}$/) }]);
		const incoming = await store.getIncomingReferences({ targetId: target.id });
		expect(incoming.some((item) => item.sourceId === source.id && item.kind === "entry")).toBe(true);
	});

	it("an address no entry holds stays as written, and publishing says it does not resolve", async () => {
		const created = await draft("links-dangling", `[nowhere](${pathOf("nobody-holds-this")})`);
		expect(entryLinkIds(created.working.doc.content)).toEqual([]);
		expect(JSON.stringify(created.working.doc)).toContain(pathOf("nobody-holds-this"));

		const error = await publishError(created.id, created.version);

		expect(error.code).toBe("publish_validation_failed");
		expect(error.issues?.map((issue) => issue.code)).toContain("unresolved_internal_link");
	});

	it("publishing needs the target to be published, and says so with the same code as before", async () => {
		const target = await draft("links-unpublished", "Not yet");
		const source = await draft("links-to-draft", `[draft](${pathOf("links-unpublished")})`);
		expect(entryLinkIds(source.working.doc.content)).toEqual([target.translationGroupId]);

		const error = await publishError(source.id, source.version);
		expect(error.issues?.filter((issue) => issue.code === "unpublished_internal_link")).toHaveLength(1);
		expect(error.issues?.[0]?.position?.blockId).toBeDefined();

		await publishDraft(store, { id: target.id, expectedVersion: target.version });
		const published = await publishDraft(store, { id: source.id, expectedVersion: source.version });
		expect(published.status).toBe("published");
	});

	it("a link to an id that is not an entry is an unresolved link at publish, and a draft with it still saves", async () => {
		const id = "00000000-0000-4000-8000-0000000000aa";
		const created = await draft("links-bad-id", `[x](entry:${id})`);
		expect(entryLinkIds(created.working.doc.content)).toEqual([id]);
		expect(await references(created.id)).toEqual([]);

		const error = await publishError(created.id, created.version);
		expect(error.issues?.map((issue) => issue.code)).toContain("unresolved_internal_link");
	});

	it("a post that other posts link to cannot be deleted while they do", async () => {
		const target = await publish("links-in-use");
		const source = await draft("links-in-use-source", `[x](${pathOf("links-in-use")})`);

		const trashed = await store.trashEntry({ id: target.id, expectedVersion: target.version });
		const removal = await store
			.permanentDeleteEntry({ id: target.id, expectedVersion: trashed.version })
			.catch((e) => e);

		expect(removal).toMatchObject({ code: "in_use" });
		// The draft that links to a trashed post can still be saved (and the link removed); it cannot be published like that.
		const error = await publishError(source.id, source.version);
		expect(error.issues?.map((issue) => issue.code)).toContain("unpublished_internal_link");
	});

	it("the read API gives each link the address and title of its target for this reader", async () => {
		const target = await publish("links-read-target");
		await publish("links-read-source", `See [it](${pathOf("links-read-target")}).`);

		const found = await cms.read.getEntry({ collection: contentCollection, slug: "links-read-source" });
		if (found.status !== "found") throw new Error("not found");

		expect(found.entry.refs.links).toEqual({
			[target.translationGroupId]: {
				path: pathOf("links-read-target"),
				title: "Title links-read-target",
				locale: DEFAULT_LOCALE,
			},
		});
		// Only the links of this document are listed, and a link is drawn from them.
		const markup = renderToStaticMarkup(await CmsContent({ entry: found.entry }));
		expect(markup).toContain(`href="${pathOf("links-read-target")}"`);
		expect(markup).toContain(">it</a>");
	});

	it("a link whose target is not published is left out of the refs and drawn as plain text, in a preview too", async () => {
		await draft("links-hidden-target", "Draft only");
		const source = await draft("links-hidden-source", `A [hidden](${pathOf("links-hidden-target")}) page.`);
		void source;

		const preview = await cms.read.getPreview({ collection: contentCollection, slug: "links-hidden-source" });

		expect(preview?.refs.links).toEqual({});
		const markup = renderToStaticMarkup(await CmsContent({ entry: preview as never }));
		expect(markup).toContain("A hidden page.");
		expect(markup).not.toContain("<a");
	});

	it.skipIf(!secondLocale)(
		"a link follows the reader's language and falls back to the source when the target has no translation",
		async () => {
			const locale = secondLocale as string;
			const translated = await publish("links-lang-target");
			const translatedEn = await publishTranslation("links-lang-target-t", locale, translated.id, "Translated");
			const plain = await publish("links-lang-plain");
			const body = `[one](${pathOf("links-lang-target")}) [two](${pathOf("links-lang-plain")})`;
			const source = await publish("links-lang-source", body);
			await publishTranslation(
				"links-lang-source-t",
				locale,
				source.id,
				`[one](entry:${translated.id}) [two](entry:${plain.id})`,
			);

			const inLocale = await cms.read.getEntry({ collection: contentCollection, slug: "links-lang-source-t", locale });
			if (inLocale.status !== "found") throw new Error("not found");

			expect(inLocale.entry.refs.links).toEqual({
				[translated.id]: {
					path: localizePath(locale, pathOf("links-lang-target-t")),
					title: "Title links-lang-target-t",
					locale,
				},
				// No translation of this one: the source's address, in the source's language.
				[plain.id]: { path: pathOf("links-lang-plain"), title: "Title links-lang-plain", locale: DEFAULT_LOCALE },
			});
			void translatedEn;
			// The same document read in the source language points at the source pages.
			const inSource = await cms.read.getEntry({ collection: contentCollection, slug: "links-lang-source" });
			if (inSource.status !== "found") throw new Error("not found");
			expect(inSource.entry.refs.links[translated.id]?.path).toBe(pathOf("links-lang-target"));
		},
	);
});
