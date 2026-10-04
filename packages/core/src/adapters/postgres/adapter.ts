import { Pool } from "pg";
import type { PluginDatabase } from "../../plugin/define";
import type { DatabaseAdapter } from "../../server/define";
import type { ContentStore } from "./content-store";
import { validateSchemaName } from "./store/context";

export interface PostgresOptions {
	/** 연결 주소. 처음 쓸 때 없으면 오류를 낸다(빌드 중에는 비어 있어도 된다). */
	readonly connectionString: string | undefined;
	/** 표를 둘 스키마. 같은 DB를 미리보기·스테이징과 나눠 쓸 때 바꾼다. 기본값은 `public`. */
	readonly schema?: string;
}

/**
 * 저장소 모듈(SQL·MDX 해석·사이트 설정을 읽는 업무 규칙)은 처음 부를 때 불러온다(M17-3). 그래서 `cms.server.ts`가
 * `postgres()`만 불러도 저장소 코드·사이트 설정을 끌어오지 않는다.
 */
const loadStoreModule = () => import("./content-store");
const loadSchemaModule = () => import("./store/schema");

/**
 * 처음 부를 때 진짜 저장소를 만드는 대리 저장소. 저장소의 함수는 모두 비동기라 부르는 쪽은 차이를 모른다
 * (함수 목록을 펼치거나 묶는 일은 하지 않는다).
 */
function lazyStore(create: () => Promise<ContentStore>): ContentStore {
	let store: Promise<ContentStore> | undefined;
	const load = () => {
		store ??= create().catch((error) => {
			store = undefined;
			throw error;
		});
		return store;
	};
	return new Proxy({} as ContentStore, {
		get: (_target, name) => {
			if (name === "then") return undefined;
			return async (...args: unknown[]) => {
				const real = (await load()) as unknown as Record<PropertyKey, (...input: unknown[]) => unknown>;
				const method = real[name];
				if (typeof method !== "function") throw new Error(`cms: content store has no method ${String(name)}`);
				return method.apply(real, args);
			};
		},
	});
}

/** Postgres 콘텐츠 저장소. */
export function postgres(options: PostgresOptions): DatabaseAdapter {
	let pool: Pool | undefined;
	const getPool = () => {
		if (!options.connectionString) throw new Error("cms.server: postgres connectionString is not configured");
		pool ??= new Pool({ connectionString: options.connectionString });
		return pool;
	};
	const schema = options.schema ? { schema: options.schema } : undefined;
	return {
		name: "postgres",
		createStore: (storeOptions) =>
			lazyStore(async () => (await loadStoreModule()).createContentStore(getPool(), { ...schema, ...storeOptions })),
		migrate: async () => (await loadStoreModule()).migrateContentStore(getPool(), schema),
		pluginDatabase: () => pluginDatabaseFor(getPool(), options.schema),
		close: async () => {
			await pool?.end();
			pool = undefined;
		},
	};
}

/** 플러그인이 쓰는 DB(연결·스키마·한 번만 하는 일). 테스트에서도 같은 모양을 만든다. */
export function pluginDatabaseFor(pool: Pool, schema?: string): PluginDatabase {
	const qSchema = validateSchemaName(schema);
	return {
		pool,
		schema: qSchema,
		once: async (name, run) => (await loadSchemaModule()).runOnce(pool, { schema: qSchema }, name, run),
	};
}
