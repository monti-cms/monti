import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, type Schema } from "../schema/define";
import { planSchema } from "../schema/plan";
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
		category: { kind: "item", path: "/categories/:slug", fields: { ...fixed } },
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
