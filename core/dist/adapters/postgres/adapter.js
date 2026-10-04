import { Pool } from "pg";
import { validateSchemaName } from "./store/context.js";
/**
 * The store module (SQL, MDX parsing, and the business rules that read the site config) is loaded on first use, so
 * importing only `postgres()` from `cms.server.ts` does not pull in store code or the site config.
 */
const loadStoreModule = () => import("./content-store.js");
const loadSchemaModule = () => import("./store/schema.js");
/**
 * A proxy store that creates the real store on first call. Every store function is async, so callers cannot tell the
 * difference (it does not spread or enumerate the function list).
 */
function lazyStore(create) {
    let store;
    const load = () => {
        store ??= create().catch((error) => {
            store = undefined;
            throw error;
        });
        return store;
    };
    return new Proxy({}, {
        get: (_target, name) => {
            if (name === "then")
                return undefined;
            return async (...args) => {
                const real = (await load());
                const method = real[name];
                if (typeof method !== "function")
                    throw new Error(`cms: content store has no method ${String(name)}`);
                return method.apply(real, args);
            };
        },
    });
}
/** Postgres content store. */
export function postgres(options) {
    let pool;
    const getPool = () => {
        if (!options.connectionString)
            throw new Error("cms.server: postgres connectionString is not configured");
        pool ??= new Pool({ connectionString: options.connectionString });
        return pool;
    };
    const schema = options.schema ? { schema: options.schema } : undefined;
    return {
        name: "postgres",
        createStore: (storeOptions) => lazyStore(async () => (await loadStoreModule()).createContentStore(getPool(), { ...schema, ...storeOptions })),
        migrate: async () => (await loadStoreModule()).migrateContentStore(getPool(), schema),
        pluginDatabase: () => pluginDatabaseFor(getPool(), options.schema),
        close: async () => {
            await pool?.end();
            pool = undefined;
        },
    };
}
/** DB used by plugins (connection, schema, run-once jobs). Tests build the same shape. */
export function pluginDatabaseFor(pool, schema) {
    const qSchema = validateSchemaName(schema);
    return {
        pool,
        schema: qSchema,
        once: async (name, run) => (await loadSchemaModule()).runOnce(pool, { schema: qSchema }, name, run),
    };
}
