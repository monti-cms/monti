import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createReader } from "../entries/reader";
import { createMonti } from "../monti";
import { migrateContent } from "./apply";
import { defineSchema, type FieldDefinition, type Schema } from "./define";
import { type Answers, planSchema, type Rename, stepsFor } from "./plan";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				mood: { kind: "select", options: ["calm", "loud"] },
				level: { kind: "select", required: true, options: ["easy", "hard"] },
				topics: { kind: "select", many: true, options: ["react", "css", "db"] },
				format: {
					kind: "conditional",
					required: true,
					options: ["article", "video", "link"],
					fields: {
						video: { videoUrl: { kind: "text", required: true } },
						link: { linkUrl: { kind: "text", required: true } },
					},
				},
				note: { kind: "text" },
				extra: {
					kind: "conditional",
					options: ["none", "quote"],
					fields: { quote: { quoteText: { kind: "text" } } },
				},
			},
		},
	},
});
const post = schema.collections.post;
const admin = { actor: "admin" } as const;
const site = () => createMonti({ db, schema });
type Written<Output> = { output: Output };

let made = 0;
/** A post with these values; `on` puts it on the site. */
async function newPost(values: Record<string, unknown>, on = false) {
	const n = ++made;
	const id = (
		(await site().run(
			"entries.create",
			{
				collection: "post",
				title: `글 ${n}`,
				slug: `post-${n}`,
				values: { level: "easy", format: "article", ...values },
			},
			admin,
		)) as Written<{ id: string }>
	).output.id;
	if (on) await site().run("entries.publish", { ids: [id], date: "keep" }, admin);
	return id;
}
const draftOf = async (id: string) =>
	(await db.selectFrom("entries").select("values").where("id", "=", id).executeTakeFirstOrThrow()).values as Record<
		string,
		unknown
	>;
const publishedOf = async (id: string) =>
	(await db.selectFrom("entry_published").select("values").where("entry_id", "=", id).executeTakeFirstOrThrow())
		.values as Record<string, unknown>;
const stateOf = async (id: string) =>
	db.selectFrom("entries").select(["status", "has_unpublished_changes"]).where("id", "=", id).executeTakeFirstOrThrow();

const withFields = (fields: Record<string, FieldDefinition | undefined>): Schema => ({
	...schema,
	collections: {
		post: {
			...post,
			fields: Object.fromEntries(
				Object.entries({ ...post.fields, ...fields }).filter(([, field]) => field !== undefined),
			) as Record<string, FieldDefinition>,
		},
	},
});
let applied = 0;
/** Plans the change, answers it and follows its steps, as a save of the settings does. */
async function apply(after: Schema, answers: Answers = {}, renames: Rename[] = []) {
	const plan = await planSchema(db, schema, after, renames);
	const { steps, missing } = stepsFor(plan, answers);
	expect(missing).toEqual([]);
	await migrateContent(db, after, [{ id: `change-${++applied}`, steps }]);
	return plan;
}
const lineOf = (plan: Awaited<ReturnType<typeof planSchema>>, id: string) => plan.find((change) => change.id === id);

beforeEach(async () => {
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of ["entries", "schema_state", "schema_changes"] as const) await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("how many of the entries a settings change touches are on the site (doc 02)", () => {
	it("19-7 a removed field, a field made required, a removed and a renamed option each say the entries they touch and how many are published; a trashed entry is not on the site", async () => {
		await newPost({ note: "하나", mood: "loud" }, true);
		await newPost({ note: "둘", mood: "loud" }, false);
		const trashed = await newPost({ note: "셋", mood: "loud" }, true);
		await db.updateTable("entries").set({ trashed_at: new Date() }).where("id", "=", trashed).execute();
		await newPost({}, true);

		const removed = await planSchema(db, schema, withFields({ note: undefined }));
		expect(lineOf(removed, "removeField:post.note")).toMatchObject({ count: 3, published: 1 });

		const required = await planSchema(db, schema, withFields({ note: { kind: "text", required: true } }));
		expect(lineOf(required, "changeField:post.note")).toMatchObject({ count: 1, published: 1 });

		const option = await planSchema(db, schema, withFields({ mood: { kind: "select", options: ["calm"] } }));
		expect(lineOf(option, "removeOption:post.mood.loud")).toMatchObject({ count: 3, published: 1 });

		const renamed = await planSchema(db, schema, withFields({ mood: { kind: "select", options: ["calm", "noisy"] } }), [
			{ collection: "post", of: "mood", from: "loud", to: "noisy" },
		]);
		expect(lineOf(renamed, "renameOption:post.mood.loud")).toMatchObject({ count: 3, published: 1 });
	});
});

describe("an option renamed (docs 12 and 19)", () => {
	it("19-8 is a rename: the stored word is rewritten in the draft and on the site, the entry stays published, and nothing is asked", async () => {
		const on = await newPost({ mood: "loud", topics: ["react", "css"] }, true);
		const other = await newPost({ mood: "calm", topics: ["db"] }, true);
		const plan = await apply(
			withFields({
				mood: { kind: "select", options: ["calm", "noisy"] },
				topics: { kind: "select", many: true, options: ["react", "styles", "db"] },
			}),
			{},
			[
				{ collection: "post", of: "mood", from: "loud", to: "noisy" },
				{ collection: "post", of: "topics", from: "css", to: "styles" },
			],
		);
		expect(plan.map((change) => change.do)).toEqual(["renameOption", "renameOption"]);
		expect(lineOf(plan, "renameOption:post.mood.loud")).toMatchObject({ from: "loud", option: "noisy" });
		expect(lineOf(plan, "renameOption:post.mood.loud")?.choices).toBeUndefined();
		for (const read of [await draftOf(on), await publishedOf(on)])
			expect(read).toMatchObject({ mood: "noisy", topics: ["react", "styles"] });
		expect(await publishedOf(other)).toMatchObject({ mood: "calm", topics: ["db"] });
		expect(await stateOf(on)).toEqual({ status: "published", has_unpublished_changes: false });
	});

	it("19-8 without the rename named, the same draft is an option taken out: it is asked about, not rewritten unsaid", async () => {
		await newPost({ mood: "loud" });
		const plan = await planSchema(db, schema, withFields({ mood: { kind: "select", options: ["calm", "noisy"] } }));
		// The added word has the field's own line; the one taken out is asked about.
		expect(plan.map((change) => change.id)).toEqual(["changeField:post.mood", "removeOption:post.mood.loud"]);
	});

	it("19-8 a conditional field's option renamed takes its group of fields with it untouched: the site reads the new word and the same values", async () => {
		const on = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" }, true);
		const format = post.fields.format as Extract<FieldDefinition, { kind: "conditional" }>;
		const after = withFields({
			format: {
				...format,
				options: ["article", "clip", "link"],
				fields: { clip: format.fields.video ?? {}, link: format.fields.link ?? {} },
			},
		});
		const plan = await apply(after, {}, [{ collection: "post", of: "format", from: "video", to: "clip" }]);
		// The group's field is not a changed field: it only follows its option.
		expect(plan.map((change) => change.id)).toEqual(["renameOption:post.format.video"]);
		expect(await publishedOf(on)).toMatchObject({ format: "clip", videoUrl: "https://example.dev/v.mp4" });
		const slug = (await db.selectFrom("entries").select("slug").where("id", "=", on).executeTakeFirstOrThrow()).slug;
		const read = await createReader({ db, schema: after }).entry({ collection: "post", locale: "ko", slug });
		expect(read).toMatchObject({ entry: { values: { format: "clip", videoUrl: "https://example.dev/v.mp4" } } });
	});
});

describe("an option taken out while entries chose it (docs 12 and 19)", () => {
	const calmOnly = withFields({ mood: { kind: "select", options: ["calm"] } });

	it("19-9 asks: empty them, or change them to an option that stays; unanswered it cannot be applied, and the line is not 'the data is the same'", async () => {
		await newPost({ mood: "loud" }, true);
		const plan = await planSchema(db, schema, calmOnly);
		expect(plan).toEqual([
			{
				id: "removeOption:post.mood.loud",
				do: "removeOption",
				collection: "post",
				field: "mood",
				option: "loud",
				count: 1,
				published: 1,
				// Changing first: it is the default, and emptying is chosen, not fallen into.
				choices: [
					{ do: "removeOption", entries: { change: "calm" } },
					{ do: "removeOption", entries: "empty" },
				],
			},
		]);
		expect(stepsFor(plan, {}).missing).toEqual(["removeOption:post.mood.loud"]);
	});

	it("19-9 emptied, the field is gone from the draft and from the site; changed, both hold the option picked; other entries are not touched", async () => {
		const loud = await newPost({ mood: "loud" }, true);
		const calm = await newPost({ mood: "calm" }, true);
		await apply(calmOnly, { "removeOption:post.mood.loud": { do: "removeOption", entries: "empty" } });
		expect(await draftOf(loud)).not.toHaveProperty("mood");
		expect(await publishedOf(loud)).not.toHaveProperty("mood");
		expect(await publishedOf(calm)).toMatchObject({ mood: "calm" });
		expect(await stateOf(loud)).toEqual({ status: "published", has_unpublished_changes: false });

		await migrateContent(db, schema, []);
		const again = await newPost({ mood: "loud" }, true);
		await apply(calmOnly, { "removeOption:post.mood.loud": { do: "removeOption", entries: { change: "calm" } } });
		expect(await draftOf(again)).toMatchObject({ mood: "calm" });
		expect(await publishedOf(again)).toMatchObject({ mood: "calm" });
	});

	it("19-9 a required field is never emptied: only the options that stay are offered", async () => {
		await newPost({ level: "hard" }, true);
		const plan = await planSchema(
			db,
			schema,
			withFields({ level: { kind: "select", required: true, options: ["easy", "mid"] } }),
		);
		expect(lineOf(plan, "removeOption:post.level.hard")?.choices).toEqual([
			{ do: "removeOption", entries: { change: "easy" } },
			{ do: "removeOption", entries: { change: "mid" } },
		]);
	});

	it("19-9 one pick of many taken out leaves the others; changed, the new one joins them once; the last pick emptied leaves no field", async () => {
		const two = await newPost({ topics: ["react", "css"] }, true);
		const both = await newPost({ topics: ["css", "db"] }, true);
		const only = await newPost({ topics: ["css"] }, true);
		const after = withFields({ topics: { kind: "select", many: true, options: ["react", "db"] } });
		await apply(after, { "removeOption:post.topics.css": { do: "removeOption", entries: { change: "db" } } });
		expect((await publishedOf(two)).topics).toEqual(["react", "db"]);
		expect((await publishedOf(both)).topics).toEqual(["db"]);
		expect((await draftOf(only)).topics).toEqual(["db"]);

		await migrateContent(db, schema, []);
		const last = await newPost({ topics: ["css"] }, true);
		const some = await newPost({ topics: ["css", "react"] }, true);
		await apply(after, { "removeOption:post.topics.css": { do: "removeOption", entries: "empty" } });
		expect(await publishedOf(last)).not.toHaveProperty("topics");
		expect((await publishedOf(some)).topics).toEqual(["react"]);
	});

	it("19-9 with no entry on the option the question is still asked: the live site's entries follow the same change file", async () => {
		const plan = await planSchema(db, schema, calmOnly);
		expect(lineOf(plan, "removeOption:post.mood.loud")).toMatchObject({ count: 0, published: 0 });
		expect(lineOf(plan, "removeOption:post.mood.loud")?.choices).toHaveLength(2);
	});
});

describe("a conditional field's option taken out, its entries changed to another (doc 19)", () => {
	it("19-10 the entries are the other option's on the site at once, with the removed option's values moved or cleared by their own answers; what the new option requires is asked for at the next publish", async () => {
		const video = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" }, true);
		const bare = await newPost({ format: "video", videoUrl: "https://example.dev/w.mp4" }, true);
		const format = post.fields.format as Extract<FieldDefinition, { kind: "conditional" }>;
		const after = withFields({
			format: { ...format, options: ["article", "link"], fields: { link: format.fields.link ?? {} } },
		});
		const plan = await planSchema(db, schema, after);
		expect(lineOf(plan, "removeOption:post.format.video")).toMatchObject({ count: 2, published: 2 });
		// The choice is required: no "empty".
		expect(lineOf(plan, "removeOption:post.format.video")?.choices).toEqual([
			{ do: "removeOption", entries: { change: "article" } },
			{ do: "removeOption", entries: { change: "link" } },
		]);
		await apply(after, {
			"removeField:post.videoUrl": { do: "removeField", values: "clear" },
			"removeOption:post.format.video": { do: "removeOption", entries: { change: "link" } },
		});
		for (const id of [video, bare]) {
			expect(await publishedOf(id)).toEqual({ level: "easy", format: "link" });
			expect(await stateOf(id)).toEqual({ status: "published", has_unpublished_changes: false });
		}
		// The link's address is required and empty: the entry stays on the site, and its next publish asks for it.
		const check = (await createMonti({ db, schema: after }).run("entries.checkPublish", { id: video }, admin)) as {
			tasks: { code: string; field?: string }[];
		};
		expect(check.tasks).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "required", field: "linkUrl" })]),
		);
	});

	it("19-10 a removed field's values moved into a field of an option go to the entries that have that option chosen (after the change's own answer); for the others they are cleared, never held unseen", async () => {
		const video = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" }, true);
		const noted = await newPost({ format: "article", note: "https://example.dev/n" }, true);
		const format = post.fields.format as Extract<FieldDefinition, { kind: "conditional" }>;
		const after = withFields({
			format: { ...format, options: ["article", "link"], fields: { link: format.fields.link ?? {} } },
			note: undefined,
		});
		await apply(after, {
			"removeField:post.videoUrl": { do: "removeField", values: { move: "linkUrl" } },
			"removeField:post.note": { do: "removeField", values: { move: "linkUrl" } },
			"removeOption:post.format.video": { do: "removeOption", entries: { change: "link" } },
		});
		// The video post is a link post by the time its address is moved: a whole link post, on the site too.
		expect(await publishedOf(video)).toEqual({ level: "easy", format: "link", linkUrl: "https://example.dev/v.mp4" });
		expect(await draftOf(video)).toEqual({ level: "easy", format: "link", linkUrl: "https://example.dev/v.mp4" });
		// The article is not a link post: the site is given no address of a kind it is not.
		expect(await publishedOf(noted)).toEqual({ level: "easy", format: "article" });
	});
});

describe("a field of an option is its option's entries' only (doc 19)", () => {
	const format = post.fields.format as Extract<FieldDefinition, { kind: "conditional" }>;

	it("19-12 a required field added to an option is asked of the entries that chose that option, and filled in them only: the others, on the site too, get no value of an option that is not theirs", async () => {
		const video = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" }, true);
		const article = await newPost({ format: "article" }, true);
		await newPost({ format: "link", linkUrl: "https://example.dev" }, false);
		const after = withFields({
			format: {
				...format,
				fields: { ...format.fields, video: { ...format.fields.video, caption: { kind: "text", required: true } } },
			},
		});
		const plan = await planSchema(db, schema, after);
		expect(lineOf(plan, "addField:post.caption")).toMatchObject({ count: 1, published: 1 });
		await apply(after, { "addField:post.caption": { do: "addRequiredField", fill: "설명" } });
		expect(await publishedOf(video)).toMatchObject({ caption: "설명" });
		expect(await draftOf(video)).toMatchObject({ caption: "설명" });
		expect(await publishedOf(article)).not.toHaveProperty("caption");
		expect(await draftOf(article)).not.toHaveProperty("caption");
	});

	it("19-13 a field moved into an option is cleared from the entries that chose another, in the draft and on the site, and the review says how many; those that chose it keep it", async () => {
		const video = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4", note: "영상 메모" }, true);
		const link = await newPost({ format: "link", linkUrl: "https://example.dev", note: "링크 메모" }, true);
		// `note`, on its own until now, becomes the link option's; `videoUrl` goes from the video option to the link option.
		const after = withFields({
			note: undefined,
			format: {
				...format,
				fields: {
					link: {
						...format.fields.link,
						note: { kind: "text" },
						...(format.fields.video?.videoUrl ? { videoUrl: format.fields.video.videoUrl } : {}),
					},
				},
			},
		});
		const plan = await planSchema(db, schema, after);
		expect(lineOf(plan, "moveField:post.note")).toMatchObject({ option: "link", count: 1, published: 1 });
		expect(lineOf(plan, "moveField:post.videoUrl")).toMatchObject({ option: "link", count: 1, published: 1 });
		expect(plan.some((change) => change.do === "changeField")).toBe(false);
		await apply(after);
		expect(await publishedOf(video)).toEqual({ level: "easy", format: "video" });
		expect(await draftOf(video)).toEqual({ level: "easy", format: "video" });
		expect(await publishedOf(link)).toEqual({
			level: "easy",
			format: "link",
			linkUrl: "https://example.dev",
			note: "링크 메모",
		});
	});

	it("19-13 an option emptied leaves none of its group's values: its fields are removed fields, and a value moved into another option's field goes to no entry that has not chosen it", async () => {
		const quoted = await newPost({ extra: "quote", quoteText: "인용" }, true);
		const extra = post.fields.extra as Extract<FieldDefinition, { kind: "conditional" }>;
		const after = withFields({ extra: { ...extra, options: ["none"], fields: {} } });
		await apply(after, {
			"removeField:post.quoteText": { do: "removeField", values: { move: "linkUrl" } },
			"removeOption:post.extra.quote": { do: "removeOption", entries: "empty" },
		});
		expect(await publishedOf(quoted)).toEqual({ level: "easy", format: "article" });
		expect(await draftOf(quoted)).toEqual({ level: "easy", format: "article" });
	});

	it("19-13 whatever a stored copy still holds, the site and the list give no value of an option that is not chosen, and the list does not filter on it", async () => {
		const id = await newPost({ format: "article" }, true);
		// As older data, a translation or an undone save can leave it: a video address on an article.
		for (const table of ["entries", "entry_published"] as const)
			await sql`update ${sql.table(table)} set values = values || '{"videoUrl": "https://example.dev/stray.mp4"}'::jsonb`.execute(
				db,
			);
		const slug = (await db.selectFrom("entries").select("slug").where("id", "=", id).executeTakeFirstOrThrow()).slug;
		const read = (await createReader({ db, schema }).entry({ collection: "post", locale: "ko", slug })) as {
			entry: { values: Record<string, unknown> };
		};
		expect(read.entry.values).toEqual({ level: "easy", format: "article" });
		const listed = (await site().run("entries.query", { collection: "post" }, admin)) as {
			rows: { values: Record<string, unknown> }[];
		};
		expect(listed.rows[0]?.values).not.toHaveProperty("videoUrl");
		const empty = (await site().run(
			"entries.query",
			{ collection: "post", filters: [{ on: "empty", field: "videoUrl" }] },
			admin,
		)) as { total: number };
		expect(empty.total).toBe(1);
	});
});
