import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { sql, testDatabase } from "../__test__/database";
import { createReader } from "../entries/reader";
import { CheckError, ForbiddenError } from "../errors";
import { lockFolderScope } from "../folders/operations";
import type { MediaItem } from "../media/operations";
import { memoryStorage } from "../media/storage";
import { createMonti, definePlugin } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { TrashedEntry, TrashList } from "./list";
import type { TrashEffects, TrashMoved, TrashRestored } from "./operations";
import type { TrashRef } from "./purge";

const db = await testDatabase();

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
				slug: { kind: "slug", required: true },
				cover: { kind: "media", accept: "image" },
				tags: { kind: "relation", to: "tag", many: true },
			},
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const DAY = 86_400_000;
const START = new Date("2026-11-01T09:00:00Z");
let clock = START;
const later = (days: number) => {
	clock = new Date(clock.getTime() + days * DAY);
};
const storage = memoryStorage();
const SECRET = "trash-test-secret";
const site = () =>
	createMonti({ db, schema, secret: SECRET, now: () => clock, plugins: [definePlugin({ name: "files", storage })] });
const fromSite = (slug: string, collection = "post", locale = "ko") =>
	createReader({ db, schema, secret: SECRET, storage, now: () => clock }).entry({ collection, locale, slug });
type Written<Output> = { output: Output; activityId: string };
const write = async <Output = { id: string }>(name: string, input: unknown, actor: "admin" | "assistant" = "admin") =>
	(await site().run(name, input, { actor })) as Written<Output>;
const read = <Output>(name: string, input: unknown = {}) =>
	site().run(name, input, { actor: "admin" }) as Promise<Output>;

const entryRow = (id: string): TrashRef => ({ kind: "entry", id });
const folderRow = (id: string): TrashRef => ({ kind: "folder", id });
const mediaRow = (id: string): TrashRef => ({ kind: "media", id });
const move = (...rows: TrashRef[]) => write<TrashMoved>("trash.move", { rows });
const restore = (...rows: TrashRef[]) => write<TrashRestored>("trash.restore", { rows });
const purge = (...rows: TrashRef[]) => write<{ purged: number }>("trash.purge", { rows });
const list = (input: unknown = {}) => read<TrashList>("trash.list", input);
const titles = async (input: unknown = {}) => (await list(input)).rows.map((row) => row.title);
const row = async (title: string, input: unknown = {}) => {
	const found = (await list(input)).rows.find((each) => each.title === title);
	if (!found) throw new Error(`No "${title}" in the trash.`);
	return found;
};
const entry = (id: string) => db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const gone = async (id: string) =>
	(await db.selectFrom("entries").select("id").where("id", "=", id).executeTakeFirst()) === undefined;
const refused = async (run: Promise<unknown>, key: string) => {
	const error = await run.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(CheckError);
	expect((error as CheckError).reason.key).toBe(key);
};

const post = async (title: string, slug: string, values: Record<string, unknown> = {}) =>
	(await write("entries.create", { collection: "post", locale: "ko", title, slug, values })).output.id;
const publish = (...ids: string[]) => write<{ published: string[]; blocked: string[] }>("entries.publish", { ids });
const translate = async (source: string, locale = "en") =>
	(await write("translations.create", { source, locale })).output.id;
type Item = { group: string; locales: Record<string, { id: string; slug: string }> };
const tag = async (ko: string, en?: string) =>
	(
		await write<Item>("items.saveGroup", {
			collection: "tag",
			locales: { ko: { title: ko, slug: ko }, ...(en ? { en: { title: en, slug: en } } : {}) },
		})
	).output;
const postFolder = async (name: string, parentId: string | null = null) =>
	(await write("folders.create", { scope: { collection: "post" }, parentId, name })).output.id;
const mediaFolder = async (name: string, parentId: string | null = null) =>
	(await write("folders.create", { scope: "media", parentId, name })).output.id;
let keys = 0;
async function bytes() {
	const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}.jpg`;
	await storage.put(key, new Uint8Array(12), { mime: "image/jpeg" });
	return key;
}
const upload = async (name: string, folderId: string | null = null) => {
	const key = await bytes();
	const file = (await write<MediaItem>("media.upload", { name, folderId, original: { key, width: 10, height: 10 } }))
		.output;
	return { id: file.id, key };
};

beforeEach(async () => {
	clock = START;
	await sql`drop view if exists monti_post, monti_tag`.execute(db);
	for (const table of [
		"media_uses",
		"media",
		"entry_links",
		"entries",
		"folders",
		"reserved_paths",
		"loose_files",
		"monti_proposal",
		"monti_delivery",
		"monti_activity",
		"schema_state",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("into the trash", () => {
	it("11-2 a source entry goes with its translations as one row, and undo brings them back as they were", async () => {
		const source = await post("첫 번째 글", "first-post");
		const english = await translate(source);
		await publish(source);

		const moved = await move(entryRow(source));

		expect(moved.output).toMatchObject({ rows: 1, entries: 2, unpublished: 1 });
		expect(await fromSite("first-post")).toBeNull();
		expect(await entry(english)).toMatchObject({ trashed_by: "admin" });
		expect(await list()).toMatchObject({
			total: 1,
			counts: { post: 1 },
			rows: [{ kind: "entry", id: source, address: "/posts/first-post", locales: ["ko", "en"], daysLeft: 30 }],
		});

		await write("activity.undo", { id: moved.activityId });
		expect(await fromSite("first-post")).toMatchObject({ entry: { title: "첫 번째 글" } });
		expect(await entry(english)).toMatchObject({ trashed_at: null });
		expect((await list()).total).toBe(0);
	});

	it("11-2 a translation goes alone and its source stays on the site", async () => {
		const source = await post("React 19", "react-19");
		const english = await translate(source);
		await write("entries.save", { id: english, version: (await entry(english)).version, slug: "react-19-en" });
		await publish(source, english);

		await move(entryRow(english));

		expect(await fromSite("react-19")).not.toBeNull();
		expect(await fromSite("react-19-en", "post", "en")).toBeNull();
		expect(await list()).toMatchObject({ rows: [{ id: english, locales: ["en"] }] });
	});

	it("11-2 a folder is one row; its subfolders and entries are inside it", async () => {
		const series = await postFolder("시리즈 원고");
		const drafts = await postFolder("drafts", series);
		const [a, b, outside] = [await post("A", "a"), await post("B", "b"), await post("Outside", "outside")];
		await write("entries.moveToFolder", { ids: [a], folder: series });
		await write("entries.moveToFolder", { ids: [b], folder: drafts });

		await move(folderRow(series));

		expect(await list()).toMatchObject({ total: 1, rows: [{ kind: "folder", title: "시리즈 원고", holds: 2 }] });
		const inside = await list({ folder: series });
		expect(inside.place).toMatchObject({ name: "시리즈 원고", daysLeft: 30, trail: [] });
		expect(inside.rows.map((each) => [each.kind, each.title]).sort()).toEqual([
			["entry", "A"],
			["folder", "drafts"],
		]);
		expect((await list({ folder: drafts })).place?.trail).toEqual([{ id: series, name: "시리즈 원고" }]);
		expect((await entry(outside)).trashed_at).toBeNull();
	});

	it("11-2 a folder going to the trash and an entry moving into it, at the same moment: the undo brings back everything that went", async () => {
		for (let round = 0; round < 12; round++) {
			const folder = await postFolder(`상자 ${round}`);
			const entry = await post(`들어가는 글 ${round}`, `moving-in-${round}`);
			const throwAway = () => move(folderRow(folder));
			const moveIn = () => write("entries.moveToFolder", { ids: [entry], folder });
			const first = round % 2 === 0 ? throwAway() : moveIn();
			const second = round % 2 === 0 ? moveIn() : throwAway();
			const [one, other] = await Promise.allSettled([first, second]);
			const moved = round % 2 === 0 ? one : other;
			if (moved.status !== "fulfilled") throw moved.reason;
			await write("activity.undo", { id: (moved.value as Written<TrashMoved>).activityId });
			// Whichever came first, nothing the folder took with it is left behind in the trash.
			expect(
				await db.selectFrom("entries").select("trashed_at").where("id", "=", entry).executeTakeFirstOrThrow(),
			).toEqual({
				trashed_at: null,
			});
		}
	});

	it("11-1 a folder coming back while a folder with its name is being made: it waits, then takes the next name", async () => {
		const name = "같은 이름";
		const folder = await postFolder(name);
		await move(folderRow(folder));
		// Two requests started together do not show this: the one that is making a folder has to have picked the name and not saved yet, so this
		// transaction stands in for it. It holds what `folders.create` holds, and the restore has to be seen waiting for it.
		const key = "monti:folders:post:root";
		const waiting = async () =>
			(
				await sql<{ n: number }>`select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted
					and objid::bigint = hashtext(${key})::bigint & 4294967295`.execute(db)
			).rows[0]?.n ?? 0;
		let back: Promise<Written<TrashRestored>> | undefined;
		await db.transaction().execute(async (making) => {
			await lockFolderScope(making, "post", null);
			back = restore(folderRow(folder));
			for (let tries = 0; (await waiting()) === 0; tries++) {
				if (tries === 200) throw new Error("The restore did not wait for the folder that is being made.");
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			await making
				.insertInto("folders")
				.values({ id: randomUUID(), collection: "post", parent_id: null, name, position: 1 })
				.execute();
		});
		await back;
		const names = await db.selectFrom("folders").select("name").where("name", "like", `${name}%`).execute();
		expect(names.map((row) => row.name).sort()).toEqual([name, `${name} 2`]);
	});

	it("11-2 what a screen asks about first: published entries, translations that go along, entries that point here, files that stay", async () => {
		const react = await tag("react");
		const source = await post("첫 번째 글", "first-post", { tags: [react.group] });
		await translate(source);
		await publish(source);
		const draft = await post("초안", "draft", { tags: [react.group] });
		const used = await upload("cover.jpg");
		const free = await upload("free.jpg");
		await write("entries.save", {
			id: draft,
			version: (await entry(draft)).version,
			values: { cover: { media: used.id, alt: "표지" } },
		});
		const effects = (rows: TrashRef[]) => read<TrashEffects>("trash.checkMove", { rows });

		expect(await effects([entryRow(source), entryRow(draft)])).toEqual({
			entries: 3,
			unpublished: 1,
			translations: ["en"],
			pointing: 0,
			kept: 0,
		});
		// One published entry points at the tag: the draft does not count, the site never showed it.
		expect(await effects([entryRow(react.locales.ko.id)])).toMatchObject({ entries: 1, unpublished: 0, pointing: 1 });
		expect(await effects([mediaRow(used.id), mediaRow(free.id)])).toMatchObject({ kept: 1 });
	});

	it("11-2 the assistant's trash is marked as its own, and it deletes nothing for good", async () => {
		const id = await post("정리할 글", "tidy");
		const monti = site();
		const proposal = await monti.proposals.create("c-tidy", "throw this away");
		await monti.proposals.add(proposal, "trash.move", { rows: [entryRow(id)] });
		await monti.proposals.apply(proposal);

		expect(await row("정리할 글")).toMatchObject({ byAssistant: true });
		await expect(site().run("trash.purge", { rows: [entryRow(id)] }, { actor: "assistant" })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		await expect(site().run("trash.empty", {}, { actor: "assistant" })).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("11-2 something already in the trash, or not there at all, is refused", async () => {
		const id = await post("글", "post");
		await move(entryRow(id));
		await refused(move(entryRow(id)), "entries.unknown");
		await refused(move(folderRow("no-such-folder")), "folders.unknown");
		await refused(move(mediaRow("no-such-file")), "media.unknown");
		await refused(restore(entryRow("no-such-entry")), "trash.unknown");
	});
});

describe("the list", () => {
	it("11-1 rows are filtered by kind with a count for each, searched inside thrown-away folders, and sorted by when they went", async () => {
		const folder = await postFolder("시리즈 원고");
		const inFolder = await post("리액트 19 마이그레이션", "react-19");
		await write("entries.moveToFolder", { ids: [inFolder], folder });
		const alone = await post("연습장", "scratch");
		const react = await tag("react");
		const assets = await mediaFolder("Blog Assets");
		const file = await upload("winter-01.jpg", assets);

		await move(folderRow(folder));
		later(1);
		await move(entryRow(alone), entryRow(react.locales.ko.id));
		later(1);
		await move(mediaRow(file.id));

		const all = await titles();
		expect([all[0], all[3]]).toEqual(["winter-01.jpg", "시리즈 원고"]);
		expect([...all].sort()).toEqual(["react", "winter-01.jpg", "시리즈 원고", "연습장"].sort());
		expect((await titles({ sort: { by: "left", dir: "asc" } }))[0]).toBe("시리즈 원고");
		// By title, both ways.
		const byTitle = await titles({ sort: { by: "title", dir: "asc" } });
		expect(byTitle.indexOf("react")).toBeLessThan(byTitle.indexOf("winter-01.jpg"));
		expect(await titles({ sort: { by: "title", dir: "desc" } })).toEqual([...byTitle].reverse());
		// By language: entries with it in the trash; folders and files have none. Each menu's numbers are under the other's choice.
		expect(await list({ locales: ["ko"] })).toMatchObject({
			total: 2,
			counts: { post: 1, tag: 1 },
			locales: { ko: 2 },
		});
		expect((await titles({ locales: ["ko"] })).sort()).toEqual(["react", "연습장"].sort());
		expect(await list({ locales: ["en"] })).toMatchObject({ total: 0, rows: [], counts: {} });
		expect((await list({ kinds: ["tag"] })).locales).toEqual({ ko: 1 });
		expect((await list()).counts).toEqual({ post: 2, tag: 1, media: 1 });
		expect(await titles({ kinds: ["media", "tag"] })).toEqual(["winter-01.jpg", "react"]);
		expect((await list({ kinds: ["media"] })).total).toBe(1);

		// A search looks inside the thrown-away folder and says where the row sits.
		expect(await list({ search: "리액트" })).toMatchObject({
			total: 1,
			rows: [{ title: "리액트 19 마이그레이션", path: ["시리즈 원고"], inTrashedFolder: true }],
		});
		expect(await titles({ folder, search: "연습" })).toEqual([]);
		expect(await titles({ folder, search: "연습", scope: "all" })).toEqual(["연습장"]);
		expect(await row("winter-01.jpg")).toMatchObject({ path: ["Blog Assets"], file: { kind: "image" }, daysLeft: 30 });
		expect(await row("시리즈 원고")).toMatchObject({ daysLeft: 28 });
	});

	it("11-1 the sidebar counts the rows the trash shows: entries, folders and files", async () => {
		const folder = await postFolder("시리즈 원고");
		const [a, b] = [await post("A", "a"), await post("B", "b")];
		await write("entries.moveToFolder", { ids: [a], folder });
		await translate(b);
		const file = await upload("free.jpg");
		await move(folderRow(folder), entryRow(b), mediaRow(file.id));

		expect((await read<{ trash: number }>("frame.counts")).trash).toBe(3);
	});
});

describe("restoring", () => {
	it("11-1 a published entry comes back as a draft, with the translations that went with it", async () => {
		const source = await post("옛 소개 글", "about-old");
		const english = await translate(source);
		await publish(source);
		await move(entryRow(source));

		const restored = await restore(entryRow(source));

		expect(restored.output).toEqual({
			rows: 1,
			entry: { id: source, collection: "post", draft: true },
			folders: [],
			renamed: [],
		});
		expect(await entry(source)).toMatchObject({
			status: "draft",
			trashed_at: null,
			trashed_by: null,
			slug: "about-old",
		});
		expect((await entry(english)).trashed_at).toBeNull();
		expect(await fromSite("about-old")).toBeNull();
		// Its path is still its own: it publishes under it again.
		expect((await publish(source)).output.published).toEqual([source]);
	});

	it("11-1 an entry's languages in the trash are one row with one day to go, however they got there, and come back together", async () => {
		const source = await post("리액트 19 마이그레이션", "react-19");
		const english = await translate(source);
		await move(entryRow(english));
		// Alone, the translation is a row of its own: its source is still alive.
		expect(await list()).toMatchObject({ total: 1, rows: [{ id: english, locales: ["en"] }] });
		later(2);
		expect((await list()).rows[0]?.daysLeft).toBe(28);
		await move(entryRow(source));

		// The source followed: one row for the entry, and the translation's days start again with it.
		expect(await list()).toMatchObject({ total: 1, rows: [{ id: source, locales: ["ko", "en"], daysLeft: 30 }] });
		// The row is found by either of its languages.
		expect(await list({ locales: ["en"] })).toMatchObject({
			total: 1,
			rows: [{ id: source }],
			locales: { ko: 1, en: 1 },
		});
		expect((await read<TrashedEntry>("trash.get", { id: english })).locales.map((each) => each.locale)).toEqual([
			"en",
			"ko",
		]);
		// Either language brings the whole entry back.
		await restore(entryRow(english));

		expect((await entry(source)).trashed_at).toBeNull();
		expect((await entry(english)).trashed_at).toBeNull();
		expect((await list()).total).toBe(0);
	});

	it("11-1 a translation whose language the entry has again is refused", async () => {
		const source = await post("글", "post");
		const first = await translate(source);
		await move(entryRow(first));
		await translate(source);

		const error = await restore(entryRow(first)).catch((caught: unknown) => caught);
		expect((error as CheckError).reason).toEqual({ key: "trash.localeTaken", values: { locale: "English" } });
	});

	it("11-1 one entry out of a thrown-away folder brings the folder back to sit in; the rest stay in the trash", async () => {
		const series = await postFolder("시리즈 원고");
		const [a, b] = [await post("A", "a"), await post("B", "b")];
		await write("entries.moveToFolder", { ids: [a, b], folder: series });
		await move(folderRow(series));

		const restored = await restore(entryRow(a));

		expect(restored.output).toMatchObject({ folders: ["시리즈 원고"], entry: { id: a, draft: true } });
		expect(await entry(a)).toMatchObject({ trashed_at: null, folder_id: series });
		expect(
			(await db.selectFrom("folders").select("trashed_at").where("id", "=", series).executeTakeFirstOrThrow())
				.trashed_at,
		).toBeNull();
		// The folder is no longer in the trash, so what it still holds there is a row of its own.
		expect(await list()).toMatchObject({
			total: 1,
			rows: [{ title: "B", path: ["시리즈 원고"], inTrashedFolder: false }],
		});
	});

	it("11-1 a folder comes back with everything in it, under a free name when a sibling took its own", async () => {
		const series = await postFolder("시리즈 원고");
		const drafts = await postFolder("drafts", series);
		const [a, b] = [await post("A", "a"), await post("B", "b")];
		await write("entries.moveToFolder", { ids: [a], folder: series });
		await write("entries.moveToFolder", { ids: [b], folder: drafts });
		await move(folderRow(series));
		await postFolder("시리즈 원고");

		await restore(folderRow(series));

		const folders = await db.selectFrom("folders").select(["id", "name", "trashed_at"]).execute();
		expect(folders.map((folder) => `${folder.name}${folder.trashed_at ? " (trash)" : ""}`).sort()).toEqual(
			["drafts", "시리즈 원고", "시리즈 원고 2"].sort(),
		);
		expect(folders.find((folder) => folder.name === "시리즈 원고 2")?.id).toBe(series);
		expect([(await entry(a)).trashed_at, (await entry(b)).trashed_at]).toEqual([null, null]);
	});

	it("11-1 a file comes back to its folder, and to the top level when that folder is gone for good", async () => {
		const assets = await mediaFolder("Blog Assets");
		const [one, two] = [await upload("one.jpg", assets), await upload("two.jpg", assets)];
		await move(folderRow(assets));

		await restore(mediaRow(one.id));
		const place = (id: string) =>
			db.selectFrom("media").select(["folder_id", "trashed_at"]).where("id", "=", id).executeTakeFirstOrThrow();
		expect(await place(one.id)).toEqual({ folder_id: assets, trashed_at: null });

		// The folder goes again, alone this time, and for good: the file left in the trash has nowhere to return to.
		await write("media.moveToFolder", { ids: [one.id], folder: null });
		await move(folderRow(assets));
		await db.deleteFrom("folders").where("id", "=", assets).execute();
		await restore(mediaRow(two.id));
		expect(await place(two.id)).toEqual({ folder_id: null, trashed_at: null });
	});

	it("11-1 an item is on the site again for the entries that point at it, under a new address when its own was taken", async () => {
		const react = await tag("react");
		const id = await post("글", "post", { tags: [react.group] });
		await publish(id);
		const tagsOnSite = async () => {
			const found = await fromSite("post");
			const tags = found && "entry" in found ? found.entry.relations?.tags : null;
			return [tags ?? []].flat().map((each) => each.slug);
		};
		expect(await tagsOnSite()).toEqual(["react"]);

		await move(entryRow(react.locales.ko.id));
		expect(await tagsOnSite()).toEqual([]);
		await tag("react");

		const restored = await restore(entryRow(react.locales.ko.id));
		expect(restored.output).toMatchObject({ renamed: [{ from: "react", to: "react-2" }], entry: { draft: false } });
		expect(await tagsOnSite()).toEqual(["react-2"]);
	});
});

describe("an entry in the trash, read", () => {
	it("11-1 it has every language that went with it, the entries that point at it, and the paths a delete would keep", async () => {
		const react = await tag("react", "React");
		const live = await post("살아 있는 글", "live", { tags: [react.group] });
		const trashed = await post("버린 글", "trashed", { tags: [react.group] });
		await move(entryRow(trashed));
		await move(entryRow(react.locales.ko.id));

		const item = await read<TrashedEntry>("trash.get", { id: react.locales.ko.id });
		expect(item).toMatchObject({
			collection: "tag",
			daysLeft: 30,
			locales: [
				{ locale: "ko", title: "react", address: "/tags/react" },
				{ locale: "en", title: "React", address: "/en/tags/React" },
			],
			reserves: ["/tags/react", "/en/tags/React"],
		});
		expect(item.pointing.map((entry) => [entry.id, entry.trashed]).sort()).toEqual(
			[
				[live, false],
				[trashed, true],
			].sort(),
		);
		await refused(read("trash.get", { id: live }), "trash.unknown");
	});

	it("11-1 a field that points at a target in the trash can still name it; it is no longer a choice", async () => {
		const react = await tag("react");
		await move(entryRow(react.locales.ko.id));
		const options = await read<{ options: unknown[]; trashed: unknown[] }>("relations.options", {
			collection: "post",
			field: "tags",
		});
		expect(options).toMatchObject({ options: [], trashed: [{ group: react.group, title: "react" }] });
	});
});

describe("deleting for good", () => {
	it("11-3 a deleted item leaves every entry that pointed at it, live or in the trash, and nothing stops the delete", async () => {
		const [react, vue] = [await tag("react"), await tag("vue")];
		const live = await post("살아 있는 글", "live", { tags: [react.group, vue.group] });
		await publish(live);
		const trashed = await post("버린 글", "trashed", { tags: [react.group] });
		await move(entryRow(trashed));
		await move(entryRow(react.locales.ko.id));

		expect((await purge(entryRow(react.locales.ko.id))).output).toEqual({ purged: 1 });

		expect((await entry(live)).values.tags).toEqual([vue.group]);
		expect((await entry(trashed)).values.tags).toEqual([]);
		const published = await db
			.selectFrom("entry_published")
			.select("values")
			.where("entry_id", "=", live)
			.executeTakeFirstOrThrow();
		expect(published.values.tags).toEqual([vue.group]);
		expect(await db.selectFrom("entry_links").select("to_group").where("to_group", "=", react.group).execute()).toEqual(
			[],
		);
		// The published entry is as published as it was: nothing shows as changed.
		expect(await entry(live)).toMatchObject({ status: "published", has_unpublished_changes: false });
	});

	it("11-3 a delete cuts the draft and the published copy each on its own: what the draft changed stays unpublished", async () => {
		const [react, vue] = [await tag("react"), await tag("vue")];
		const edited = await post("고치는 글", "edited", { tags: [react.group, vue.group] });
		await publish(edited);
		// The draft drops vue; the site still shows both.
		await write("entries.save", {
			id: edited,
			version: (await entry(edited)).version,
			values: { tags: [react.group] },
		});
		await move(entryRow(react.locales.ko.id));
		await purge(entryRow(react.locales.ko.id));

		expect((await entry(edited)).values.tags).toEqual([]);
		const published = await db
			.selectFrom("entry_published")
			.select("values")
			.where("entry_id", "=", edited)
			.executeTakeFirstOrThrow();
		expect(published.values.tags).toEqual([vue.group]);
	});

	it("11-3 a delete and a save of an entry that points at it, at the same moment: the save is kept whole or refused, never written over", async () => {
		const stays = await tag("stays");
		for (let round = 0; round < 12; round++) {
			const gone = await tag(`gone-${round}`);
			const pointing = await post(`가리키는 글 ${round}`, `pointing-${round}`, { tags: [gone.group] });
			await move(entryRow(gone.locales.ko.id));
			const version = (await entry(pointing)).version;
			const save = () => write("entries.save", { id: pointing, version, values: { tags: [gone.group, stays.group] } });
			const cut = () => purge(entryRow(gone.locales.ko.id));
			const first = round % 2 === 0 ? save() : cut();
			const second = round % 2 === 0 ? cut() : save();
			const [one, other] = await Promise.allSettled([first, second]);
			const saved = round % 2 === 0 ? one : other;
			// The tag is cut either way; the tag the save added is there exactly when the save was taken.
			expect((await entry(pointing)).values.tags).toEqual(saved.status === "fulfilled" ? [stays.group] : []);
		}
	});

	it("11-3 a source entry takes every language of it, and a folder everything it holds", async () => {
		const source = await post("글", "post");
		const english = await translate(source);
		await move(entryRow(english));
		await move(entryRow(source));
		const series = await postFolder("시리즈 원고");
		const inFolder = await post("A", "a");
		await write("entries.moveToFolder", { ids: [inFolder], folder: series });
		await move(folderRow(series));

		await purge(entryRow(source), folderRow(series));

		expect(await Promise.all([source, english, inFolder].map(gone))).toEqual([true, true, true]);
		expect(await db.selectFrom("folders").select("id").execute()).toEqual([]);
		expect((await list()).total).toBe(0);
	});

	it("11-4 a path an entry was published under stays taken after it is deleted for good", async () => {
		const old = await post("옛 소개 글", "about-old");
		await publish(old);
		await move(entryRow(old));
		expect(await row("옛 소개 글")).toMatchObject({ reserves: ["/posts/about-old"] });
		const never = await post("발행한 적 없는 글", "never");
		await move(entryRow(never));
		expect(await row("발행한 적 없는 글")).toMatchObject({ reserves: [] });

		await purge(entryRow(old), entryRow(never));

		const [again, free] = [await post("새 소개 글", "about-old"), await post("새 글", "never")];
		expect((await publish(again, free)).output).toEqual({ published: [free], blocked: [again] });
	});

	it("11-5 emptying deletes every row, and a deleted file leaves the storage", async () => {
		const id = await post("글", "post");
		const file = await upload("free.jpg");
		await move(entryRow(id), mediaRow(file.id));

		expect((await write<{ purged: number }>("trash.empty", {})).output).toEqual({ purged: 2 });

		expect(await gone(id)).toBe(true);
		expect(await storage.stat(file.key)).toBeNull();
		expect((await list()).total).toBe(0);
	});
});

describe("what the final review found", () => {
	it("11-3 an entry is in one folder with every language of it, the ones in the trash too: a folder's delete takes no entry shown outside it", async () => {
		const folder = await postFolder("상자");
		const source = await post("원문", "source");
		const english = await translate(source);
		await write("entries.moveToFolder", { ids: [source], folder });
		await move(entryRow(english));
		// The source leaves the folder: its translation in the trash goes with it.
		await write("entries.moveToFolder", { ids: [source], folder: null });
		expect((await entry(english)).folder_id).toBeNull();

		await move(folderRow(folder));
		later(20);
		await move(entryRow(source));
		later(11);
		// The folder has been 31 days in the trash and goes; the entry, thrown away 11 days ago, stays with both its languages.
		await site().trash.purgeDue();
		expect(await db.selectFrom("folders").select("id").where("id", "=", folder).execute()).toEqual([]);
		expect(await list()).toMatchObject({ total: 1, rows: [{ id: source, locales: ["ko", "en"], daysLeft: 19 }] });
	});

	it("11-3 a folder's delete takes only folders that are in the trash: one under it that is not stays, at the top level, with what it holds", async () => {
		const outer = await postFolder("바깥");
		const inner = await postFolder("안", outer);
		const kept = await post("남는 글", "kept");
		await write("entries.moveToFolder", { ids: [kept], folder: inner });
		const out = await write("folders.move", { id: inner, parentId: null });
		await move(folderRow(outer));
		// The undo puts the live folder back under the one that is in the trash by now.
		await write("activity.undo", { id: out.activityId });
		expect(
			await db.selectFrom("folders").select("parent_id").where("id", "=", inner).executeTakeFirstOrThrow(),
		).toEqual({ parent_id: outer });

		await purge(folderRow(outer));

		expect(await db.selectFrom("folders").select(["id", "parent_id", "trashed_at"]).execute()).toEqual([
			{ id: inner, parent_id: null, trashed_at: null },
		]);
		expect((await entry(kept)).folder_id).toBe(inner);
	});

	it("11-4 a path another entry is published under by then stays that entry's: it publishes under it again", async () => {
		const first = await post("첫 글", "shared");
		await publish(first);
		await move(entryRow(first));
		const second = await post("둘째 글", "shared");
		await publish(second);
		// The delete would keep no path: the one it had is the second entry's now.
		expect(await row("첫 글")).toMatchObject({ reserves: [] });
		await purge(entryRow(first));

		await write("entries.save", { id: second, version: (await entry(second)).version, title: "둘째 글, 고침" });
		expect((await publish(second)).output).toEqual({ published: [second], blocked: [] });
	});

	it("11-4 a deleted item's address is kept from new items too: a new one of its name gets the next, and typing the address is refused", async () => {
		const react = await tag("react");
		await move(entryRow(react.locales.ko.id));
		await purge(entryRow(react.locales.ko.id));

		const again = (await write<Item>("items.saveGroup", { collection: "tag", locales: { ko: { title: "react" } } }))
			.output;
		expect(again.locales.ko.slug).toBe("react-2");
		await expect(tag("react")).rejects.toThrow("items.pathKept");
	});

	it("11-2 a folder going to the trash and an entry moving into a folder under it, at the same moment: neither stops the other for good", async () => {
		for (let round = 0; round < 10; round++) {
			const outer = await postFolder(`바깥 ${round}`);
			const inner = await postFolder("안", outer);
			const inside = await post(`안의 글 ${round}`, `inside-${round}`);
			await write("entries.moveToFolder", { ids: [inside], folder: outer });
			const results = await Promise.allSettled([
				move(folderRow(outer)),
				write("entries.moveToFolder", { ids: [inside], folder: inner }),
			]);
			// The move may be refused (the folder is in the trash by then); a deadlock is neither.
			for (const result of results)
				if (result.status === "rejected") expect(String(result.reason)).not.toContain("deadlock");
			expect(results[0].status).toBe("fulfilled");
		}
	});

	it("11-2 undo puts a language that was already in the trash back to the day it went there", async () => {
		const source = await post("원문", "source");
		const english = await translate(source);
		await move(entryRow(english));
		const went = (await entry(english)).trashed_at;
		later(5);
		const moved = await move(entryRow(source));
		expect((await entry(english)).trashed_at).toEqual((await entry(source)).trashed_at);

		await write("activity.undo", { id: moved.activityId });
		expect((await entry(source)).trashed_at).toBeNull();
		expect((await entry(english)).trashed_at).toEqual(went);
		expect(await list()).toMatchObject({ total: 1, rows: [{ id: english, locales: ["en"], daysLeft: 25 }] });
	});

	it("11-5 a clean-up that fails does not fail the admin's frame, and the next visit tries again", async () => {
		const monti = site();
		const api = signedInApi(monti);
		const clean = monti.trash.purgeDue;
		let tries = 0;
		monti.trash.purgeDue = () => {
			tries++;
			return Promise.reject(new Error("the database is busy"));
		};
		const frame = () =>
			api(new Request("http://site/admin/api/operations/frame.counts", { method: "POST", body: JSON.stringify({}) }));
		const said = console.error;
		console.error = () => {};
		try {
			expect((await frame()).status).toBe(200);
			expect((await frame()).status).toBe(200);
		} finally {
			console.error = said;
			monti.trash.purgeDue = clean;
		}
		expect(tries).toBe(2);
	});
});

describe("the clean-up", () => {
	it("11-5 what has been in the trash for 30 days is deleted; what has not stays", async () => {
		const [old, young] = [await post("오래된 글", "old"), await post("최근 글", "young")];
		const file = await upload("old.jpg");
		await move(entryRow(old), mediaRow(file.id));
		later(10);
		await move(entryRow(young));
		expect(await row("오래된 글")).toMatchObject({ daysLeft: 20 });

		later(20);
		expect(await site().trash.purgeDue()).toEqual({ purged: 2, files: 1 });

		expect(await gone(old)).toBe(true);
		expect(await storage.stat(file.key)).toBeNull();
		expect(await titles()).toEqual(["최근 글"]);
	});

	it("11-5 a write that can no longer be undone keeps no snapshot", async () => {
		const id = await post("글", "post");
		const saved = await write("entries.save", { id, version: (await entry(id)).version, title: "고친 글" });
		const snapshots = () =>
			db
				.selectFrom("monti_activity_snapshot")
				.select("activity_id")
				.where("activity_id", "=", saved.activityId)
				.execute();
		later(29);
		await site().trash.purgeDue();
		expect(await snapshots()).toHaveLength(1);
		later(2);
		await site().trash.purgeDue();
		expect(await snapshots()).toEqual([]);
	});

	it("11-5 an upload that never became a file leaves the storage after a day; a file's own bytes are never removed", async () => {
		const api = signedInApi(site());
		const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
		const put = async (name: string) => {
			const answer = await api(
				new Request(`http://site/admin/api/media/bytes?name=${name}`, { method: "PUT", body: PNG.slice().buffer }),
			);
			return ((await answer.json()) as { key: string }).key;
		};
		const stray = await put("stray.png");
		const taken = await put("kept.png");
		const kept = { key: taken };
		await write("media.upload", { name: "kept.png", original: { key: taken, width: 1, height: 1 } });
		// The byte route lists every key it writes; `media.upload` took its own off the list.
		expect(await db.selectFrom("loose_files").select("key").execute()).toEqual([{ key: stray }]);

		await site().trash.purgeDue();
		expect(await storage.stat(stray)).not.toBeNull();
		later(2);
		expect((await site().trash.purgeDue()).files).toBe(1);
		expect(await storage.stat(stray)).toBeNull();
		expect(await storage.stat(kept.key)).not.toBeNull();
	});

	it("11-5 the clean-up and an upload that takes a due key, at the same moment: a file never points at bytes that left", async () => {
		const api = signedInApi(site());
		const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
		for (let round = 0; round < 8; round++) {
			const answer = await api(
				new Request(`http://site/admin/api/media/bytes?name=late-${round}.png`, {
					method: "PUT",
					body: PNG.slice().buffer,
				}),
			);
			const { key } = (await answer.json()) as { key: string };
			later(2);
			const upload = () => write("media.upload", { name: `late-${round}.png`, original: { key, width: 1, height: 1 } });
			const clean = () => site().trash.purgeDue();
			await Promise.allSettled(round % 2 === 0 ? [upload(), clean()] : [clean(), upload()]);
			const file = await db.selectFrom("media").select("id").where("original_key", "=", key).executeTakeFirst();
			// Either the file took the key and its bytes are there, or the clean-up was first and there is no file.
			expect((await storage.stat(key)) !== null).toBe(file !== undefined);
		}
	});

	it("11-5 opening the admin cleans the trash before it counts it, an hour apart at most", async () => {
		const api = signedInApi(site());
		const counted = async () => {
			const answer = await api(
				new Request("http://site/admin/api/operations/frame.counts", { method: "POST", body: JSON.stringify({}) }),
			);
			return ((await answer.json()) as { trash: number }).trash;
		};
		const [old, later30] = [await post("오래된 글", "old"), await post("나중 글", "later")];
		await move(entryRow(old));
		later(29.99);
		await move(entryRow(later30));
		expect(await counted()).toBe(2);
		// The first is due a few minutes on, but the admin cleaned within the hour: it waits.
		later(0.02);
		expect(await counted()).toBe(2);
		later(0.05);
		expect(await counted()).toBe(1);
		expect(await gone(old)).toBe(true);
	});

	it("11-5 a replaced file's old bytes leave the storage a day later", async () => {
		const file = await upload("cover.jpg");
		const next = await bytes();
		await write("media.replace", { id: file.id, original: { key: next, width: 10, height: 10 } });

		later(2);
		await site().trash.purgeDue();

		expect(await storage.stat(file.key)).toBeNull();
		expect(await storage.stat(next)).not.toBeNull();
	});
});
