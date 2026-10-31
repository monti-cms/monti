import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";
import { SetupError } from "../../../core/problem";
import { postgres } from "../adapter";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("postgres() at run time", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>;
	beforeAll(async () => {
		pool = await createIsolatedTestPool();
	});
	afterAll(async () => {
		await dropIsolatedTestPool(pool.pool, pool.schemaName);
		await closeGlobalPool();
	});

	it("SETUP-E1 tells to run `monti db:migrate` when the tables are not there, as the first request of a new site meets it", async () => {
		const adapter = postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: pool.schemaName });
		const store = adapter.createStore({ site: testSite });
		const error = await store.getPreferences({ userId: "u" }).then(
			() => undefined,
			(failure: unknown) => failure,
		);
		expect(error).toBeInstanceOf(SetupError);
		expect((error as SetupError).kind).toBe("migrations_pending");
		expect((error as SetupError).message).toContain(pool.schemaName);
		expect((error as SetupError).message).toContain("monti db:migrate");
		await adapter.close?.();
	});

	it("DB-C1 names a schema name that cannot be used", async () => {
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

	it("DB-C4 names an unreachable database when the connection is first used", async () => {
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
