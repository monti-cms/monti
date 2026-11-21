import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { createMemoryStorage, type MemoryStorage } from "../../__test__/memory-storage";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig } from "../../engine/types";
import { validateDoc } from "../../rich-text/validate-doc";
import { templates } from "./templates";

let testDb: TestDatabase;
let db: Kysely<Database>;
let storage: MemoryStorage;

const POSTS = "posts";
const PAGES = "pages";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The one block type the config adds to the built-in ones. */
const GALLERY = { type: "gallery", holds: "nothing" } as const;

/** A body that passes `validateDoc` and references no media. */
const PLAIN = { blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

/** A body with two problems: the gallery block has an empty `id` and the second block's type is not registered. */
const BROKEN = {
	blocks: [
		{ id: "", type: "gallery" },
		{ id: "x1", type: "unregistered" },
	],
};

function configOf(withStorage: boolean): MontiConfig {
	return { name: "Monti Blog", dev: false, blocks: [GALLERY], storage: withStorage ? storage : undefined };
}

function montiOf(withStorage = true) {
	return createMonti(db, { templates }, [], {
		schema: {
			locales: ["ko"],
			collections: {
				[POSTS]: { fields: { title: { type: "text" } } },
				[PAGES]: { fields: { title: { type: "text" } } },
			},
		},
		config: configOf(withStorage),
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	storage = createMemoryStorage();
});

afterEach(async () => {
	await testDb.drop();
});

/** A body whose one image block references `mediaId`. */
function imageDoc(mediaId: string) {
	return { blocks: [{ id: "i1", type: "image", attrs: { mediaId } }] };
}

/** Puts an uploaded file in the storage and registers it as a media row, as `media.create` would. */
async function seedMedia(trashed = false): Promise<string> {
	const id = randomUUID();
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 1024 });
	await db
		.insertInto("media")
		.values({
			id,
			folder_id: null,
			key,
			filename: "image.png",
			mime_type: "image/png",
			size: 1024,
			trashed_at: trashed ? new Date() : null,
		})
		.execute();
	return id;
}

/** 미디어의 `trashed_at`을 설정해 휴지통으로 옮긴다. */
async function trashMedia(id: string): Promise<void> {
	await db.updateTable("media").set({ trashed_at: new Date() }).where("id", "=", id).execute();
}

interface TemplateSeed {
	collection?: string;
	name?: string;
	content?: Record<string, unknown>;
}

/** Inserts a template straight into the table and returns its row as the table holds it. */
async function seedTemplate(seed: TemplateSeed = {}) {
	const row = {
		id: randomUUID(),
		collection: seed.collection ?? POSTS,
		name: seed.name ?? "Template",
		content: seed.content ?? PLAIN,
	};
	await db
		.insertInto("templates")
		.values({ ...row, content: JSON.stringify(row.content) })
		.execute();
	return row;
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

/** A template that references a media item through `content`, with its `media_uses` row. */
async function seedTemplateUsing(name: string, mediaId?: string) {
	mediaId ??= await seedMedia();
	const template = await seedTemplate({ name, content: imageDoc(mediaId) });
	const use = await seedUse({
		media_id: mediaId,
		source_kind: "template",
		source_id: template.id,
		field_path: "content",
	});
	return { template, use };
}

/** TPL-UPD-2 and TPL-DEL-1: a target and another template using the first media, and an entry use sharing the target's id. */
async function seedSharedUses() {
	const first = await seedMedia();
	const target = await seedTemplateUsing("Target", first);
	const other = await seedTemplateUsing("Other", first);
	const entryUse = await seedUse({
		media_id: first,
		source_kind: "entry",
		source_id: target.template.id,
		field_path: "body",
	});
	return { target, other, entryUse };
}

async function templateRows() {
	return db.selectFrom("templates").selectAll().execute();
}

async function templateRow(id: string) {
	return db.selectFrom("templates").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function useRows(source_kind: "entry" | "template", source_id: string) {
	return db
		.selectFrom("media_uses")
		.selectAll()
		.where("source_kind", "=", source_kind)
		.where("source_id", "=", source_id)
		.orderBy("media_id")
		.execute();
}

async function allUseRows() {
	return db.selectFrom("media_uses").selectAll().orderBy("media_id").execute();
}

function byId<T extends { id: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

it("TPL-CRT-1 creates and returns a template of a collection on an engine without storage", async () => {
	const output = await montiOf(false).templates.create({ collection: POSTS, name: "Review", content: PLAIN });

	// TPL-CRT-1.1
	expect(output).toEqual({ id: expect.stringMatching(UUID), collection: POSTS, name: "Review", content: PLAIN });
	// TPL-CRT-1.2
	expect(await templateRows()).toEqual([output]);
});

it("TPL-CRT-2 creates a template with the given __preset_id", async () => {
	const id = randomUUID();

	const output = await montiOf().templates.create({
		__preset_id: id,
		collection: POSTS,
		name: "Review",
		content: PLAIN,
	});

	// TPL-CRT-2.1
	expect(output.id).toBe(id);
	// TPL-CRT-2.2
	expect((await templateRows()).map((row) => row.id)).toEqual([id]);
});

it("TPL-CRT-3 creates a template whose name another collection already has", async () => {
	const existing = await seedTemplate({ collection: PAGES, name: "Review" });

	const output = await montiOf().templates.create({ collection: POSTS, name: "Review", content: PLAIN });

	// TPL-CRT-3.1
	expect({ collection: output.collection, name: output.name }).toEqual({ collection: POSTS, name: "Review" });
	// TPL-CRT-3.2
	expect(byId(await templateRows())).toEqual(byId([existing, output]));
});

it("TPL-CRT-4 records every media in the block tree's attrs.mediaId and attrs.mediaIds once in media_uses, ignoring case", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const third = await seedMedia();
	const content = {
		blocks: [
			{ id: "b1", type: "image", attrs: { mediaId: first } },
			{
				id: "b2",
				type: "quote",
				children: [
					{ id: "b3", type: "image", attrs: { mediaId: second } },
					{ id: "b4", type: "gallery", attrs: { mediaIds: [second.toUpperCase(), third] } },
				],
			},
		],
	};

	const output = await montiOf().templates.create({ collection: POSTS, name: "Review", content });

	// TPL-CRT-4.1
	expect(await allUseRows()).toEqual(
		[first, second, third].sort().map((media_id) => ({
			media_id,
			source_kind: "template",
			source_id: output.id,
			field_path: "content",
		})),
	);
});

it("TPL-CRT-5 rejects templates.create with BAD_REQUEST for a collection not in the schema", async () => {
	// TPL-CRT-5.1
	await expect(
		montiOf().templates.create({ collection: "constructor", name: "Review", content: PLAIN }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// TPL-CRT-5.2
	expect(await templateRows()).toEqual([]);
});

it("TPL-CRT-6 rejects templates.create with CONFLICT for a name the collection already has", async () => {
	const existing = await seedTemplate({ name: "Review" });

	// TPL-CRT-6.1
	await expect(montiOf().templates.create({ collection: POSTS, name: "Review", content: PLAIN })).rejects.toMatchObject(
		{ code: "CONFLICT" },
	);
	// TPL-CRT-6.2
	expect(await templateRows()).toEqual([existing]);
});

it("TPL-CRT-7 rejects templates.create with BAD_REQUEST carrying every problem of an invalid body", async () => {
	const error = await montiOf()
		.templates.create({ collection: POSTS, name: "Review", content: BROKEN })
		.catch((caught: unknown) => caught);

	// TPL-CRT-7.1
	expect(error).toMatchObject({ code: "BAD_REQUEST" });
	// TPL-CRT-7.2
	expect(error).toHaveProperty("details", validateDoc(BROKEN, configOf(true)));
	// TPL-CRT-7.3
	expect(await templateRows()).toEqual([]);
});

it("TPL-CRT-8 rejects templates.create with BAD_REQUEST for a body referencing a trashed media", async () => {
	const trashed = await seedMedia(true);

	// TPL-CRT-8.1
	await expect(
		montiOf().templates.create({ collection: POSTS, name: "Review", content: imageDoc(trashed) }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// TPL-CRT-8.2
	expect(await templateRows()).toEqual([]);
	// TPL-CRT-8.3
	expect(await allUseRows()).toEqual([]);
});

it("TPL-READ-1 lists the templates of every collection when called without an input", async () => {
	const post = await seedTemplate({ collection: POSTS });
	const page = await seedTemplate({ collection: PAGES });

	const output = await montiOf().templates.list();

	// TPL-READ-1.1
	expect(byId(output)).toEqual(byId([post, page]));
});

it("TPL-READ-2 lists only the templates of the given collection", async () => {
	const post = await seedTemplate({ collection: POSTS });
	await seedTemplate({ collection: PAGES });

	const output = await montiOf().templates.list({ collection: POSTS });

	// TPL-READ-2.1
	expect(output).toEqual([post]);
});

it("TPL-READ-3 gets the template with the given id", async () => {
	await seedTemplate({ name: "First", content: { blocks: [{ id: "h1", type: "heading" }] } });
	const second = await seedTemplate({ name: "Second" });

	const output = await montiOf().templates.get({ id: second.id });

	// TPL-READ-3.1
	expect(output).toEqual(second);
});

it("TPL-READ-4 rejects templates.get with NOT_FOUND for an id no template has", async () => {
	await seedTemplate();

	// TPL-READ-4.1
	await expect(montiOf().templates.get({ id: randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TPL-UPD-1 renames a template given only a name and keeps its content and media_uses", async () => {
	const { template, use } = await seedTemplateUsing("Review");

	const output = await montiOf().templates.update({ id: template.id, name: "Renamed" });

	// TPL-UPD-1.1
	expect(output).toEqual({ ...template, name: "Renamed" });
	// TPL-UPD-1.2
	expect(await templateRow(template.id)).toEqual(output);
	// TPL-UPD-1.3
	expect(await useRows("template", template.id)).toEqual([use]);
});

it("TPL-UPD-2 replaces the content and only the template's media_uses with the new references", async () => {
	const { target, other, entryUse } = await seedSharedUses();
	const second = await seedMedia();
	const content = imageDoc(second);

	const output = await montiOf().templates.update({ id: target.template.id, content });

	// TPL-UPD-2.1
	expect(output).toEqual({ ...target.template, content });
	// TPL-UPD-2.2
	expect(await templateRow(target.template.id)).toEqual(output);
	// TPL-UPD-2.3
	expect(await useRows("template", target.template.id)).toEqual([
		{ media_id: second, source_kind: "template", source_id: target.template.id, field_path: "content" },
	]);
	// TPL-UPD-2.4
	expect(await useRows("template", other.template.id)).toEqual([other.use]);
	// TPL-UPD-2.5
	expect(await useRows("entry", target.template.id)).toEqual([entryUse]);
});

it("TPL-UPD-3 rejects templates.update with CONFLICT for a name another template of the collection has", async () => {
	const first = await seedTemplate({ name: "First" });
	const second = await seedTemplate({ name: "Second" });

	// TPL-UPD-3.1
	await expect(montiOf().templates.update({ id: second.id, name: first.name })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// TPL-UPD-3.2
	expect((await templateRow(second.id)).name).toBe("Second");
});

it("TPL-UPD-4 rejects templates.update with BAD_REQUEST carrying every problem of an invalid body", async () => {
	const template = await seedTemplate();

	const error = await montiOf()
		.templates.update({ id: template.id, content: BROKEN })
		.catch((caught: unknown) => caught);

	// TPL-UPD-4.1
	expect(error).toMatchObject({ code: "BAD_REQUEST" });
	// TPL-UPD-4.2
	expect(error).toHaveProperty("details", validateDoc(BROKEN, configOf(true)));
	// TPL-UPD-4.3
	expect((await templateRow(template.id)).content).toEqual(template.content);
});

it("TPL-UPD-5 본문에 존재하지 않거나 기존에 없던 휴지통 미디어를 새로 넣어 템플릿을 수정할 수 없다", async () => {
	const { template, use } = await seedTemplateUsing("Review");
	const trashed = await seedMedia(true);

	const codes: (string | null)[] = [];
	for (const mediaId of [randomUUID(), trashed]) {
		const error = await montiOf()
			.templates.update({ id: template.id, content: imageDoc(mediaId) })
			.then(
				() => null,
				(caught: { code: string }) => caught,
			);
		codes.push(error?.code ?? null);
	}

	// TPL-UPD-5.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// TPL-UPD-5.2
	expect((await templateRow(template.id)).content).toEqual(template.content);
	// TPL-UPD-5.3
	expect(await useRows("template", template.id)).toEqual([use]);
});

it("TPL-UPD-6 rejects templates.update with NOT_FOUND for an id no template has", async () => {
	await seedTemplate();

	// TPL-UPD-6.1
	await expect(montiOf().templates.update({ id: randomUUID(), name: "Renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("TPL-UPD-7 이미 템플릿 본문에 들어 있던 미디어가 휴지통에 들어가도 그 미디어를 그대로 유지한 채 다른 문단을 수정할 수 있다", async () => {
	const media = await seedMedia();
	/** 문단 하나와 그 미디어를 참조하는 이미지 블록 하나로 된 본문. */
	const contentWith = (text: string) => ({
		blocks: [
			{ id: "p1", type: "paragraph", content: [{ type: "text", text }] },
			{ id: "i1", type: "image", attrs: { mediaId: media } },
		],
	});
	const template = await seedTemplate({ content: contentWith("Hello") });
	const use = await seedUse({
		media_id: media,
		source_kind: "template",
		source_id: template.id,
		field_path: "content",
	});
	await trashMedia(media);
	const content = contentWith("Bye");

	const output = await montiOf().templates.update({ id: template.id, content });

	// TPL-UPD-7.1
	expect(output.content).toEqual(content);
	// TPL-UPD-7.2
	expect(await useRows("template", template.id)).toEqual([use]);
});

it("TPL-UPD-8 템플릿의 이름을 빈 문자열로 바꿀 수 없다", async () => {
	const template = await seedTemplate({ name: "Review" });

	// TPL-UPD-8.1
	await expect(montiOf().templates.update({ id: template.id, name: "" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// TPL-UPD-8.2
	expect((await templateRow(template.id)).name).toBe("Review");
});

it("TPL-DEL-1 deletes the template and only its media_uses", async () => {
	const { target, other, entryUse } = await seedSharedUses();

	await montiOf().templates.delete({ id: target.template.id });

	// TPL-DEL-1.1
	expect(await templateRows()).toEqual([other.template]);
	// TPL-DEL-1.2
	expect(await useRows("template", target.template.id)).toEqual([]);
	// TPL-DEL-1.3
	expect(await useRows("template", other.template.id)).toEqual([other.use]);
	// TPL-DEL-1.4
	expect(await useRows("entry", target.template.id)).toEqual([entryUse]);
});

it("TPL-DEL-2 rejects templates.delete with NOT_FOUND for an id no template has", async () => {
	await seedTemplate();

	// TPL-DEL-2.1
	await expect(montiOf().templates.delete({ id: randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
