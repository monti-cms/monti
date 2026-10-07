import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";

// No database is used: the pool and the store module are replaced, and what they were given is what is checked.
const pools: { connectionString?: string }[] = [];
const stores: { schema?: string }[] = [];

vi.mock("pg", () => ({
	Pool: class {
		constructor(options: { connectionString?: string }) {
			pools.push(options);
		}
		async end() {}
	},
}));
vi.mock("../content-store", () => ({
	createContentStore: (_pool: unknown, options: { schema?: string }) => {
		stores.push(options);
		return { getEntry: async () => null };
	},
	migrateContentStore: async (_pool: unknown, options: { schema?: string }) => {
		stores.push(options);
	},
}));

const { postgres } = await import("../adapter");

beforeEach(() => {
	pools.length = 0;
	stores.length = 0;
	vi.stubEnv("DATABASE_URL", "");
	vi.stubEnv("DATABASE_SCHEMA", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("postgres() reads the conventional environment variables", () => {
	it("works with no arguments: DATABASE_URL and DATABASE_SCHEMA", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		vi.stubEnv("DATABASE_SCHEMA", "blog");
		const adapter = postgres();
		await adapter.createStore({ site: testSite }).getEntry("x");
		expect(pools).toEqual([{ connectionString: "postgres://env/db" }]);
		expect(stores[0]?.schema).toBe("blog");
		await adapter.close?.();
	});

	it("uses the public schema when neither the option nor DATABASE_SCHEMA is set", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		const adapter = postgres();
		await adapter.migrate({ site: testSite });
		expect(stores[0]).not.toHaveProperty("schema");
	});

	it("lets explicit values win over the environment", async () => {
		vi.stubEnv("DATABASE_URL", "postgres://env/db");
		vi.stubEnv("DATABASE_SCHEMA", "from_env");
		const adapter = postgres({ connectionString: "postgres://explicit/db", schema: "explicit" });
		await adapter.migrate({ site: testSite });
		expect(pools).toEqual([{ connectionString: "postgres://explicit/db" }]);
		expect(stores[0]?.schema).toBe("explicit");
	});

	it("does not guess the connection string from any other variable", async () => {
		vi.stubEnv("CMS_DATABASE_URL", "postgres://old/name");
		vi.stubEnv("POSTGRES_URL", "postgres://other/name");
		await expect(postgres().migrate({ site: testSite })).rejects.toThrow(/DATABASE_URL/);
		expect(pools).toEqual([]);
	});

	it("says which variable is missing, when the connection is first used and not before", async () => {
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
