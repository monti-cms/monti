import { Pool } from "pg";
import { problemError } from "../../core/problem.js";
import { DATABASE_URL_WHERE, describeConnection, explainDatabaseError } from "./explain.js";
import { createPluginStorage } from "./plugin-storage.js";
/** The environment variable `postgres()` reads the connection string from when `connectionString` is not given. */
export const DATABASE_URL_ENV = "DATABASE_URL";
/** The environment variable `postgres()` reads the schema name from when `schema` is not given. */
export const DATABASE_SCHEMA_ENV = "DATABASE_SCHEMA";
/**
 * The store module (SQL, MDX parsing, and the business rules that read the site config) is loaded on first use, so
 * calling `postgres()` (when `monti.config.ts` creates the instance) does not load the store code.
 */
const loadStoreModule = () => import("./content-store.js");
/**
 * A proxy store that creates the real store on first call. Every store function is async, so callers cannot tell the
 * difference (it does not spread or enumerate the function list).
 */
function lazyStore(create, explain) {
    let store;
    const load = () => {
        store ??= create().catch((error) => {
            store = undefined;
            throw explain(error) ?? error;
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
                try {
                    return await method.apply(real, args);
                }
                catch (error) {
                    // A database that is down or not migrated says so, with the fix, instead of the driver's message.
                    throw explain(error) ?? error;
                }
            };
        },
    });
}
/**
 * Postgres content store. It works with no arguments: the connection string is read from `DATABASE_URL` and the schema name from `DATABASE_SCHEMA`
 * (no other variable is looked at), and a value passed here wins. The environment is read when the connection is first used, so building the app
 * without it does not fail; a missing connection string is an error that names the variable.
 */
export function postgres(options = {}) {
    let pool;
    const getPool = () => {
        const connectionString = options.connectionString || process.env[DATABASE_URL_ENV];
        if (!connectionString) {
            throw problemError({
                what: `${DATABASE_URL_ENV} is not set, so there is no database to connect to`,
                where: DATABASE_URL_WHERE,
                fix: `put your Postgres URL in ${DATABASE_URL_ENV}, for example ${DATABASE_URL_ENV}=postgres://user:password@localhost:5432/monti, then run \`monti doctor\``,
            }, undefined, "database_url_missing");
        }
        pool ??= new Pool({ connectionString });
        return pool;
    };
    /** Read when used (like the connection string), so the environment of the running process decides. */
    const schemaOptions = () => {
        const schema = options.schema || process.env[DATABASE_SCHEMA_ENV];
        return schema ? { schema } : undefined;
    };
    const explain = (error) => explainDatabaseError(error, {
        connectionString: options.connectionString || process.env[DATABASE_URL_ENV],
        schema: schemaOptions()?.schema,
    });
    return {
        name: "postgres",
        settings: () => ({ connectionString: options.connectionString, schema: options.schema }),
        createStore: (storeOptions) => lazyStore(async () => (await loadStoreModule()).createContentStore(getPool(), { ...schemaOptions(), ...storeOptions }), explain),
        migrate: async (migrateOptions) => {
            try {
                const store = await loadStoreModule();
                return await store.migrateContentStore(getPool(), {
                    ...schemaOptions(),
                    site: migrateOptions.site,
                    formats: migrateOptions.formats,
                });
            }
            catch (error) {
                throw explain(error) ?? error;
            }
        },
        decisions: (env) => {
            const url = options.connectionString || env[DATABASE_URL_ENV]?.trim() || undefined;
            const schema = options.schema || env[DATABASE_SCHEMA_ENV]?.trim() || undefined;
            return [
                {
                    topic: "Database",
                    value: describeConnection(url) ?? "no URL",
                    source: options.connectionString
                        ? "set in monti.config.ts (postgres({ connectionString }))"
                        : url
                            ? `from env ${DATABASE_URL_ENV}`
                            : `${DATABASE_URL_ENV} is not set`,
                },
                {
                    topic: "Database schema",
                    value: schema ?? "public",
                    source: options.schema
                        ? "set in monti.config.ts (postgres({ schema }))"
                        : schema
                            ? `from env ${DATABASE_SCHEMA_ENV}`
                            : `default (${DATABASE_SCHEMA_ENV} is not set)`,
                },
            ];
        },
        describeTarget: () => {
            const where = describeConnection(options.connectionString || process.env[DATABASE_URL_ENV]);
            return where ? `${where}, schema "${schemaOptions()?.schema ?? "public"}"` : undefined;
        },
        pluginStorage: (plugin) => createPluginStorage(getPool(), schemaOptions()?.schema, plugin),
        close: async () => {
            await pool?.end();
            pool = undefined;
        },
    };
}
