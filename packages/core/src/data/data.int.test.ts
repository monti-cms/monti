import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { sql, testDatabase } from "../__test__/database";
import { agentTools } from "../entry/tools";
import { ForbiddenError } from "../errors";
import { memoryStorage } from "../media/storage";
import { createMonti, definePlugin, type Plugin } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { EntryLine } from "./backup";
import { restoreFrom, writeBackup } from "./files";
import type { Imported, Inspected } from "./import";
import type { BackupOutput, BackupSummary } from "./operations";

// Two sites: the one the backup is taken from, and an empty one it is restored or imported into.
const db = await testDatabase();
const other = await testDatabase();

const schema = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
		],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text", required: true },
				cover: { kind: "media", accept: "image" },
				tags: { kind: "relation", to: "tag", many: true },
				format: { kind: "select", options: ["memo", "essay"] },
			},
		},
		tag: {
			kind: "item",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const storage = memoryStorage();
const otherStorage = memoryStorage();
let clock = new Date("2026-11-13T03:00:00Z");
const site = (plugins: Plugin[] = []) =>
	createMonti({ db, schema, now: () => clock, plugins: [definePlugin({ name: "files", storage }), ...plugins] });
const second = (plugins: Plugin[] = []) =>
	createMonti({
		db: other,
		schema,
		now: () => clock,
		plugins: [definePlugin({ name: "files", storage: otherStorage }), ...plugins],
	});
type Site = ReturnType<typeof site>;
const run = <Output>(monti: Site, name: string, input: unknown = {}) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;
const write = async <Output>(monti: Site, name: string, input: unknown) =>
	(await run<{ output: Output; activityId: string }>(monti, name, input)).output;

const p = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const body = (...blocks: unknown[]) => ({ type: "doc", blocks });

let keys = 0;
async function picture(monti: Site, to: typeof storage, name: string) {
	const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}.jpg`;
	await to.put(key, new Uint8Array([1, 2, 3, keys]), { mime: "image/jpeg" });
	return (await write<{ id: string }>(monti, "media.upload", { name, original: { key, width: 10, height: 10 } })).id;
}

/** A small site: two tags, a folder, three posts (one published and since changed, one with a translation), a file, a template. */
async function fill(monti: Site) {
	const tag = async (title: string) =>
		(
			await write<{ group: string }>(monti, "items.saveGroup", {
				collection: "tag",
				locales: { ko: { title, slug: title } },
			})
		).group;
	const [travel, food] = [await tag("여행"), await tag("음식")];
	const cover = await picture(monti, storage, "cover.jpg");
	const folder = (
		await write<{ id: string }>(monti, "folders.create", {
			scope: { collection: "post" },
			parentId: null,
			name: "2026",
		})
	).id;
	const post = async (title: string, slug: string, values: Record<string, unknown>, doc: unknown) =>
		(await write<{ id: string }>(monti, "entries.create", { collection: "post", title, slug, values, doc })).id;
	const first = await post(
		"가을 산행",
		"autumn",
		{ summary: "산에 다녀왔다", cover: { media: cover, alt: "산" }, tags: [travel, food], format: "essay" },
		body(p("b1", "단풍이 시작됐다."), { id: "b2", type: "image", attrs: { media: cover, alt: "산길" } }),
	);
	await write(monti, "entries.moveToFolder", { ids: [first], folder });
	await write(monti, "entries.publish", { ids: [first] });
	clock = new Date(clock.getTime() + 60_000);
	const read = await run<{ entry: { version: number } }>(monti, "entries.get", { id: first });
	// The address changes after the publish: the old one is kept.
	await write(monti, "entries.save", { id: first, version: read.entry.version, slug: "autumn-hike" });
	await write(monti, "entries.publish", { ids: [first] });
	const second = await post("메모", "memo", { summary: "짧은 글", tags: [travel] }, body(p("m1", "메모의 본문.")));
	const translated = (await write<{ id: string }>(monti, "translations.create", { source: second, locale: "en" })).id;
	const draft = await post("초안", "", {}, body(p("d1", "아직 쓰는 중.")));
	await write(monti, "templates.save", { name: "기본 글", doc: body(p("t1", "서론")) });
	const trashed = await post("버린 글", "gone", { summary: "x" }, body(p("g1", "버린다.")));
	await write(monti, "trash.move", { rows: [{ kind: "entry", id: trashed }] });
	return { first, second, translated, draft, trashed, cover, folder, travel, food };
}

const tables = [
	"entries",
	"entry_published",
	"entry_links",
	"folders",
	"media",
	"old_paths",
	"templates",
	"media_uses",
];
const rowsOf = async (from: typeof db, table: string) =>
	(
		await sql<{
			row: Record<string, unknown>;
		}>`select to_jsonb(t) as row from ${sql.id(table)} t order by to_jsonb(t)::text`.execute(from)
	).rows.map((each) => each.row);

beforeEach(async () => {
	for (const each of [db, other]) {
		await sql`truncate entries, entry_links, source_blocks, folders, media, media_uses, templates, monti_activity, monti_delivery, collection_admin_values, monti_settings, old_paths, reserved_paths cascade`.execute(
			each,
		);
		await migrateContent(each, schema, []);
	}
	clock = new Date("2026-11-13T03:00:00Z");
});

describe("the backup (flow 9, 01–03)", () => {
	it("14-1 holds every entry with what the site shows of it, the folders, the media records, the addresses and the templates, and nothing of the trash", async () => {
		const monti = site();
		const made = await fill(monti);
		const backup = await run<BackupOutput>(monti, "data.backup");
		expect(backup.name).toBe("monti-backup-2026-11-13.zip");
		expect(backup.manifest).toMatchObject({
			format: 1,
			kind: "backup",
			counts: { entries: 6, published: 3, folders: 1, media: 1, templates: 1 },
		});
		expect(Object.keys(backup.files)).toEqual([
			"manifest.json",
			"schema.json",
			"entries.jsonl",
			"folders.jsonl",
			"media.jsonl",
			"paths.jsonl",
			"templates.jsonl",
			"source-blocks.jsonl",
			"admin-values.json",
		]);
		const lines = backup.files["entries.jsonl"].split("\n").map((line) => JSON.parse(line) as EntryLine);
		expect(lines.map((line) => line.entry.id)).not.toContain(made.trashed);
		expect(lines.find((line) => line.entry.id === made.first)).toMatchObject({
			entry: { slug: "autumn-hike", status: "published", folder_id: made.folder },
			published: { slug: "autumn-hike" },
			links: [expect.objectContaining({ field: "tags" }), expect.objectContaining({ field: "tags" })],
		});
		expect(backup.files["paths.jsonl"]).toContain('"slug":"autumn"');
		expect(backup.media).toHaveLength(1);
		expect(backup.lastBackup).toBeNull();
		await write(monti, "data.backedUp", {});
		expect((await run<BackupOutput>(monti, "data.backup")).lastBackup).toBe(clock.toISOString());
	});

	it("14-4 a stored key is in no file of the backup: not its sealed value, not its last characters, not its name", async () => {
		const monti = site();
		await fill(monti);
		await db
			.insertInto("api_keys")
			.values({
				id: "key-1",
				service: "anthropic",
				name: "글쓰기용 키 이름",
				base_url: null,
				secret: "sealed:9f2c-the-sealed-value",
				last4: "x7Qz",
				models: "[]",
				models_at: null,
				models_failed_at: null,
			})
			.execute();
		try {
			const backup = await run<BackupOutput>(monti, "data.backup");
			const all = Object.values(backup.files).join("\n");
			for (const part of ["sealed:9f2c-the-sealed-value", "x7Qz", "글쓰기용 키 이름", "api_keys"])
				expect(all).not.toContain(part);
		} finally {
			await db.deleteFrom("api_keys").execute();
		}
	});

	it("14-1 as the assistant's tool it says what the backup holds and not its contents; an export does the same", async () => {
		const monti = site();
		const made = await fill(monti);
		const told = (await monti.run("data.backup", {}, { actor: "assistant" })) as BackupSummary;
		expect(told).toEqual({
			name: expect.any(String),
			manifest: expect.objectContaining({ kind: "backup" }),
			lastBackup: null,
		});
		const exported = (await monti.run("data.export", { ids: [made.first] }, { actor: "assistant" })) as BackupSummary;
		expect(Object.keys(exported)).toEqual(["name", "manifest", "lastBackup"]);
		expect(JSON.stringify(told).length).toBeLessThan(1000);
		// Importing needs the files: only a person does it.
		await expect(monti.run("data.import", { collection: "post", files: [] }, { actor: "assistant" })).rejects.toThrow(
			ForbiddenError,
		);
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("data.import");
	});
});

describe("monti restore (14-3)", () => {
	it("14-3 an empty database restored from a backup has the states, dates, addresses, old addresses, folders and media as they were, and the files in the storage", async () => {
		const monti = site();
		await fill(monti);
		const dir = await mkdtemp(path.join(tmpdir(), "monti-backup-"));
		try {
			const file = path.join(dir, "backup.zip");
			expect(await writeBackup(monti, file, { media: true })).toEqual({ entries: 6, files: 1 });
			const answer = await restoreFrom(second(), file);
			expect(answer).toEqual({ restored: { entries: 6, folders: 1, media: 1, files: 1, templates: 1 } });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
		// What the trash held is not in a backup: without it, the two databases hold the same rows.
		await sql`delete from entries where trashed_at is not null`.execute(db);
		for (const table of tables) expect(await rowsOf(other, table), table).toEqual(await rowsOf(db, table));
		const [media] = await other.selectFrom("media").select("original_key").execute();
		expect((await otherStorage.read(media.original_key))?.bytes).toEqual(
			(await storage.read(media.original_key))?.bytes,
		);
		// The restored site reads as the first one does: the list, and an old address still kept.
		const list = await run<{ rows: { title: string; state: string }[] }>(second(), "entries.query", {
			collection: "post",
		});
		expect(list.rows.map((row) => [row.title, row.state]).sort()).toEqual(
			[
				["가을 산행", "published"],
				["메모", "draft"],
				["초안", "draft"],
			].sort(),
		);
	});

	it("14-3 it runs only on an empty database, and with one problem writes nothing and says every problem", async () => {
		const monti = site();
		await fill(monti);
		const dir = await mkdtemp(path.join(tmpdir(), "monti-backup-"));
		try {
			const file = path.join(dir, "backup.zip");
			await writeBackup(monti, file, { media: false });
			// Into the site it was taken from: it has entries.
			expect(await restoreFrom(monti, file)).toEqual({ problems: [{ problem: "notEmpty" }] });
			// Into a site whose schema lacks a field and a collection the backup uses.
			const narrow = defineSchema({
				...schema,
				collections: {
					post: {
						kind: "document",
						path: "/posts/:slug",
						fields: {
							title: { kind: "text", required: true },
							slug: { kind: "slug", required: true },
							summary: { kind: "text" },
						},
					},
				},
			});
			const narrowSite = createMonti({ db: other, schema: narrow });
			const answer = await restoreFrom(narrowSite, file);
			expect(answer).toEqual({
				problems: expect.arrayContaining([
					{ problem: "unknownCollection", collection: "tag", entries: 2 },
					{ problem: "unknownField", collection: "post", field: "tags", entries: 2 },
					{ problem: "unknownField", collection: "post", field: "cover", entries: 1 },
				]),
			});
			expect(await rowsOf(other, "entries")).toEqual([]);
			expect(await restoreFrom(second(), path.join(dir, "nowhere.zip")).catch(() => "no file")).toBe("no file");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("an export imported into another site (flow 9, 04–09)", () => {
	const upload = (backup: BackupOutput) => ({
		collection: "post",
		files: Object.entries(backup.files).map(([name, text]) => ({ name, text })),
		has: backup.media.map((file) => `media/${file.key}`),
	});

	it("14-1 picked entries are exported with what they point at, and imported as new drafts: relations found by address or made, folders by name, translations kept, one line of the log", async () => {
		const from = site();
		const made = await fill(from);
		const exported = await run<BackupOutput>(from, "data.export", { ids: [made.first, made.second] });
		expect(exported.manifest).toMatchObject({ kind: "export", counts: { entries: 5, folders: 1, media: 1 } });
		expect(exported.name).toBe("monti-export-2026-11-13.zip");

		const to = second();
		// The other site has one of the tags already, under the same address.
		await write(to, "items.saveGroup", { collection: "tag", locales: { ko: { title: "여행", slug: "여행" } } });
		const seen = await run<Extract<Inspected, { kind: "monti" | "files" }>>(to, "data.inspect", upload(exported));
		expect(seen).toMatchObject({ kind: "monti", found: 3, same: 0, unfit: 0 });
		expect(seen.keys.find((key) => key.key === "tags")).toMatchObject({ field: "tags", creates: 1, createsIn: "tag" });
		// The picture is in the upload and not in this library: it is sent up first, then named to the import.
		expect(seen.pictures).toEqual([{ name: made.cover, file: `media/${exported.media[0].key}` }]);
		const cover = await picture(to, otherStorage, "cover.jpg");

		const done = await run<{ output: Imported; activityId: string }>(to, "data.import", {
			...upload(exported),
			name: "monti-export.zip",
			media: { [made.cover]: cover },
		});
		expect(done.output).toMatchObject({ imported: 3, skipped: 0, items: 1, renamed: [] });
		const list = await run<{ rows: { id: string; title: string; state: string; slug: string }[] }>(
			to,
			"entries.query",
			{
				collection: "post",
			},
		);
		// All drafts, whatever they were (doc 14, principle 2): one row per group.
		expect(list.rows.map((row) => [row.title, row.state, row.slug]).sort()).toEqual(
			[
				["가을 산행", "draft", "autumn-hike"],
				["메모", "draft", "memo"],
			].sort(),
		);
		const hike = list.rows.find((row) => row.title === "가을 산행");
		const read = await run<{
			entry: { values: Record<string, unknown>; folderId: string | null; doc: { blocks: { attrs?: unknown }[] } };
		}>(to, "entries.get", { id: hike?.id });
		expect(read.entry.values).toMatchObject({
			summary: "산에 다녀왔다",
			format: "essay",
			cover: { media: cover, alt: "산" },
		});
		expect(read.entry.values.tags).toHaveLength(2);
		expect(read.entry.doc.blocks[1].attrs).toMatchObject({ media: cover });
		const tags = await other.selectFrom("entries").select("title").where("collection", "=", "tag").execute();
		expect(tags.map((row) => row.title).sort()).toEqual(["여행", "음식"].sort());
		const folders = await other.selectFrom("folders").select("name").where("collection", "=", "post").execute();
		expect(folders).toEqual([{ name: "2026" }]);
		expect(read.entry.folderId).not.toBeNull();
		const translations = await other
			.selectFrom("entries")
			.select(["locale", "status"])
			.where("title", "=", "")
			.execute();
		expect(translations).toEqual([{ locale: "en", status: "draft" }]);

		// One line in the log, of the kind "import", undone as a whole.
		const log = await run<{
			lines: { id: string; what: { key: string; values: Record<string, unknown> }[]; kind?: string }[];
		}>(to, "activity.list", { kinds: ["import"] });
		expect(log.lines).toHaveLength(1);
		expect(log.lines[0].what[0]).toMatchObject({ key: "data.import", values: { count: 3, name: "monti-export.zip" } });
		await write(to, "activity.undo", { id: done.activityId });
		expect((await run<{ rows: unknown[] }>(to, "entries.query", { collection: "post" })).rows).toEqual([]);
		expect(
			await other
				.selectFrom("entries")
				.select("title")
				.where("collection", "=", "tag")
				.where("title", "=", "음식")
				.execute(),
		).toEqual([]);
	});

	it("14-1 an entry whose body the collection already has is left out, and a taken address gets -2 and is named in the result", async () => {
		const from = site();
		const made = await fill(from);
		const exported = await run<BackupOutput>(from, "data.export", { ids: [made.first, made.second] });
		// Back into the site it came from: the same bodies are there.
		const seen = await run<Extract<Inspected, { kind: "monti" | "files" }>>(from, "data.inspect", upload(exported));
		expect(seen).toMatchObject({ found: 3, same: 3 });
		await expect(run(from, "data.import", upload(exported))).rejects.toMatchObject({
			reason: { key: "data.nothingToImport" },
		});

		// Into a site that has another entry at one of the addresses.
		const to = second();
		await write(to, "entries.create", {
			collection: "post",
			title: "다른 메모",
			slug: "memo",
			doc: body(p("x1", "다른 글.")),
		});
		const cover = await picture(to, otherStorage, "cover.jpg");
		const done = await write<Imported>(to, "data.import", { ...upload(exported), media: { [made.cover]: cover } });
		expect(done.renamed).toEqual([{ id: expect.any(String), title: "메모", from: "memo", to: "memo-2" }]);
		const log = await run<{ lines: { what: { values: Record<string, unknown> }[] }[] }>(to, "activity.list", {
			kinds: ["import"],
		});
		expect(JSON.parse(String(log.lines[0].what[0].values.renamed))).toEqual(done.renamed);
	});

	it("14-1 a picture the library does not have is left out: a field stays empty, a body keeps the picture's words", async () => {
		const from = site();
		const made = await fill(from);
		const exported = await run<BackupOutput>(from, "data.export", { ids: [made.first] });
		const to = second();
		const seen = await run<Extract<Inspected, { kind: "monti" | "files" }>>(to, "data.inspect", {
			...upload(exported),
			has: [],
		});
		expect(seen).toMatchObject({ pictures: [], missingPictures: 1 });
		await write<Imported>(to, "data.import", { ...upload(exported), has: [] });
		const [row] = await other
			.selectFrom("entries")
			.select(["values", "doc"])
			.where("collection", "=", "post")
			.execute();
		expect(row.values).not.toHaveProperty("cover");
		expect((row.doc as { blocks: unknown[] }).blocks).toEqual([
			expect.objectContaining({ type: "paragraph" }),
			expect.objectContaining({ type: "paragraph", content: [{ type: "text", text: "산길" }] }),
		]);
	});
});

describe("files a plugin reads (flow 9, 05–07)", () => {
	/** A plugin that reads `.txt`: the first line is the title, `key: value` lines are values, the rest is the body. */
	const text: Plugin = definePlugin({
		name: "plain-text",
		importers: [
			{
				id: "txt",
				label: "Text",
				extensions: [".txt"],
				read(file) {
					const [first = "", ...rest] = file.text.split("\n");
					const values: Record<string, unknown> = { title: first };
					const blocks: unknown[] = [];
					const unknown: string[] = [];
					for (const [index, line] of rest.entries()) {
						const pair = /^(\w+): (.*)$/.exec(line);
						if (pair) values[pair[1]] = pair[2].includes(",") ? pair[2].split(",").map((each) => each.trim()) : pair[2];
						else if (line.startsWith("!["))
							blocks.push({ id: `i${index}`, type: "image", attrs: { src: line.slice(2), alt: "그림" } });
						else if (line.startsWith("<")) {
							unknown.push(line.slice(1, -1));
							blocks.push({
								id: `c${index}`,
								type: "codeBlock",
								attrs: { language: "mdx" },
								content: [{ type: "text", text: line }],
							});
						} else if (line !== "") blocks.push(p(`p${index}`, line));
					}
					return { values, doc: body(...blocks), unknown };
				},
			},
		],
	});
	const files = [
		{
			name: "posts/hello.txt",
			text: "첫 글\ndescription: 인사\ntags: 여행, 맛집\nlayout: post\n본문 한 줄.\n![./img/a.png\n<Tweet>",
		},
		{ name: "posts/second.txt", text: "둘째 글\ntags: 여행\n둘째 본문." },
	];
	const has = ["posts/img/a.png", "readme.html"];

	it("14-1 the upload's keys are listed with the field each goes to; a mapping fits them, a relation value with no item would make one, and what is unknown or empty is said", async () => {
		const monti = site([text]);
		await write(monti, "collections.updateAdminValues", {
			collection: "post",
			values: { fields: { summary: { label: "요약" } } },
		});
		const seen = await run<Extract<Inspected, { kind: "monti" | "files" }>>(monti, "data.inspect", {
			collection: "post",
			files,
			has,
		});
		expect(seen).toMatchObject({ kind: "files", found: 2, same: 0 });
		expect(seen.keys).toEqual([
			{ key: "title", example: "첫 글", field: "title", creates: 0, createsIn: null },
			{ key: "description", example: "인사", field: null, creates: 0, createsIn: null },
			{ key: "tags", example: "여행, 맛집", field: "tags", creates: 2, createsIn: "tag" },
			{ key: "layout", example: "post", field: null, creates: 0, createsIn: null },
		]);
		expect(seen.fields.map((field) => field.name)).toEqual(["title", "slug", "summary", "cover", "tags", "format"]);
		expect(seen.fields.find((field) => field.name === "summary")?.label).toBe("요약");
		expect(seen.pictures).toEqual([{ name: "./img/a.png", file: "posts/img/a.png" }]);
		expect(seen.unknown).toEqual([{ name: "Tweet", entries: 1 }]);
		// Nothing maps to the required summary yet: both entries would lack it.
		expect(seen.emptyRequired).toEqual([{ field: "summary", label: "요약", entries: 2 }]);
		const mapped = await run<Extract<Inspected, { kind: "monti" | "files" }>>(monti, "data.inspect", {
			collection: "post",
			files,
			has,
			mapping: { description: "summary" },
		});
		expect(mapped.emptyRequired).toEqual([{ field: "summary", label: "요약", entries: 1 }]);
		// Nothing was written by looking.
		expect(await rowsOf(db, "entries")).toEqual([]);
	});

	it("14-1 imported, each file is a draft named by its file, with its mapped values, its tags made, and its picture pointed at the library", async () => {
		const monti = site([text]);
		const image = await picture(monti, storage, "a.png");
		const done = await write<Imported>(monti, "data.import", {
			collection: "post",
			name: "blog.zip",
			files,
			has,
			mapping: { description: "summary", layout: null },
			media: { "./img/a.png": image },
		});
		expect(done).toMatchObject({ imported: 2, skipped: 0, items: 2 });
		const rows = await db
			.selectFrom("entries")
			.select(["title", "slug", "status", "values", "doc"])
			.where("collection", "=", "post")
			.orderBy("created_at")
			.execute();
		expect(rows.map((row) => [row.title, row.slug, row.status])).toEqual([
			["첫 글", "hello", "draft"],
			["둘째 글", "second", "draft"],
		]);
		expect(rows[0].values).toMatchObject({ summary: "인사" });
		expect((rows[0].values as { tags: string[] }).tags).toHaveLength(2);
		expect(rows[0].values).not.toHaveProperty("layout");
		expect(
			(rows[0].doc as { blocks: { type: string; attrs?: Record<string, unknown> }[] }).blocks.map((block) => [
				block.type,
				block.attrs?.media,
			]),
		).toEqual([
			["paragraph", undefined],
			["image", image],
			["codeBlock", undefined],
		]);
		expect(
			(await db.selectFrom("entries").select("title").where("collection", "=", "tag").execute())
				.map((row) => row.title)
				.sort(),
		).toEqual(["맛집", "여행"].sort());
		// The second import of the same files finds the same bodies.
		await expect(run(monti, "data.import", { collection: "post", files, has })).rejects.toMatchObject({
			reason: { key: "data.nothingToImport" },
		});
	});

	it("14-1 the upload's pictures become files of the library as the import's own work: in the folder named, used by the entries, and gone when the import is undone", async () => {
		const monti = site([text]);
		const key = "00000000-0000-4000-8000-00000000aaaa.png";
		await storage.put(key, new Uint8Array([9, 9, 9]), { mime: "image/png" });
		const done = await run<{ output: Imported; activityId: string }>(monti, "data.import", {
			collection: "post",
			name: "blog.zip",
			files,
			has,
			uploaded: { "./img/a.png": { name: "a.png", original: { key, width: 4, height: 4 } } },
			mediaFolder: "가져온 이미지",
		});
		expect(done.output.imported).toBe(2);
		const media = await db.selectFrom("media").select(["id", "name", "folder_id"]).execute();
		expect(media).toHaveLength(1);
		const folder = await db.selectFrom("folders").select(["id", "name", "collection"]).executeTakeFirstOrThrow();
		expect(folder).toMatchObject({ name: "가져온 이미지", collection: null });
		expect(media[0]).toMatchObject({ name: "a.png", folder_id: folder.id });
		const first = await db.selectFrom("entries").select("doc").where("slug", "=", "hello").executeTakeFirstOrThrow();
		expect(JSON.stringify(first.doc)).toContain(media[0].id);
		// One line, and undoing it takes the entries, the tags and the picture with it.
		expect(await db.selectFrom("monti_activity").select("kind").execute()).toEqual([{ kind: "import" }]);
		await run(monti, "activity.undo", { id: done.activityId });
		expect(await db.selectFrom("entries").select("id").where("trashed_at", "is", null).execute()).toEqual([]);
		expect(await db.selectFrom("media").select("id").where("trashed_at", "is", null).execute()).toEqual([]);
	});

	it("14-2 a site with no plugin for them does not read .md and .mdx, and says which plugin does; other files are just not read", async () => {
		const monti = site();
		const markdown = [{ name: "posts/hello.mdx", text: "# Hello" }];
		expect(await run(monti, "data.inspect", { collection: "post", files: markdown })).toEqual({
			kind: "unreadable",
			reason: { key: "data.needsMdx" },
		});
		await expect(run(monti, "data.import", { collection: "post", files: markdown })).rejects.toMatchObject({
			reason: { key: "data.needsMdx" },
		});
		expect(
			await run(monti, "data.inspect", { collection: "post", files: [{ name: "notes.docx", text: "?" }] }),
		).toEqual({
			kind: "unreadable",
			reason: { key: "data.unreadable" },
		});
		expect(
			await run(monti, "data.inspect", { collection: "post", files: [{ name: "manifest.json", text: "not json" }] }),
		).toEqual({
			kind: "unreadable",
			reason: { key: "data.unreadable" },
		});
		expect(await rowsOf(db, "entries")).toEqual([]);
	});
});
