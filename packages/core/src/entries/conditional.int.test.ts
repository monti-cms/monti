import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, notChosenFields, type Schema, storedFields } from "../schema/define";
import { planSchema, stepsFor } from "../schema/plan";
import { createReader } from "./reader";

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
				format: {
					kind: "conditional",
					required: true,
					options: ["article", "video", "link"],
					fields: {
						video: { videoUrl: { kind: "text", required: true }, poster: { kind: "media", accept: "image" } },
						link: { linkUrl: { kind: "text", required: true } },
					},
				},
				summary: { kind: "text" },
			},
		},
	},
});
const post = schema.collections.post;
const admin = { actor: "admin" } as const;
const site = () => createMonti({ db, schema });
type Written<Output> = { output: Output };

async function newPost(values: Record<string, unknown>) {
	const made = (await site().run(
		"entries.create",
		{ collection: "post", title: "글", slug: "post", values },
		admin,
	)) as Written<{ id: string }>;
	return made.output.id;
}
const stored = async (id: string) =>
	(await db.selectFrom("entries").select(["values", "version"]).where("id", "=", id).executeTakeFirstOrThrow()) as {
		values: Record<string, unknown>;
		version: number;
	};
const save = async (id: string, values: Record<string, unknown>) =>
	site().run("entries.save", { id, version: (await stored(id)).version, values }, admin);

beforeEach(async () => {
	await sql`drop view if exists monti_post`.execute(db);
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

describe("a conditional field in the schema", () => {
	it("19-1 it is a choice with a group of fields for an option; stored, it is the choice and the groups' fields side by side", () => {
		expect(checkSchema(schema)).toEqual([]);
		const fields = storedFields(post);
		expect(Object.keys(fields)).toEqual(["title", "slug", "format", "videoUrl", "poster", "linkUrl", "summary"]);
		expect(fields.format).toEqual({ kind: "select", required: true, options: ["article", "video", "link"] });
		expect(fields.videoUrl).toEqual({ kind: "text", required: true, under: { field: "format", option: "video" } });
		expect([...notChosenFields(post, { format: "video" })]).toEqual(["linkUrl"]);
		// Nothing chosen, or a word the field does not list: no option's fields are the entry's.
		expect([...notChosenFields(post, {})]).toEqual(["videoUrl", "poster", "linkUrl"]);
		expect([...notChosenFields(post, { format: "audio" })]).toEqual(["videoUrl", "poster", "linkUrl"]);
	});

	it("19-1 a group for an option that is not listed, a name used twice, and a conditional field or an address in a group are to fix", () => {
		const withFormat = (format: unknown): Schema => ({
			...schema,
			collections: { post: { ...post, fields: { ...post.fields, format: format as never } } },
		});
		const base = post.fields.format as { fields: Record<string, object> };
		const codes = (format: unknown) =>
			checkSchema(withFormat(format)).map((problem) => `${problem.field}:${problem.code}`);
		expect(codes({ ...base, fields: { audio: { audioUrl: { kind: "text" } } } })).toEqual(["format:unknownOption"]);
		// The same name in two groups, and a group's field named as one of the collection's own.
		expect(codes({ ...base, fields: { video: { url: { kind: "text" } }, link: { url: { kind: "text" } } } })).toEqual([
			"url:duplicateField",
		]);
		expect(codes({ ...base, fields: { video: { summary: { kind: "text" } } } })).toEqual(["summary:duplicateField"]);
		expect(
			codes({
				...base,
				fields: {
					video: { inner: { kind: "conditional", options: ["a"], fields: {} }, address: { kind: "slug" } },
				},
			}),
		).toEqual(expect.arrayContaining(["address:notInOption"]));
		expect(codes({ ...base, options: [] })).toContain("format:noOptions");
	});
});

describe("saving an entry with a conditional field", () => {
	it("19-2 only the chosen option's values are kept: a change of the choice drops the other option's, in the entry, on the site and in the list", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4", summary: "요약" });
		expect((await stored(id)).values).toEqual({
			format: "video",
			videoUrl: "https://example.dev/v.mp4",
			summary: "요약",
		});

		await save(id, { format: "link", linkUrl: "https://example.dev" });
		expect((await stored(id)).values).toEqual({ format: "link", linkUrl: "https://example.dev", summary: "요약" });

		await site().run("entries.publish", { ids: [id] }, admin);
		const read = await createReader({ db, schema }).entry({ collection: "post", locale: "ko", slug: "post" });
		expect(read).toMatchObject({ entry: { values: { format: "link", linkUrl: "https://example.dev" } } });
		expect((read as { entry: { values: object } }).entry.values).not.toHaveProperty("videoUrl");
		// A field of a group is a column like any other.
		const columns = (await site().run("list.columns", { collection: "post" }, admin)) as {
			columns?: { field: string }[];
		};
		expect(JSON.stringify(columns)).toContain("linkUrl");

		// An option with no group: choosing it leaves nothing of the others.
		await save(id, { format: "article" });
		expect((await stored(id)).values).toEqual({ format: "article", summary: "요약" });
	});

	it("19-2 a value given for a field of an option that is not chosen is refused by name, not dropped unsaid; an empty one is let be", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		await expect(save(id, { linkUrl: "https://example.dev" })).rejects.toMatchObject({
			reason: { key: "entries.notChosen", values: { field: "linkUrl" } },
		});
		await expect(save(id, { format: "link", videoUrl: "https://example.dev/other.mp4" })).rejects.toMatchObject({
			reason: { key: "entries.notChosen", values: { field: "videoUrl" } },
		});
		expect((await stored(id)).values).toEqual({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		await save(id, { format: "link", linkUrl: "https://example.dev", videoUrl: null });
		expect((await stored(id)).values).toEqual({ format: "link", linkUrl: "https://example.dev" });
		await expect(
			site().run("entries.create", { collection: "post", title: "둘", slug: "two", values: { linkUrl: "x" } }, admin),
		).rejects.toMatchObject({ reason: { key: "entries.notChosen" } });
		await expect(save(id, { format: "audio" })).rejects.toMatchObject({ reason: { key: "entries.badOption" } });
	});

	it("19-3 required holds only inside the chosen option: another option's required field asks for nothing, the chosen one's blocks the publish", async () => {
		const tasks = async (id: string) =>
			((await site().run("entries.checkPublish", { id }, admin)) as { tasks: { code: string; field?: string }[] }).tasks
				.filter((task) => task.code === "required")
				.map((task) => task.field);
		const id = await newPost({ format: "article" });
		expect(await tasks(id)).toEqual([]);
		await save(id, { format: "video" });
		expect(await tasks(id)).toEqual(["videoUrl"]);
		await save(id, { format: "link", linkUrl: "https://example.dev" });
		expect(await tasks(id)).toEqual([]);
		// Nothing chosen: the choice itself is asked for, and no option's fields.
		const none = (
			(await site().run("entries.create", { collection: "post", title: "셋", slug: "three" }, admin)) as Written<{
				id: string;
			}>
		).output.id;
		expect(await tasks(none)).toEqual(["format"]);
	});
});

describe("changing the structure of a conditional field", () => {
	const changed = (format: object): Schema => ({
		...schema,
		collections: { post: { ...post, fields: { ...post.fields, format: format as never } } },
	});
	const base = post.fields.format as { options: string[]; fields: Record<string, Record<string, object>> };

	it("19-4 an option taken out puts its group's fields in the review as removed fields, and asks about the entries that had it chosen", async () => {
		await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const after = changed({ ...base, options: ["article", "link"], fields: { link: base.fields.link } });
		const plan = await planSchema(db, schema, after);
		expect(plan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ do: "removeField", field: "videoUrl", count: 1 }),
				expect.objectContaining({ do: "removeField", field: "poster", count: 0 }),
			]),
		);
		// The choice is required, so it is never emptied: each option that stays is offered (options.int.test.ts has the rest).
		expect(plan.find((change) => change.do === "removeOption")).toEqual({
			id: "removeOption:post.format.video",
			do: "removeOption",
			collection: "post",
			field: "format",
			option: "video",
			count: 1,
			published: 0,
			choices: [
				{ do: "removeOption", entries: { change: "article" } },
				{ do: "removeOption", entries: { change: "link" } },
			],
		});
		// Unanswered, the change cannot be applied.
		const fields = {
			"removeField:post.videoUrl": { do: "removeField", values: "clear" },
			"removeField:post.poster": { do: "removeField", values: "clear" },
		} as const;
		expect(stepsFor(plan, fields).missing).toEqual(["removeOption:post.format.video"]);
	});

	it("19-4 an option taken out: the fields' choices", async () => {
		await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const after = changed({ ...base, options: ["article", "link"], fields: { link: base.fields.link } });
		const plan = await planSchema(db, schema, after);
		expect(plan.find((change) => change.field === "videoUrl")?.choices?.[0]).toEqual({
			do: "removeField",
			values: "clear",
		});
	});

	it("19-4 a field moved to another group keeps its name, and its values where that group's option is chosen: it is a line of its own that says how many entries lose the value (options.int.test.ts applies it)", async () => {
		await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const moved = changed({
			...base,
			fields: {
				video: { poster: base.fields.video?.poster },
				link: { ...base.fields.link, videoUrl: base.fields.video?.videoUrl },
			},
		});
		const plan = await planSchema(db, schema, moved);
		expect(plan.map((change) => [change.do, change.field, change.option, change.count])).toEqual([
			["moveField", "videoUrl", "link", 1],
		]);
		expect(plan[0]?.choices).toBeUndefined();
		expect(plan.some((change) => change.do === "removeField")).toBe(false);
	});

	it("19-1 a conditional field with a choice of its own in each language is to fix: one choice per entry, made on the source", () => {
		const perLocale = changed({ ...base, kind: "conditional", locale: "perLocale" });
		expect(checkSchema(perLocale)).toEqual([{ collection: "post", field: "format", code: "choicePerLocale" }]);
	});
});

describe("the assistant and the comparison keep to the choice (T195)", () => {
	it("19-5 a proposal for a field of an option that is not chosen is refused when it is applied, with the reason; the entry is as it was", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const monti = site();
		const proposal = await monti.proposals.create("c1", "링크를 채워 줘");
		const { itemId } = await monti.proposals.add(proposal, "entries.save", {
			id,
			version: (await stored(id)).version,
			values: { linkUrl: "https://example.dev" },
		});
		// It starts left out (its own write said it would be refused); put in all the same, the save still refuses it.
		await monti.run("proposals.include", { ids: [itemId], included: true }, { actor: "admin" });
		await monti.proposals.apply(proposal);
		const items = await db.selectFrom("monti_proposal_item").select(["state", "reason"]).execute();
		expect(items).toEqual([{ state: "failed", reason: { key: "entries.notChosen", values: { field: "linkUrl" } } }]);
		expect((await stored(id)).values).toEqual({ format: "video", videoUrl: "https://example.dev/v.mp4" });
	});

	it("19-5 T187 a proposal for a field of an option that is not chosen starts left out, with why; one that changes the choice says which values go with the option it leaves", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const monti = site();
		const version = (await stored(id)).version;
		const proposal = await monti.proposals.create("c1", "링크를 채워 줘");
		await monti.proposals.add(proposal, "entries.save", { id, version, values: { linkUrl: "https://example.dev" } });
		const view = await monti.proposals.view(proposal);
		expect(view?.items.map((item) => [item.included, item.blocked])).toEqual([
			[false, { key: "entries.optionNotChosen", values: { field: "format", option: "link" } }],
		]);
		// Left out, it is not counted among what applying would run, and applying does not try it.
		expect(view?.counts.toApply).toBe(0);

		const other = await monti.proposals.create("c1", "링크 글로 바꿔 줘");
		// The choice and the new option's field in one change: the field belongs to the option the change itself chooses.
		await monti.proposals.add(other, "entries.save", {
			id,
			version,
			values: { format: "link", linkUrl: "https://example.dev" },
		});
		const changed = await monti.proposals.view(other);
		expect(changed?.items.map((item) => [item.included, item.blocked])).toEqual([[true, null]]);
		expect(changed?.items[0]?.preview?.clears).toEqual([{ field: "videoUrl", value: "https://example.dev/v.mp4" }]);
	});

	it("19-5 the comparison counts the choice as the place that differs, not the fields of the option the draft no longer has chosen", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const compared = (await site().run(
			"entries.compare",
			{ id, values: { format: "link", linkUrl: "https://example.dev" } },
			admin,
		)) as { places: { place: string; mine: unknown; server: unknown }[] } | { place: string }[];
		const places = (Array.isArray(compared) ? compared : compared.places).map((each) => each.place);
		// One place: the two sides are different kinds of post, and their fields differ because of it.
		expect(places).toEqual(["values.format"]);

		// With the same option on both sides, its field is a place like any other.
		const same = (await site().run(
			"entries.compare",
			{ id, values: { videoUrl: "https://example.dev/other.mp4" } },
			admin,
		)) as { places: { place: string }[] };
		expect(same.places.map((each) => each.place)).toEqual(["values.videoUrl"]);
	});
});
