import { STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { createContentLookup } from "@monti-cms/core/plugin/server";
import { type ContentStore, createContentService, type Entry } from "@monti-cms/core/runtime";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	fakeCms,
	migrateContentStore,
	pluginStorageFor,
} from "@monti-cms/core/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../test/site";
import {
	actionWithDraft,
	createCustomAction,
	deleteCustomAction,
	getAction,
	listActions,
	resetAction,
	updateAction,
} from "../actions";
import { migrateAi } from "../migrate";
import { aiRegistryOf } from "../registry";
import { type AiStore, createAiStore } from "../store";

const AI_ACTIONS = aiRegistryOf(testSite).actions;

describe("AI action edited-value store", () => {
	const cms = fakeCms({ config: testConfig });
	let pool: Pool;
	let schemaName: string;
	let content: ContentStore;
	let store: AiStore;
	/** Creates the core tables, then the AI plugin tables (same order as `monti migrate`). */
	const migrate = async () => {
		await migrateContentStore(pool, { schema: schemaName, site: testSite });
		await migrateAi(pluginStorageFor(pool, schemaName, "ai"), cms);
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrate();
		content = createContentStore(pool, { schema: schemaName, site: testSite });
		store = createAiStore(pluginStorageFor(pool, schemaName, "ai"), { site: testSite });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("lists actions in config order, and defaults with version 0 if never edited", async () => {
		const actions = await listActions(testSite, store);
		expect(actions.map((action) => action.key)).toEqual(Object.keys(AI_ACTIONS));
		expect(actions[0]).toMatchObject({ key: "slug", version: 0, updatedAt: null, overridden: [] });
	});

	it("stores only editable values, drops values equal to the defaults, and rejects on version mismatch", async () => {
		const updated = await updateAction(testSite, store, "summary", 0, {
			enabled: false,
			prompt: "바꾼 지시문",
			label: "바꾼 이름",
			result: "candidates",
			maxCount: 5,
		});
		expect(updated).toMatchObject({
			enabled: false,
			prompt: "바꾼 지시문",
			label: "요약 만들기",
			result: "text",
			version: 1,
			overridden: ["enabled", "prompt"],
		});
		const row = await pluginStorageFor(pool, schemaName, "ai").collection("action-overrides").get("summary");
		expect(row?.value).toEqual({ enabled: false, prompt: "바꾼 지시문" });
		await expect(updateAction(testSite, store, "summary", 0, { enabled: true })).rejects.toMatchObject({
			code: "conflict",
		});
		await expect(updateAction(testSite, store, "summary", 1, { prompt: "{{title}}" })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
		await expect(updateAction(testSite, store, "nope", 0, {})).rejects.toMatchObject({ code: "ai_unknown_action" });
	});

	it("resetting to defaults restores the prompt to the definition and leaves the enabled flag as is", async () => {
		const edited = await updateAction(testSite, store, "slug", 0, { prompt: "바꾼 지시문", enabled: false });
		const reset = await resetAction(testSite, store, "slug", edited.version);
		expect(reset.prompt).toBe(AI_ACTIONS.slug?.prompt);
		expect(reset.enabled).toBe(false);
		expect((await getAction(testSite, store, "slug")).prompt).toBe(AI_ACTIONS.slug?.prompt);
	});

	it("moves edited values of the legacy action table once, and does not delete the legacy table", async () => {
		await pool.query(`
			CREATE TABLE "${schemaName}".ai_features (
				id UUID PRIMARY KEY, builtin TEXT UNIQUE, spec JSONB NOT NULL,
				version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`);
		await pool.query(
			`INSERT INTO "${schemaName}".ai_features (id, builtin, spec) VALUES
			 (gen_random_uuid(), 'codeFold', $1), (gen_random_uuid(), 'mediaAlt', $2), (gen_random_uuid(), NULL, '{}')`,
			[
				JSON.stringify({ prompt: "운영자 지시문", enabled: false, modelName: "m-1", inputs: ["code", "title"] }),
				JSON.stringify({ prompt: "지운 기능" }),
			],
		);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name LIKE 'plugin:ai:%'`);
		await migrate();
		expect(await getAction(testSite, store, "codeFold")).toMatchObject({
			prompt: "운영자 지시문",
			enabled: false,
			modelName: "m-1",
			send: ["code"],
		});
		const keys = await pluginStorageFor(pool, schemaName, "ai").collection("action-overrides").list();
		expect(keys.map((item) => item.key)).not.toContain("mediaAlt");

		// After moving once, later changes to the legacy table are not moved again.
		await pool.query(`UPDATE "${schemaName}".ai_features SET spec = '{"prompt": "다시"}' WHERE builtin = 'codeFold'`);
		await migrate();
		expect((await getAction(testSite, store, "codeFold")).prompt).toBe("운영자 지시문");
		const legacy = await pool.query(`SELECT count(*)::int AS n FROM "${schemaName}".ai_features`);
		expect(legacy.rows[0]?.n).toBe(3);
	});

	it("the core content lookup used by code checks finds slugs used by other posts in the same collection and language", async () => {
		const entry = (
			await createContentService<Entry>(content, { site: testSite }).createDraft({
				collection: "category",
				slug: "used-address",
				metadata: { title: "주소 확인" },
				doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] },
			})
		).entry;
		const lookup = createContentLookup({ store: () => content });
		const slugs = ["used-address", "free-address"];
		expect(await lookup.slugsInUse({ collection: "category", locale: "ko", slugs })).toEqual(new Set(["used-address"]));
		expect(await lookup.slugsInUse({ collection: "category", locale: "en", slugs })).toEqual(new Set());
		expect(await lookup.slugsInUse({ collection: "category", locale: "ko", slugs, excludeEntryId: entry.id })).toEqual(
			new Set(),
		);
	});

	it("a new UI action is created in one step with basic info and edited values (prompt, connection, checks, etc.), and is tested with those values even before saving", async () => {
		const base = {
			label: "태그 고르기",
			surface: { slot: "field", field: "tagIds", collections: ["post"] },
			result: "candidates",
			engine: "decide",
		};
		const edits = {
			prompt: "글의 주제를 다루는가.",
			instant: true,
			checks: [
				{ kind: "exists", enabled: true },
				{ kind: "oneOf", enabled: true, items: ["t1"] },
			],
		};
		const draft = await actionWithDraft(testSite, store, "custom_new", edits, base);
		expect(draft).toMatchObject({ engine: "decide", prompt: "글의 주제를 다루는가.", instant: true });
		expect(draft.checks.map((check) => check.kind)).toEqual(["exists", "oneOf"]);

		const created = await createCustomAction(testSite, store, base, edits);
		expect(created).toMatchObject({
			label: "태그 고르기",
			engine: "decide",
			prompt: "글의 주제를 다루는가.",
			instant: true,
		});
		expect((await getAction(testSite, store, created.key)).checks.map((check) => check.kind)).toEqual([
			"exists",
			"oneOf",
		]);
		await expect(createCustomAction(testSite, store, base, { prompt: "{{title}}" })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
		await deleteCustomAction(testSite, store, created.key, created.version);
	});

	it("creates, edits, reads as a runnable shape, and deletes UI actions", async () => {
		const created = await createCustomAction(testSite, store, {
			label: "한 줄 요약",
			surface: { slot: "field", field: "summary", collections: ["post"] },
			result: "text",
		});
		expect(created.key).toMatch(/^custom_/);
		expect(created).toMatchObject({
			label: "한 줄 요약",
			custom: { surface: { slot: "field", field: "summary" } },
			attach: [{ slot: "field", field: "summary", collections: ["post"] }],
			version: 1,
		});
		// Appended to the end of the list.
		expect((await listActions(testSite, store)).at(-1)?.key).toBe(created.key);

		const updated = await updateAction(
			testSite,
			store,
			created.key,
			1,
			{ prompt: "한 문장으로 줄인다.", send: ["title", "body"] },
			{ label: "한 문장 요약", surface: { slot: "selection" }, result: "mdx" },
		);
		expect(updated).toMatchObject({ label: "한 문장 요약", result: "mdx", stream: true, version: 2 });
		const action = await getAction(testSite, store, created.key);
		expect(action).toMatchObject({ prompt: "한 문장으로 줄인다.", attach: [{ slot: "selection" }] });
		// Only materials of the chosen slots are sent (required inputs of the selection slot are always sent).
		expect(action.send).toEqual(["selection", "title"]);

		await expect(resetAction(testSite, store, created.key, 2)).rejects.toMatchObject({ code: "ai_invalid_input" });
		await expect(
			createCustomAction(testSite, store, { label: "x", surface: { slot: "field", field: "nope" }, result: "text" }),
		).rejects.toMatchObject({ code: "ai_invalid_input" });
		await expect(
			createCustomAction(testSite, store, { label: "x", surface: { slot: "selection" }, result: "candidates" }),
		).rejects.toMatchObject({ code: "ai_invalid_input" });

		await deleteCustomAction(testSite, store, created.key, 2);
		expect((await listActions(testSite, store)).some((item) => item.key === created.key)).toBe(false);
		await expect(getAction(testSite, store, created.key)).rejects.toMatchObject({ code: "ai_unknown_action" });
		await expect(deleteCustomAction(testSite, store, "summary", 0)).rejects.toMatchObject({ code: "ai_invalid_input" });
	});
});
