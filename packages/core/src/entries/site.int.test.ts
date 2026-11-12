import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, type Schema } from "../schema/define";
import { planSchema } from "../schema/plan";
import { readPreviewToken } from "./preview";
import { createReader } from "./reader";

const db = await testDatabase();

const fixed = { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } } as const;
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
			fields: { ...fixed, tags: { kind: "relation", to: "tag", many: true, createMissing: true } },
		},
		note: { kind: "document", path: "/notes/:slug", previewPath: "/preview/notes/:slug", fields: { ...fixed } },
		category: {
			kind: "item",
			path: "/categories/:slug",
			fields: { ...fixed, tags: { kind: "relation", to: "tag", many: true } },
		},
		// An item with no page of its own.
		tag: { kind: "item", fields: { ...fixed } },
	},
});

const SECRET = "test-secret";
let clock = new Date("2026-10-01T09:00:00Z");
type Sent = { type: string; collection?: string; locale?: string; paths?: string[] };
let sent: Sent[] = [];
const site = () =>
	createMonti({
		db,
		schema,
		secret: SECRET,
		now: () => clock,
		receivers: [{ destination: "test", send: async (event) => void sent.push(event as Sent) }],
	});
const reader = () => createReader({ db, schema, secret: SECRET, now: () => clock });
type Written<Output> = { output: Output };
const write = async <Output = { id: string }>(name: string, input: unknown) =>
	((await site().run(name, input, { actor: "admin" })) as Written<Output>).output;
const read = <Output>(name: string, input: unknown) => site().run(name, input, { actor: "admin" }) as Promise<Output>;
const versionOf = async (id: string) =>
	(await read<{ entry: { version: number } }>("entries.get", { id })).entry.version;
const published = (collection?: string) =>
	sent.filter((event) => event.type === "entry.published" && (!collection || event.collection === collection));

async function post(title: string, slug: string, collection = "post") {
	const { id } = await write("entries.create", { collection, locale: "ko", title, slug });
	await write("entries.publish", { ids: [id] });
	return id;
}

beforeEach(async () => {
	clock = new Date("2026-10-01T09:00:00Z");
	sent = [];
	await sql`drop view if exists monti_post, monti_note, monti_category, monti_tag`.execute(db);
	for (const table of ["entries", "schema_state", "schema_changes", "monti_delivery", "monti_activity"] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("an event's paths are public addresses, whatever made it", () => {
	it("16-3 an item made live by entries.create and changed by entries.save: its page, and the page it had before its address changed", async () => {
		const { id } = await write("entries.create", { collection: "category", locale: "ko", title: "개발", slug: "dev" });
		expect(published("category").map((event) => event.paths)).toEqual([["/categories/dev"]]);
		sent = [];
		await write("entries.save", { id, version: await versionOf(id), slug: "development" });
		expect(published("category").map((event) => event.paths)).toEqual([["/categories/development", "/categories/dev"]]);
	});

	it("16-3 items.saveGroup: each language's page with the language shown as the site shows it", async () => {
		const made = await write<{ group: string }>("items.saveGroup", {
			collection: "category",
			locales: { ko: { title: "개발", slug: "dev" }, en: { title: "Dev", slug: "dev" } },
		});
		expect(
			published("category")
				.map((event) => event.paths)
				.sort(),
		).toEqual([["/categories/dev"], ["/en/categories/dev"]]);
		sent = [];
		await write("items.saveGroup", {
			collection: "category",
			group: made.group,
			locales: { ko: { title: "개발", slug: "develop" } },
		});
		expect(published("category").map((event) => event.paths)).toEqual([["/categories/develop", "/categories/dev"]]);
	});

	it("16-3 an item made from inside an entry, in a collection with no page: published with no path, never a bare slug", async () => {
		await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "성능",
			slug: "perf",
			values: { tags: ["new:웹"] },
		});
		expect(published("tag").map((event) => event.paths)).toEqual([[]]);
	});

	it("16-3 publishing the source names the pages of its published translations too: they show the source's blocks", async () => {
		const id = await post("안녕", "hello");
		const translation = await write("translations.create", { source: id, locale: "en" });
		await write("entries.save", {
			id: translation.id,
			version: await versionOf(translation.id),
			title: "Hello",
			slug: "hello-en",
		});
		await write("entries.publish", { ids: [translation.id] });
		expect(published("post").at(-1)?.paths).toEqual(["/en/posts/hello-en"]);
		sent = [];
		await write("entries.save", { id, version: await versionOf(id), title: "안녕하세요" });
		await write("entries.publish", { ids: [id] });
		expect(published("post").map((event) => event.paths)).toEqual([["/posts/hello", "/en/posts/hello-en"]]);
	});
});

describe("a write that changes what a live item shows says so", () => {
	it("16-3 relations.merge: the merged item's page leaves the site and the entries that pointed at it are published again; a renamed file says so", async () => {
		const [from, into] = await Promise.all(
			["old", "kept"].map((slug) =>
				write<{ group: string }>("items.saveGroup", { collection: "tag", locales: { ko: { title: slug, slug } } }),
			),
		);
		const { id } = await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "태그가 있는 글",
			slug: "tagged",
			values: { tags: [from?.group] },
		});
		await write("entries.publish", { ids: [id] });
		sent = [];
		await write("relations.merge", { collection: "tag", fromGroups: [from?.group], intoGroup: into?.group });
		const types = sent.map((event) => [event.type, event.collection, event.paths]);
		// The post points at the tag they became (its page changed); the merged tag is off the site (it has no page of its own, so no path).
		expect(types).toContainEqual(["entry.published", "post", ["/posts/tagged"]]);
		expect(types).toContainEqual(["entry.unpublished", "tag", []]);
	});

	it("16-3 relations.edit on a live item: its page shows other values, with no new version and no publish", async () => {
		const tag = await write<{ group: string }>("items.saveGroup", {
			collection: "tag",
			locales: { ko: { title: "웹", slug: "web" } },
		});
		const category = await write<{ group: string }>("items.saveGroup", {
			collection: "category",
			locales: { ko: { title: "개발", slug: "dev" } },
		});
		sent = [];
		await write("relations.edit", {
			collection: "category",
			groups: [category.group],
			field: "tags",
			add: [tag.group],
		});
		expect(sent.map((event) => [event.type, event.collection, event.paths])).toEqual([
			["entry.published", "category", ["/categories/dev"]],
		]);
	});
});

describe("an undo that changes what the site shows says so", () => {
	type Activity = { activityId: string };
	const act = async (name: string, input: unknown) =>
		(await site().run(name, input, { actor: "admin" })) as Activity & Written<{ id: string }>;
	const undo = (activityId: string) => write("activity.undo", { id: activityId });
	const shown = () => sent.filter((event) => event.type !== "entry.saved").map((event) => [event.type, event.paths]);

	it("02-7 T29 undoing a first publish takes the entry off the site; undoing a later one puts the copy before it back", async () => {
		const { id } = await write("entries.create", { collection: "post", locale: "ko", title: "글", slug: "undo-me" });
		const first = await act("entries.publish", { ids: [id] });
		sent = [];
		await undo(first.activityId);
		expect(shown()).toEqual([["entry.unpublished", ["/posts/undo-me"]]]);
		expect(await reader().entry({ collection: "post", locale: "ko", slug: "undo-me" })).toBeNull();

		await write("entries.publish", { ids: [id] });
		await write("entries.save", { id, version: await versionOf(id), title: "글 고침", slug: "undo-me-2" });
		const again = await act("entries.publish", { ids: [id] });
		sent = [];
		await undo(again.activityId);
		// The copy before is back at its own address, and the address the undone publish gave is no longer the entry's.
		expect(shown()).toEqual([["entry.published", ["/posts/undo-me", "/posts/undo-me-2"]]]);
		const back = await reader().entry({ collection: "post", locale: "ko", slug: "undo-me" });
		expect(back && "entry" in back && back.entry.title).toBe("글");
	});

	it("02-7 T29 undoing a change that touched only what a live item shows says so too, and an undone source names its translations' pages", async () => {
		// A live item's values change with no new version and no new date.
		const made = await write<{ group: string }>("items.saveGroup", {
			collection: "category",
			locales: { ko: { title: "개발", slug: "dev" } },
		});
		const item = await db
			.selectFrom("entries")
			.select("id")
			.where("translation_group", "=", made.group)
			.executeTakeFirstOrThrow();
		const renamed = await act("entries.save", { id: item.id, version: await versionOf(item.id), title: "개발 일기" });
		sent = [];
		await undo(renamed.activityId);
		expect(shown()).toEqual([["entry.published", ["/categories/dev"]]]);

		// A source with a published translation: undoing the source's publish names both pages.
		const id = await post("안녕", "hello");
		const translation = await write("translations.create", { source: id, locale: "en" });
		await write("entries.save", {
			id: translation.id,
			version: await versionOf(translation.id),
			title: "Hello",
			slug: "hello-en",
		});
		await write("entries.publish", { ids: [translation.id] });
		await write("entries.save", { id, version: await versionOf(id), title: "안녕하세요" });
		const again = await act("entries.publish", { ids: [id] });
		sent = [];
		await undo(again.activityId);
		expect(shown()).toEqual([["entry.published", ["/posts/hello", "/en/posts/hello-en"]]]);
	});

	it("02-7 T29 undoing a move to the trash puts a published entry back on the site; undoing a save alone says nothing", async () => {
		const id = await post("나온 글", "kept");
		const saved = await act("entries.save", { id, version: await versionOf(id), title: "쓰는 중" });
		sent = [];
		await undo(saved.activityId);
		expect(shown()).toEqual([]);
		const thrown = await act("trash.move", { rows: [{ kind: "entry", id }] });
		expect(await reader().entry({ collection: "post", locale: "ko", slug: "kept" })).toBeNull();
		sent = [];
		await undo(thrown.activityId);
		expect(shown()).toEqual([["entry.published", ["/posts/kept"]]]);
		expect(await reader().entry({ collection: "post", locale: "ko", slug: "kept" })).not.toBeNull();
	});
});

describe("what the site reads", () => {
	it("16-7 an entry comes with its public address; an old address answers with the new one, and a language with no translation is not there", async () => {
		const id = await post("안녕", "hello");
		const found = await reader().entry({ collection: "post", locale: "ko", slug: "hello" });
		expect(found && "entry" in found && found.entry.path).toBe("/posts/hello");
		expect(await reader().entry({ collection: "post", locale: "en", slug: "hello" })).toBeNull();
		expect(await reader().entry({ collection: "post", locale: "ko", slug: "nothing" })).toBeNull();
		await write("entries.save", { id, version: await versionOf(id), slug: "hi" });
		await write("entries.publish", { ids: [id] });
		expect(await reader().entry({ collection: "post", locale: "ko", slug: "hello" })).toEqual({
			redirect: "/posts/hi",
		});
		await write("items.saveGroup", { collection: "tag", locales: { ko: { title: "웹", slug: "web" } } });
		expect((await reader().entries({ collection: "tag", locale: "ko" })).map((entry) => entry.path)).toEqual([null]);
	});

	it("16-1 a list is read a page at a time, newest first, each entry once", async () => {
		for (const day of [1, 2, 3, 4, 5]) {
			clock = new Date(`2026-10-0${day}T09:00:00Z`);
			await post(`글 ${day}`, `post-${day}`);
		}
		const first = await reader().page({ collection: "post", locale: "ko", limit: 2 });
		expect(first.entries.map((entry) => entry.slug)).toEqual(["post-5", "post-4"]);
		const second = await reader().page({ collection: "post", locale: "ko", limit: 2, after: first.next });
		expect(second.entries.map((entry) => entry.path)).toEqual(["/posts/post-3", "/posts/post-2"]);
		const last = await reader().page({ collection: "post", locale: "ko", limit: 2, after: second.next });
		expect(last.entries.map((entry) => entry.slug)).toEqual(["post-1"]);
		expect(last.next).toBeNull();
		expect((await reader().page({ collection: "post", locale: "en", limit: 2 })).entries).toEqual([]);
	});

	it("16-1 an entry published or taken off between two pages neither repeats an entry nor skips one, and items page in their own order", async () => {
		const ids: Record<string, string> = {};
		for (const day of [1, 2, 3, 4]) {
			clock = new Date(`2026-10-0${day}T09:00:00Z`);
			ids[`post-${day}`] = await post(`글 ${day}`, `post-${day}`);
		}
		const first = await reader().page({ collection: "post", locale: "ko", limit: 2 });
		expect(first.entries.map((entry) => entry.slug)).toEqual(["post-4", "post-3"]);
		// A newer post comes on the site, and one already given leaves it.
		clock = new Date("2026-10-09T09:00:00Z");
		await post("새 글", "post-new");
		await write("entries.archive", { ids: [ids["post-4"]] });
		const second = await reader().page({ collection: "post", locale: "ko", limit: 2, after: first.next });
		expect(second.entries.map((entry) => entry.slug)).toEqual(["post-2", "post-1"]);
		expect(second.next).toBeNull();
		// A `next` that is none of ours starts the list over; it does not throw.
		const over = await reader().page({ collection: "post", locale: "ko", limit: 1, after: "not-a-cursor" });
		expect(over.entries.map((entry) => entry.slug)).toEqual(["post-new"]);

		// Items: in their own order (the order they were made in), each once.
		for (const name of ["a", "b", "c"])
			await write("items.saveGroup", { collection: "category", locales: { ko: { title: name, slug: name } } });
		const one = await reader().page({ collection: "category", locale: "ko", limit: 2 });
		const two = await reader().page({ collection: "category", locale: "ko", limit: 2, after: one.next });
		expect([...one.entries, ...two.entries].map((entry) => entry.slug)).toEqual(["a", "b", "c"]);
		expect(two.next).toBeNull();
	});
});

describe("a collection's preview address", () => {
	const linkOf = (id: string) => read<{ path: string | null }>("entries.previewLink", { id });

	it("16-9 Preview opens the collection's preview page when it has one, the public address otherwise, with the language shown the same way", async () => {
		const plain = await write("entries.create", { collection: "post", locale: "ko", title: "글", slug: "a-post" });
		expect((await linkOf(plain.id)).path).toBe("/posts/a-post");
		const note = await write("entries.create", { collection: "note", locale: "ko", title: "메모", slug: "a-note" });
		expect((await linkOf(note.id)).path).toBe("/preview/notes/a-note");
		const translation = await write("translations.create", { source: note.id, locale: "en" });
		expect((await linkOf(translation.id)).path).toBe("/en/preview/notes/a-note");
	});

	it("16-2 a preview ticket opens its own entry at its own address only: another entry read with it is what the site shows", async () => {
		const draft = await write("entries.create", { collection: "post", locale: "ko", title: "쓰는 중", slug: "draft" });
		await post("나온 글", "out");
		const { token } = await read<{ token: string }>("entries.previewLink", { id: draft.id });
		const at = (slug: string, locale = "ko", preview: string | null = token) =>
			reader().entry({ collection: "post", locale, slug, ...(preview === null ? {} : { preview }) });
		const own = await at("draft");
		expect(own && "entry" in own && [own.entry.title, own.entry.publishedAt]).toEqual(["쓰는 중", null]);
		// Not published, so without the ticket its address is not there.
		expect(await at("draft", "ko", null)).toBeNull();
		const other = await at("out");
		expect(other && "entry" in other && other.entry.title).toBe("나온 글");
		expect(await at("nothing")).toBeNull();
		expect(await at("draft", "en")).toBeNull();
		// A forged ticket, and one past its hour, open nothing.
		expect(await at("draft", "ko", `${token}x`)).toBeNull();
		clock = new Date(clock.getTime() + 61 * 60_000);
		expect(await at("draft")).toBeNull();
	});

	it("16-2 a secret that is empty or only spaces opens nothing: no link is made with it, and a ticket signed with it is refused", async () => {
		const { id } = await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "쓰는 중",
			slug: "blank-secret",
		});
		for (const blank of ["", "   "]) {
			const monti = createMonti({ db, schema, secret: blank, now: () => clock });
			await expect(monti.run("entries.previewLink", { id }, { actor: "admin" })).rejects.toMatchObject({
				reason: { key: "entries.noSecret" },
			});
			// What someone who guessed the blank secret would sign themselves.
			const body = `${id}.${clock.getTime() + 60_000}`;
			const key = await crypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(blank || "\u0000"),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			);
			const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString(
				"base64url",
			);
			const forged = Buffer.from(`${body}.${signature}`).toString("base64url");
			const site = createReader({ db, schema, secret: blank, now: () => clock });
			expect(await site.entry({ collection: "post", locale: "ko", slug: "blank-secret", preview: forged })).toBeNull();
			expect(await readPreviewToken(blank, forged, clock)).toBeNull();
		}
	});

	it("16-9 a preview address has the shape of an address, belongs to a document, and is no page's address", () => {
		const collections = schema.collections;
		const withPreview = (over: Record<string, unknown>): Schema =>
			({ ...schema, collections: { ...collections, ...over } }) as unknown as Schema;
		expect(checkSchema(schema)).toEqual([]);
		expect(checkSchema(withPreview({ note: { ...collections.note, previewPath: "/preview" } }))).toEqual([
			{ collection: "note", code: "badPreviewPath" },
		]);
		expect(
			checkSchema(withPreview({ category: { ...collections.category, previewPath: "/preview/c/:slug" } })),
		).toEqual([{ collection: "category", code: "badPreviewPath" }]);
		expect(checkSchema(withPreview({ note: { ...collections.note, previewPath: "/posts/:slug" } }))).toEqual([
			{ collection: "note", code: "previewPathTaken" },
		]);
		expect(
			checkSchema(withPreview({ post: { ...collections.post, previewPath: "/preview/notes/:slug" } })).map(
				(problem) => problem.code,
			),
		).toEqual(["previewPathTaken"]);
	});

	it("16-9 putting a preview address in, changing it and taking it out are each one change that touches no stored value", async () => {
		const change = async (before: Schema, after: Schema) =>
			(await planSchema(db, before, after)).map(({ do: what, collection, from, to, choices }) => ({
				what,
				collection,
				from,
				to,
				choices,
			}));
		const { previewPath: _preview, ...bare } = schema.collections.note as {
			previewPath?: string;
		} & Schema["collections"][string];
		const without = { ...schema, collections: { ...schema.collections, note: bare } } as Schema;
		const moved = {
			...schema,
			collections: { ...schema.collections, note: { ...schema.collections.note, previewPath: "/draft/:slug" } },
		} as Schema;
		const row = { what: "changePreviewPath", collection: "note", choices: undefined };
		expect(await change(without, schema)).toEqual([{ ...row, from: undefined, to: "/preview/notes/:slug" }]);
		expect(await change(schema, moved)).toEqual([{ ...row, from: "/preview/notes/:slug", to: "/draft/:slug" }]);
		expect(await change(schema, without)).toEqual([{ ...row, from: "/preview/notes/:slug", to: undefined }]);
	});
});
