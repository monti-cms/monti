import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { CheckError } from "../errors";
import { createMonti } from "../monti";
import { applyChange, migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, notChosenFields, type Schema, storedFields } from "../schema/define";
import { type Answers, planSchema, stepsFor } from "../schema/plan";
import { createReader } from "./reader";

// Doc 19, what came after the first build: a conditional field inside another's option, a choice made by a switch, translations that
// follow their source's choice, and the review's count of what a move into an option keeps.

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
				format: {
					kind: "conditional",
					options: ["article", "video", "link"],
					fields: {
						video: {
							videoUrl: { kind: "text" },
							caption: { kind: "text", locale: "perLocale" },
							// A choice inside the choice: where the video is, and what each place needs.
							host: {
								kind: "conditional",
								options: ["own", "embed"],
								fields: {
									own: { file: { kind: "text" } },
									embed: { embedCode: { kind: "text", required: true }, credit: { kind: "text", locale: "perLocale" } },
								},
							},
						},
						link: { linkUrl: { kind: "text" }, linkText: { kind: "text", locale: "perLocale" } },
					},
				},
				// On or off, with fields for on.
				featured: {
					kind: "conditional",
					control: "toggle",
					options: ["yes"],
					fields: { yes: { featuredNote: { kind: "text" } } },
				},
				note: { kind: "text", locale: "perLocale" },
				summary: { kind: "text" },
			},
		},
		author: {
			kind: "item",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				role: {
					kind: "conditional",
					options: ["staff", "guest"],
					fields: { guest: { from: { kind: "text" } }, staff: { desk: { kind: "text" } } },
				},
			},
		},
	},
});
const post = schema.collections.post;
const site = (using: Schema = schema) => createMonti({ db, schema: using });
type Written<Output> = { output: Output; activityId: string };
const write = async <Output = { id: string }>(name: string, input: unknown, using?: Schema) =>
	(await site(using).run(name, input, { actor: "admin" })) as Written<Output>;

let slugs = 0;
async function newPost(values: Record<string, unknown>) {
	return (await write("entries.create", { collection: "post", title: "글", slug: `post-${++slugs}`, values })).output
		.id;
}
const stored = async (id: string) =>
	(await db
		.selectFrom("entries")
		.select(["values", "version", "translation_seen", "has_unpublished_changes"])
		.where("id", "=", id)
		.executeTakeFirstOrThrow()) as {
		values: Record<string, unknown>;
		version: number;
		translation_seen: Record<string, unknown>;
		has_unpublished_changes: boolean;
	};
const shown = async (id: string) =>
	(await db.selectFrom("entry_published").select("values").where("entry_id", "=", id).executeTakeFirst())?.values;
const save = async (id: string, values: Record<string, unknown>) =>
	write("entries.save", { id, version: (await stored(id)).version, values });
const translate = async (source: string) => (await write("translations.create", { source, locale: "en" })).output.id;
const refusal = async (run: Promise<unknown>) =>
	run.then(
		() => null,
		(error) => (error instanceof CheckError ? error.reason : Promise.reject(error)),
	);

/** The draft schema with the post's fields changed. */
const changed = (fields: (typeof post)["fields"]): Schema => ({
	...schema,
	collections: { ...schema.collections, post: { ...post, fields } },
});
/** Plans a change, answers it, and follows it on the database, as `schema.apply` does. */
async function follow(draft: Schema, answers: Answers = {}) {
	const plan = await planSchema(db, schema, draft, [], answers);
	const { steps, missing } = stepsFor(plan, answers);
	expect(missing).toEqual([]);
	await applyChange(db, { id: `change-${++slugs}`, steps }, draft, site(draft).site.kit);
	return plan;
}

beforeEach(async () => {
	await sql`drop view if exists monti_post`.execute(db);
	await sql`drop view if exists monti_author`.execute(db);
	for (const table of [
		"entries",
		"schema_state",
		"schema_changes",
		"monti_proposal",
		"monti_delivery",
		"monti_activity",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("a conditional field in an option of another (T183)", () => {
	it("19-17 its choice and its options' fields are stored beside the rest, each with its place and the places above it", () => {
		expect(checkSchema(schema)).toEqual([]);
		const fields = storedFields(post);
		expect(Object.keys(fields)).toEqual([
			"title",
			"slug",
			"format",
			"videoUrl",
			"caption",
			"host",
			"file",
			"embedCode",
			"credit",
			"linkUrl",
			"linkText",
			"featured",
			"featuredNote",
			"note",
			"summary",
		]);
		const video = { field: "format", option: "video" };
		expect(fields.host).toEqual({ kind: "select", options: ["own", "embed"], under: video });
		expect(fields.embedCode).toEqual({
			kind: "text",
			required: true,
			under: { field: "host", option: "embed", above: video },
		});
		// A field is the entry's only where every choice above it is made.
		expect([...notChosenFields(post, { format: "video", host: "embed" })].sort()).toEqual(
			["featuredNote", "file", "linkText", "linkUrl"].sort(),
		);
		// The inner choice alone, under an outer choice that is another's: nothing of the inner field is the entry's, the choice included.
		expect([...notChosenFields(post, { format: "link", host: "embed" })]).toEqual(
			expect.arrayContaining(["host", "file", "embedCode", "credit", "videoUrl"]),
		);
	});

	it("19-17 as deep as it goes it is checked like any conditional field: a name used twice, an option not listed, an address inside", () => {
		const inner = (host: unknown) =>
			checkSchema(
				changed({
					...post.fields,
					format: {
						kind: "conditional",
						options: ["article", "video"],
						fields: { video: { host: host as never } },
					},
				}),
			).map((problem) => `${problem.field}:${problem.code}`);
		expect(inner({ kind: "conditional", options: ["own"], fields: { own: { summary: { kind: "text" } } } })).toEqual([
			"summary:duplicateField",
		]);
		expect(inner({ kind: "conditional", options: ["own"], fields: { embed: {} } })).toEqual(["host:unknownOption"]);
		expect(inner({ kind: "conditional", options: ["own"], fields: { own: { address: { kind: "slug" } } } })).toEqual(
			expect.arrayContaining(["address:notInOption"]),
		);
		expect(inner({ kind: "conditional", options: ["own"], fields: {}, locale: "perLocale" })).toEqual([
			"host:choicePerLocale",
		]);
	});

	it("19-17 a save keeps the inner option's values only under both choices: changing the outer one drops the inner choice with its fields, and a value for a field under a choice not made is refused", async () => {
		const id = await newPost({ format: "video", videoUrl: "v.mp4", host: "embed", embedCode: "<iframe>" });
		expect((await stored(id)).values).toEqual({
			format: "video",
			videoUrl: "v.mp4",
			host: "embed",
			embedCode: "<iframe>",
		});
		// The inner choice changed: the other inner option's value goes.
		await save(id, { host: "own", file: "a.mp4" });
		expect((await stored(id)).values).toEqual({ format: "video", videoUrl: "v.mp4", host: "own", file: "a.mp4" });
		// A field two choices deep, with the outer choice made and the inner one another's.
		expect(await refusal(save(id, { embedCode: "<iframe>" }))).toEqual({
			key: "entries.notChosen",
			values: { field: "embedCode" },
		});
		// The outer choice changed: everything under it goes, the inner choice too.
		await save(id, { format: "link", linkUrl: "https://example.dev" });
		expect((await stored(id)).values).toEqual({ format: "link", linkUrl: "https://example.dev" });
		// The inner choice with the outer one another's is no value of the entry.
		expect(await refusal(save(id, { host: "own" }))).toEqual({ key: "entries.notChosen", values: { field: "host" } });
	});

	it("19-17 required holds only under every choice above the field, and the site is given no value from under a choice not made", async () => {
		const id = await newPost({ format: "video", host: "embed" });
		const tasks = async () =>
			((await site().run("entries.checkPublish", { id }, { actor: "admin" })) as { tasks: { field?: string }[] }).tasks
				.map((task) => task.field)
				.filter(Boolean);
		expect(await tasks()).toEqual(["embedCode"]);
		await save(id, { host: "own" });
		expect(await tasks()).toEqual([]);
		// A stored copy that still holds values from under other choices (older data): the site is given none of them.
		await db
			.updateTable("entries")
			.set({
				values: JSON.stringify({ format: "video", host: "own", file: "a.mp4", embedCode: "old", linkUrl: "old" }),
			})
			.where("id", "=", id)
			.execute();
		const published = await write<{ published: string[] }>("entries.publish", { ids: [id] });
		expect(published.output.published).toEqual([id]);
		const read = await createReader({ db, schema }).entry({ collection: "post", locale: "ko", slug: `post-${slugs}` });
		expect((read as { entry: { values: object } }).entry.values).toEqual({
			format: "video",
			host: "own",
			file: "a.mp4",
		});
	});

	it("19-17 a field moved into an inner option is kept by the entries that made both choices, and the review counts the rest", async () => {
		const both = await newPost({ format: "video", host: "embed", embedCode: "x", summary: "둘 다 고른 글" });
		const outer = await newPost({ format: "video", host: "own", summary: "바깥만 같은 글" });
		const neither = await newPost({ format: "article", summary: "다른 종류의 글" });
		const { summary, format, ...rest } = post.fields;
		const video = (format as { fields: Record<string, Record<string, unknown>> }).fields.video as Record<
			string,
			unknown
		>;
		const host = video.host as { fields: Record<string, Record<string, unknown>> };
		const moved = changed({
			...rest,
			format: {
				...format,
				fields: {
					...(format as { fields: object }).fields,
					video: { ...video, host: { ...host, fields: { ...host.fields, embed: { ...host.fields.embed, summary } } } },
				},
			} as never,
		});
		const plan = await follow(moved);
		expect(plan.map((change) => [change.do, change.field, change.option, change.count])).toEqual([
			["moveField", "summary", "embed", 2],
		]);
		expect((await stored(both)).values.summary).toBe("둘 다 고른 글");
		expect((await stored(outer)).values).not.toHaveProperty("summary");
		expect((await stored(neither)).values).not.toHaveProperty("summary");
	});
});

describe("a choice made by a switch (T183)", () => {
	it("19-18 it is a conditional field with one option, on or off: stored as that option's word or nothing, its fields kept while it is on", async () => {
		expect(storedFields(post).featured).toEqual({ kind: "select", options: ["yes"], control: "toggle" });
		const id = await newPost({ featured: "yes", featuredNote: "첫 화면에" });
		expect((await stored(id)).values).toEqual({ featured: "yes", featuredNote: "첫 화면에" });
		// Off is no choice: the field is emptied, and its option's values go with it.
		await save(id, { featured: null });
		expect((await stored(id)).values).toEqual({});
		expect(await refusal(save(id, { featuredNote: "다시" }))).toEqual({
			key: "entries.notChosen",
			values: { field: "featuredNote" },
		});
	});

	it("19-18 a switch with more than one option, or a required one, is to fix", () => {
		const codes = (featured: object) =>
			checkSchema(changed({ ...post.fields, featured: featured as never })).map(
				(problem) => `${problem.field}:${problem.code}`,
			);
		const base = post.fields.featured as object;
		expect(codes({ ...base, options: ["yes", "no"] })).toEqual(["featured:badToggle"]);
		expect(codes({ ...base, required: true })).toEqual(["featured:badToggle"]);
		// Inside an option of another it is checked the same.
		expect(
			checkSchema(
				changed({
					...post.fields,
					format: {
						kind: "conditional",
						options: ["video"],
						fields: { video: { loud: { kind: "conditional", control: "toggle", options: ["a", "b"], fields: {} } } },
					},
				}),
			).map((problem) => `${problem.field}:${problem.code}`),
		).toEqual(["loud:badToggle"]);
	});
});

describe("a translation follows its source's choice (T184)", () => {
	it("19-19 a source that is not on the site changes its choice: its translations lose the old option's values with what they had seen of them, and an undo of that save puts them back", async () => {
		const source = await newPost({ format: "video", videoUrl: "v.mp4" });
		const en = await translate(source);
		await save(en, { caption: "A caption", note: "A note" });
		const before = await stored(en);
		expect(before.values).toEqual({ caption: "A caption", note: "A note" });

		const changedChoice = await save(source, { format: "link", linkUrl: "https://example.dev" });
		const after = await stored(en);
		// The field on its own stays; the old option's is gone, in one more version.
		expect(after.values).toEqual({ note: "A note" });
		expect(after.translation_seen).not.toHaveProperty("caption");
		expect(after.version).toBe(before.version + 1);

		await write("activity.undo", { id: changedChoice.activityId });
		expect((await stored(source)).values).toEqual({ format: "video", videoUrl: "v.mp4" });
		expect((await stored(en)).values).toEqual({ caption: "A caption", note: "A note" });
	});

	it("19-19 a source on the site is followed as the site shows it: its save changes nothing in its translations, its publish does, in their working copy and in what the site shows of them", async () => {
		const source = await newPost({ format: "video", videoUrl: "v.mp4" });
		await write("entries.publish", { ids: [source] });
		const en = await translate(source);
		await write("entries.save", {
			id: en,
			version: (await stored(en)).version,
			title: "Post",
			values: { caption: "A caption" },
		});
		await write("entries.publish", { ids: [en] });

		// The working copy has another choice; the site still shows the video, and so does the translation.
		await save(source, { format: "link", linkUrl: "https://example.dev" });
		expect((await stored(en)).values).toEqual({ caption: "A caption" });
		// A value for the option the site does not show yet is not the translation's to write.
		expect(await refusal(save(en, { linkText: "Read" }))).toEqual({
			key: "entries.notChosen",
			values: { field: "linkText" },
		});

		const published = await write("entries.publish", { ids: [source] });
		expect((await stored(en)).values).toEqual({});
		expect(await shown(en)).toEqual({});
		// Both copies changed alike: the translation is not "changed" by it.
		expect((await stored(en)).has_unpublished_changes).toBe(false);
		// Now the link's field is its own.
		await save(en, { linkText: "Read" });
		expect((await stored(en)).values).toEqual({ linkText: "Read" });

		// The publish undone: the site shows the source as a video again.
		await save(en, { linkText: null });
		await write("activity.undo", { id: published.activityId });
		expect((await stored(source)).values).toEqual({ format: "link", linkUrl: "https://example.dev" });
		expect(await shown(source)).toEqual({ format: "video", videoUrl: "v.mp4" });
	});

	it("19-19 a source taken off the site is followed by its working copy again: the translations lose what that copy has not chosen", async () => {
		const source = await newPost({ format: "video", videoUrl: "v.mp4" });
		await write("entries.publish", { ids: [source] });
		const en = await translate(source);
		await save(en, { caption: "A caption" });
		await save(source, { format: "article" });
		expect((await stored(en)).values).toEqual({ caption: "A caption" });
		await write("entries.archive", { ids: [source] });
		expect((await stored(en)).values).toEqual({});
	});

	it("19-19 a translation's own save keeps to the source's choice: what its copy held of another option goes, and a translation back from the trash is brought back without it", async () => {
		const source = await newPost({ format: "link", linkUrl: "https://example.dev" });
		const en = await translate(source);
		// Older data: a value of an option the source has not chosen.
		await db
			.updateTable("entries")
			.set({ values: JSON.stringify({ caption: "Old", linkText: "Read" }) })
			.where("id", "=", en)
			.execute();
		await save(en, { note: "A note" });
		expect((await stored(en)).values).toEqual({ linkText: "Read", note: "A note" });

		await db
			.updateTable("entries")
			.set({ values: JSON.stringify({ caption: "Old", linkText: "Read" }) })
			.where("id", "=", en)
			.execute();
		await write("trash.move", { rows: [{ kind: "entry", id: en }] });
		await write("trash.restore", { rows: [{ kind: "entry", id: en }] });
		expect((await stored(en)).values).toEqual({ linkText: "Read" });
	});

	it("19-19 a structure change reads a translation's choice from its source: a field moved into an option stays in the translations whose source chose it, and a required field of an option is counted for them", async () => {
		const video = await newPost({ format: "video" });
		const article = await newPost({ format: "article" });
		const [videoEn, articleEn] = [await translate(video), await translate(article)];
		await save(videoEn, { note: "kept" });
		await save(articleEn, { note: "lost" });
		await save(video, { note: "유지" });
		await save(article, { note: "지움" });
		const { note, format, ...rest } = post.fields;
		const groups = (format as { fields: Record<string, object> }).fields;
		const moved = changed({
			...rest,
			format: { ...format, fields: { ...groups, video: { ...groups.video, note } } } as never,
		});
		const plan = await follow(moved);
		// The article and its translation lose it.
		expect(plan.map((change) => [change.do, change.field, change.option, change.count])).toEqual([
			["moveField", "note", "video", 2],
		]);
		expect((await stored(video)).values.note).toBe("유지");
		expect((await stored(videoEn)).values.note).toBe("kept");
		expect((await stored(article)).values).not.toHaveProperty("note");
		expect((await stored(articleEn)).values).not.toHaveProperty("note");
	});
});

describe("an item's languages keep to the choice too", () => {
	it("19-19 saved as a group, each language holds the chosen option's values only: the source's by its own choice, another language's by the source's", async () => {
		const made = await write<{ group: string }>("items.saveGroup", {
			collection: "author",
			locales: {
				ko: { title: "손님", slug: "guest", values: { role: "guest", from: "밖에서", desk: "남는 값" } },
				en: { title: "Guest", slug: "guest", values: { from: "Outside", desk: "Stray" } },
			},
		});
		const held = async () =>
			Object.fromEntries(
				(
					await db
						.selectFrom("entries")
						.select(["locale", "values"])
						.where("translation_group", "=", made.output.group)
						.execute()
				).map((row) => [row.locale, row.values]),
			);
		expect(await held()).toEqual({ ko: { role: "guest", from: "밖에서" }, en: { from: "Outside" } });
		// The choice changed on the source: both languages lose the old option's value.
		await write("items.saveGroup", {
			collection: "author",
			group: made.output.group,
			locales: { ko: { values: { role: "staff", desk: "편집부" } }, en: {} },
		});
		expect(await held()).toEqual({ ko: { role: "staff", desk: "편집부" }, en: {} });
	});
});

describe("what a removed field's values moved into an option's field keep (T188)", () => {
	it("19-20 the plan says how many entries keep the value, by who has the option when the move runs: an option taken out in the same change gives its entries to the one they are changed to", async () => {
		await newPost({ format: "video", summary: "영상" });
		await newPost({ format: "link", summary: "링크" });
		await newPost({ format: "article", summary: "글 하나" });
		await newPost({ format: "article", summary: "글 둘" });
		await newPost({ format: "article" });
		const { summary: _summary, ...rest } = post.fields;
		const removed = changed(rest);
		const [change] = await planSchema(db, schema, removed);
		expect([change?.do, change?.field, change?.count]).toEqual(["removeField", "summary", 4]);
		// Into the link's field one entry keeps it; into a field on its own nothing is said (every entry keeps it).
		expect(change?.kept).toMatchObject({ linkUrl: 1, videoUrl: 1, linkText: 1 });
		expect(change?.kept).not.toHaveProperty("note");
		// Two choices deep: only an entry with both.
		expect(change?.kept?.embedCode).toBe(0);

		// The article option taken out in the same change: its entries go where the answer sends them.
		const format = post.fields.format as { options: string[]; fields: Record<string, object> };
		const fewer = changed({ ...rest, format: { ...format, options: ["video", "link"] } as never });
		const id = "removeOption:post.format.article";
		const toLink = await planSchema(db, schema, fewer, [], {
			[id]: { do: "removeOption", entries: { change: "link" } },
		});
		expect(toLink.find((each) => each.do === "removeField")?.kept).toMatchObject({ linkUrl: 3, videoUrl: 1 });
		const emptied = await planSchema(db, schema, fewer, [], { [id]: { do: "removeOption", entries: "empty" } });
		expect(emptied.find((each) => each.do === "removeField")?.kept).toMatchObject({ linkUrl: 1, videoUrl: 1 });
		// With no answer yet the default counts: to change, to the first option left.
		const unanswered = await planSchema(db, schema, fewer);
		expect(unanswered.find((each) => each.do === "removeField")?.kept).toMatchObject({ linkUrl: 1, videoUrl: 3 });

		// And the count is what the change does.
		await follow(fewer, {
			[id]: { do: "removeOption", entries: { change: "link" } },
			"removeField:post.summary": { do: "removeField", values: { move: "linkUrl" } },
		});
		const kept = await db.selectFrom("entries").select("values").execute();
		expect(
			kept
				.map((row) => row.values.linkUrl)
				.filter((value) => /영상|링크|글/.test(String(value)))
				.sort(),
		).toEqual(["글 둘", "글 하나", "링크"]);
		expect(kept.some((row) => "summary" in row.values)).toBe(false);
	});
});
