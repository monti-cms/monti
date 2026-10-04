import type { PluginDatabase } from "@monti-cms/core";
import { CmsError, getCmsDatabase, withTransaction } from "@monti-cms/core/plugin/server";

/** AI 설정 표(`ai_settings`)의 줄 이름. */
export type AiSettingsId = "default" | "shared";

/** 기능 이름별로 고친 값 한 줄. */
export interface AiActionOverrideRow {
	key: string;
	/** 정의와 다른 고친 값(`aiActionOverrideSchema` 모양). */
	value: unknown;
	version: number;
	updatedAt: Date;
}

/** v2 D AI 기능의 고친 값(`ai_action_overrides`)·연결 설정(`ai_settings`)·화면 기능(`ai_custom_actions`). */
export function createAiStore({ pool, schema: qSchema }: PluginDatabase) {
	return {
		/** 고친 값 전부. 고친 적 없는 기능은 없다. */
		listAiActionOverrides: async (): Promise<AiActionOverrideRow[]> => {
			const res = await pool.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
				`SELECT key, value, version, updated_at FROM "${qSchema}".ai_action_overrides ORDER BY key`,
			);
			return res.rows.map((row) => ({
				key: row.key,
				value: row.value,
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},

		/**
		 * 고친 값을 바꾼다. 처음이면 `expectedVersion`이 0이고, 그 뒤로는 버전이 다르면 409다.
		 * 고친 값이 비면(모두 기본값) 줄을 남겨 버전을 이어 간다.
		 */
		saveAiActionOverride: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_action_overrides WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				const res = await client.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
					`INSERT INTO "${qSchema}".ai_action_overrides (key, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING key, value, version, updated_at`,
					[params.key, JSON.stringify(params.value), version + 1],
				);
				const row = res.rows[0] as { key: string; value: unknown; version: number; updated_at: Date };
				return { key: row.key, value: row.value, version: row.version, updatedAt: row.updated_at };
			}),

		/**
		 * AI 설정 한 줄(저장한 모양 그대로). `default`는 서비스 연결, `shared`는 고친 공통 문구다. 없으면 `null`.
		 */
		getAiSettings: async (id: AiSettingsId = "default"): Promise<{ value: unknown; version: number } | null> => {
			const res = await pool.query<{ value: unknown; version: number }>(
				`SELECT value, version FROM "${qSchema}".ai_settings WHERE id = $1`,
				[id],
			);
			return res.rows[0] ?? null;
		},

		/** 설정 한 줄을 저장한다. 처음이면 `expectedVersion`이 0이고, 그 뒤로는 버전이 다르면 409다. */
		saveAiSettings: async (params: { id?: AiSettingsId; expectedVersion: number; value: unknown }): Promise<number> =>
			withTransaction(pool, async (client) => {
				const id = params.id ?? "default";
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_settings WHERE id = $1 FOR UPDATE`,
					[id],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				await client.query(
					`INSERT INTO "${qSchema}".ai_settings (id, value, version, updated_at) VALUES ($1, $2, $3, NOW())
					 ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()`,
					[id, JSON.stringify(params.value), version + 1],
				);
				return version + 1;
			}),

		/** 화면 기능(관리자 화면에서 만든 기능) 전부. 만든 순서다. */
		listAiCustomActions: async (): Promise<AiActionOverrideRow[]> => {
			const res = await pool.query<{ key: string; value: unknown; version: number; updated_at: Date }>(
				`SELECT key, value, version, updated_at FROM "${qSchema}".ai_custom_actions ORDER BY created_at, key`,
			);
			return res.rows.map((row) => ({
				key: row.key,
				value: row.value,
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},

		/** 화면 기능을 만들거나(`expectedVersion` 0) 고친다. 버전이 다르면 409다. */
		saveAiCustomAction: async (params: {
			key: string;
			expectedVersion: number;
			value: unknown;
		}): Promise<AiActionOverrideRow> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version ?? 0;
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				const res = await client.query<{ updated_at: Date }>(
					`INSERT INTO "${qSchema}".ai_custom_actions (key, value, version, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = NOW()
					 RETURNING updated_at`,
					[params.key, JSON.stringify(params.value), version + 1],
				);
				return {
					key: params.key,
					value: params.value,
					version: version + 1,
					updatedAt: res.rows[0]?.updated_at ?? new Date(),
				};
			}),

		/** 화면 기능을 지운다. 버전이 다르면 409, 없으면 404다. */
		deleteAiCustomAction: async (params: { key: string; expectedVersion: number }): Promise<void> =>
			withTransaction(pool, async (client) => {
				const cur = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".ai_custom_actions WHERE key = $1 FOR UPDATE`,
					[params.key],
				);
				const version = cur.rows[0]?.version;
				if (version === undefined) throw new CmsError("Not found", "not_found");
				if (version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", version);
				await client.query(`DELETE FROM "${qSchema}".ai_custom_actions WHERE key = $1`, [params.key]);
			}),
	};
}

export type AiStore = ReturnType<typeof createAiStore>;

declare global {
	var __cmsAiStore: AiStore | undefined;
}

/** 본체 DB 연결로 만든 AI 저장소. 개발 서버가 모듈을 다시 읽어도 하나만 둔다. */
export function getAiStore(): AiStore {
	global.__cmsAiStore ??= createAiStore(getCmsDatabase());
	return global.__cmsAiStore;
}
