import { createContentLookup } from "@monti-cms/core/plugin/server";
import {
	type ContentStore,
	createContentService,
	createContentStore,
	type Entry,
	migrateContentStore,
} from "@monti-cms/core/runtime";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	pluginDatabaseFor,
} from "@monti-cms/core/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { AI_ACTIONS } from "../registry";
import { type AiStore, createAiStore } from "../store";

describe("AI 기능 고친 값 저장소", () => {
	let pool: Pool;
	let schemaName: string;
	let content: ContentStore;
	let store: AiStore;
	/** 본체 표를 만들고 AI 플러그인 표를 만든다(`monti migrate`와 같은 순서). */
	const migrate = async () => {
		await migrateContentStore(pool, { schema: schemaName });
		await migrateAi(pluginDatabaseFor(pool, schemaName));
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrate();
		content = createContentStore(pool, { schema: schemaName });
		store = createAiStore(pluginDatabaseFor(pool, schemaName));
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("기능 목록은 설정 순서대로이고, 고친 적 없으면 기본값·버전 0이다", async () => {
		const actions = await listActions(store);
		expect(actions.map((action) => action.key)).toEqual(Object.keys(AI_ACTIONS));
		expect(actions[0]).toMatchObject({ key: "slug", version: 0, updatedAt: null, overridden: [] });
	});

	it("고칠 수 있는 값만 저장하고, 기본값과 같은 값은 남기지 않으며, 버전이 다르면 막는다", async () => {
		const updated = await updateAction(store, "summary", 0, {
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
		const row = await pool.query(`SELECT value FROM "${schemaName}".ai_action_overrides WHERE key = 'summary'`);
		expect(row.rows[0]?.value).toEqual({ enabled: false, prompt: "바꾼 지시문" });
		await expect(updateAction(store, "summary", 0, { enabled: true })).rejects.toMatchObject({ code: "conflict" });
		await expect(updateAction(store, "summary", 1, { prompt: "{{title}}" })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
		await expect(updateAction(store, "nope", 0, {})).rejects.toMatchObject({ code: "ai_unknown_action" });
	});

	it("기본값으로 되돌리면 지시문은 정의대로, 켜짐 여부는 그대로 둔다", async () => {
		const edited = await updateAction(store, "slug", 0, { prompt: "바꾼 지시문", enabled: false });
		const reset = await resetAction(store, "slug", edited.version);
		expect(reset.prompt).toBe(AI_ACTIONS.slug?.prompt);
		expect(reset.enabled).toBe(false);
		expect((await getAction(store, "slug")).prompt).toBe(AI_ACTIONS.slug?.prompt);
	});

	it("예전 기능 표의 고친 값을 한 번만 옮기고, 예전 표는 지우지 않는다", async () => {
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
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'migrate_ai_features_to_actions'`);
		await migrate();
		expect(await getAction(store, "codeFold")).toMatchObject({
			prompt: "운영자 지시문",
			enabled: false,
			modelName: "m-1",
			send: ["code"],
		});
		const keys = await pool.query(`SELECT key FROM "${schemaName}".ai_action_overrides ORDER BY key`);
		expect(keys.rows.map((row) => row.key)).not.toContain("mediaAlt");

		// 한 번 옮긴 뒤에는 예전 표가 바뀌어도 다시 옮기지 않는다.
		await pool.query(`UPDATE "${schemaName}".ai_features SET spec = '{"prompt": "다시"}' WHERE builtin = 'codeFold'`);
		await migrate();
		expect((await getAction(store, "codeFold")).prompt).toBe("운영자 지시문");
		const legacy = await pool.query(`SELECT count(*)::int AS n FROM "${schemaName}".ai_features`);
		expect(legacy.rows[0]?.n).toBe(3);
	});

	it("코드 검사가 쓰는 본체 콘텐츠 조회는 같은 컬렉션·언어에서 다른 글이 쓰는 주소를 찾는다", async () => {
		const entry = await createContentService<Entry>(content).createDraft({
			collection: "category",
			slug: "used-address",
			metadata: { title: "주소 확인" },
			mdx: "",
		});
		const lookup = createContentLookup(pluginDatabaseFor(pool, schemaName));
		const slugs = ["used-address", "free-address"];
		expect(await lookup.slugsInUse({ collection: "category", locale: "ko", slugs })).toEqual(new Set(["used-address"]));
		expect(await lookup.slugsInUse({ collection: "category", locale: "en", slugs })).toEqual(new Set());
		expect(await lookup.slugsInUse({ collection: "category", locale: "ko", slugs, excludeEntryId: entry.id })).toEqual(
			new Set(),
		);
	});

	it("새 화면 기능은 기본 정보와 고친 값(지시문·연결·검사 등)을 한 번에 만들고, 저장 전에도 그 값으로 시험한다", async () => {
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
		const draft = await actionWithDraft(store, "custom_new", edits, base);
		expect(draft).toMatchObject({ engine: "decide", prompt: "글의 주제를 다루는가.", instant: true });
		expect(draft.checks.map((check) => check.kind)).toEqual(["exists", "oneOf"]);

		const created = await createCustomAction(store, base, edits);
		expect(created).toMatchObject({
			label: "태그 고르기",
			engine: "decide",
			prompt: "글의 주제를 다루는가.",
			instant: true,
		});
		expect((await getAction(store, created.key)).checks.map((check) => check.kind)).toEqual(["exists", "oneOf"]);
		await expect(createCustomAction(store, base, { prompt: "{{title}}" })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
		await deleteCustomAction(store, created.key, created.version);
	});

	it("화면 기능(M8-5)을 만들고 고치고 실행할 모양으로 읽고 지운다", async () => {
		const created = await createCustomAction(store, {
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
		// 목록 끝에 붙는다.
		expect((await listActions(store)).at(-1)?.key).toBe(created.key);

		const updated = await updateAction(
			store,
			created.key,
			1,
			{ prompt: "한 문장으로 줄인다.", send: ["title", "body"] },
			{ label: "한 문장 요약", surface: { slot: "selection" }, result: "mdx" },
		);
		expect(updated).toMatchObject({ label: "한 문장 요약", result: "mdx", stream: true, version: 2 });
		const action = await getAction(store, created.key);
		expect(action).toMatchObject({ prompt: "한 문장으로 줄인다.", attach: [{ slot: "selection" }] });
		// 고른 자리의 재료만 보낸다(선택 영역 자리의 필수 입력은 언제나 보낸다).
		expect(action.send).toEqual(["selection", "title"]);

		await expect(resetAction(store, created.key, 2)).rejects.toMatchObject({ code: "ai_invalid_input" });
		await expect(
			createCustomAction(store, { label: "x", surface: { slot: "field", field: "nope" }, result: "text" }),
		).rejects.toMatchObject({ code: "ai_invalid_input" });
		await expect(
			createCustomAction(store, { label: "x", surface: { slot: "selection" }, result: "candidates" }),
		).rejects.toMatchObject({ code: "ai_invalid_input" });

		await deleteCustomAction(store, created.key, 2);
		expect((await listActions(store)).some((item) => item.key === created.key)).toBe(false);
		await expect(getAction(store, created.key)).rejects.toMatchObject({ code: "ai_unknown_action" });
		await expect(deleteCustomAction(store, "summary", 0)).rejects.toMatchObject({ code: "ai_invalid_input" });
	});
});
