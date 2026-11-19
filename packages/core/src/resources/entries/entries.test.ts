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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLISHED_AT = new Date("2026-11-01T09:00:00.000Z");

/** `posts` has a body and every field type; `pages` relates to topics with `many`; `topics` has no body. */
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

interface EntrySeed {
	collection?: string;
	locale?: string;
	slug?: string;
	folder_id?: string | null;
	source_entry_id?: string | null;
	data?: Record<string, unknown>;
	trashed?: boolean;
}

/** Inserts an entry straight into the table and returns its row as the table holds it. */
async function seedEntry(seed: EntrySeed = {}) {
	const row = {
		id: randomUUID(),
		collection: seed.collection ?? POSTS,
		locale: seed.locale ?? "ko",
		source_entry_id: seed.source_entry_id ?? null,
		folder_id: seed.folder_id ?? null,
		slug: seed.slug ?? `entry-${randomUUID()}`,
		data: seed.data ?? { fields: {} },
		translation_seen: {},
		trashed_at: seed.trashed ? new Date() : null,
	};
	await db
		.insertInto("entries")
		.values({ ...row, data: JSON.stringify(row.data), translation_seen: JSON.stringify(row.translation_seen) })
		.execute();
	return row;
}

/** Inserts the published copy of an entry, as `entries.publish` would, and returns its row. */
async function seedPublished(entry_id: string, slug: string, data: Record<string, unknown>) {
	const row = { entry_id, slug, data, published_at: PUBLISHED_AT };
	await db
		.insertInto("entry_published")
		.values({ ...row, data: JSON.stringify(data) })
		.execute();
	return row;
}

/** An active entry whose published copy has another slug and data than its working copy. */
async function seedPublishedEntry(seed: EntrySeed = {}) {
	const entry = await seedEntry({ data: { fields: { title: "Draft" } }, ...seed });
	const published = await seedPublished(entry.id, `live-${randomUUID()}`, { fields: { title: "Live" } });
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

/** An entry whose `cover` field references `mediaId`, with its `media_uses` row. */
async function seedEntryUsing(mediaId: string, seed: EntrySeed = {}) {
	const entry = await seedEntry({ data: { fields: { cover: mediaId } }, ...seed });
	const use = await seedUse({
		media_id: mediaId,
		source_kind: "entry",
		source_id: entry.id,
		field_path: "fields.cover",
	});
	return { entry, use };
}

async function entryRows() {
	return db.selectFrom("entries").selectAll().execute();
}

async function entryRow(id: string) {
	return db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function publishedRow(entry_id: string) {
	return db.selectFrom("entry_published").selectAll().where("entry_id", "=", entry_id).executeTakeFirstOrThrow();
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
		source_entry_id: null,
		folder_id: null,
		slug: "hello-world",
		data: { fields: {} },
		published_at: null,
	});
	const { published_at: _, ...stored } = output;
	// ENT-CRT-1.2
	expect(await entryRows()).toEqual([{ ...stored, translation_seen: {}, trashed_at: null }]);
	// ENT-CRT-1.3
	expect(await db.selectFrom("entry_published").selectAll().execute()).toEqual([]);
});

it("ENT-CRT-2 creates a working copy with the given __preset_id", async () => {
	const id = randomUUID();

	const output = await montiOf().entries.create({ __preset_id: id, collection: POSTS, locale: "ko", slug: "hello" });

	// ENT-CRT-2.1
	expect(output.id).toBe(id);
	// ENT-CRT-2.2
	expect(idsOf(await entryRows())).toEqual([id]);
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
	const { published_at: _, ...stored } = output;
	// ENT-CRT-3.2
	expect(await entryRow(output.id)).toEqual({ ...stored, translation_seen: {}, trashed_at: null });
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
});

it("ENT-CRT-6 rejects entries.create with BAD_REQUEST for a locale not in the schema", async () => {
	// ENT-CRT-6.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "fr", slug: "hello" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-CRT-6.2
	expect(await entryRows()).toEqual([]);
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
	expect(await entryRows()).toEqual([page]);
});

it("ENT-CRT-15 rejects entries.create with BAD_REQUEST for a relation to a translation", async () => {
	const source = await seedEntry({ collection: TOPICS });
	const translation = await seedEntry({ collection: TOPICS, locale: "en", source_entry_id: source.id });
	const data = { fields: { topic: translation.id } };

	// ENT-CRT-15.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello", data }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-15.2
	expect(idsOf(await entryRows())).toEqual(idsOf([source, translation]));
});

it("ENT-CRT-16 rejects entries.create with BAD_REQUEST for a slug with a space", async () => {
	// ENT-CRT-16.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello world" }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-16.2
	expect(await entryRows()).toEqual([]);
});

it("ENT-CRT-17 rejects entries.create with CONFLICT for a slug an active entry of the collection and locale has", async () => {
	const existing = await seedEntry({ slug: "hello" });

	// ENT-CRT-17.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-CRT-17.2
	expect(await entryRows()).toEqual([existing]);
});

it("ENT-READ-1 gets the published copy of a published entry when draft is left out", async () => {
	const { entry, published } = await seedPublishedEntry();

	const output = await montiOf().entries.get({ id: entry.id });

	// ENT-READ-1.1
	expect(output).toMatchObject({
		id: entry.id,
		collection: entry.collection,
		locale: entry.locale,
		source_entry_id: entry.source_entry_id,
		folder_id: entry.folder_id,
	});
	// ENT-READ-1.2
	expect(output).toMatchObject({ slug: published.slug, data: published.data, published_at: published.published_at });
});

it("ENT-READ-2 gets the published copy by collection, locale and slug", async () => {
	const { entry, published } = await seedPublishedEntry();
	await seedPublishedEntry();

	const output = await montiOf().entries.get({
		collection: entry.collection,
		locale: entry.locale,
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

it("ENT-READ-6 lists only the published copies of active published entries when called without an input", async () => {
	const { entry, published } = await seedPublishedEntry();
	await seedEntry();
	await seedPublishedEntry({ trashed: true });

	const output = await montiOf().entries.list();

	// ENT-READ-6.1
	expect(idsOf(output)).toEqual([entry.id]);
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
	await seedPublished(post.id, post.slug, { fields: { topic: topic.id } });
	const page = await seedEntry({ collection: PAGES });
	await seedPublished(page.id, page.slug, { fields: { topic: [other.id, topic.id] } });
	const draftOnly = await seedEntry({ collection: POSTS, data: { fields: { topic: topic.id } } });
	await seedPublished(draftOnly.id, draftOnly.slug, { fields: { topic: other.id } });

	const output = await montiOf().entries.list({ relation: { field: "topic", id: topic.id } });

	// ENT-READ-10.1
	expect(idsOf(output)).toEqual(idsOf([post, page]));
});

it("ENT-UPD-1 changes only the slug and folder_id and keeps the data, media_uses and published copy", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media);
	const published = await seedPublished(entry.id, "live", { fields: { title: "Live" } });
	const folder = await seedFolder();

	const output = await montiOf().entries.update({ id: entry.id, slug: "renamed", folder_id: folder });

	// ENT-UPD-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: entry.collection,
		locale: entry.locale,
		source_entry_id: null,
		folder_id: folder,
		slug: "renamed",
		data: entry.data,
		published_at: published.published_at,
	});
	// ENT-UPD-1.2
	expect(await entryRow(entry.id)).toMatchObject({ slug: "renamed", folder_id: folder, data: entry.data });
	// ENT-UPD-1.3
	expect(await useRows("entry", entry.id)).toEqual([use]);
	// ENT-UPD-1.4
	expect(await publishedRow(entry.id)).toMatchObject({ slug: published.slug, data: published.data });
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
	expect((await entryRow(target.entry.id)).data).toEqual(data);
	// ENT-UPD-2.3
	expect(await useRows("entry", target.entry.id)).toEqual([
		{ media_id: second, source_kind: "entry", source_id: target.entry.id, field_path: "fields.cover" },
	]);
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
	expect((await entryRow(entry.id)).data).toEqual(entry.data);
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
	expect((await entryRow(entry.id)).data).toEqual(entry.data);
});

it("ENT-UPD-6 rejects entries.update with NOT_FOUND for a trashed entry", async () => {
	const entry = await seedEntry({ slug: "trashed", trashed: true });

	// ENT-UPD-6.1
	await expect(montiOf().entries.update({ id: entry.id, slug: "renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-6.2
	expect((await entryRow(entry.id)).slug).toBe("trashed");
});

it("ENT-UPD-7 rejects entries.update with CONFLICT for a slug another active entry of the collection and locale has", async () => {
	const first = await seedEntry({ slug: "first" });
	const second = await seedEntry({ slug: "second" });

	// ENT-UPD-7.1
	await expect(montiOf().entries.update({ id: second.id, slug: first.slug })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-UPD-7.2
	expect((await entryRow(second.id)).slug).toBe("second");
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
