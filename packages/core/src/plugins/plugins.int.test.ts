import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql, testDatabase } from "../__test__/database";
import { receiverFetch } from "../engine/deliveries";
import { agentTools } from "../entry/tools";
import { CheckError, ForbiddenError } from "../errors";
import type { KeyList } from "../keys/operations";
import type { KeyService } from "../keys/services";
import { createMonti, definePlugin, type Plugin } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema, type Schema } from "../schema/define";
import { says } from "./define";
import type { PluginRow, TextCheckResult } from "./operations";

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
			},
		},
		memo: {
			kind: "document",
			path: "/notes/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
		tag: {
			kind: "item",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const SECRET = "plugins-test-secret";
const SEARCH_KEY = "algolia-search-key-4410";
const OTHER_KEY = "algolia-search-key-9f3c";

/** A search service as a plugin brings it: it takes the two keys above. */
const searchService = (asked: string[] = []): KeyService => ({
	id: "algolia",
	name: "Algolia",
	async check({ secret }) {
		asked.push(secret);
		return secret === SEARCH_KEY || secret === OTHER_KEY ? { ok: true, models: [] } : { ok: false, reason: "refused" };
	},
});

const seo = (): Plugin =>
	definePlugin({
		name: "seo",
		label: "SEO",
		fields: [
			{
				tab: "SEO",
				collections: ["post"],
				fields: {
					seoPreview: { kind: "view", view: "seo.preview" },
					seoTitle: { kind: "text", label: "검색 제목", input: "seo.title", inputOptions: { limit: 60 } },
					seoImage: { kind: "media", accept: "image", label: "공유 이미지" },
					seoNoindex: { kind: "select", options: ["index", "noindex"], label: "검색에서 숨기기" },
				},
				columns: ["seoTitle", "seoImage"],
			},
		],
	});

const site = (plugins: Plugin[] = [seo()], options: Partial<Parameters<typeof createMonti>[0]> = {}) =>
	createMonti({ db, schema, secret: SECRET, plugins, ...options });

const run = <Output>(monti: ReturnType<typeof site>, name: string, input: unknown = {}) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

async function create(monti: ReturnType<typeof site>, title: string, values: Record<string, unknown> = {}) {
	const made = await run<{ output: { id: string } }>(monti, "entries.create", {
		collection: "post",
		title,
		slug: title.toLowerCase().replace(/\s+/g, "-"),
		values,
	});
	return made.output.id;
}

const entry = async (monti: ReturnType<typeof site>, id: string) =>
	(
		await run<{ entry: { version: number; title: string; values: Record<string, unknown> } }>(monti, "entries.get", {
			id,
		})
	).entry;

beforeEach(async () => {
	await sql`truncate entries, api_keys, monti_delivery, monti_activity, collection_admin_values cascade`.execute(db);
	await migrateContent(db, schema, []);
});

describe("a plugin's fields", () => {
	it("14-5 are an entry's fields while the plugin is there, without being in the schema file", async () => {
		const monti = site();
		const id = await create(monti, "First", { seoTitle: "Search title" });
		expect((await entry(monti, id)).values).toEqual({ seoTitle: "Search title" });
		// The file's schema does not have them: the structure operations plan and write the file's alone.
		expect(monti.site.fileSchema().collections.post.fields).not.toHaveProperty("seoTitle");
		expect(monti.site.schema().collections.post.fields).toHaveProperty("seoTitle");
		expect(monti.site.schema().collections.memo.fields).not.toHaveProperty("seoTitle");
		// Without the plugin the field is no field: a value for it is refused like any unknown one.
		const bare = site([]);
		await expect(
			run(bare, "entries.create", { collection: "post", title: "x", values: { seoTitle: "y" } }),
		).rejects.toThrow(CheckError);
	});

	it("a view field holds no value: nothing can be saved under its name", async () => {
		const monti = site();
		await expect(
			run(monti, "entries.create", { collection: "post", title: "x", values: { seoPreview: "y" } }),
		).rejects.toThrow(CheckError);
	});

	it("are read with their tab, their names and their inputs; the settings read the file's schema", async () => {
		const monti = site();
		const read = await run<{
			schema: Schema;
			adminValues: Record<string, { fields?: Record<string, { label?: string }> }>;
			pluginTabs: Record<
				string,
				{ plugin: string; tab: string; fields: { name: string; view?: string; kind: string }[] }[]
			>;
		}>(monti, "schema.read");
		expect(read.schema.collections.post.fields.seoTitle).toEqual({
			kind: "text",
			input: "seo.title",
			inputOptions: { limit: 60 },
		});
		expect(read.adminValues.post.fields?.seoTitle?.label).toBe("검색 제목");
		expect(read.pluginTabs).toEqual({
			post: [
				{
					plugin: "seo",
					tab: "SEO",
					fields: [
						{ name: "seoPreview", kind: "view", view: "seo.preview", column: false },
						{ name: "seoTitle", kind: "text", label: "검색 제목", column: true },
						{ name: "seoImage", kind: "media", label: "공유 이미지", column: true },
						{ name: "seoNoindex", kind: "select", label: "검색에서 숨기기", column: false },
					],
				},
			],
		});
		const settings = await run<{ schema: Schema; pluginTabs: Record<string, unknown[]> }>(monti, "settings.read");
		expect(settings.schema.collections.post.fields).not.toHaveProperty("seoTitle");
		expect(settings.pluginTabs.post).toHaveLength(1);
	});

	it("a draft made from what was read leaves them out again: nothing to change", async () => {
		const monti = site();
		const read = await run<{ schema: Schema }>(monti, "schema.read");
		const plan = await run<{ problems: unknown[]; changes: unknown[] }>(monti, "schema.plan", { draft: read.schema });
		expect(plan).toEqual({ problems: [], changes: [] });
	});

	it("a name the schema file already has stays the file's field", async () => {
		const own: Schema = {
			...schema,
			collections: {
				...schema.collections,
				post: {
					...schema.collections.post,
					fields: { ...schema.collections.post.fields, seoTitle: { kind: "text", max: 10 } },
				},
			},
		};
		const monti = createMonti({ db, schema: own, plugins: [seo()] });
		expect(monti.site.schema().collections.post.fields.seoTitle).toEqual({ kind: "text", max: 10 });
		expect(monti.site.pluginTabs("post")[0].fields.map((field) => field.name)).toEqual([
			"seoPreview",
			"seoImage",
			"seoNoindex",
		]);
	});

	it("are refused when the site is built, when they could never work", () => {
		const fields = (set: NonNullable<Plugin["fields"]>[number]) => () => site([{ name: "bad", fields: [set] }]);
		expect(fields({ tab: "T", fields: { slug: { kind: "text", label: "x" } } })).toThrow(/cannot be a field's name/);
		expect(fields({ tab: "T", fields: { a: { kind: "select", options: [], label: "x" } } })).toThrow(/needs options/);
		expect(fields({ tab: "T", fields: { a: { kind: "view", view: "v" } }, columns: ["a"] })).toThrow(/column/);
		expect(() =>
			site([seo(), { name: "other", fields: [{ tab: "T", fields: { seoTitle: { kind: "text", label: "x" } } }] }]),
		).toThrow(/added twice/);
		expect(() => site([seo(), seo()])).toThrow(/Two plugins are named/);
		expect(() => definePlugin({ name: "Not A Name" })).toThrow(/lower-case/);
	});
});

describe("a plugin's list columns (T53)", () => {
	type Column = { id: string; label?: string; filter: string | null; hidden: boolean };

	it("are offered hidden, named by the plugin, only for the fields it says", async () => {
		const monti = site();
		const { columns } = await run<{ columns: Column[] }>(monti, "list.columns", { collection: "post" });
		const theirs = columns.filter((column) => column.id.startsWith("seo"));
		expect(theirs).toEqual([
			expect.objectContaining({ id: "seoTitle", label: "검색 제목", filter: "empty", hidden: true }),
			expect.objectContaining({ id: "seoImage", label: "공유 이미지", filter: "empty", hidden: true }),
		]);
		// A person shows one; the list keeps it.
		await run(monti, "list.savePrefs", {
			collection: "post",
			order: columns.map((column) => column.id),
			hidden: ["seoImage"],
		});
		const after = await run<{ columns: Column[] }>(monti, "list.columns", { collection: "post" });
		expect(after.columns.find((column) => column.id === "seoTitle")?.hidden).toBe(false);
	});

	it('filter by "empty", and count it', async () => {
		const monti = site();
		await create(monti, "With", { seoTitle: "Search title" });
		await create(monti, "Without");
		const empty = { collection: "post", filters: [{ on: "empty", field: "seoTitle" }] };
		const { rows } = await run<{ rows: { title: string }[] }>(monti, "entries.query", empty);
		expect(rows.map((row) => row.title)).toEqual(["Without"]);
		const facets = await run<{ values: unknown[] }>(monti, "entries.facets", {
			collection: "post",
			column: "seoTitle",
		});
		expect(facets.values).toEqual([{ value: "empty", count: 1 }]);
	});
});

describe("before a save (T85)", () => {
	const trims = (): Plugin => ({
		name: "tidy",
		beforeSave: (saving) => ({ values: { summary: String(saving.values.summary ?? "").trim() || null } }),
	});

	it("a plugin changes the values that are saved, on create and on save", async () => {
		const monti = site([trims()]);
		const id = await create(monti, "First", { summary: "  spaced  " });
		expect((await entry(monti, id)).values).toEqual({ summary: "spaced" });
		const { version } = await entry(monti, id);
		await run(monti, "entries.save", { id, version, values: { summary: "   " } });
		// A value the hook empties is gone, as a person's `null` is.
		expect((await entry(monti, id)).values).toEqual({});
	});

	it("a plugin refuses the save with its reason, and nothing is written", async () => {
		const refuses: Plugin = {
			name: "house-rules",
			beforeSave(saving, { previous }) {
				if (saving.title.includes("draft")) throw new CheckError(says("제목에 draft가 있습니다."));
				// It is told what was stored before: `null` for a new entry.
				if (previous && previous.title === saving.title) return undefined;
				return undefined;
			},
		};
		const monti = site([refuses]);
		const id = await create(monti, "Fine");
		const { version } = await entry(monti, id);
		const refused = run(monti, "entries.save", { id, version, title: "a draft" });
		await expect(refused).rejects.toMatchObject({
			reason: { key: "plugins.says", values: { text: "제목에 draft가 있습니다." } },
		});
		expect(await entry(monti, id)).toMatchObject({ version, title: "Fine" });
	});

	it("what a hook returns passes a save's own checks: no field the schema does not have", async () => {
		const wild: Plugin = { name: "wild", beforeSave: () => ({ values: { nowhere: 1 } }) };
		const monti = site([wild]);
		await expect(create(monti, "x")).rejects.toMatchObject({ reason: { key: "entries.unknownField" } });
	});

	it("each plugin sees what the one before it left", async () => {
		const first: Plugin = { name: "first", beforeSave: () => ({ title: "one" }) };
		const second: Plugin = { name: "second", beforeSave: (saving) => ({ title: `${saving.title} two` }) };
		const monti = site([first, second]);
		const id = await create(monti, "zero");
		expect((await entry(monti, id)).title).toBe("one two");
	});
});

describe("plugin keys (T144)", () => {
	const algolia = (asked: string[] = []): Plugin =>
		definePlugin({
			name: "algolia",
			label: "Algolia 검색",
			keyServices: [searchService(asked)],
			keys: [
				{ id: "search", label: "검색 키", service: "algolia" },
				{ id: "admin", label: "관리 키", service: "algolia" },
			],
		});
	const list = (monti: ReturnType<typeof site>) => run<KeyList>(monti, "keys.list");
	const setKey = (monti: ReturnType<typeof site>, input: Record<string, unknown>) =>
		run<{ output: Record<string, unknown> }>(monti, "plugins.setKey", { plugin: "algolia", slot: "search", ...input });

	it("14-5 a plugin's slots are rows of the key list, empty until a key is put in", async () => {
		const monti = site([algolia()]);
		const { slots, keys } = await list(monti);
		expect(keys).toEqual([]);
		expect(slots).toEqual([
			expect.objectContaining({
				plugin: "algolia",
				pluginLabel: "Algolia 검색",
				slot: "search",
				label: "검색 키",
				key: null,
			}),
			expect.objectContaining({ slot: "admin", label: "관리 키", oneOfMany: true, serviceName: "Algolia", key: null }),
		]);
	});

	it("14-4 a key is put in after its service takes it, and is opened only by the server", async () => {
		const asked: string[] = [];
		const monti = site([algolia(asked)]);
		const result = await setKey(monti, { secret: SEARCH_KEY });
		expect(asked).toEqual([SEARCH_KEY]);
		expect(JSON.stringify(result)).not.toContain(SEARCH_KEY);
		const { slots, keys } = await list(monti);
		// The slot's key is no row of the AI keys, and gives no model.
		expect(keys).toEqual([]);
		expect(slots[0].key).toEqual({ last4: "4410", baseUrl: null, readable: true, hasKey: true });
		expect(slots[1].key).toBeNull();
		expect(JSON.stringify(await list(monti))).not.toContain(SEARCH_KEY);
		expect((await monti.plugins.key("algolia", "search"))?.secret).toBe(SEARCH_KEY);
		expect(await monti.plugins.key("algolia", "admin")).toBeNull();
		// Stored sealed: the database alone does not hold the key.
		const stored = await db.selectFrom("api_keys").select(["id", "secret"]).execute();
		expect(stored).toEqual([{ id: "slot:algolia/search", secret: expect.not.stringContaining(SEARCH_KEY) }]);
		const activity = await db.selectFrom("monti_activity").selectAll().execute();
		expect(JSON.stringify(activity)).not.toContain(SEARCH_KEY);
	});

	it("a key the service refuses is not stored, and the slot keeps what it had", async () => {
		const monti = site([algolia()]);
		await expect(setKey(monti, { secret: "not-a-key-at-all" })).rejects.toMatchObject({
			reason: { key: "keys.refused" },
		});
		expect((await list(monti)).slots[0].key).toBeNull();
		await setKey(monti, { secret: SEARCH_KEY });
		await expect(setKey(monti, { secret: "not-a-key-at-all" })).rejects.toMatchObject({
			reason: { key: "keys.refused" },
		});
		expect((await monti.plugins.key("algolia", "search"))?.secret).toBe(SEARCH_KEY);
	});

	it("a key is replaced, and taken out", async () => {
		const monti = site([algolia()]);
		await setKey(monti, { secret: SEARCH_KEY });
		await setKey(monti, { secret: OTHER_KEY });
		expect((await list(monti)).slots[0].key?.last4).toBe("9f3c");
		expect((await monti.plugins.key("algolia", "search"))?.secret).toBe(OTHER_KEY);
		const removed = await setKey(monti, { secret: null });
		expect(removed.output.did).toBe("removed");
		expect((await list(monti)).slots[0].key).toBeNull();
		await expect(setKey(monti, { secret: null })).rejects.toMatchObject({ reason: { key: "plugins.slotEmpty" } });
	});

	it("a slot's key is changed only as a slot: the key operations do not know it", async () => {
		const monti = site([algolia()]);
		await setKey(monti, { secret: SEARCH_KEY });
		const id = "slot:algolia/search";
		await expect(run(monti, "keys.update", { id, name: "mine" })).rejects.toMatchObject({
			reason: { key: "keys.unknown" },
		});
		await expect(run(monti, "keys.remove", { id })).rejects.toMatchObject({ reason: { key: "keys.unknown" } });
		expect((await list(monti)).slots[0].key).not.toBeNull();
		const models = await run<{ keys: unknown[] }>(monti, "models.list");
		expect(models.keys).toEqual([]);
	});

	it("only a person fills a slot; the assistant is told which slots are filled and no more", async () => {
		const monti = site([algolia()]);
		await setKey(monti, { secret: SEARCH_KEY });
		await expect(
			monti.run("plugins.setKey", { plugin: "algolia", slot: "search", secret: OTHER_KEY }, { actor: "assistant" }),
		).rejects.toThrow(ForbiddenError);
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("plugins.setKey");
		const told = (await monti.run("keys.list", {}, { actor: "assistant" })) as { slots: unknown[] };
		expect(told.slots[0]).toEqual({
			plugin: "algolia",
			pluginLabel: "Algolia 검색",
			slot: "search",
			label: "검색 키",
			serviceName: "Algolia",
			filled: true,
		});
	});

	it("there is no slot a plugin did not name, and no key without the server's secret", async () => {
		const monti = site([algolia()]);
		await expect(setKey(monti, { slot: "nowhere", secret: SEARCH_KEY })).rejects.toMatchObject({
			reason: { key: "plugins.unknownSlot" },
		});
		const noSecret = site([algolia()], { secret: null });
		await expect(setKey(noSecret, { secret: SEARCH_KEY })).rejects.toMatchObject({ reason: { key: "keys.noSecret" } });
		expect(() => site([{ name: "lost", keys: [{ id: "k", label: "Key", service: "nowhere" }] }])).toThrow(
			/does not have/,
		);
	});
});

describe("a text check (T70)", () => {
	const spelling = (locales?: string[]): Plugin => ({
		name: "spelling",
		label: "바른 맞춤법",
		textCheck: {
			label: "맞춤법",
			...(locales ? { locales } : {}),
			check: (blocks) =>
				blocks.flatMap((block) => {
					const at = block.text.indexOf("몇일");
					return at < 0 ? [] : [{ block: block.id, from: at, to: at + 2, replacement: "며칠", note: "맞춤법" }];
				}),
		},
	});
	const check = (monti: ReturnType<typeof site>, locale = "ko") =>
		run<{ checks: TextCheckResult[] }>(monti, "plugins.checkText", {
			collection: "post",
			locale,
			blocks: [
				{ id: "b1", text: "몇일 뒤에 봅시다" },
				{ id: "b2", text: "틀린 곳이 없는 글" },
			],
		});

	it("gives each finding with its block, its place and the words to put there", async () => {
		const { checks } = await check(site([spelling()]));
		expect(checks).toEqual([
			{
				plugin: "spelling",
				label: "맞춤법",
				failed: false,
				findings: [{ block: "b1", from: 0, to: 2, replacement: "며칠", note: "맞춤법" }],
			},
		]);
	});

	it("a check that reads other languages has no cell here", async () => {
		expect((await check(site([spelling(["ko"])]), "en")).checks).toEqual([]);
		expect((await check(site([spelling(["ko"])]), "ko")).checks).toHaveLength(1);
	});

	it("a finding outside the text it was given is dropped, and a check that throws says it failed", async () => {
		const loose: Plugin = {
			name: "loose",
			textCheck: {
				label: "Loose",
				check: () => [
					{ block: "b1", from: 0, to: 99, replacement: "x" },
					{ block: "nowhere", from: 0, to: 1, replacement: "x" },
					{ block: "b2", from: 1, to: 3, replacement: "ok" },
				],
			},
		};
		const broken: Plugin = {
			name: "broken",
			textCheck: {
				label: "Broken",
				check: () => {
					throw new Error("the service is down at https://example.dev/?token=secret");
				},
			},
		};
		const said = vi.spyOn(console, "error").mockImplementation(() => {});
		const { checks } = await check(site([loose, broken]));
		expect(checks[0].findings).toEqual([{ block: "b2", from: 1, to: 3, replacement: "ok" }]);
		expect(checks[1]).toEqual({ plugin: "broken", label: "Broken", findings: [], failed: true });
		// What the plugin threw is the server's to read, not the screen's.
		expect(JSON.stringify(checks)).not.toContain("token");
		expect(said).toHaveBeenCalledOnce();
		said.mockRestore();
	});
});

describe("a plugin's receiver (T172)", () => {
	const failures = async () =>
		(await db.selectFrom("monti_delivery").select(["destination", "last_error"]).execute()).map((row) => [
			row.destination,
			row.last_error,
		]);

	it("answers as the other side answered when it sends with receiverFetch", async () => {
		const index: Plugin = {
			name: "index",
			receivers: [
				{
					destination: "plugin:index",
					accepts: (event) => event.type === "entry.saved",
					send: async (event, signal) => {
						await receiverFetch(
							"https://search.example/index?token=secret",
							{ method: "POST", body: JSON.stringify(event), signal },
							async () => new Response("no room", { status: 503, statusText: "Service Unavailable" }),
						);
					},
				},
			],
		};
		const monti = site([index]);
		await create(monti, "First");
		expect(await failures()).toEqual([["plugin:index", "status:503 Service Unavailable"]]);
	});

	it("a side that is not reached is no answer, with the network's word and nothing of the address", async () => {
		const index: Plugin = {
			name: "index",
			receivers: [
				{
					destination: "plugin:index",
					send: async (_event, signal) => {
						await receiverFetch("https://search.example/index?token=secret", { signal }, async () => {
							throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
						});
					},
				},
			],
		};
		const monti = site([index]);
		await create(monti, "First");
		expect(await failures()).toEqual([["plugin:index", "noAnswer:ECONNREFUSED"]]);
	});

	it("what a receiver's own code throws is stored without its words, and printed on the server", async () => {
		const buggy: Plugin = {
			name: "buggy",
			receivers: [
				{
					destination: "plugin:buggy",
					send: async () => {
						throw new Error("could not post to https://search.example/?token=secret");
					},
				},
			],
		};
		const said = vi.spyOn(console, "error").mockImplementation(() => {});
		const monti = site([buggy]);
		await create(monti, "First");
		expect(await failures()).toEqual([["plugin:buggy", "failed"]]);
		expect(said).toHaveBeenCalledWith(expect.stringContaining("plugin:buggy"), expect.any(Error));
		said.mockRestore();
	});
});

describe("the plugin list", () => {
	it("14-5 says what each plugin adds, to a person and to the assistant alike", async () => {
		const monti = site([
			seo(),
			{
				name: "algolia",
				keyServices: [searchService()],
				keys: [{ id: "search", label: "검색 키", service: "algolia" }],
				toolPages: [{ id: "reindex", label: "색인" }],
			},
		]);
		await run(monti, "plugins.setKey", { plugin: "algolia", slot: "search", secret: SEARCH_KEY });
		const { plugins } = (await monti.run("plugins.list", {}, { actor: "assistant" })) as { plugins: PluginRow[] };
		expect(plugins).toEqual([
			expect.objectContaining({ name: "seo", label: "SEO", adds: ["fields", "columns"], keys: [] }),
			expect.objectContaining({
				name: "algolia",
				adds: ["toolPages", "keys", "keyServices"],
				keys: [{ id: "search", label: "검색 키", service: "algolia", filled: true }],
				toolPages: [{ id: "reindex", label: "색인" }],
			}),
		]);
		expect(agentTools(monti).map((tool) => tool.name)).toContain("plugins.list");
	});
});
