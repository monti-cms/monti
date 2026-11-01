import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";

// No database is used: the driver's pool is replaced (the network edge). It records what it was given and the SQL the real store sends, then fails.
const pools: { connectionString?: string }[] = [];
const statements: string[] = [];

vi.mock("pg", () => {
	const refuse = async (statement: unknown) => {
		statements.push(typeof statement === "string" ? statement : (statement as { text: string }).text);
		throw new Error("no database in this test");
	};
	class Pool {
		constructor(options: { connectionString?: string }) {
			pools.push(options);
		}
		query = refuse;
		async connect() {
			return { query: refuse, release() {} };
		}
		async end() {}
	}
	return { Pool, default: { Pool } };
});

const { postgres } = await import("../adapter");

/** The schemas the store's SQL named its `entries` table in, after reading one entry through it. */
const schemasRead = async (adapter: ReturnType<typeof postgres>) => {
	await adapter
		.createStore({ site: testSite })
		.getEntry("11111111-1111-4111-8111-111111111111")
		.catch(() => undefined);
	return [...new Set(statements.flatMap((sql) => [...sql.matchAll(/"([^"]+)"\."entries"/g)].map((match) => match[1])))];
};

beforeEach(() => {
	pools.length = 0;
	statements.length = 0;
	vi.stubEnv("DATABASE_URL", "");
	vi.stubEnv("DATABASE_SCHEMA", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("postgres() reads the conventional environment variables", () => {
	it("DB-C1 works with no arguments: DATABASE_URL and DATABASE_SCHEMA", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		vi.stubEnv("DATABASE_SCHEMA", "blog");
		const adapter = postgres();
		expect(await schemasRead(adapter)).toEqual(["blog"]);
		expect(pools).toEqual([{ connectionString: "postgres://env/db" }]);
		await adapter.close?.();
	});

	it("DB-C1 uses the public schema when neither the option nor DATABASE_SCHEMA is set", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		expect(await schemasRead(postgres())).toEqual(["public"]);
	});

	it("DB-C1 lets explicit values win over the environment", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		vi.stubEnv("DATABASE_SCHEMA", "from_env");
		const adapter = postgres({ connectionString: "postgres://explicit/db", schema: "explicit" });
		expect(await schemasRead(adapter)).toEqual(["explicit"]);
		expect(pools).toEqual([{ connectionString: "postgres://explicit/db" }]);
	});

	it("DB-C1 does not guess the connection string from any other variable", async () => {
		vi.stubEnv("CMS_DATABASE_URL", "postgres://old/name");
		vi.stubEnv("POSTGRES_URL", "postgres://other/name");
		await expect(postgres().migrate({ site: testSite })).rejects.toThrow(/DATABASE_URL/);
		expect(pools).toEqual([]);
	});

	it("DB-C1 says which variable is missing, when the connection is first used and not before", async () => {
		const adapter = postgres();
		expect(() => adapter.createStore({ site: testSite })).not.toThrow();
		const message = await adapter.migrate({ site: testSite }).then(
			() => "",
			(error: Error) => error.message,
		);
		expect(message).toContain("DATABASE_URL");
		expect(message).toMatch(/Where:.*postgres\(\{ connectionString \}\)/);
		expect(message).toMatch(/Fix:.*postgres:\/\//);
	});
});
