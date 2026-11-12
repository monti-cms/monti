import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { slugify } from "../entries/paths";
import { createReader } from "../entries/reader";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";

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
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true, from: "title" } },
		},
		memo: {
			kind: "document",
			path: "/memos/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const SECRET = "test-secret";
const site = () => createMonti({ db, schema, secret: SECRET });
type Written<Output> = { output: Output; activityId: string };
const write = async <Output = { id: string }>(name: string, input: unknown) =>
	(await site().run(name, input, { actor: "admin" })) as Written<Output>;
const read = <Output>(name: string, input: unknown) => site().run(name, input, { actor: "admin" }) as Promise<Output>;
type Node = { id: string; parentId: string | null; name: string; depth: number; count: number; published: number };
const tree = async (scope: unknown = { collection: "post" }) =>
	(await read<{ folders: Node[] }>("folders.tree", { scope })).folders;
const folder = async (name: string, parentId: string | null = null, scope: unknown = { collection: "post" }) =>
	(await write("folders.create", { scope, parentId, name })).output.id;

async function newPost(title: string, collection = "post") {
	return (await write("entries.create", { collection, locale: "ko", title, slug: slugify(title) })).output.id;
}
const entry = (id: string) => db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const move = (ids: string[], to: string | null) => write("entries.moveToFolder", { ids, folder: to });
const fromSite = (slug: string) =>
	createReader({ db, schema, secret: SECRET }).entry({ collection: "post", locale: "ko", slug });

/** A translation of an entry, in its translation group (doc 04 makes these; here it is put in directly). */
async function translation(of: string, locale: string) {
	const source = await entry(of);
	const id = `${of}-${locale}`;
	await db
		.insertInto("entries")
		.values({
			id,
			collection: source.collection,
			translation_group: source.translation_group,
			locale,
			slug: `${source.slug}-${locale}`,
			title: `${source.title} (${locale})`,
			folder_id: source.folder_id,
			values: "{}",
		})
		.execute();
	return id;
}

beforeEach(async () => {
	await sql`drop view if exists monti_post, monti_memo`.execute(db);
	for (const table of [
		"entries",
		"folders",
		"monti_proposal",
		"monti_delivery",
		"monti_activity",
		"schema_state",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("folders", () => {
	it("07-1 the same operations make, rename, move and remove folders of posts and of media", async () => {
		for (const scope of [{ collection: "post" }, "media"]) {
			const top = await folder("Blog Assets", null, scope);
			const inner = await folder("covers", null, scope);
			await write("folders.rename", { id: inner, name: "diagrams" });
			await write("folders.move", { id: inner, parentId: top });
			expect((await tree(scope)).map((node) => [node.name, node.depth])).toEqual([
				["Blog Assets", 0],
				["diagrams", 1],
			]);
			await write("trash.move", { rows: [{ kind: "folder", id: top }] });
			expect(await tree(scope)).toEqual([]);
		}
	});

	it("folders.tree gives a scope's folders as a tree, each counting its own entries and its subfolders' (and how many are published), trash left out", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await folder("diagrams", assets);
		const loose = await folder("Wallpapers");
		const memos = await folder("Memo box", null, { collection: "memo" });
		const [a, b, c] = [await newPost("A"), await newPost("B"), await newPost("C")];
		await translation(a, "en");
		await move([a], assets);
		await move([b, c], covers);
		await move([await newPost("Memo", "memo")], memos);
		await write("entries.publish", { ids: [b] });
		// A trashed folder and what is in it are not counted.
		const gone = await folder("Gone", assets);
		await move([await newPost("D")], gone);
		await write("trash.move", { rows: [{ kind: "folder", id: gone }] });

		expect((await tree()).map(({ name, depth, count, published }) => ({ name, depth, count, published }))).toEqual([
			{ name: "Blog Assets", depth: 0, count: 3, published: 1 },
			{ name: "covers", depth: 1, count: 2, published: 1 },
			{ name: "diagrams", depth: 1, count: 0, published: 0 },
			{ name: "Wallpapers", depth: 0, count: 0, published: 0 },
		]);
		expect((await tree()).find((node) => node.id === loose)?.parentId).toBeNull();
	});

	it("folders.create names a folder that is taken among its siblings with ' 2'", async () => {
		const top = await folder("새 폴더");
		const second = await write<{ name: string }>("folders.create", {
			scope: { collection: "post" },
			parentId: null,
			name: "새 폴더",
		});
		const inside = await write<{ name: string }>("folders.create", {
			scope: { collection: "post" },
			parentId: top,
			name: "새 폴더",
		});
		const otherCollection = await write<{ name: string }>("folders.create", {
			scope: { collection: "memo" },
			parentId: null,
			name: "새 폴더",
		});
		expect([second.output.name, inside.output.name, otherCollection.output.name]).toEqual([
			"새 폴더 2",
			"새 폴더",
			"새 폴더",
		]);
	});

	it("07-1 concurrent folder creation keeps live sibling names unique", async () => {
		const made = await Promise.all([
			write<{ name: string }>("folders.create", {
				scope: { collection: "post" },
				parentId: null,
				name: "새 폴더",
			}),
			write<{ name: string }>("folders.create", {
				scope: { collection: "post" },
				parentId: null,
				name: "새 폴더",
			}),
		]);
		expect(made.map((result) => result.output.name).sort()).toEqual(["새 폴더", "새 폴더 2"]);
	});

	it("folders.rename refuses a name a sibling has", async () => {
		await folder("2024");
		const other = await folder("2025");
		await expect(write("folders.rename", { id: other, name: "2024" })).rejects.toMatchObject({
			reason: { key: "folders.nameTaken" },
		});
	});

	it("folders.move refuses to put a folder inside itself or one of its own subfolders", async () => {
		const top = await folder("top");
		const child = await folder("child", top);
		const grandchild = await folder("grandchild", child);
		for (const into of [top, grandchild])
			await expect(write("folders.move", { id: top, parentId: into })).rejects.toMatchObject({
				reason: { key: "folders.intoItself" },
			});
		await expect(
			write("folders.move", { id: child, parentId: await folder("memo box", null, { collection: "memo" }) }),
		).rejects.toMatchObject({ reason: { key: "folders.otherScope" } });
	});

	it("entries.moveToFolder moves the whole translation group, and to the top level with null", async () => {
		const box = await folder("box");
		const post = await newPost("Hello");
		const english = await translation(post, "en");
		await move([english], box);
		expect([(await entry(post)).folder_id, (await entry(english)).folder_id]).toEqual([box, box]);
		await move([post], null);
		expect([(await entry(post)).folder_id, (await entry(english)).folder_id]).toEqual([null, null]);
		await expect(move([post], await folder("memo box", null, { collection: "memo" }))).rejects.toMatchObject({
			reason: { key: "folders.otherScope" },
		});
	});

	it("07-3 moving entries or a folder leaves the entries' addresses and publish state as they were", async () => {
		const box = await folder("box");
		const outer = await folder("outer");
		const post = await newPost("Hello");
		await write("entries.publish", { ids: [post] });
		const before = await entry(post);
		await move([post], box);
		await write("folders.move", { id: box, parentId: outer });
		const after = await entry(post);
		expect([after.slug, after.status, after.has_unpublished_changes]).toEqual([
			before.slug,
			before.status,
			before.has_unpublished_changes,
		]);
		expect(await fromSite("hello")).toMatchObject({ entry: { title: "Hello" } });
	});

	it("trash.move previews how many entries, subfolders and published entries go with the folder", async () => {
		const series = await folder("시리즈 원고");
		const inner = await folder("drafts", series);
		const [a, b, c] = [await newPost("A"), await newPost("B"), await newPost("C")];
		await move([a, b], series);
		await move([c], inner);
		await write("entries.publish", { ids: [a] });
		// The preview is what the assistant reads before proposing, and what the card shows.
		const monti = site();
		const { preview } = await monti.proposals.add(await monti.proposals.create("c-remove", "remove it"), "trash.move", {
			rows: [{ kind: "folder", id: series }],
		});
		// Three entries and two folders go; one published entry leaves the site.
		expect(preview?.summary).toEqual({
			key: "trash.movePreview",
			values: { count: 5, unpublished: 1, kept: 0 },
		});
	});

	it("07-3 removing a folder puts it, its subfolders and their entries in the trash; only the published ones go off the site", async () => {
		const series = await folder("시리즈 원고");
		const inner = await folder("drafts", series);
		const [published, draft, nested, outside] = [
			await newPost("Published"),
			await newPost("Draft"),
			await newPost("Nested"),
			await newPost("Outside"),
		];
		await move([published, draft], series);
		await move([nested], inner);
		await write("entries.publish", { ids: [published, outside] });

		await write("trash.move", { rows: [{ kind: "folder", id: series }] });

		const trashed = async (id: string) => (await entry(id)).trashed_at !== null;
		expect(await Promise.all([published, draft, nested, outside].map(trashed))).toEqual([true, true, true, false]);
		expect(await fromSite("published")).toBeNull();
		expect(await fromSite("outside")).toMatchObject({ entry: { title: "Outside" } });
		const folders = await db.selectFrom("folders").select(["id", "trashed_at"]).execute();
		expect(folders.every((row) => row.trashed_at !== null)).toBe(true);
		expect((await entry(outside)).slug).toBe("outside");
	});

	it("undoing a folder's removal brings the folder, its subfolders and their entries back as they were", async () => {
		const series = await folder("시리즈 원고");
		const inner = await folder("drafts", series);
		const [published, nested] = [await newPost("Published"), await newPost("Nested")];
		await move([published], series);
		await move([nested], inner);
		await write("entries.publish", { ids: [published] });

		const removed = await write("trash.move", { rows: [{ kind: "folder", id: series }] });
		await write("activity.undo", { id: removed.activityId });

		expect((await tree()).map(({ name, count }) => [name, count])).toEqual([
			["시리즈 원고", 2],
			["drafts", 1],
		]);
		expect((await entry(published)).status).toBe("published");
		expect(await fromSite("published")).toMatchObject({ entry: { title: "Published" } });
	});

	it("07-4 'make a folder and move these there' is one proposal; leaving out the first item leaves out the second", async () => {
		const posts = [await newPost("Old 1"), await newPost("Old 2")];
		const propose = async () => {
			const monti = site();
			const proposal = await monti.proposals.create("c-tidy", "move last year's posts into 2024");
			const made = await monti.proposals.add(proposal, "folders.create", {
				scope: { collection: "post" },
				parentId: null,
				name: "2024",
			});
			const moved = await monti.proposals.add(proposal, "entries.moveToFolder", {
				ids: posts,
				folder: { $item: made.itemId },
			});
			// One item per post: each can be taken or left (doc 10).
			expect(moved.itemIds).toHaveLength(2);
			return { proposal, made: made.itemId, moved: moved.itemIds };
		};

		const all = await propose();
		await site().proposals.apply(all.proposal);
		const [box] = await tree();
		expect(box).toMatchObject({ name: "2024", count: 2 });
		expect((await entry(posts[0] ?? "")).folder_id).toBe(box?.id);

		await move(posts, null);
		const part = await propose();
		const result = await site().proposals.apply(part.proposal, part.moved);
		expect(result.map((item) => item.state)).toEqual(["discarded", "skipped", "skipped"]);
		expect((await entry(posts[0] ?? "")).folder_id).toBeNull();
	});
});

describe("the list inside folders", () => {
	type Page = { rows: { title: string }[] };
	const titles = async (query: Record<string, unknown>) =>
		(await read<Page>("entries.query", { collection: "post", ...query })).rows.map((row) => row.title).sort();

	it("a folder lists only what sits right in it; a search or a filter in it looks through its subfolders too, and 'all' through the collection (T54)", async () => {
		const series = await folder("시리즈 원고");
		const inner = await folder("drafts", series);
		const [top, inSeries, inInner] = [
			await newPost("리액트 top"),
			await newPost("리액트 1편"),
			await newPost("리액트 2편"),
		];
		await move([inSeries], series);
		await move([inInner], inner);
		void top;

		expect(await titles({ folder: null })).toEqual(["리액트 top"]);
		expect(await titles({ folder: series })).toEqual(["리액트 1편"]);
		const search = { text: "리액트", in: "all" };
		expect(await titles({ folder: series, search })).toEqual(["리액트 1편", "리액트 2편"]);
		expect(await titles({ folder: series, filters: [{ on: "status", any: ["draft"] }] })).toEqual([
			"리액트 1편",
			"리액트 2편",
		]);
		expect(await titles({ folder: series, scope: "all", search })).toEqual(["리액트 1편", "리액트 2편", "리액트 top"]);
		// At the top level a search looks in every folder.
		expect(await titles({ folder: null, search })).toEqual(["리액트 1편", "리액트 2편", "리액트 top"]);
	});
});
