import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";
import { postgres } from "../adapter";

// No database is used in this file: the driver's pool is replaced (the network edge). It records what it was given and the SQL the real store sends, then fails.
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

describe("postgres decisions", () => {
	const decide = (options: Parameters<typeof postgres>[0], env: Record<string, string | undefined>) =>
		Object.fromEntries((postgres(options).inspector?.decisions(env) ?? []).map((item) => [item.topic, item]));

	it("DOC-R5 reports a URL from the environment", () => {
		const { Database } = decide({}, { DATABASE_URL: "postgres://u:pw@localhost:5432/monti" });
		expect(Database?.value).toBe("localhost:5432/monti");
		expect(Database?.source).toBe("from env DATABASE_URL");
	});

	it("CLI-P1 never prints the password", () => {
		const text = JSON.stringify([
			...(postgres({ connectionString: "postgres://user:s3cr3t-pw@db.test/shop" }).inspector?.decisions({}) ?? []),
			...(postgres().inspector?.decisions({ DATABASE_URL: "postgres://user:s3cr3t-pw@db.test/shop" }) ?? []),
		]);
		expect(text).not.toContain("s3cr3t-pw");
		expect(text).not.toContain("user:");
	});
});

describe("postgres() reads the conventional environment variables", () => {
	/** The schemas the store's SQL named its `entries` table in, after reading one entry through it. */
	const schemasRead = async (adapter: ReturnType<typeof postgres>) => {
		await adapter
			.createStore({ site: testSite })
			.getEntry("11111111-1111-4111-8111-111111111111")
			.catch(() => undefined);
		return [
			...new Set(statements.flatMap((sql) => [...sql.matchAll(/"([^"]+)"\."entries"/g)].map((match) => match[1]))),
		];
	};

	beforeEach(() => {
		pools.length = 0;
		statements.length = 0;
		vi.stubEnv("DATABASE_URL", "");
		vi.stubEnv("DATABASE_SCHEMA", "");
	});
	afterEach(() => vi.unstubAllEnvs());

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

describe("postgres() lazy loading", () => {
	// Loading the store module (SQL, MDX parsing, the rules that read the site) fails. `postgres()` and creating the store alone must not load it.
	// The rest of this file loads it for real, so the module is replaced only here, on a fresh module graph.
	beforeAll(() => {
		vi.resetModules();
		vi.doMock("../content-store", () => {
			throw new Error("store module was loaded");
		});
	});
	afterAll(() => {
		vi.doUnmock("../content-store");
		vi.resetModules();
	});

	it("CONF-I1 does not load the store module when creating the adapter and getting the store", async () => {
		const { postgres } = await import("../adapter");
		const adapter = postgres({ connectionString: "postgres://localhost/none" });
		const store = adapter.createStore({ site: testSite });
		expect(typeof store.getEntry).toBe("function");
		// The store module loads the moment a function is called (here it is blocked, so it fails).
		await expect(store.getEntry("x")).rejects.toThrow(/store module was loaded|error when mocking/);
		await adapter.close?.();
	});
});
