import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";
import { SetupError } from "../../../core/problem";
import { postgres } from "../adapter";
import { describeConnection, explainDatabaseError } from "../explain";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** What a newcomer reads when the database is not what the app expects: what is wrong, where, and how to fix it. */

const URL_WITH_PASSWORD = "postgres://monti:hunter2@db.example.com:5432/blog";
const explain = (error: unknown, schema?: string) =>
	explainDatabaseError(error, { connectionString: URL_WITH_PASSWORD, schema });

describe("explainDatabaseError", () => {
	it("describes a connection without its user and password", () => {
		expect(describeConnection(URL_WITH_PASSWORD)).toBe("db.example.com:5432/blog");
		expect(describeConnection("not a url")).toBeUndefined();
		expect(describeConnection(undefined)).toBeUndefined();
	});

	it.each([
		[{ code: "ECONNREFUSED" }, "database_unreachable", "Nothing is listening", "docker compose up -d"],
		[{ code: "ENOTFOUND" }, "database_unreachable", "cannot be found", "typo"],
		[{ message: "Connection terminated due to connection timeout" }, "database_unreachable", "timed out", "allow-list"],
		[{ code: "28P01" }, "database_login_failed", "refused the user or password", "percent-encoded"],
		[{ code: "3D000" }, "database_missing", "does not exist", "createdb"],
		[{ message: "The server does not support SSL connections" }, "database_ssl", "does not use SSL", "sslmode=require"],
		[{ message: "self-signed certificate in certificate chain" }, "database_ssl", "not trusted", "sslmode=no-verify"],
		[
			{ code: "ERR_INVALID_URL", message: "Invalid URL" },
			"database_url_invalid",
			"cannot be read",
			"postgres://user:password@host",
		],
	])("explains %j", (driverError, kind, what, fix) => {
		const error = explain(driverError);
		expect(error).toBeInstanceOf(SetupError);
		expect(error?.kind).toBe(kind);
		expect(error?.message).toContain(what);
		expect(error?.message).toMatch(/Where: .*DATABASE_URL/);
		expect(error?.message).toContain(fix);
		// The password never reaches a message.
		expect(error?.message).not.toContain("hunter2");
	});

	it("names the host the driver could not reach, also when the error is an AggregateError (localhost resolves to two addresses)", () => {
		const aggregate = Object.assign(
			new AggregateError([Object.assign(new Error("refused"), { code: "ECONNREFUSED" })]),
			{ code: undefined },
		);
		const error = explain(aggregate);
		expect(error?.kind).toBe("database_unreachable");
		expect(error?.message).toContain("db.example.com:5432/blog");
	});

	it("says `monti migrate` for tables that are missing or older than the code, and keeps the driver's code", () => {
		const missing = explain(
			Object.assign(new Error('relation "monti.entries" does not exist'), { code: "42P01" }),
			"monti",
		);
		expect(missing?.kind).toBe("migrations_pending");
		expect(missing?.message).toContain('schema "monti"');
		expect(missing?.message).toContain("Where: DATABASE_SCHEMA");
		expect(missing?.message).toContain("`monti migrate`");
		expect(missing?.message).toContain("deploy");
		// Code that tells a missing table apart (`schema:diff`, the importer) still sees the driver's code.
		expect(missing?.code).toBe("42P01");

		const old = explain(Object.assign(new Error('column "x" does not exist'), { code: "42703" }));
		expect(old?.kind).toBe("migrations_pending");
		expect(old?.message).toContain("older than this version of Monti");
		expect(old?.message).toContain("`monti migrate`");
	});

	it("leaves an error that is not a setup problem alone", () => {
		expect(explain(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBeUndefined();
		expect(explain(new Error("something else"))).toBeUndefined();
		expect(explain("text")).toBeUndefined();
	});

	it("keeps an error that already explains itself", () => {
		const once = explain({ code: "ECONNREFUSED" });
		expect(explain(once)).toBe(once);
	});
});

describe("postgres() at run time", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>;
	beforeAll(async () => {
		pool = await createIsolatedTestPool();
	});
	afterAll(async () => {
		await dropIsolatedTestPool(pool.pool, pool.schemaName);
		await closeGlobalPool();
	});

	it("tells to run `monti migrate` when the tables are not there, as the first request of a new site meets it", async () => {
		const adapter = postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: pool.schemaName });
		const store = adapter.createStore({ site: testSite });
		const error = await store.getPreferences({ userId: "u" }).then(
			() => undefined,
			(failure: unknown) => failure,
		);
		expect(error).toBeInstanceOf(SetupError);
		expect((error as SetupError).kind).toBe("migrations_pending");
		expect((error as SetupError).message).toContain(pool.schemaName);
		expect((error as SetupError).message).toContain("monti migrate");
		await adapter.close?.();
	});

	it("names a schema name that cannot be used", async () => {
		const adapter = postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: "bad-name;" });
		const failure = await adapter.migrate({ site: testSite }).then(
			() => "",
			(error: Error) => error.message,
		);
		expect(failure).toContain('"bad-name;"');
		expect(failure).toContain("DATABASE_SCHEMA");
		expect(failure).toContain("letters, digits and underscores");
		await adapter.close?.();
	});

	it("names an unreachable database when the connection is first used", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const adapter = postgres({ connectionString: "postgres://u:secret-password@127.0.0.1:1/none" });
		const error = await adapter
			.createStore({ site: testSite })
			.getPreferences({ userId: "u" })
			.then(
				() => undefined,
				(failure: unknown) => failure as Error,
			);
		expect(error?.message).toContain("Nothing is listening for the database at 127.0.0.1:1/none");
		expect(error?.message).not.toContain("secret-password");
		await adapter.close?.();
		vi.restoreAllMocks();
	});
});
