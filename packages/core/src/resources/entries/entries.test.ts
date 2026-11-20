import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig, Schema } from "../../engine/types";
import { validateDoc } from "../../rich-text/validate-doc";
import { entries } from "./entries";

let testDb: TestDatabase;
let db: Kysely<Database>;

const POSTS = "posts";
const PAGES = "pages";
const TOPICS = "topics";
const NOTES = "notes";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLISHED_AT = new Date("2026-11-01T09:00:00.000Z");

/**
 * `posts` has a body and every field type; `pages` relates to topics with `many`; `topics` has no body; `notes` has
 * required fields and a conditional whose first option has a required sub-field and a relation.
 */
const SCHEMA: Schema = {
	locales: ["ko", "en"],
	collections: {
		[POSTS]: {
			body: true,
			fields: {
				title: { type: "text", max: 20, required: true },
				views: { type: "number" },
				featured: { type: "boolean" },
				date: { type: "date" },
				tags: { type: "select", options: ["news", "tech"], many: true },
				cover: { type: "media" },
				gallery: { type: "media", many: true },
				topic: { type: "relation", to: TOPICS },
				layout: {
					type: "conditional",
					options: {
						hero: { fields: { image: { type: "media" }, caption: { type: "text" } } },
						plain: { fields: { note: { type: "text" } } },
					},
				},
			},
		},
		[PAGES]: { fields: { topic: { type: "relation", to: TOPICS, many: true } } },
		[TOPICS]: { fields: { name: { type: "text" } } },
		[NOTES]: {
			fields: {
				title: { type: "text", required: true },
				rank: { type: "number", required: true },
				pinned: { type: "boolean", required: true },
				kind: {
					type: "conditional",
					options: {
						link: { fields: { url: { type: "text", required: true }, topic: { type: "relation", to: TOPICS } } },
						plain: { fields: { note: { type: "text" } } },
					},
				},
			},
		},
	},
};

/** The one block type the config adds to the built-in ones. */
const GALLERY = { type: "gallery", holds: "nothing" } as const;

const CONFIG: MontiConfig = { name: "Monti Blog", dev: false, blocks: [GALLERY] };

/** A body that passes `validateDoc` and references no media. */
const PLAIN = { blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

/** A body with two problems: the gallery block has an empty `id` and the second block's type is not registered. */
const BROKEN = {
	blocks: [
		{ id: "", type: "gallery" },
		{ id: "x1", type: "unregistered" },
	],
};

function montiOf() {
	return createMonti(db, { entries }, [], {
		schema: SCHEMA,
		config: CONFIG,
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
});

afterEach(async () => {
	await testDb.drop();
});

async function seedMedia(trashed = false): Promise<string> {
	const id = randomUUID();
	await db
		.insertInto("media")
		.values({
			id,
			folder_id: null,
			key: randomUUID(),
			mime_type: "image/png",
			metadata: JSON.stringify({}),
			trashed_at: trashed ? new Date() : null,
		})
		.execute();
	return id;
}

interface FolderSeed {
	scope?: string;
	parent_id?: string | null;
	trashed?: boolean;
}

async function seedFolder(seed: FolderSeed = {}): Promise<string> {
	const id = randomUUID();
	await db
		.insertInto("folders")
		.values({
			id,
			scope: seed.scope ?? POSTS,
			parent_id: seed.parent_id ?? null,
			name: id,
			trashed_at: seed.trashed ? new Date() : null,
		})
		.execute();
	return id;
}

interface LocaleSeed {
	slug?: string;
	data?: Record<string, unknown>;
	translation_seen?: Record<string, unknown>;
}

/** Inserts the working copy of an entry in one locale and returns its row as the table holds it. */
async function seedLocale(entry_id: string, locale: string, seed: LocaleSeed = {}) {
	const row = {
		entry_id,
		locale,
		slug: seed.slug ?? `entry-${randomUUID()}`,
		data: seed.data ?? { fields: {} },
		translation_seen: seed.translation_seen ?? {},
	};
	await db
		.insertInto("entry_locales")
		.values({ ...row, data: JSON.stringify(row.data), translation_seen: JSON.stringify(row.translation_seen) })
		.execute();
	return row;
}

interface EntrySeed extends LocaleSeed {
	collection?: string;
	locale?: string;
	folder_id?: string | null;
	trashed?: boolean;
}

/**
 * Inserts an entry and its working copy in its source locale (`ko` unless given). Returns the `entries` row as `row` and
 * the working copy's `slug` and `data` beside its `id`.
 */
async function seedEntry(seed: EntrySeed = {}) {
	const row = {
		id: randomUUID(),
		collection: seed.collection ?? POSTS,
		source_locale: seed.locale ?? "ko",
		folder_id: seed.folder_id ?? null,
		trashed_at: seed.trashed ? new Date() : null,
	};
	await db.insertInto("entries").values(row).execute();
	const working = await seedLocale(row.id, row.source_locale, seed);
	return { ...row, row, working, slug: working.slug, data: working.data };
}

/** Inserts the published copy of an entry in one locale, as `entries.publish` would, and returns its row. */
async function seedPublished(
	entry_id: string,
	locale: string,
	slug: string,
	data: Record<string, unknown>,
	published_at = PUBLISHED_AT,
) {
	const row = { entry_id, locale, slug, data, published_at };
	await db
		.insertInto("entry_published")
		.values({ ...row, data: JSON.stringify(data) })
		.execute();
	return row;
}

/** An active entry whose published copy in its source locale has another slug and data than its working copy. */
async function seedPublishedEntry(seed: EntrySeed = {}) {
	const entry = await seedEntry({ data: { fields: { title: "Draft" } }, ...seed });
	const published = await seedPublished(entry.id, entry.source_locale, `live-${randomUUID()}`, {
		fields: { title: "Live" },
	});
	return { entry, published };
}

interface UseSeed {
	media_id: string;
	source_kind: "entry" | "template";
	source_id: string;
	field_path: string;
}

async function seedUse(use: UseSeed): Promise<UseSeed> {
	await db.insertInto("media_uses").values(use).execute();
	return use;
}

/** The `media_uses` row of an entry's `cover` field referencing `media_id`. */
function coverUse(source_id: string, media_id: string): UseSeed {
	return { media_id, source_kind: "entry", source_id, field_path: "fields.cover" };
}

/** An entry whose `cover` field references `mediaId`, with its `media_uses` row. */
async function seedEntryUsing(mediaId: string, seed: EntrySeed = {}) {
	const entry = await seedEntry({ data: { fields: { cover: mediaId } }, ...seed });
	const use = await seedUse(coverUse(entry.id, mediaId));
	return { entry, use };
}

async function entryRows() {
	return db.selectFrom("entries").selectAll().execute();
}

async function entryRow(id: string) {
	return db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function localeRows() {
	return db.selectFrom("entry_locales").selectAll().execute();
}

async function localeRow(entry_id: string, locale: string) {
	return db
		.selectFrom("entry_locales")
		.selectAll()
		.where("entry_id", "=", entry_id)
		.where("locale", "=", locale)
		.executeTakeFirstOrThrow();
}

async function publishedRow(entry_id: string, locale: string) {
	return db
		.selectFrom("entry_published")
		.selectAll()
		.where("entry_id", "=", entry_id)
		.where("locale", "=", locale)
		.executeTakeFirstOrThrow();
}

async function publishedRows() {
	return db.selectFrom("entry_published").selectAll().orderBy("locale").execute();
}

async function useRows(source_kind: "entry" | "template", source_id: string) {
	return db
		.selectFrom("media_uses")
		.selectAll()
		.where("source_kind", "=", source_kind)
		.where("source_id", "=", source_id)
		.orderBy("field_path")
		.orderBy("media_id")
		.execute();
}

async function allUseRows() {
	return db.selectFrom("media_uses").selectAll().execute();
}

function idsOf(rows: { id: string }[]): string[] {
	return rows.map((row) => row.id).sort();
}

/** Each entry's `id` and `locale`, sorted by `id`, so a check does not hang on the order rows come back in. */
function idsAndLocales(rows: { id: string; locale: string }[]) {
	return rows.map(({ id, locale }) => ({ id, locale })).sort((a, b) => a.id.localeCompare(b.id));
}

/** A list sorted by `id`, so a check does not hang on the order rows come back in; anything else as it is. */
function sortedById(value: unknown): unknown {
	return Array.isArray(value) ? [...value].sort((a, b) => a.id.localeCompare(b.id)) : value;
}

it("ENT-CRT-1 creates a working copy from collection, locale and slug alone and fills the defaults", async () => {
	const output = await montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello-world" });

	// ENT-CRT-1.1
	expect(output).toEqual({
		id: expect.stringMatching(UUID),
		collection: POSTS,
		locale: "ko",
		source_locale: "ko",
		folder_id: null,
		slug: "hello-world",
		data: { fields: {} },
		published_at: null,
	});
	// ENT-CRT-1.2
	expect(await entryRows()).toEqual([
		{ id: output.id, collection: POSTS, source_locale: "ko", folder_id: null, trashed_at: null },
	]);
	// ENT-CRT-1.3
	expect(await localeRows()).toEqual([
		{ entry_id: output.id, locale: "ko", slug: "hello-world", data: { fields: {} }, translation_seen: {} },
	]);
	// ENT-CRT-1.4
	expect(await publishedRows()).toEqual([]);
});

it("ENT-CRT-2 creates a working copy with the given __preset_id", async () => {
	const id = randomUUID();

	const output = await montiOf().entries.create({ __preset_id: id, collection: POSTS, locale: "ko", slug: "hello" });

	// ENT-CRT-2.1
	expect(output.id).toBe(id);
	// ENT-CRT-2.2
	expect(idsOf(await entryRows())).toEqual([id]);
	// ENT-CRT-2.3
	expect((await localeRows()).map((row) => row.entry_id)).toEqual([id]);
});

it("ENT-CRT-3 stores a working copy with every field type, a body, a folder and a slug", async () => {
	const folder = await seedFolder();
	const media = await seedMedia();
	const topic = await seedEntry({ collection: TOPICS });
	const data = {
		fields: {
			title: "Hello",
			views: 3,
			featured: true,
			date: "2026-11-20T10:00:00+09:00",
			tags: ["news", "tech"],
			cover: media,
			gallery: [media],
			topic: topic.id,
			layout: { option: "hero", fields: { image: media, caption: "Hi" } },
		},
		body: PLAIN,
	};

	const output = await montiOf().entries.create({
		collection: POSTS,
		locale: "ko",
		slug: "full",
		folder_id: folder,
		data,
	});

	// ENT-CRT-3.1
	expect({ folder_id: output.folder_id, slug: output.slug, data: output.data }).toEqual({
		folder_id: folder,
		slug: "full",
		data,
	});
	// ENT-CRT-3.2
	expect(await entryRow(output.id)).toMatchObject({ id: output.id, folder_id: folder });
	// ENT-CRT-3.3
	expect(await localeRow(output.id, "ko")).toMatchObject({ entry_id: output.id, locale: "ko", slug: "full", data });
});

it("ENT-CRT-4 records the body, top-level media fields and conditional media sub-fields in media_uses once per path, ignoring case", async () => {
	const [first, second, third] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const data = {
		fields: {
			gallery: [first, first.toUpperCase()],
			layout: { option: "hero", fields: { image: second } },
		},
		body: {
			blocks: [
				{ id: "i1", type: "image", attrs: { mediaId: first } },
				{ id: "i2", type: "image", attrs: { mediaId: third } },
			],
		},
	};

	const output = await montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "uses", data });

	const use = (media_id: string, field_path: string) => ({
		media_id,
		source_kind: "entry",
		source_id: output.id,
		field_path,
	});
	// ENT-CRT-4.1
	expect(await useRows("entry", output.id)).toEqual([
		...[first, third].sort().map((id) => use(id, "body")),
		use(first, "fields.gallery"),
		use(second, "fields.layout.fields.image"),
	]);
});

it("ENT-CRT-5 rejects entries.create with BAD_REQUEST for a collection not in the schema", async () => {
	// ENT-CRT-5.1
	await expect(
		montiOf().entries.create({ collection: "constructor", locale: "ko", slug: "hello" }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-5.2
	expect(await entryRows()).toEqual([]);
	// ENT-CRT-5.3
	expect(await localeRows()).toEqual([]);
});

it("ENT-CRT-6 rejects entries.create with BAD_REQUEST for a locale not in the schema", async () => {
	// ENT-CRT-6.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "fr", slug: "hello" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-CRT-6.2
	expect(await entryRows()).toEqual([]);
	// ENT-CRT-6.3
	expect(await localeRows()).toEqual([]);
});

it("ENT-CRT-7 rejects entries.create with BAD_REQUEST for a folder of another scope", async () => {
	const folder = await seedFolder({ scope: "media" });

	// ENT-CRT-7.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", folder_id: folder }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-7.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-8 rejects entries.create with BAD_REQUEST for a field key the schema does not define", async () => {
	// ENT-CRT-8.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data: { fields: { unknown: "x" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-8.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-9 rejects entries.create with BAD_REQUEST for values that break their field's type or constraint", async () => {
	const data = { fields: { views: "three", title: "x".repeat(21) } };

	// ENT-CRT-9.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-9.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-10 rejects entries.create with BAD_REQUEST for a conditional sub-field not in the chosen option", async () => {
	const data = { fields: { layout: { option: "hero", fields: { note: "Plain note" } } } };

	// ENT-CRT-10.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-10.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-11 rejects entries.create with BAD_REQUEST for a body in a collection without one", async () => {
	const data = { fields: {}, body: PLAIN };

	// ENT-CRT-11.1
	await expect(
		montiOf().entries.create({ collection: TOPICS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-11.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-12 rejects entries.create with BAD_REQUEST carrying every problem of an invalid body", async () => {
	const error = await montiOf()
		.entries.create({ collection: POSTS, locale: "ko", slug: "hello", data: { fields: {}, body: BROKEN } })
		.catch((caught: unknown) => caught);

	// ENT-CRT-12.1
	expect(error).toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-12.2
	expect(error).toHaveProperty("details", validateDoc(BROKEN, CONFIG));
	// ENT-CRT-12.3
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-13 rejects entries.create with BAD_REQUEST for a media field referencing a trashed media", async () => {
	const trashed = await seedMedia(true);
	const data = { fields: { cover: trashed } };

	// ENT-CRT-13.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-13.2
	expect(await entryRows()).toEqual([]);
	// ENT-CRT-13.3
	expect(await allUseRows()).toEqual([]);
});

it("ENT-CRT-14 rejects entries.create with BAD_REQUEST for a relation to an entry outside the to collection", async () => {
	const page = await seedEntry({ collection: PAGES });
	const data = { fields: { topic: page.id } };

	// ENT-CRT-14.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-14.2
	expect(await entryRows()).toEqual([page.row]);
});

it("ENT-CRT-15 rejects entries.create with BAD_REQUEST for a slug with a space", async () => {
	// ENT-CRT-15.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello world" }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-15.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-16 rejects entries.create with CONFLICT for a slug an active entry of the collection and locale has", async () => {
	const existing = await seedEntry({ slug: "hello" });

	// ENT-CRT-16.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-CRT-16.2
	expect(await entryRows()).toEqual([existing.row]);
});

it("ENT-READ-1 gets the published copy of the source locale when draft is left out", async () => {
	const { entry, published } = await seedPublishedEntry();

	const output = await montiOf().entries.get({ id: entry.id });

	// ENT-READ-1.1
	expect(output).toMatchObject({
		id: entry.id,
		collection: entry.collection,
		source_locale: entry.source_locale,
		folder_id: entry.folder_id,
		locale: entry.source_locale,
	});
	// ENT-READ-1.2
	expect(output).toMatchObject({ slug: published.slug, data: published.data, published_at: published.published_at });
});

it("ENT-READ-2 gets the published copy by collection, locale and published slug", async () => {
	const { entry, published } = await seedPublishedEntry();
	await seedPublishedEntry();

	const output = await montiOf().entries.get({
		collection: entry.collection,
		locale: entry.source_locale,
		slug: published.slug,
	});

	// ENT-READ-2.1
	expect(output).toMatchObject({
		id: entry.id,
		slug: published.slug,
		data: published.data,
		published_at: published.published_at,
	});
});

it("ENT-READ-3 gets the working copy with draft true even when the entry is published", async () => {
	const { entry, published } = await seedPublishedEntry();

	const output = await montiOf().entries.get({ id: entry.id, draft: true });

	// ENT-READ-3.1
	expect(output).toMatchObject({ slug: entry.slug, data: entry.data });
	// ENT-READ-3.2
	expect(output.published_at).toEqual(published.published_at);
});

it("ENT-READ-4 rejects entries.get with NOT_FOUND for an unpublished entry when draft is left out", async () => {
	const entry = await seedEntry();

	// ENT-READ-4.1
	await expect(montiOf().entries.get({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("ENT-READ-5 rejects entries.get with NOT_FOUND for a trashed entry even with draft true", async () => {
	const { entry } = await seedPublishedEntry({ trashed: true });

	// ENT-READ-5.1
	await expect(montiOf().entries.get({ id: entry.id, draft: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("ENT-READ-6 lists only the published source locale of active entries when called without an input", async () => {
	const { entry, published } = await seedPublishedEntry();
	await seedLocale(entry.id, "en");
	await seedPublished(entry.id, "en", `live-en-${randomUUID()}`, { fields: { title: "Live EN" } });
	const enOnly = await seedEntry();
	await seedLocale(enOnly.id, "en");
	await seedPublished(enOnly.id, "en", `live-en-${randomUUID()}`, { fields: { title: "Live EN" } });
	await seedPublishedEntry({ trashed: true });

	const output = await montiOf().entries.list();

	// ENT-READ-6.1
	expect(idsAndLocales(output)).toEqual([{ id: entry.id, locale: "ko" }]);
	// ENT-READ-6.2
	expect(output[0]).toMatchObject({ slug: published.slug, data: published.data, published_at: published.published_at });
});

it("ENT-READ-7 lists the working copies of every active entry with draft true", async () => {
	const { entry: publishedEntry, published } = await seedPublishedEntry();
	const unpublished = await seedEntry({ data: { fields: { title: "Unpublished" } } });
	await seedEntry({ trashed: true });

	const output = await montiOf().entries.list({ draft: true });
	const byId = new Map(output.map((entry) => [entry.id, entry]));

	// ENT-READ-7.1
	expect(output.map(({ id, data }) => ({ id, data })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
		[publishedEntry, unpublished].map(({ id, data }) => ({ id, data })).sort((a, b) => a.id.localeCompare(b.id)),
	);
	// ENT-READ-7.2
	expect(byId.get(publishedEntry.id)?.published_at).toEqual(published.published_at);
	// ENT-READ-7.3
	expect(byId.get(unpublished.id)?.published_at).toBeNull();
});

it("ENT-READ-8 lists only the entries directly in the folder with the given collection, locale and folder_id", async () => {
	const folder = await seedFolder();
	const child = await seedFolder({ parent_id: folder });
	const target = await seedEntry({ folder_id: folder });
	await seedEntry({ folder_id: child });
	await seedEntry({ folder_id: null });
	await seedEntry({ folder_id: folder, locale: "en" });
	await seedEntry({ collection: PAGES, folder_id: folder });

	const output = await montiOf().entries.list({ collection: POSTS, locale: "ko", folder_id: folder, draft: true });

	// ENT-READ-8.1
	expect(idsOf(output)).toEqual([target.id]);
});

it("ENT-READ-9 lists only the entries at the root with folder_id null", async () => {
	const folder = await seedFolder();
	const root = await seedEntry({ folder_id: null });
	await seedEntry({ folder_id: folder });

	const output = await montiOf().entries.list({ folder_id: null, draft: true });

	// ENT-READ-9.1
	expect(idsOf(output)).toEqual([root.id]);
});

it("ENT-READ-10 lists the entries whose relation field references the given entry in their published copy", async () => {
	const topic = await seedEntry({ collection: TOPICS });
	const other = await seedEntry({ collection: TOPICS });
	const post = await seedEntry({ collection: POSTS });
	await seedPublished(post.id, "ko", post.slug, { fields: { topic: topic.id } });
	const page = await seedEntry({ collection: PAGES });
	await seedPublished(page.id, "ko", page.slug, { fields: { topic: [other.id, topic.id] } });
	const draftOnly = await seedEntry({ collection: POSTS, data: { fields: { topic: topic.id } } });
	await seedPublished(draftOnly.id, "ko", draftOnly.slug, { fields: { topic: other.id } });

	const output = await montiOf().entries.list({ relation: { field: "topic", id: topic.id } });

	// ENT-READ-10.1
	expect(idsOf(output)).toEqual(idsOf([post, page]));
});

it("ENT-READ-11 gets the published copy of the given non-source locale", async () => {
	const { entry } = await seedPublishedEntry();
	await seedLocale(entry.id, "en", { data: { fields: { title: "Draft EN" } } });
	const en = await seedPublished(
		entry.id,
		"en",
		`live-en-${randomUUID()}`,
		{ fields: { title: "Live EN" } },
		new Date("2026-11-02T09:00:00.000Z"),
	);

	const output = await montiOf().entries.get({ id: entry.id, locale: "en" });

	// ENT-READ-11.1
	expect(output).toMatchObject({ id: entry.id, locale: "en", source_locale: "ko" });
	// ENT-READ-11.2
	expect(output).toMatchObject({ slug: en.slug, data: en.data, published_at: en.published_at });
});

it("ENT-READ-12 rejects entries.get with NOT_FOUND for a locale the entry does not have", async () => {
	const entry = await seedEntry();

	// ENT-READ-12.1
	await expect(montiOf().entries.get({ id: entry.id, locale: "en", draft: true })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("ENT-READ-13 lists one source locale row per entry when the locale is left out, even with translations", async () => {
	const translated = await seedEntry({ locale: "ko" });
	await seedLocale(translated.id, "en");
	const english = await seedEntry({ locale: "en" });

	const output = await montiOf().entries.list({ draft: true });

	// ENT-READ-13.1
	expect(idsAndLocales(output)).toEqual(
		idsAndLocales([
			{ id: translated.id, locale: "ko" },
			{ id: english.id, locale: "en" },
		]),
	);
});

it("ENT-UPD-1 changes only the slug and folder_id and keeps the data, media_uses and published copy", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media);
	const published = await seedPublished(entry.id, "ko", "live", { fields: { title: "Live" } });
	const folder = await seedFolder();

	const output = await montiOf().entries.update({ id: entry.id, slug: "renamed", folder_id: folder });

	// ENT-UPD-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: entry.collection,
		locale: "ko",
		source_locale: "ko",
		folder_id: folder,
		slug: "renamed",
		data: entry.data,
		published_at: published.published_at,
	});
	const working = await localeRow(entry.id, "ko");
	// ENT-UPD-1.2
	expect({ folder_id: (await entryRow(entry.id)).folder_id, slug: working.slug, data: working.data }).toEqual({
		folder_id: folder,
		slug: "renamed",
		data: entry.data,
	});
	// ENT-UPD-1.3
	expect(await useRows("entry", entry.id)).toEqual([use]);
	// ENT-UPD-1.4
	expect(await publishedRow(entry.id, "ko")).toMatchObject({ slug: published.slug, data: published.data });
});

it("ENT-UPD-2 replaces the working data and only the entry's media_uses", async () => {
	const first = await seedMedia();
	const target = await seedEntryUsing(first);
	const other = await seedEntryUsing(first);
	const templateUse = await seedUse({
		media_id: first,
		source_kind: "template",
		source_id: target.entry.id,
		field_path: "content",
	});
	const second = await seedMedia();
	const data = { fields: { cover: second } };

	const output = await montiOf().entries.update({ id: target.entry.id, data });

	// ENT-UPD-2.1
	expect(output).toMatchObject({ data, slug: target.entry.slug, folder_id: target.entry.folder_id });
	// ENT-UPD-2.2
	expect((await localeRow(target.entry.id, "ko")).data).toEqual(data);
	// ENT-UPD-2.3
	expect(await useRows("entry", target.entry.id)).toEqual([coverUse(target.entry.id, second)]);
	// ENT-UPD-2.4
	expect(await useRows("entry", other.entry.id)).toEqual([other.use]);
	// ENT-UPD-2.5
	expect(await useRows("template", target.entry.id)).toEqual([templateUse]);
});

it("ENT-UPD-3 moves an entry to the root with folder_id null", async () => {
	const folder = await seedFolder();
	const entry = await seedEntry({ folder_id: folder });

	const output = await montiOf().entries.update({ id: entry.id, folder_id: null });

	// ENT-UPD-3.1
	expect(output).toMatchObject({ folder_id: null });
	// ENT-UPD-3.2
	expect((await entryRow(entry.id)).folder_id).toBeNull();
});

it("ENT-UPD-4 rejects entries.update with BAD_REQUEST for a media id not in the database and keeps the entry", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media);

	// ENT-UPD-4.1
	await expect(
		montiOf().entries.update({ id: entry.id, data: { fields: { cover: randomUUID() } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-UPD-4.2
	expect((await localeRow(entry.id, "ko")).data).toEqual(entry.data);
	// ENT-UPD-4.3
	expect(await useRows("entry", entry.id)).toEqual([use]);
});

it("ENT-UPD-5 rejects entries.update with BAD_REQUEST for a relation to a trashed entry", async () => {
	const entry = await seedEntry({ data: { fields: { title: "Kept" } } });
	const trashed = await seedEntry({ collection: TOPICS, trashed: true });

	// ENT-UPD-5.1
	await expect(
		montiOf().entries.update({ id: entry.id, data: { fields: { topic: trashed.id } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-UPD-5.2
	expect((await localeRow(entry.id, "ko")).data).toEqual(entry.data);
});

it("ENT-UPD-6 rejects entries.update with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ slug: "trashed", trashed: true });

	// ENT-UPD-6.1
	await expect(montiOf().entries.update({ id: entry.id, slug: "renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-6.2
	expect((await localeRow(entry.id, "ko")).slug).toBe("trashed");
});

it("ENT-UPD-7 rejects entries.update with CONFLICT for a slug another active entry of the collection and locale has", async () => {
	const first = await seedEntry({ slug: "first" });
	const second = await seedEntry({ slug: "second" });

	// ENT-UPD-7.1
	await expect(montiOf().entries.update({ id: second.id, slug: first.slug })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-UPD-7.2
	expect((await localeRow(second.id, "ko")).slug).toBe("second");
});

it("ENT-UPD-8 moves the entries of ids into one folder", async () => {
	const folder = await seedFolder();
	const first = await seedEntry();
	const second = await seedEntry();

	const output = await montiOf().entries.update({ ids: [first.id, second.id], folder_id: folder });

	// ENT-UPD-8.1
	expect(sortedById(output)).toEqual(idsOf([first, second]).map((id) => ({ id, folder_id: folder })));
	// ENT-UPD-8.2
	expect((await entryRows()).map((row) => row.folder_id)).toEqual([folder, folder]);
});

it("ENT-UPD-9 rejects a batch entries.update with NOT_FOUND when one entry is trashed and rolls back", async () => {
	const folder = await seedFolder();
	const active = await seedEntry();
	const trashed = await seedEntry({ trashed: true });

	// ENT-UPD-9.1
	await expect(montiOf().entries.update({ ids: [active.id, trashed.id], folder_id: folder })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-9.2
	expect((await entryRow(active.id)).folder_id).toBeNull();
});

it("ENT-UPD-10 rejects a batch entries.update with BAD_REQUEST for a trashed folder and rolls back", async () => {
	const folder = await seedFolder({ trashed: true });
	const first = await seedEntry();
	const second = await seedEntry();

	// ENT-UPD-10.1
	await expect(montiOf().entries.update({ ids: [first.id, second.id], folder_id: folder })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-UPD-10.2
	expect((await entryRows()).map((row) => row.folder_id)).toEqual([null, null]);
});

it("ENT-UPD-11 changes only the given non-source locale's working copy and moves the whole entry", async () => {
	const entry = await seedEntry({ data: { fields: { title: "Korean" } } });
	await seedLocale(entry.id, "en", { slug: "english", data: { fields: { title: "English" } } });
	const folder = await seedFolder();
	const data = { fields: { title: "New English" } };

	const output = await montiOf().entries.update({
		id: entry.id,
		locale: "en",
		slug: "new-english",
		folder_id: folder,
		data,
	});

	// ENT-UPD-11.1
	expect(output).toMatchObject({ locale: "en", source_locale: "ko", slug: "new-english", folder_id: folder, data });
	// ENT-UPD-11.2
	expect([await localeRow(entry.id, "en"), await localeRow(entry.id, "ko")]).toEqual([
		{ entry_id: entry.id, locale: "en", slug: "new-english", data, translation_seen: {} },
		entry.working,
	]);
	// ENT-UPD-11.3
	expect((await entryRow(entry.id)).folder_id).toBe(folder);
});

it("ENT-UPD-12 keeps the media_uses another locale of the entry references when one locale's data changes", async () => {
	const [first, second, third] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const { entry } = await seedEntryUsing(first);
	await seedLocale(entry.id, "en", { data: { fields: { cover: second } } });
	await seedUse(coverUse(entry.id, second));

	await montiOf().entries.update({ id: entry.id, locale: "en", data: { fields: { cover: third } } });

	// ENT-UPD-12.1
	expect(await useRows("entry", entry.id)).toEqual([first, third].sort().map((id) => coverUse(entry.id, id)));
});

it("ENT-UPD-13 rejects entries.update with NOT_FOUND for a locale the entry does not have", async () => {
	const entry = await seedEntry();

	// ENT-UPD-13.1
	await expect(montiOf().entries.update({ id: entry.id, locale: "en", slug: "english" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-13.2
	expect(await localeRows()).toEqual([entry.working]);
});

/** Note data that fills every required field, with `0` and `false` as the values. */
const FILLED = { fields: { title: "Hello", rank: 0, pinned: false } };

it("ENT-PUB-1 publishes the working copy into a published copy", async () => {
	const entry = await seedEntry({ collection: NOTES, data: FILLED });
	const before = new Date();

	const output = await montiOf().entries.publish({ id: entry.id });

	const after = new Date();
	const published_at = output.published_at ?? new Date(0);
	// ENT-PUB-1.1
	expect({ slug: output.slug, data: output.data, inRange: before <= published_at && published_at <= after }).toEqual({
		slug: entry.slug,
		data: entry.data,
		inRange: true,
	});
	// ENT-PUB-1.2
	expect(await publishedRows()).toEqual([
		{ entry_id: entry.id, locale: "ko", slug: output.slug, data: output.data, published_at: output.published_at },
	]);
});

it("ENT-PUB-2 keeps the first published time when a published entry is published again", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "new-slug", data: FILLED });
	await seedPublished(entry.id, "ko", "old-slug", { fields: { title: "Old", rank: 1, pinned: true } });

	const output = await montiOf().entries.publish({ id: entry.id });

	// ENT-PUB-2.1
	expect({ slug: output.slug, data: output.data, published_at: output.published_at }).toEqual({
		slug: entry.slug,
		data: entry.data,
		published_at: PUBLISHED_AT,
	});
	// ENT-PUB-2.2
	expect(await publishedRow(entry.id, "ko")).toEqual({
		entry_id: entry.id,
		locale: "ko",
		slug: entry.slug,
		data: entry.data,
		published_at: PUBLISHED_AT,
	});
});

it("ENT-PUB-3 stores the given published_at", async () => {
	const entry = await seedEntry({ collection: NOTES, data: FILLED });
	await seedPublished(entry.id, "ko", entry.slug, FILLED);
	const given = "2026-12-25T18:30:00+09:00";

	const output = await montiOf().entries.publish({ id: entry.id, published_at: given });

	// ENT-PUB-3.1
	expect(output.published_at).toEqual(new Date(given));
	// ENT-PUB-3.2
	expect((await publishedRow(entry.id, "ko")).published_at).toEqual(new Date(given));
});

it("ENT-PUB-4 rejects entries.publish with BAD_REQUEST for an empty required field", async () => {
	const entry = await seedEntry({ collection: NOTES, data: { fields: { ...FILLED.fields, title: "" } } });

	// ENT-PUB-4.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-4.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-5 rejects entries.publish with BAD_REQUEST for an empty required sub-field of the chosen option", async () => {
	const data = { fields: { ...FILLED.fields, kind: { option: "link", fields: {} } } };
	const entry = await seedEntry({ collection: NOTES, data });

	// ENT-PUB-5.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-5.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-6 rejects entries.publish with CONFLICT for a slug another entry is published with", async () => {
	const first = await seedEntry({ collection: NOTES, slug: "renamed", data: FILLED });
	const published = await seedPublished(first.id, "ko", "hello", FILLED);
	const second = await seedEntry({ collection: NOTES, slug: "hello", data: FILLED });

	// ENT-PUB-6.1
	await expect(montiOf().entries.publish({ id: second.id })).rejects.toMatchObject({ code: "CONFLICT" });
	// ENT-PUB-6.2
	expect(await publishedRows()).toEqual([published]);
});

it("ENT-PUB-7 rejects entries.publish with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ collection: NOTES, data: FILLED, trashed: true });

	// ENT-PUB-7.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-PUB-7.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-8 publishes only the given non-source locale and leaves the source locale unpublished", async () => {
	const entry = await seedEntry({ collection: NOTES, data: FILLED });
	const en = await seedLocale(entry.id, "en", { data: { fields: { ...FILLED.fields, title: "Hello EN" } } });

	const output = await montiOf().entries.publish({ id: entry.id, locale: "en" });

	// ENT-PUB-8.1
	expect(output).toMatchObject({ locale: "en", source_locale: "ko", slug: en.slug, data: en.data });
	// ENT-PUB-8.2
	expect((await publishedRows()).map(({ entry_id, locale }) => ({ entry_id, locale }))).toEqual([
		{ entry_id: entry.id, locale: "en" },
	]);
});

it("ENT-PUB-9 rejects entries.publish with NOT_FOUND for a locale the entry does not have", async () => {
	const entry = await seedEntry({ collection: NOTES, data: FILLED });

	// ENT-PUB-9.1
	await expect(montiOf().entries.publish({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-PUB-9.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-10 rejects entries.publish with BAD_REQUEST for a relation to an entry trashed after the save", async () => {
	const topic = await seedEntry({ collection: TOPICS });
	const entry = await seedEntry({ data: { fields: { title: "Hello", topic: topic.id } } });
	await db.updateTable("entries").set({ trashed_at: new Date() }).where("id", "=", topic.id).execute();

	// ENT-PUB-10.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-10.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-11 rejects entries.publish with BAD_REQUEST for media trashed after the save", async () => {
	const media = await seedMedia();
	const { entry } = await seedEntryUsing(media, { data: { fields: { title: "Hello", cover: media } } });
	await db.updateTable("media").set({ trashed_at: new Date() }).where("id", "=", media).execute();

	// ENT-PUB-11.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-11.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-PUB-12 rejects entries.publish with BAD_REQUEST for a conditional option removed from the schema after the save", async () => {
	// `removed` stands for an option the schema had when the entry was saved and has no longer.
	const data = { fields: { ...FILLED.fields, kind: { option: "removed", fields: { note: "Gone" } } } };
	const entry = await seedEntry({ collection: NOTES, data });

	// ENT-PUB-12.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-12.2
	expect(await publishedRows()).toEqual([]);
});

it("ENT-UNPUB-1 deletes only the published copy and keeps the working copy and media_uses", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media);
	await seedPublished(entry.id, "ko", `live-${entry.slug}`, { fields: { title: "Live" } });

	const output = await montiOf().entries.unpublish({ id: entry.id });

	// ENT-UNPUB-1.1
	expect({ slug: output.slug, data: output.data, published_at: output.published_at }).toEqual({
		slug: entry.slug,
		data: entry.data,
		published_at: null,
	});
	// ENT-UNPUB-1.2
	expect(await publishedRows()).toEqual([]);
	// ENT-UNPUB-1.3
	expect(await localeRow(entry.id, "ko")).toEqual(entry.working);
	// ENT-UNPUB-1.4
	expect(await useRows("entry", entry.id)).toEqual([use]);
});

it("ENT-UNPUB-2 unpublishes an entry that is not published without an error", async () => {
	const entry = await seedEntry({ data: { fields: { title: "Draft" } } });

	const output = await montiOf().entries.unpublish({ id: entry.id });

	// ENT-UNPUB-2.1
	expect(output).toMatchObject({ id: entry.id, slug: entry.slug, data: entry.data, published_at: null });
});

it("ENT-UNPUB-3 rejects entries.unpublish with NOT_FOUND for a trashed entry", async () => {
	const { entry, published } = await seedPublishedEntry({ trashed: true });

	// ENT-UNPUB-3.1
	await expect(montiOf().entries.unpublish({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-UNPUB-3.2
	expect(await publishedRow(entry.id, "ko")).toEqual(published);
});

it("ENT-UNPUB-4 unpublishes only the given non-source locale and keeps the other published copies", async () => {
	const { entry, published } = await seedPublishedEntry();
	await seedLocale(entry.id, "en", { data: { fields: { title: "Draft EN" } } });
	await seedPublished(entry.id, "en", `live-en-${randomUUID()}`, { fields: { title: "Live EN" } });

	const output = await montiOf().entries.unpublish({ id: entry.id, locale: "en" });

	// ENT-UNPUB-4.1
	expect(output).toMatchObject({ locale: "en", published_at: null });
	// ENT-UNPUB-4.2
	expect(await publishedRows()).toEqual([published]);
});

it("ENT-UNPUB-5 rejects entries.unpublish with NOT_FOUND for a locale the entry does not have", async () => {
	const { entry, published } = await seedPublishedEntry();

	// ENT-UNPUB-5.1
	await expect(montiOf().entries.unpublish({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UNPUB-5.2
	expect(await publishedRows()).toEqual([published]);
});

it("ENT-DUP-1 duplicates the source locale's working copy and media_uses into an unpublished entry and leaves the translations out", async () => {
	const folder = await seedFolder();
	const [first, second] = [await seedMedia(), await seedMedia()];
	const { entry: source, use } = await seedEntryUsing(first, {
		folder_id: folder,
		data: { fields: { title: "Draft", cover: first } },
	});
	await seedPublished(source.id, "ko", source.slug, { fields: { title: "Live" } });
	const en = await seedLocale(source.id, "en", { data: { fields: { title: "Draft EN", cover: second } } });
	await seedUse(coverUse(source.id, second));

	const output = await montiOf().entries.duplicate({ id: source.id, slug: "copied" });

	// ENT-DUP-1.1
	expect({ ...output, id: UUID.test(output.id) && output.id !== source.id }).toEqual({
		id: true,
		collection: source.collection,
		locale: "ko",
		source_locale: "ko",
		folder_id: folder,
		slug: "copied",
		data: source.data,
		published_at: null,
	});
	// ENT-DUP-1.2
	expect({
		entries: (await entryRows()).filter((row) => row.id !== source.id),
		locales: (await localeRows()).filter((row) => row.entry_id !== source.id),
	}).toEqual({
		entries: [
			{ id: output.id, collection: source.collection, source_locale: "ko", folder_id: folder, trashed_at: null },
		],
		locales: [{ entry_id: output.id, locale: "ko", slug: "copied", data: source.data, translation_seen: {} }],
	});
	// ENT-DUP-1.3
	expect([await entryRow(source.id), await localeRow(source.id, "ko"), await localeRow(source.id, "en")]).toEqual([
		source.row,
		source.working,
		en,
	]);
	// ENT-DUP-1.4
	expect((await publishedRows()).map((row) => row.entry_id)).toEqual([source.id]);
	// ENT-DUP-1.5
	expect(await useRows("entry", output.id)).toEqual([{ ...use, source_id: output.id }]);
});

it("ENT-DUP-2 gives a duplicate without a slug the first -copy slug no active entry has", async () => {
	const source = await seedEntry({ slug: "hello" });
	await seedEntry({ slug: "hello-copy" });

	const output = await montiOf().entries.duplicate({ id: source.id });

	// ENT-DUP-2.1
	expect(output.slug).toBe("hello-copy-2");
	// ENT-DUP-2.2
	expect((await localeRow(output.id, "ko")).slug).toBe("hello-copy-2");
});

it("ENT-DUP-3 duplicates with the given __preset_id", async () => {
	const source = await seedEntry();
	const id = randomUUID();

	const output = await montiOf().entries.duplicate({ id: source.id, __preset_id: id });

	// ENT-DUP-3.1
	expect(output.id).toBe(id);
	// ENT-DUP-3.2
	expect(idsOf(await entryRows())).toEqual(idsOf([source, { id }]));
});

it("ENT-DUP-4 rejects entries.duplicate with BAD_REQUEST for a slug with a space", async () => {
	const source = await seedEntry();

	// ENT-DUP-4.1
	await expect(montiOf().entries.duplicate({ id: source.id, slug: "hello world" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-DUP-4.2
	expect(await entryRows()).toEqual([source.row]);
});

it("ENT-DUP-5 rejects entries.duplicate with CONFLICT for a slug an active entry has", async () => {
	const source = await seedEntry({ slug: "hello" });

	// ENT-DUP-5.1
	await expect(montiOf().entries.duplicate({ id: source.id, slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-DUP-5.2
	expect(await entryRows()).toEqual([source.row]);
});

it("ENT-DUP-6 rejects entries.duplicate with NOT_FOUND for a trashed entry", async () => {
	const source = await seedEntry({ trashed: true });

	// ENT-DUP-6.1
	await expect(montiOf().entries.duplicate({ id: source.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-DUP-6.2
	expect(await entryRows()).toEqual([source.row]);
});

/** Two topics, either optionally trashed, to replace references between. */
async function seedTopics(seed: { oldTrashed?: boolean; newTrashed?: boolean } = {}) {
	const old = await seedEntry({ collection: TOPICS, trashed: seed.oldTrashed });
	const replacement = await seedEntry({ collection: TOPICS, trashed: seed.newTrashed });
	return { old, replacement };
}

it("ENT-REF-1 points the working and published copies at the new entry and leaves the old entry as it is", async () => {
	const { old, replacement } = await seedTopics();
	const post = await seedEntry({ data: { fields: { title: "Draft", topic: old.id } } });
	const published = await seedPublished(post.id, "ko", `live-${post.slug}`, {
		fields: { title: "Live", topic: old.id },
	});

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-1.1
	expect(output).toEqual({ from_id: old.id, into_id: replacement.id, updated_ids: [post.id] });
	// ENT-REF-1.2
	expect([(await localeRow(post.id, "ko")).data, (await publishedRow(post.id, "ko")).data]).toMatchObject([
		{ fields: { topic: replacement.id } },
		{ fields: { topic: replacement.id } },
	]);
	// ENT-REF-1.3
	expect(await publishedRow(post.id, "ko")).toEqual({
		...published,
		data: { fields: { title: "Live", topic: replacement.id } },
	});
	// ENT-REF-1.4
	expect((await entryRow(old.id)).trashed_at).toBeNull();
});

it("ENT-REF-2 keeps only the first place of the new entry in a relation field with many", async () => {
	const { old, replacement } = await seedTopics();
	const other = await seedEntry({ collection: TOPICS });
	const page = await seedEntry({ collection: PAGES, data: { fields: { topic: [old.id, other.id, replacement.id] } } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-2.1
	expect(output.updated_ids).toEqual([page.id]);
	// ENT-REF-2.2
	expect((await localeRow(page.id, "ko")).data).toEqual({ fields: { topic: [replacement.id, other.id] } });
});

it("ENT-REF-3 also replaces a relation inside a conditional field", async () => {
	const { old, replacement } = await seedTopics();
	const note = await seedEntry({
		collection: NOTES,
		data: { fields: { kind: { option: "link", fields: { url: "https://monti.dev", topic: old.id } } } },
	});

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-3.1
	expect(output.updated_ids).toEqual([note.id]);
	// ENT-REF-3.2
	expect((await localeRow(note.id, "ko")).data).toEqual({
		fields: { kind: { option: "link", fields: { url: "https://monti.dev", topic: replacement.id } } },
	});
});

it("ENT-REF-4 also replaces the references of a trashed entry", async () => {
	const { old, replacement } = await seedTopics();
	const trashed = await seedEntry({ data: { fields: { topic: old.id } }, trashed: true });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-4.1
	expect(output.updated_ids).toEqual([trashed.id]);
	// ENT-REF-4.2
	expect((await localeRow(trashed.id, "ko")).data).toEqual({ fields: { topic: replacement.id } });
});

it("ENT-REF-5 replaces references to an old entry that is already trashed", async () => {
	const { old, replacement } = await seedTopics({ oldTrashed: true });
	const post = await seedEntry({ data: { fields: { topic: old.id } } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-5.1
	expect(output.updated_ids).toEqual([post.id]);
	// ENT-REF-5.2
	expect((await localeRow(post.id, "ko")).data).toEqual({ fields: { topic: replacement.id } });
});

it("ENT-REF-6 rejects entries.replaceReferences with BAD_REQUEST for the same entry on both sides", async () => {
	const topic = await seedEntry({ collection: TOPICS });

	// ENT-REF-6.1
	await expect(montiOf().entries.replaceReferences({ from_id: topic.id, into_id: topic.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("ENT-REF-7 rejects entries.replaceReferences with BAD_REQUEST for entries of different collections", async () => {
	const old = await seedEntry({ collection: TOPICS });
	const replacement = await seedEntry({ collection: PAGES });

	// ENT-REF-7.1
	await expect(montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id })).rejects.toMatchObject(
		{ code: "BAD_REQUEST" },
	);
});

it("ENT-REF-8 rejects entries.replaceReferences with NOT_FOUND for a trashed new entry and replaces nothing", async () => {
	const { old, replacement } = await seedTopics({ newTrashed: true });
	const post = await seedEntry({ data: { fields: { topic: old.id } } });

	// ENT-REF-8.1
	await expect(montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id })).rejects.toMatchObject(
		{ code: "NOT_FOUND" },
	);
	// ENT-REF-8.2
	expect((await localeRow(post.id, "ko")).data).toEqual(post.data);
});

it("ENT-REF-9 replaces the references in every locale's working and published copies and returns the entry id once", async () => {
	const { old, replacement } = await seedTopics();
	const post = await seedEntry({ data: { fields: { title: "Draft KO", topic: old.id } } });
	await seedLocale(post.id, "en", { data: { fields: { title: "Draft EN", topic: old.id } } });
	await seedPublished(post.id, "ko", post.slug, { fields: { title: "Live KO", topic: old.id } });
	await seedPublished(post.id, "en", `${post.slug}-en`, { fields: { title: "Live EN", topic: old.id } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: replacement.id });

	// ENT-REF-9.1
	expect(output.updated_ids).toEqual([post.id]);
	// ENT-REF-9.2
	expect([(await localeRow(post.id, "ko")).data, (await localeRow(post.id, "en")).data]).toEqual([
		{ fields: { title: "Draft KO", topic: replacement.id } },
		{ fields: { title: "Draft EN", topic: replacement.id } },
	]);
	// ENT-REF-9.3
	expect([(await publishedRow(post.id, "ko")).data, (await publishedRow(post.id, "en")).data]).toEqual([
		{ fields: { title: "Live KO", topic: replacement.id } },
		{ fields: { title: "Live EN", topic: replacement.id } },
	]);
});

it("ENT-LOC-1 adds a non-source locale to an active entry, even with the source locale's slug, and fills the defaults", async () => {
	const folder = await seedFolder();
	const entry = await seedEntry({ folder_id: folder });

	const output = await montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: entry.slug });

	// ENT-LOC-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: POSTS,
		locale: "en",
		source_locale: "ko",
		folder_id: folder,
		slug: entry.slug,
		data: { fields: {} },
		published_at: null,
	});
	// ENT-LOC-1.2
	expect(await localeRow(entry.id, "en")).toEqual({
		entry_id: entry.id,
		locale: "en",
		slug: entry.slug,
		data: { fields: {} },
		translation_seen: {},
	});
	// ENT-LOC-1.3
	expect(await publishedRows()).toEqual([]);
});

it("ENT-LOC-2 adds a locale with data and indexes the media of every locale of the entry", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const { entry } = await seedEntryUsing(first);
	const data = { fields: { cover: second } };

	const output = await montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "hello", data });

	// ENT-LOC-2.1
	expect(output.data).toEqual(data);
	// ENT-LOC-2.2
	expect(await useRows("entry", entry.id)).toEqual(
		[coverUse(entry.id, first), coverUse(entry.id, second)].sort((a, b) => a.media_id.localeCompare(b.media_id)),
	);
});

it("ENT-LOC-3 rejects entries.addLocale with BAD_REQUEST for a locale the schema does not have", async () => {
	const entry = await seedEntry();

	// ENT-LOC-3.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "ja", slug: "hello" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-LOC-3.2
	expect(await localeRows()).toEqual([entry.working]);
});

it("ENT-LOC-4 rejects entries.addLocale with CONFLICT for a locale the entry already has", async () => {
	const entry = await seedEntry();
	const en = await seedLocale(entry.id, "en");

	// ENT-LOC-4.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "fresh-slug" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-LOC-4.2
	expect(await localeRow(entry.id, "en")).toEqual(en);
});

it("ENT-LOC-5 rejects entries.addLocale with CONFLICT for a slug another active entry has in the collection and locale", async () => {
	const first = await seedEntry();
	await seedLocale(first.id, "en", { slug: "hello" });
	const second = await seedEntry();

	// ENT-LOC-5.1
	await expect(montiOf().entries.addLocale({ id: second.id, locale: "en", slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-LOC-5.2
	expect((await localeRows()).filter((row) => row.entry_id === second.id)).toEqual([second.working]);
});

it("ENT-LOC-6 rejects entries.addLocale with BAD_REQUEST for a slug with a space", async () => {
	const entry = await seedEntry();

	// ENT-LOC-6.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "hello world" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-LOC-6.2
	expect(await localeRows()).toEqual([entry.working]);
});

it("ENT-LOC-7 rejects entries.addLocale with BAD_REQUEST for data that breaks a field's type", async () => {
	const entry = await seedEntry();

	// ENT-LOC-7.1
	await expect(
		montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "hello", data: { fields: { views: "ten" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-LOC-7.2
	expect(await localeRows()).toEqual([entry.working]);
});

it("ENT-LOC-8 rejects entries.addLocale with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ trashed: true });

	// ENT-LOC-8.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "hello" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-LOC-8.2
	expect(await localeRows()).toEqual([entry.working]);
});

/** The `media_uses` row of an entry's `gallery` field referencing `media_id`. */
function galleryUse(source_id: string, media_id: string): UseSeed {
	return { media_id, source_kind: "entry", source_id, field_path: "fields.gallery" };
}

/** Each working copy's row sorted by `locale`, so a check does not hang on the order rows come back in. */
function byLocale<Row extends { locale: string }>(rows: Row[]): Row[] {
	return [...rows].sort((a, b) => a.locale.localeCompare(b.locale));
}

it("ENT-RLOC-1 deletes a non-source locale with its published copy and indexes the media of the locales left", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const entry = await seedEntry({ data: { fields: { gallery: [first] } } });
	await seedLocale(entry.id, "en", { data: { fields: { gallery: [first, second] } } });
	const ko = await seedPublished(entry.id, "ko", entry.slug, entry.data);
	await seedPublished(entry.id, "en", `${entry.slug}-en`, { fields: { gallery: [first, second] } });
	await seedUse(galleryUse(entry.id, first));
	await seedUse(galleryUse(entry.id, second));

	const output = await montiOf().entries.removeLocale({ id: entry.id, locale: "en" });

	// ENT-RLOC-1.1
	expect(output).toEqual({ id: entry.id, locale: "en" });
	// ENT-RLOC-1.2
	expect([
		(await localeRows()).filter((row) => row.locale === "en"),
		(await publishedRows()).filter((row) => row.locale === "en"),
	]).toEqual([[], []]);
	// ENT-RLOC-1.3
	expect([await entryRows(), await localeRows(), await publishedRows()]).toEqual([[entry.row], [entry.working], [ko]]);
	// ENT-RLOC-1.4
	expect(await useRows("entry", entry.id)).toEqual([galleryUse(entry.id, first)]);
});

it("ENT-RLOC-2 deletes a non-source locale that is not published yet", async () => {
	const entry = await seedEntry();
	await seedLocale(entry.id, "en");

	const output = await montiOf().entries.removeLocale({ id: entry.id, locale: "en" });

	// ENT-RLOC-2.1
	expect(output).toEqual({ id: entry.id, locale: "en" });
	// ENT-RLOC-2.2
	expect([await localeRows(), await entryRows()]).toEqual([[entry.working], [entry.row]]);
});

it("ENT-RLOC-3 rejects entries.removeLocale with BAD_REQUEST for the source locale", async () => {
	const entry = await seedEntry();
	const en = await seedLocale(entry.id, "en");

	// ENT-RLOC-3.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "ko" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-RLOC-3.2
	expect([await entryRows(), byLocale(await localeRows())]).toEqual([[entry.row], [en, entry.working]]);
});

it("ENT-RLOC-4 rejects entries.removeLocale with NOT_FOUND for a locale the entry does not have", async () => {
	const entry = await seedEntry();

	// ENT-RLOC-4.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-RLOC-4.2
	expect(await localeRow(entry.id, "ko")).toEqual(entry.working);
});

it("ENT-RLOC-5 rejects entries.removeLocale with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ trashed: true });
	const en = await seedLocale(entry.id, "en");

	// ENT-RLOC-5.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-RLOC-5.2
	expect(await localeRow(entry.id, "en")).toEqual(en);
});

/** A `translation_seen` record of a working copy that has caught up with its source locale. */
const SEEN = { title: "seen-hash" };

/** Each working copy's `locale` and `translation_seen` of one entry, sorted by `locale`. */
async function seenOf(entry_id: string) {
	const rows = byLocale((await localeRows()).filter((row) => row.entry_id === entry_id));
	return rows.map(({ locale, translation_seen }) => ({ locale, translation_seen }));
}

it("ENT-SRC-1 changes the source locale to another locale and clears the translation_seen of every locale of the entry", async () => {
	const folder = await seedFolder();
	const entry = await seedEntry({ folder_id: folder, data: { fields: { title: "KO" } } });
	const en = await seedLocale(entry.id, "en", { data: { fields: { title: "EN" } }, translation_seen: SEEN });
	await seedLocale(entry.id, "ja", { translation_seen: SEEN });
	const enPublishedAt = new Date("2026-11-02T09:00:00.000Z");
	const published = [
		await seedPublished(entry.id, "en", en.slug, en.data, enPublishedAt),
		await seedPublished(entry.id, "ko", entry.slug, entry.data),
	];
	const other = await seedEntry({ translation_seen: SEEN });

	const output = await montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" });

	// ENT-SRC-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: POSTS,
		locale: "en",
		source_locale: "en",
		folder_id: folder,
		slug: en.slug,
		data: en.data,
		published_at: enPublishedAt,
	});
	// ENT-SRC-1.2
	expect((await entryRow(entry.id)).source_locale).toBe("en");
	// ENT-SRC-1.3
	expect(await seenOf(entry.id)).toEqual([
		{ locale: "en", translation_seen: {} },
		{ locale: "ja", translation_seen: {} },
		{ locale: "ko", translation_seen: {} },
	]);
	// ENT-SRC-1.4
	expect([await publishedRows(), await localeRow(other.id, "ko")]).toEqual([published, other.working]);
});

it("ENT-SRC-2 returns the entry as it is and keeps translation_seen when the locale is already the source locale", async () => {
	const entry = await seedEntry({ data: { fields: { title: "KO" } } });
	const en = await seedLocale(entry.id, "en", { translation_seen: SEEN });

	const output = await montiOf().entries.setSourceLocale({ id: entry.id, locale: "ko" });

	// ENT-SRC-2.1
	expect(output).toEqual({
		id: entry.id,
		collection: POSTS,
		locale: "ko",
		source_locale: "ko",
		folder_id: null,
		slug: entry.slug,
		data: entry.data,
		published_at: null,
	});
	// ENT-SRC-2.2
	expect(await localeRow(entry.id, "en")).toEqual(en);
});

it("ENT-SRC-3 rejects entries.setSourceLocale with NOT_FOUND for a locale the entry does not have", async () => {
	const entry = await seedEntry();

	// ENT-SRC-3.1
	await expect(montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-SRC-3.2
	expect((await entryRow(entry.id)).source_locale).toBe("ko");
});

it("ENT-SRC-4 rejects entries.setSourceLocale with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ trashed: true });
	const en = await seedLocale(entry.id, "en", { translation_seen: SEEN });

	// ENT-SRC-4.1
	await expect(montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-SRC-4.2
	expect([await entryRow(entry.id), await localeRow(entry.id, "en")]).toEqual([entry.row, en]);
});
