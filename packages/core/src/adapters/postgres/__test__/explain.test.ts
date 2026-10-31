import { describe, expect, it } from "vitest";
import { SetupError } from "../../../core/problem";
import { describeConnection, explainDatabaseError } from "../explain";

/** What a newcomer reads when the database is not what the app expects: what is wrong, where, and how to fix it. */

const URL_WITH_PASSWORD = "postgres://monti:hunter2@db.example.com:5432/blog";
const explain = (error: unknown, schema?: string) =>
	explainDatabaseError(error, { connectionString: URL_WITH_PASSWORD, schema });

describe("explainDatabaseError", () => {
	it("DB-C4 describes a connection without its user and password", () => {
		expect(describeConnection(URL_WITH_PASSWORD)).toBe("db.example.com:5432/blog");
		expect(describeConnection("not a url")).toBeUndefined();
		expect(describeConnection(undefined)).toBeUndefined();
	});

	it.each([
		[{ code: "ECONNREFUSED" }, "database_unreachable", "Nothing is listening", "start Postgres"],
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
	])("DB-C4 explains %j", (driverError, kind, what, fix) => {
		const error = explain(driverError);
		expect(error).toBeInstanceOf(SetupError);
		expect(error?.kind).toBe(kind);
		expect(error?.message).toContain(what);
		expect(error?.message).toMatch(/Where: .*DATABASE_URL/);
		expect(error?.message).toContain(fix);
		// The password never reaches a message.
		expect(error?.message).not.toContain("hunter2");
	});

	it("SETUP-E1 names the host the driver could not reach, also when the error is an AggregateError (localhost resolves to two addresses)", () => {
		const aggregate = Object.assign(
			new AggregateError([Object.assign(new Error("refused"), { code: "ECONNREFUSED" })]),
			{ code: undefined },
		);
		const error = explain(aggregate);
		expect(error?.kind).toBe("database_unreachable");
		expect(error?.message).toContain("db.example.com:5432/blog");
	});

	it("SETUP-E1 says `monti db:migrate` for tables that are missing or older than the code, and keeps the driver's code", () => {
		const missing = explain(
			Object.assign(new Error('relation "monti.entries" does not exist'), { code: "42P01" }),
			"monti",
		);
		expect(missing?.kind).toBe("migrations_pending");
		expect(missing?.message).toContain('schema "monti"');
		expect(missing?.message).toContain("Where: DATABASE_SCHEMA");
		expect(missing?.message).toContain("`monti db:migrate`");
		expect(missing?.message).toContain("deploy");
		// Code that tells a missing table apart (`schema:diff`, the importer) still sees the driver's code.
		expect(missing?.code).toBe("42P01");

		const old = explain(Object.assign(new Error('column "x" does not exist'), { code: "42703" }));
		expect(old?.kind).toBe("migrations_pending");
		expect(old?.message).toContain("older than this version of Monti");
		expect(old?.message).toContain("`monti db:migrate`");
	});

	it("SETUP-E1 leaves an error that is not a setup problem alone", () => {
		expect(explain(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBeUndefined();
		expect(explain(new Error("something else"))).toBeUndefined();
		expect(explain("text")).toBeUndefined();
	});
});
