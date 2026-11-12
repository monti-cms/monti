import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { checkSchema, defineSchema, notChosenFields, type Schema, storedFields } from "../schema/define";
import { planSchema } from "../schema/plan";
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
		).toEqual(expect.arrayContaining(["inner:nestedConditional", "address:nestedConditional"]));
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

	it("19-4 an option taken out puts its group's fields in the review as removed fields, and says how many entries had it chosen", async () => {
		await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const after = changed({ ...base, options: ["article", "link"], fields: { link: base.fields.link } });
		const plan = await planSchema(db, schema, after);
		expect(plan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ do: "removeField", field: "videoUrl", count: 1 }),
				expect.objectContaining({ do: "removeField", field: "poster", count: 0 }),
				expect.objectContaining({ do: "changeField", field: "format", count: 1 }),
			]),
		);
		expect(plan.find((change) => change.field === "videoUrl")?.choices?.[0]).toEqual({
			do: "removeField",
			values: "clear",
		});
	});

	it("19-4 a field moved to another group, and fields gathered under a new conditional field, keep their names and so their values", async () => {
		await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const moved = changed({
			...base,
			fields: {
				video: { poster: base.fields.video?.poster },
				link: { ...base.fields.link, videoUrl: base.fields.video?.videoUrl },
			},
		});
		const plan = await planSchema(db, schema, moved);
		expect(plan.map((change) => [change.do, change.field])).toEqual([["changeField", "videoUrl"]]);
		expect(plan[0]?.choices).toBeUndefined();

		// `summary` gathered into a group of a new conditional field: nothing is asked about its values.
		const { summary, ...rest } = post.fields;
		const gathered: Schema = {
			...schema,
			collections: {
				post: {
					...post,
					fields: { ...rest, kind: { kind: "conditional", options: ["a", "b"], fields: { a: { summary } } } } as never,
				},
			},
		};
		const added = await planSchema(db, schema, gathered);
		expect(added.map((change) => [change.do, change.field])).toEqual(
			expect.arrayContaining([
				["addField", "kind"],
				["changeField", "summary"],
			]),
		);
		expect(added.some((change) => change.do === "removeField")).toBe(false);
	});
});

describe("the assistant and the comparison keep to the choice (T195)", () => {
	it("19-5 a proposal for a field of an option that is not chosen is refused when it is applied, with the reason; the entry is as it was", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const monti = site();
		const proposal = await monti.proposals.create("c1", "링크를 채워 줘");
		await monti.proposals.add(proposal, "entries.save", {
			id,
			version: (await stored(id)).version,
			values: { linkUrl: "https://example.dev" },
		});
		await monti.proposals.apply(proposal);
		const items = await db.selectFrom("monti_proposal_item").select(["state", "reason"]).execute();
		expect(items).toEqual([{ state: "failed", reason: { key: "entries.notChosen", values: { field: "linkUrl" } } }]);
		expect((await stored(id)).values).toEqual({ format: "video", videoUrl: "https://example.dev/v.mp4" });
	});

	it("19-5 the comparison counts the choice as the place that differs, not the fields of the option the draft no longer has chosen", async () => {
		const id = await newPost({ format: "video", videoUrl: "https://example.dev/v.mp4" });
		const compared = (await site().run(
			"entries.compare",
			{ id, values: { format: "link", linkUrl: "https://example.dev" } },
			admin,
		)) as { places: { place: string; mine: unknown; server: unknown }[] } | { place: string }[];
		const places = (Array.isArray(compared) ? compared : compared.places).map((each) => each.place);
		expect(places).toContain("values.format");
		expect(places).toContain("values.linkUrl");
		expect(places).not.toContain("values.videoUrl");
	});
});
