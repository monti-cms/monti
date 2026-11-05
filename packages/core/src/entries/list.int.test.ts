import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { callAgentTool } from "../entry/tools";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { Facet, ListColumn, ListRow } from "./list";

const db = await testDatabase();

const schema = defineSchema({
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text" },
				format: { kind: "select", options: ["memo", "essay"] },
				category: { kind: "relation", to: "category" },
				tags: { kind: "relation", to: "tag", many: true },
				cover: { kind: "media" },
			},
		},
		memo: {
			kind: "document",
			path: "/notes/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
		category: {
			kind: "item",
			path: "/categories/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				about: { kind: "text" },
			},
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

let clock = new Date("2026-10-20T03:00:00Z");
const site = () => createMonti({ db, schema, now: () => clock });
const run = <Output>(name: string, input: unknown, actor: "admin" | "assistant" = "admin") =>
	site().run(name, input, { actor }) as Promise<Output>;
type Page = { rows: ListRow[]; total: number };
const query = (input: Record<string, unknown>) => run<Page>("entries.query", { collection: "post", ...input });
const titles = async (input: Record<string, unknown>) => (await query(input)).rows.map((row) => row.title);
const facets = async (column: string, input: Record<string, unknown> = {}) =>
	(await run<{ values: Facet[] }>("entries.facets", { collection: "post", column, ...input })).values;
const columns = async (collection: string) =>
	(await run<{ columns: ListColumn[]; pageSize: number }>("list.columns", { collection })).columns;

async function create(collection: string, title: string, values: Record<string, unknown> = {}, doc?: unknown) {
	const created = (
		await run<{ output: { id: string } }>("entries.create", { collection, locale: "ko", title, values, doc })
	).output.id;
	return created;
}
const groupOf = async (id: string) =>
	(await db.selectFrom("entries").select("translation_group").where("id", "=", id).executeTakeFirstOrThrow())
		.translation_group;
const touch = (id: string, at: string) =>
	db
		.updateTable("entries")
		.set({ updated_at: new Date(at) })
		.where("id", "=", id)
		.execute();
/** Relation values go through doc 08's `relations.edit`; until then the test writes the links the list reads. */
async function link(id: string, field: string, targets: string[]) {
	const from = await groupOf(id);
	for (const [position, target] of targets.entries())
		await db
			.insertInto("entry_links")
			.values({ from_group: from, field, to_group: await groupOf(target), position })
			.execute();
}
const paragraph = (text: string) => ({
	type: "doc",
	blocks: [{ id: `b_${text.length}`, type: "paragraph", content: [{ type: "text", text }] }],
});

let ids: Record<string, string>;

beforeEach(async () => {
	clock = new Date("2026-10-20T03:00:00Z");
	for (const table of ["entry_links", "entries", "collection_admin_values", "monti_activity"] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
	const dev = await create("category", "개발");
	const life = await create("category", "일상");
	const react = await create("tag", "리액트");
	const perf = await create("tag", "성능");
	const unused = await create("tag", "안 쓰는 태그");
	const first = await create(
		"post",
		"첫 번째 글",
		{ summary: "처음", format: "essay" },
		paragraph("서버 컴포넌트 이야기"),
	);
	const rsc = await create("post", "리액트 서버 컴포넌트 다시 보기", { format: "memo" });
	const photos = await create("post", "가을 사진 정리", { cover: "media-1" });
	const old = await create("post", "보관한 글");
	await run("entries.publish", { ids: [first] });
	await run("entries.save", { id: first, version: 2, values: { summary: "고침" } });
	await run("entries.archive", { ids: [old] });
	await link(first, "category", [dev]);
	await link(first, "tags", [react]);
	await link(rsc, "category", [dev]);
	await link(rsc, "tags", [react, perf]);
	await link(photos, "category", [life]);
	// A translation of the first post: the same group, so the list still shows one row.
	const english = await create("post", "First post");
	await db
		.updateTable("entries")
		.set({ translation_group: await groupOf(first), locale: "en", created_at: new Date("2026-12-01T00:00:00Z") })
		.where("id", "=", english)
		.execute();
	await touch(first, "2026-10-01T09:00:00Z");
	await touch(rsc, "2026-10-19T16:00:00Z");
	await touch(photos, "2026-10-20T01:00:00Z");
	ids = { dev, life, react, perf, unused, first, rsc, photos, old, english };
});

describe("the list query", () => {
	it("06-1 one row per translation group, newest change first, with its languages and relation values; archived rows only on request", async () => {
		const { rows, total } = await query({});
		expect(total).toBe(3);
		expect(rows.map((row) => row.title)).toEqual(["가을 사진 정리", "리액트 서버 컴포넌트 다시 보기", "첫 번째 글"]);
		const first = rows[2];
		expect(first).toMatchObject({ state: "changed", locale: "ko", locales: ["ko", "en"] });
		expect(first.relations).toEqual({
			category: [{ id: await groupOf(ids.dev), title: "개발" }],
			tags: [{ id: await groupOf(ids.react), title: "리액트" }],
		});
		expect(rows[1].relations.tags.map((tag) => tag.title)).toEqual(["리액트", "성능"]);

		expect(await titles({ filters: [{ on: "status", any: ["archived"] }] })).toEqual(["보관한 글"]);
		expect(await titles({ filters: [{ on: "status", any: ["changed", "draft"] }] })).toHaveLength(3);
	});

	it("06-1 search finds Korean everywhere, or only in the title, the address or the body", async () => {
		expect(await titles({ search: { text: "컴포넌트", in: "title" } })).toEqual(["리액트 서버 컴포넌트 다시 보기"]);
		expect(await titles({ search: { text: "컴포넌트", in: "body" } })).toEqual(["첫 번째 글"]);
		// Publishing made the first post's address from its title: "첫-번째-글".
		expect(await titles({ search: { text: "-번째", in: "slug" } })).toEqual(["첫 번째 글"]);
		expect(await titles({ search: { text: "-번째", in: "title" } })).toEqual([]);
		expect(await titles({ search: { text: "컴포넌트", in: "all" } })).toEqual([
			"리액트 서버 컴포넌트 다시 보기",
			"첫 번째 글",
		]);
		expect(await titles({ search: { text: "100%", in: "all" } })).toEqual([]);
	});

	it("06-1 filters on relation values (none included), select options and empty fields, all of them at once", async () => {
		const react = await groupOf(ids.react);
		expect(await titles({ filters: [{ on: "relation", field: "tags", any: [react] }] })).toEqual([
			"리액트 서버 컴포넌트 다시 보기",
			"첫 번째 글",
		]);
		expect(await titles({ filters: [{ on: "relation", field: "tags", any: [null] }] })).toEqual(["가을 사진 정리"]);
		expect(await titles({ filters: [{ on: "select", field: "format", any: ["memo", null] }] })).toEqual([
			"가을 사진 정리",
			"리액트 서버 컴포넌트 다시 보기",
		]);
		expect(await titles({ filters: [{ on: "empty", field: "summary" }] })).toEqual([
			"가을 사진 정리",
			"리액트 서버 컴포넌트 다시 보기",
		]);
		expect(
			await titles({
				filters: [
					{ on: "relation", field: "tags", any: [react] },
					{ on: "empty", field: "summary" },
				],
			}),
		).toEqual(["리액트 서버 컴포넌트 다시 보기"]);
		await expect(query({ filters: [{ on: "empty", field: "title" }] })).rejects.toMatchObject({
			reason: { key: "list.badFilter" },
		});
	});

	it("06-1 a group filter finds the entries a body link or a relation points at, one row per group", async () => {
		const groups = [await groupOf(ids.first), await groupOf(ids.rsc)];
		expect(await titles({ filters: [{ on: "group", any: groups }] })).toEqual([
			"리액트 서버 컴포넌트 다시 보기",
			"첫 번째 글",
		]);
	});

	it("06-1 date filters count days in the admin's time zone", async () => {
		// 03:00 UTC is noon in Seoul: "today" there began at 15:00 UTC the day before.
		expect(await titles({ filters: [{ on: "date", field: "updatedAt", range: "today" }] })).toEqual(["가을 사진 정리"]);
		expect(
			await titles({ filters: [{ on: "date", field: "updatedAt", range: "today" }], timeZone: "Asia/Seoul" }),
		).toEqual(["가을 사진 정리", "리액트 서버 컴포넌트 다시 보기"]);
		expect(await titles({ filters: [{ on: "date", field: "updatedAt", range: "7d" }] })).toHaveLength(2);
		const range = { from: "2026-10-01", to: "2026-10-19" };
		expect(await titles({ filters: [{ on: "date", field: "updatedAt", range }] })).toEqual([
			"리액트 서버 컴포넌트 다시 보기",
			"첫 번째 글",
		]);
		expect(await titles({ filters: [{ on: "date", field: "updatedAt", range }], timeZone: "Asia/Seoul" })).toEqual([
			"첫 번째 글",
		]);
		expect(await titles({ filters: [{ on: "date", field: "publishedAt", range: "30d" }] })).toEqual(["첫 번째 글"]);
	});

	it("06-1 sorts by title or a date either way, and pages with the total", async () => {
		expect(await titles({ sort: { by: "title", dir: "asc" } })).toEqual([
			"가을 사진 정리",
			"리액트 서버 컴포넌트 다시 보기",
			"첫 번째 글",
		]);
		expect(await titles({ sort: { by: "updatedAt", dir: "asc" } })).toEqual([
			"첫 번째 글",
			"리액트 서버 컴포넌트 다시 보기",
			"가을 사진 정리",
		]);
		const second = await query({ page: 2, pageSize: 2 });
		expect(second).toMatchObject({ total: 3, rows: [{ title: "첫 번째 글" }] });
		expect(await query({ page: 9, pageSize: 2 })).toEqual({ total: 3, rows: [] });
	});

	it("06-1 a column's counts leave out its own filter and keep the others", async () => {
		const tags = await facets("tags", {
			filters: [
				{ on: "relation", field: "tags", any: [await groupOf(ids.perf)] },
				{ on: "select", field: "format", any: ["memo", "essay"] },
			],
		});
		expect(tags.map((facet) => [facet.label ?? facet.value, facet.count])).toEqual([
			[null, 0],
			["리액트", 2],
			["성능", 1],
			["안 쓰는 태그", 0],
		]);
		expect(await facets("status")).toEqual([
			{ value: "published", count: 0 },
			{ value: "changed", count: 1 },
			{ value: "draft", count: 2 },
			{ value: "archived", count: 1 },
		]);
		expect((await facets("format")).map((facet) => [facet.value, facet.count])).toEqual([
			[null, 1],
			["memo", 1],
			["essay", 1],
		]);
		expect(await facets("summary")).toEqual([{ value: "empty", count: 2 }]);
		expect(await facets("locale")).toEqual([
			{ value: "ko", count: 3 },
			{ value: "en", count: 1 },
		]);
		expect(await titles({ filters: [{ on: "locale", any: ["en"] }] })).toEqual(["첫 번째 글"]);
	});
});

describe("columns", () => {
	it("06-2 every collection's columns come from its schema and its kind: the system columns, then its own fields", async () => {
		const shape = (list: ListColumn[]) => list.map((column) => `${column.id}${column.hidden ? "?" : ""}`);
		expect(shape(await columns("post"))).toEqual([
			"status",
			"title",
			"summary?",
			"format?",
			"category",
			"tags",
			"locale",
			"updatedAt",
			"publishedAt?",
			"createdAt?",
		]);
		expect(shape(await columns("memo"))).toEqual([
			"status",
			"title",
			"locale",
			"updatedAt",
			"publishedAt?",
			"createdAt?",
		]);
		// An item collection is live on save: no status and no publish date.
		expect(shape(await columns("category"))).toEqual(["title", "about?", "locale", "updatedAt", "createdAt?"]);
		expect((await columns("post")).find((column) => column.id === "tags")).toMatchObject({
			kind: "relation",
			filter: "relation",
			to: "tag",
			many: true,
		});
	});

	it("06-1 the column order, hidden columns and page size are kept per collection; the title cannot be hidden", async () => {
		await run("list.savePrefs", {
			collection: "post",
			order: ["title", "status", "updatedAt"],
			hidden: ["tags"],
			pageSize: 50,
		});
		const kept = await run<{ columns: ListColumn[]; pageSize: number }>("list.columns", { collection: "post" });
		expect(kept.pageSize).toBe(50);
		expect(kept.columns.slice(0, 3).map((column) => column.id)).toEqual(["title", "status", "updatedAt"]);
		expect(kept.columns.find((column) => column.id === "tags")?.hidden).toBe(true);
		expect(kept.columns.find((column) => column.id === "category")?.hidden).toBe(false);
		expect(kept.columns.find((column) => column.id === "summary")?.hidden).toBe(true);
		expect((await columns("memo")).map((column) => column.id)[0]).toBe("status");

		await expect(run("list.savePrefs", { collection: "post", hidden: ["title"] })).rejects.toMatchObject({
			reason: { key: "list.titleHidden" },
		});
		await expect(run("list.savePrefs", { collection: "post", order: ["nope"] })).rejects.toMatchObject({
			reason: { key: "list.unknownColumn" },
		});
	});
});

describe("the agent", () => {
	it("06-3 a list the agent shows with list.show has the rows a person gets with the same filters", async () => {
		const proposalId = await site().proposals.create("c1", "drafts tagged react without a summary");
		const session = { conversationId: "c1", proposalId };
		const filters = [
			{ on: "relation", field: "tags", any: [await groupOf(ids.react)] },
			{ on: "empty", field: "summary" },
		];
		const shown = await callAgentTool(site(), "list.show", { collection: "post", filters }, session);
		expect(shown.kind).toBe("screen");
		const screenQuery = (shown as { input: Record<string, unknown> }).input;
		const person = await query({ filters });
		expect((await query(screenQuery)).rows.map((row) => row.id)).toEqual(person.rows.map((row) => row.id));

		const selected = await callAgentTool(site(), "list.select", { ids: [ids.rsc] }, session);
		expect(selected).toEqual({ kind: "screen", name: "list.select", input: { ids: [ids.rsc] } });
		await expect(run("list.show", { collection: "post" })).rejects.toThrow();
	});

	it("00-5 whatever a column menu filters by, the agent filters the same way through entries.query", async () => {
		const proposalId = await site().proposals.create("c1", "find");
		const session = { conversationId: "c1", proposalId };
		const filterFor = (column: ListColumn) => {
			switch (column.filter) {
				case "status":
					return { on: "status", any: ["draft"] };
				case "locale":
					return { on: "locale", any: ["ko"] };
				case "date":
					return { on: "date", field: column.id, range: "30d" };
				case "relation":
				case "select":
					return { on: column.filter, field: column.id, any: [null] };
				case "empty":
					return { on: "empty", field: column.id };
				default:
					return null;
			}
		};
		for (const column of await columns("post")) {
			const filter = filterFor(column);
			if (!filter) continue;
			const asAgent = await callAgentTool(site(), "entries.query", { collection: "post", filters: [filter] }, session);
			const asPerson = await query({ filters: [filter] });
			expect(asAgent, column.id).toEqual({ kind: "read", output: asPerson });
		}
	});
});
