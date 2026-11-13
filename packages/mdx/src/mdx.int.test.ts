import { createMonti, defineBlock, defineSchema, type Imported, type Inspected, migrateContent } from "@monti-cms/core";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { sql, testDatabase } from "../../core/src/__test__/database";
import { mdx } from "./index";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text" },
				tags: { kind: "relation", to: "tag", many: true },
			},
		},
		tag: { kind: "item", fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } } },
	},
});

const callout = defineBlock({
	type: "callout",
	label: "Callout",
	description: "A highlighted note.",
	menu: "insert",
	holds: "blocks",
	attrs: z.object({ tone: z.string().optional() }),
});

const site = (plugins = [mdx()]) => createMonti({ db, schema, plugins, blocks: [callout] });
const run = <Output>(monti: ReturnType<typeof site>, name: string, input: unknown) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

const files = [
	{
		name: "posts/autumn-hike.mdx",
		text: [
			"---",
			"title: 가을 산행",
			"description: 산에 다녀왔다",
			"tags: [여행, 산]",
			"layout: post",
			"---",
			"",
			'import Tweet from "../components/tweet"',
			"",
			"단풍이 시작됐다.",
			"",
			':::callout{tone="info"}',
			"물을 챙긴다.",
			":::",
			"",
			'<Tweet id="123" />',
			"",
			"```ts",
			"const a = 1; // [!code ++]",
			"```",
		].join("\n"),
	},
	{ name: "posts/no-front-matter.md", text: "제목 없는 글의 첫 문단.\n" },
];

beforeEach(async () => {
	await sql`truncate entries, entry_links, monti_activity, collection_admin_values cascade`.execute(db);
	await migrateContent(db, schema, []);
});

describe("the MDX plugin on a site (T34)", () => {
	it("14-1 the import reads .md and .mdx: front matter keys to map, the site's own block from its directive, a component kept and named", async () => {
		const monti = site();
		const seen = await run<Extract<Inspected, { kind: "monti" | "files" }>>(monti, "data.inspect", {
			collection: "post",
			files,
			has: [],
		});
		expect(seen).toMatchObject({ kind: "files", found: 2, same: 0, unfit: 0 });
		expect(seen.keys.map((key) => [key.key, key.field])).toEqual([
			["title", "title"],
			["description", null],
			["tags", "tags"],
			["layout", null],
		]);
		expect(seen.unknown).toEqual([{ name: "Tweet", entries: 1 }]);

		const done = await run<{ output: Imported }>(monti, "data.import", {
			collection: "post",
			name: "blog.zip",
			files,
			has: [],
			mapping: { description: "summary" },
		});
		expect(done.output).toMatchObject({ imported: 2, items: 2 });
		const rows = await db
			.selectFrom("entries")
			.select(["id", "title", "slug", "status", "values", "doc"])
			.where("collection", "=", "post")
			.orderBy("created_at")
			.execute();
		expect(rows.map((row) => [row.title, row.slug, row.status])).toEqual([
			["가을 산행", "autumn-hike", "draft"],
			// With no title in the file, the file's name is the entry's.
			["no-front-matter", "no-front-matter", "draft"],
		]);
		expect(rows[0].values).toMatchObject({ summary: "산에 다녀왔다" });
		const blocks = (
			rows[0].doc as { blocks: { type: string; attrs?: Record<string, unknown>; content?: { text: string }[] }[] }
		).blocks;
		expect(blocks.map((block) => [block.type, block.attrs?.language ?? block.attrs?.tone])).toEqual([
			["paragraph", undefined],
			["callout", "info"],
			["codeBlock", "mdx"],
			["codeBlock", "ts"],
		]);
		// The highlighter's notation is still in the code, as it was written (T79).
		expect(blocks[3].content?.[0].text).toBe("const a = 1; // [!code ++]");

		// The kept component is a to-do on its entry that does not stop a publish.
		const read = await run<{ tasks: { code: string; blocking: boolean; message: { values: { text: string } } }[] }>(
			monti,
			"entries.get",
			{
				id: rows[0].id,
			},
		);
		expect(read.tasks.filter((task) => task.code === "mdx.unknown")).toEqual([
			expect.objectContaining({
				blocking: false,
				message: { key: "plugins.says", values: { text: "모르는 컴포넌트 Tweet" } },
			}),
		]);
	});

	it("14-2 the same files on a site without the plugin are not read", async () => {
		const bare = site([]);
		expect(await run(bare, "data.inspect", { collection: "post", files, has: [] })).toEqual({
			kind: "unreadable",
			reason: { key: "data.needsMdx" },
		});
		expect(await db.selectFrom("entries").select("id").execute()).toEqual([]);
	});
});
