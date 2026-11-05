import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { runCli } from "../entry/cli";
import { createMonti, definePlugin, type Plugin } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import { slugify } from "./paths";
import { createReader } from "./reader";

const db = await testDatabase();

const schema = defineSchema({
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text", required: true, max: 120 },
				format: { kind: "select", options: ["memo", "essay"] },
			},
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const SECRET = "test-secret";
let clock = new Date("2026-10-01T09:00:00Z");
const site = (plugins: Plugin[] = []) => createMonti({ db, schema, plugins, secret: SECRET, now: () => clock });
const reader = () => createReader({ db, schema, secret: SECRET, now: () => clock });

type Written<Output> = { output: Output; activityId: string; versions: Record<string, number | null> };
const write = async <Output = { id: string }>(name: string, input: unknown, monti = site()) =>
	(await monti.run(name, input, { actor: "admin" })) as Written<Output>;
const read = <Output>(name: string, input: unknown, monti = site()) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;
type Got = {
	entry: { version: number; slug: string; status: string };
	state: string;
	published: { slug: string; publishedAt: Date } | null;
	tasks: { code: string; field?: string; blocking: boolean }[];
};
const get = (id: string, monti = site()) => read<Got>("entries.get", { id }, monti);
const version = async (id: string) => (await get(id)).entry.version;

async function newPost(title: string, values: Record<string, unknown> = { summary: "short" }) {
	return (await write("entries.create", { collection: "post", locale: "ko", title, slug: slugify(title), values }))
		.output.id;
}
const fromSite = (slug: string) => reader().entry({ collection: "post", locale: "ko", slug });

beforeEach(async () => {
	clock = new Date("2026-10-01T09:00:00Z");
	await sql`drop view if exists monti_post, monti_tag`.execute(db);
	for (const table of ["entries", "schema_state", "schema_changes", "monti_delivery", "monti_activity"] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("writing and publishing", () => {
	it("02-1 a new entry is saved, blocked by its to-do list, published, changed and published again with only these operations", async () => {
		const id = (await write("entries.create", { collection: "post", locale: "ko" })).output.id;
		expect((await get(id)).state).toBe("draft");

		await write("entries.save", { id, version: await version(id), title: "첫 번째 글", values: { format: "memo" } });
		// No address yet: publishing does not make one, it is a to-do like an empty required field (2026-11-06).
		await expect(write("entries.publish", { ids: [id] })).rejects.toMatchObject({
			reason: { key: "entries.publishBlocked", values: { count: 2 } },
		});
		expect((await get(id)).tasks).toEqual([
			expect.objectContaining({ code: "required", field: "slug", blocking: true }),
			expect.objectContaining({ code: "required", field: "summary" }),
		]);

		await write("entries.save", {
			id,
			version: await version(id),
			slug: "첫-번째-글",
			values: { summary: "A first post." },
		});
		await write("entries.publish", { ids: [id] });
		const published = await get(id);
		expect(published.state).toBe("published");
		expect(published.entry.slug).toBe("첫-번째-글");
		expect(published.published?.publishedAt).toEqual(clock);

		await write("entries.save", { id, version: await version(id), values: { summary: "Rewritten." } });
		expect((await get(id)).state).toBe("changed");
		// Saving it back to what the site shows is no longer a change.
		await write("entries.save", { id, version: await version(id), values: { summary: "A first post." } });
		expect((await get(id)).state).toBe("published");

		await write("entries.save", { id, version: await version(id), values: { summary: "Rewritten." } });
		clock = new Date("2026-10-26T09:00:00Z");
		await write("entries.publish", { ids: [id] });
		expect((await get(id)).published?.publishedAt).toEqual(new Date("2026-10-01T09:00:00Z"));
		await write("entries.save", { id, version: await version(id), values: { summary: "Again." } });
		await write("entries.publish", { ids: [id], date: "today" });
		expect((await get(id)).published?.publishedAt).toEqual(clock);
		expect((await get(id)).state).toBe("published");
	});

	it("02-1 publishing emits the paths the site must refresh; saving emits only a save", async () => {
		const sent: { type: string; paths?: string[] }[] = [];
		const monti = createMonti({
			db,
			schema,
			receivers: [{ destination: "test", send: async (event) => void sent.push(event) }],
		});
		const id = await newPost("Hello");
		await write("entries.save", { id, version: await version(id), title: "Hello there", slug: "hello-there" }, monti);
		await write("entries.publish", { ids: [id] }, monti);
		expect(sent).toEqual([
			expect.objectContaining({ type: "entry.saved" }),
			expect.objectContaining({ type: "entry.published", paths: ["/posts/hello-there"] }),
		]);
	});

	it("02-1 a draft cannot hold a value the schema has no room for", async () => {
		const id = await newPost("Hello");
		const at = await version(id);
		await expect(write("entries.save", { id, version: at, values: { cover: "x" } })).rejects.toMatchObject({
			reason: { key: "entries.unknownField" },
		});
		await expect(write("entries.save", { id, version: at, values: { format: "poem" } })).rejects.toMatchObject({
			reason: { key: "entries.badOption" },
		});
		await expect(write("entries.save", { id, version: at, slug: "Not A Slug" })).rejects.toMatchObject({
			reason: { key: "entries.badSlug" },
		});
		await write("entries.save", { id, version: at, values: { format: null } });
		expect((await read<{ entry: { values: object } }>("entries.get", { id })).entry.values).toEqual({
			summary: "short",
		});
	});
});

describe("saves never overwrite each other", () => {
	it("02-2 a save with an old version is refused from the admin API, the CLI and an assistant proposal", async () => {
		const id = await newPost("Hello");
		const old = await version(id);
		await write("entries.save", { id, version: old, title: "Saved in another tab" });

		const monti = site();
		const response = await signedInApi(monti)(
			new Request("https://site.test/api/operations/entries.save", {
				method: "POST",
				body: JSON.stringify({ input: { id, version: old, title: "Mine" } }),
			}),
		);
		expect(response.status).toBe(409);

		const err: string[] = [];
		const args = ["entries.save", "--id", id, "--version", String(old), "--title", "From the terminal"];
		expect(await runCli(monti, args, { out: () => {}, err: (line) => err.push(line) })).toBe(1);
		// Without a version there is no save at all.
		expect(await runCli(monti, ["entries.save", "--id", id, "--title", "x"], { out: () => {}, err: () => {} })).toBe(1);

		const proposalId = await monti.proposals.create("c1", "retitle it");
		await monti.proposals.add(proposalId, "entries.save", { id, version: await version(id), title: "Proposed" });
		await write("entries.save", { id, version: await version(id), title: "Saved before the proposal was applied" });
		const [item] = await monti.proposals.apply(proposalId);
		expect(item.state).toBe("stale");

		expect((await read<{ entry: { title: string } }>("entries.get", { id })).entry.title).toBe(
			"Saved before the proposal was applied",
		);
	});

	it("02-2 compare lists the places where a draft differs from the latest save", async () => {
		const id = await newPost("Hello", { summary: "short", format: "memo" });
		const compared = await read<{ places: { place: string; mine: unknown; server: unknown }[] }>("entries.compare", {
			id,
			title: "Hello",
			values: { summary: "longer", format: null },
			doc: { type: "doc", blocks: [{ id: "b_1", type: "paragraph" }] },
		});
		expect(compared.places).toEqual([
			{ place: "values.summary", mine: "longer", server: "short" },
			{ place: "values.format", mine: undefined, server: "memo" },
			{ place: "doc.b_1", mine: { id: "b_1", type: "paragraph" }, server: undefined },
		]);
	});
});

describe("what the site reads", () => {
	it("02-3 the site reads only what was published; a preview link opens the working copy until it expires", async () => {
		const id = await newPost("Hello", { summary: "published summary" });
		expect(await reader().entries({ collection: "post", locale: "ko" })).toEqual([]);
		await write("entries.publish", { ids: [id] });
		await write("entries.save", { id, version: await version(id), values: { summary: "unsaved to the site" } });

		expect(await fromSite("hello")).toMatchObject({ entry: { values: { summary: "published summary" } } });
		expect(await reader().entries({ collection: "post", locale: "ko" })).toHaveLength(1);

		const { token } = await read<{ token: string; path: string }>("entries.previewLink", { id });
		const preview = (where: object) => reader().entry({ collection: "post", locale: "ko", slug: "hello", ...where });
		expect(await preview({ preview: token })).toMatchObject({ entry: { values: { summary: "unsaved to the site" } } });
		expect(await preview({ preview: `${token}x` })).toMatchObject({
			entry: { values: { summary: "published summary" } },
		});
		expect(
			await createReader({ db, schema, secret: "other" }).entry({
				collection: "post",
				locale: "ko",
				slug: "hello",
				preview: token,
			}),
		).toMatchObject({
			entry: { values: { summary: "published summary" } },
		});
		clock = new Date(clock.getTime() + 61 * 60_000);
		expect(await preview({ preview: token })).toMatchObject({ entry: { values: { summary: "published summary" } } });
	});

	it("02-3 the site reads only the fields the schema has, even before the database follows a change", async () => {
		const id = await newPost("Hello", { summary: "s", format: "memo" });
		await write("entries.publish", { ids: [id] });
		const { format: _gone, ...fields } = schema.collections.post.fields;
		const newCode = { collections: { ...schema.collections, post: { ...schema.collections.post, fields } } };
		const site = createReader({ db, schema: newCode });
		const found = (await site.entry({ collection: "post", locale: "ko", slug: "hello" })) as {
			entry: { values: object };
		};
		expect(found.entry.values).toEqual({ summary: "s" });
		expect((await site.entries({ collection: "post", locale: "ko" }))[0].values).toEqual({ summary: "s" });
	});

	it("02-3 a new entry with neither title nor body has no preview", async () => {
		const id = (await write("entries.create", { collection: "post", locale: "ko" })).output.id;
		await expect(read("entries.previewLink", { id })).rejects.toMatchObject({
			reason: { key: "entries.nothingToPreview" },
		});
	});

	it("02-3 a removed field's values leave what the site shows too, and the entry stays unchanged", async () => {
		const id = await newPost("Hello", { summary: "s", format: "memo" });
		await write("entries.publish", { ids: [id] });
		const { format: _gone, ...fields } = schema.collections.post.fields;
		const without = { collections: { ...schema.collections, post: { ...schema.collections.post, fields } } };
		await migrateContent(db, without, [
			{ id: "1-remove-format", steps: [{ do: "removeField", collection: "post", field: "format", values: "clear" }] },
		]);
		const copy = await db.selectFrom("entry_published").select("values").where("entry_id", "=", id).executeTakeFirst();
		expect(copy?.values).toEqual({ summary: "s" });
		expect((await get(id)).state).toBe("published");
		await write("entries.save", { id, version: await version(id), title: "Hello" });
		expect((await get(id)).state).toBe("published");
	});
});

describe("one to-do list", () => {
	const altText = definePlugin({
		name: "alt-text",
		publishChecks: [
			(entry) =>
				entry.values.summary === "has an image"
					? [{ code: "altText", blocking: true, message: { key: "altText.missing" } }]
					: [],
		],
	});

	it("02-4 the to-do list, the publish button and publishing many from the list read the same check, plugins' rows included", async () => {
		const monti = site([altText]);
		const ready = await newPost("Ready");
		const missing = await newPost("Missing", { format: "memo" });
		const image = await newPost("Image", { summary: "has an image" });

		const list = await read<{ blocking: number; tasks: { code: string }[] }>(
			"entries.checkPublish",
			{ id: image },
			monti,
		);
		expect(list.tasks.map((task) => task.code)).toEqual(["altText"]);
		expect((await get(image, monti)).tasks).toEqual(list.tasks);
		await expect(write("entries.publish", { ids: [image] }, monti)).rejects.toMatchObject({
			reason: { key: "entries.publishBlocked", values: { count: list.blocking } },
		});

		const proposalId = await monti.proposals.create("c1", "publish all three");
		const { preview } = await monti.proposals.add(proposalId, "entries.publish", { ids: [ready, missing, image] });
		expect(preview?.changes).toEqual([{ kind: "entry", id: ready }]);
		expect(preview?.blocked?.map((row) => row.ref.id).sort()).toEqual([missing, image].sort());

		const result = await write<{ published: string[]; blocked: string[] }>(
			"entries.publish",
			{ ids: [ready, missing, image] },
			monti,
		);
		expect(result.output).toEqual({ published: [ready], blocked: [missing, image] });
		await expect(write("entries.publish", { ids: [missing, image] }, monti)).rejects.toMatchObject({
			reason: { key: "entries.nothingToPublish" },
		});
	});

	it("02-4 items are not published: they have no drafts", async () => {
		const id = (await write("entries.create", { collection: "tag", locale: "ko", title: "React" })).output.id;
		await expect(write("entries.publish", { ids: [id] })).rejects.toMatchObject({
			reason: { key: "entries.notDocument" },
		});
	});
});

describe("published paths", () => {
	it("02-5 changing a published slug sends the old one on; an empty slug blocks the publish and is never made", async () => {
		const first = await newPost("Hello");
		const second = (
			await write("entries.create", { collection: "post", locale: "ko", title: "Hello", values: { summary: "s" } })
		).output.id;
		const result = await write<{ published: string[]; blocked: string[] }>("entries.publish", { ids: [first, second] });
		expect(result.output).toEqual({ published: [first], blocked: [second] });
		expect((await get(second)).entry.slug).toBe("");
		expect((await get(second)).tasks).toEqual([
			expect.objectContaining({ code: "required", field: "slug", blocking: true }),
		]);
		await write("entries.save", { id: second, version: await version(second), slug: "hello-2" });
		await write("entries.publish", { ids: [second] });
		expect((await get(first)).entry.slug).toBe("hello");

		await write("entries.save", { id: first, version: await version(first), slug: "hello-world" });
		expect(await fromSite("hello")).toMatchObject({ entry: { id: first } });
		await write("entries.publish", { ids: [first] });
		expect(await fromSite("hello")).toEqual({ redirect: "/posts/hello-world" });
		await write("entries.save", { id: first, version: await version(first), slug: "hi" });
		await write("entries.publish", { ids: [first] });
		expect(await fromSite("hello")).toEqual({ redirect: "/posts/hi" });
		expect(await fromSite("hello-world")).toEqual({ redirect: "/posts/hi" });

		// Another entry published under an old path takes it over.
		await write("entries.save", { id: second, version: await version(second), slug: "hello" });
		await write("entries.publish", { ids: [second] });
		expect(await fromSite("hello")).toMatchObject({ entry: { id: second } });
		expect(await fromSite("hello-2")).toEqual({ redirect: "/posts/hello" });
	});

	it("02-5 of two entries publishing under one slug together, the second is left for its to-do list", async () => {
		const first = await newPost("One");
		const second = await newPost("Two");
		for (const id of [first, second]) await write("entries.save", { id, version: await version(id), slug: "same" });
		const result = await write<{ published: string[]; blocked: string[] }>("entries.publish", { ids: [first, second] });
		expect(result.output).toEqual({ published: [first], blocked: [second] });
		expect((await get(second)).tasks).toEqual([expect.objectContaining({ code: "slugTaken" })]);
	});

	it("02-5 a slug another entry is published under blocks the publish", async () => {
		const first = await newPost("Hello");
		await write("entries.publish", { ids: [first] });
		const second = await newPost("Other");
		await write("entries.save", { id: second, version: await version(second), slug: "hello" });
		expect((await get(second)).tasks).toEqual([expect.objectContaining({ code: "slugTaken", blocking: true })]);
	});
});

describe("archive", () => {
	it("02-6 an archived entry leaves the site and cannot be changed; unarchived, it is a draft until published again", async () => {
		const id = await newPost("Hello");
		await write("entries.publish", { ids: [id] });
		await write("entries.archive", { ids: [id] });
		expect((await get(id)).state).toBe("archived");
		expect(await fromSite("hello")).toBeNull();

		await expect(write("entries.save", { id, version: await version(id), title: "x" })).rejects.toMatchObject({
			reason: { key: "entries.archived" },
		});
		const monti = site();
		const proposalId = await monti.proposals.create("c1", "retitle it");
		await expect(
			monti.proposals.add(proposalId, "entries.save", { id, version: await version(id), title: "x" }),
		).rejects.toMatchObject({ reason: { key: "entries.archived" } });

		await write("entries.unarchive", { ids: [id] });
		expect((await get(id)).state).toBe("draft");
		expect(await fromSite("hello")).toBeNull();
		await write("entries.publish", { ids: [id] });
		expect(await fromSite("hello")).toMatchObject({ entry: { id } });
	});
});

describe("undo", () => {
	it("02-7 undoing a publish puts the former published copy and path back on the site", async () => {
		const id = await newPost("Hello", { summary: "first" });
		await write("entries.publish", { ids: [id] });
		await write("entries.save", { id, version: await version(id), slug: "renamed", values: { summary: "second" } });
		const republished = await write("entries.publish", { ids: [id] });
		expect(await fromSite("hello")).toEqual({ redirect: "/posts/renamed" });

		await write("activity.undo", { id: republished.activityId });
		expect(await fromSite("hello")).toMatchObject({ entry: { values: { summary: "first" } } });
		expect(await fromSite("renamed")).toBeNull();
		expect((await get(id)).state).toBe("changed");
	});

	it("02-7 a duplicate is a new draft with an empty slug, and undoing it removes it", async () => {
		const id = await newPost("Hello");
		await write("entries.publish", { ids: [id] });
		const copy = await write("entries.duplicate", { id });
		expect((await get(copy.output.id)).entry).toMatchObject({ slug: "", status: "draft" });
		await write("activity.undo", { id: copy.activityId });
		await expect(get(copy.output.id)).rejects.toMatchObject({ reason: { key: "entries.unknown" } });
	});
});
