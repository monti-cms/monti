import { testSite } from "../../../../test/site";
import type { StoreFactory } from "../../../core/store/__test__/contract/harness";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The Postgres adapter as a store factory for the contract: every session is a new schema in the test database. */
export const postgresStoreFactory: StoreFactory = {
	name: "postgres",
	create: async () => {
		const { pool, schemaName } = await createIsolatedTestPool();
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		return {
			store: createContentStore(pool, { site: testSite, schema: schemaName }),
			close: () => dropIsolatedTestPool(pool, schemaName),
		};
	},
	dispose: closeGlobalPool,
};
