import { Pool } from "pg";
import { SSLMODE_FIX, sslmodeWarning } from "../../adapters/postgres/connection";
import { DATABASE_URL_WHERE, describeConnection, explainDatabaseError } from "../../adapters/postgres/explain";
import type { CoreCheck, DoctorState } from "./core-checks";
import { fail, ok, skip, warn } from "./outcome";

/** How long a check waits for the database before it calls it unreachable. */
const CONNECT_TIMEOUT_MS = 8000;

interface Settings {
	/** The `connectionString` option of `postgres()`. */
	readonly connectionString?: string | undefined;
	/** The `schema` option of `postgres()`. */
	readonly schema?: string | undefined;
}

/** What the database adapter was given in `monti.config.ts` (`DatabaseAdapter.settings`); empty when it exposes none. */
const settingsOf = (state: DoctorState): Settings => state.cms?.server.database.settings?.() ?? {};

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const urlOf = (settings: Settings, state: DoctorState): string | undefined =>
	settings.connectionString || state.env.DATABASE_URL?.trim() || undefined;

const schemaOf = (settings: Settings, state: DoctorState): string =>
	settings.schema || state.env.DATABASE_SCHEMA?.trim() || "public";

/** Opens a short-lived pool of its own (the adapter's pool waits for a connection without end), runs `fn` and closes it. */
async function withPool<T>(connectionString: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
	const pool = new Pool({
		connectionString,
		max: 1,
		connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
	});
	// A dropped idle connection must not crash the command.
	pool.on("error", () => undefined);
	try {
		return await fn(pool);
	} finally {
		await pool.end().catch(() => undefined);
	}
}

type Reach = { readonly ok: true; readonly version: string } | { readonly ok: false; readonly error: unknown };

/** One connection attempt per run (the checks after the first reuse its result). */
const reached = new WeakMap<object, Promise<Reach>>();

function reach(state: DoctorState, url: string): Promise<Reach> {
	const key = state.cms ?? state;
	let attempt = reached.get(key);
	if (!attempt) {
		attempt = withPool(url, async (pool) => {
			const result = await pool.query<{ version: string }>("SELECT version() AS version");
			return { ok: true, version: result.rows[0]?.version ?? "" } satisfies Reach;
		}).catch((error: unknown): Reach => ({ ok: false, error }));
		reached.set(key, attempt);
	}
	return attempt;
}

/** `PostgreSQL 17.2 on aarch64...` -> `PostgreSQL 17.2`. */
const shortVersion = (version: string): string => /^PostgreSQL [\d.]+/.exec(version)?.[0] ?? "PostgreSQL";

/**
 * The `database` group of `monti doctor`: the connection string, reaching the database, the schema, and the migrations. The connection string and schema
 * come from what the adapter was given (`DatabaseAdapter.settings`), else from `DATABASE_URL` and `DATABASE_SCHEMA`. The checks open a short-lived
 * connection of their own and change nothing.
 */
const url: CoreCheck = {
	group: "database",
	needsCms: true,
	id: "url",
	title: "Database URL",
	run: (state) => {
		const settings = settingsOf(state);
		const value = urlOf(settings, state);
		if (!value) {
			return fail("DATABASE_URL is not set, so there is no database to connect to", {
				where: DATABASE_URL_WHERE,
				fix: "put your Postgres URL in DATABASE_URL, for example DATABASE_URL=postgres://user:password@localhost:5432/monti. ",
			});
		}
		if (/^["']|["']$|\s/.test(value)) {
			return fail("DATABASE_URL has quotes or spaces around the value", {
				where: DATABASE_URL_WHERE,
				fix: "write the URL on its own, with no quotes and no spaces: DATABASE_URL=postgres://user:password@host:5432/database",
			});
		}
		if (!/^postgres(ql)?:\/\//i.test(value)) {
			return fail(`DATABASE_URL does not start with postgres:// (it starts with "${value.slice(0, 12)}...")`, {
				where: DATABASE_URL_WHERE,
				fix: "use a Postgres connection string: postgres://user:password@host:5432/database. Other databases are not supported",
			});
		}
		const target = describeConnection(value);
		if (!target) {
			return fail("DATABASE_URL cannot be read as a URL", {
				where: DATABASE_URL_WHERE,
				fix: "write it as postgres://user:password@host:5432/database (a password with special characters such as @ or / must be percent-encoded)",
			});
		}
		const where = settings.connectionString ? "postgres({ connectionString })" : "DATABASE_URL";
		const ssl = sslmodeWarning(value);
		if (ssl) return warn(`Postgres at ${target}; ${ssl}`, { where, fix: SSLMODE_FIX });
		return ok(`Postgres at ${target}`, { where });
	},
};

const connect: CoreCheck = {
	group: "database",
	needsCms: true,
	id: "connect",
	title: "Database reachable",
	run: async (state) => {
		const settings = settingsOf(state);
		const value = urlOf(settings, state);
		if (!value || !/^postgres(ql)?:\/\//i.test(value))
			return skip("not checked: DATABASE_URL is not usable (see above)");
		const result = await reach(state, value);
		if (result.ok) return ok(`connected to ${describeConnection(value)} (${shortVersion(result.version)})`);
		const explained = explainDatabaseError(result.error, {
			connectionString: value,
			schema: schemaOf(settings, state),
		});
		if (explained) return fail(explained.problem.what, { where: explained.problem.where, fix: explained.problem.fix });
		return fail(`could not connect to the database: ${(result.error as Error)?.message ?? String(result.error)}`, {
			where: DATABASE_URL_WHERE,
			fix: "check that the database is running and that DATABASE_URL is right",
		});
	},
};

const schema: CoreCheck = {
	group: "database",
	needsCms: true,
	id: "schema",
	title: "Database schema",
	run: async (state) => {
		const settings = settingsOf(state);
		const value = urlOf(settings, state);
		const name = schemaOf(settings, state);
		const where = settings.schema ? "postgres({ schema })" : "DATABASE_SCHEMA (default public)";
		if (!IDENTIFIER.test(name)) {
			return fail(`the schema name "${name}" is not valid`, {
				where,
				fix: "use letters, digits and underscores, starting with a letter or underscore (for example monti_preview)",
			});
		}
		if (!value) return skip("not checked: DATABASE_URL is not set (see above)");
		const result = await reach(state, value);
		if (!result.ok) return skip("not checked: the database cannot be reached (see above)");
		const found = await withPool(value, (pool) =>
			pool.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [name]),
		);
		if (found.rows.length === 0) {
			return warn(`the schema "${name}" does not exist yet`, {
				where,
				fix: "run `monti migrate`, which creates it with the tables",
			});
		}
		return ok(`schema "${name}" exists`, { where });
	},
};

const migrations: CoreCheck = {
	group: "database",
	needsCms: true,
	id: "migrations",
	title: "Migrations applied",
	run: async (state) => {
		const settings = settingsOf(state);
		const value = urlOf(settings, state);
		if (!value) return skip("not checked: DATABASE_URL is not set (see above)");
		const name = schemaOf(settings, state);
		if (!IDENTIFIER.test(name)) return skip("not checked: the schema name is not valid (see above)");
		const result = await reach(state, value);
		if (!result.ok) return skip("not checked: the database cannot be reached (see above)");
		const { CONTENT_STORE_MIGRATIONS } = await import("../../adapters/postgres/store/schema");
		const applied = await withPool(value, async (pool) => {
			try {
				const rows = await pool.query<{ name: string }>(`SELECT name FROM "${name}".cms_migrations`);
				return new Set(rows.rows.map((row) => row.name));
			} catch (error) {
				// No schema or no record table: nothing has been applied here yet.
				const code = (error as { code?: string }).code;
				if (code === "42P01" || code === "3F000") return new Set<string>();
				throw error;
			}
		});
		const pending = CONTENT_STORE_MIGRATIONS.filter((step) => !applied.has(step));
		const total = CONTENT_STORE_MIGRATIONS.length;
		if (pending.length > 0) {
			const none = pending.length === total;
			const names = none ? "" : ` (${pending.slice(0, 3).join(", ")}${pending.length > 3 ? ", ..." : ""})`;
			return fail(
				none
					? `no migration has run: all ${total} are pending, so the tables do not exist yet`
					: `${pending.length} of ${total} migrations are pending${names}`,
				{
					where: `schema "${name}" (table cms_migrations)`,
					fix: "run `monti migrate`; on a deployed site run it as a step of the deploy, before the new version starts",
				},
			);
		}
		const known = new Set(CONTENT_STORE_MIGRATIONS);
		const ahead = [...applied].filter((step) => /^\d{4}_/.test(step) && !known.has(step));
		if (ahead.length > 0) {
			return warn(
				`the database has ${ahead.length} migration${ahead.length === 1 ? "" : "s"} this version of Monti does not know (${ahead.slice(0, 3).join(", ")})`,
				{
					where: `schema "${name}" (table cms_migrations)`,
					fix: "something newer has migrated this database: update @monti-cms/core to the same version, or point DATABASE_URL (or DATABASE_SCHEMA) at a database of this version",
				},
			);
		}
		return ok(`all ${total} migrations are applied`, { where: `schema "${name}"` });
	},
};

export const DATABASE_CHECKS: readonly CoreCheck[] = [url, connect, schema, migrations];
