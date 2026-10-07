import { Pool } from "pg";
import type { ContentStore } from "../../core/store";
import type { DatabaseAdapter } from "../../server/define";
import { createPluginStorage } from "./plugin-storage";

export interface PostgresOptions {
	/** Connection string. Throws on first use if missing (it may be empty during builds). */
	readonly connectionString: string | undefined;
	/** Schema that holds the tables. Change it when the same DB is shared with previews or staging. Defaults to `public`. */
	readonly schema?: string;
}

/**
 * The store module (SQL, MDX parsing, and the business rules that read the site config) is loaded on first use, so
 * calling `postgres()` (when `cms.server.ts` creates the instance) does not load the store code.
 */
const loadStoreModule = () => import("./content-store");

/**
 * A proxy store that creates the real store on first call. Every store function is async, so callers cannot tell the
 * difference (it does not spread or enumerate the function list).
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

/** Postgres content store. */
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
		migrate: async (migrateOptions) =>
			(await loadStoreModule()).migrateContentStore(getPool(), {
				...schema,
				site: migrateOptions.site,
				formats: migrateOptions.formats,
			}),
		pluginStorage: (plugin) => createPluginStorage(getPool(), options.schema, plugin),
		close: async () => {
			await pool?.end();
			pool = undefined;
		},
	};
}
