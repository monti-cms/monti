import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import { fakeCms } from "../../cms";
import { definePlugin } from "../../plugin/define";
import { postgres } from "../../server";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool, migrateContentStore } from "../../testing";

const VALUE = "sk-ant-api03-abcdefghij3f9a";
const SECRET = "a-long-enough-test-secret";

const services = definePlugin({
	name: "services",
	server: async () => ({
		default: { keyServices: () => [{ id: "anthropic", label: "Anthropic", group: "ai" as const }] },
	}),
});

/** `cms.transaction` over the real Postgres adapter: the key and the plugin's own document are written in one database transaction. */
describe("cms.transaction on Postgres", () => {
	let pool: Pool;
	let schemaName: string;
	let database: ReturnType<typeof postgres>;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		database = postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName });
	});

	afterAll(async () => {
		await database.close?.();
		await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("KEY-A2 keeps a new key and the item that uses it together, or neither", async () => {
		const cms = fakeCms({
			config: { ...testConfig, plugins: [services] } as never,
			server: { secret: SECRET, database },
		});
		const settings = () => cms.plugin("my-plugin").storage.collection<{ keyId: string | null }>("settings");

		await expect(
			cms.transaction(async (tx) => {
				const key = await tx.apiKeys.add({ service: "anthropic", name: "Mine", value: VALUE });
				await tx.storage("my-plugin").collection("settings").set("default", { keyId: key.id }, { expectedVersion: 0 });
				throw new Error("the save failed");
			}),
		).rejects.toThrow("the save failed");
		expect(await cms.apiKeys.list()).toEqual([]);
		expect(await settings().get("default")).toBeNull();

		await cms.transaction(async (tx) => {
			const key = await tx.apiKeys.add({ service: "anthropic", name: "Mine", value: VALUE });
			await tx.storage("my-plugin").collection("settings").set("default", { keyId: key.id }, { expectedVersion: 0 });
		});
		const [key] = await cms.apiKeys.list();
		expect(key?.name).toBe("Mine");
		expect((await settings().get("default"))?.value.keyId).toBe(key?.id);
		expect((await cms.apiKeys.access(key?.id as string))?.value).toBe(VALUE);
	});
});
