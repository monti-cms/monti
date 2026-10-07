import { testSite } from "../../../../test/site";
import { runStoreContract } from "../../../core/store/__test__/contract/store-contract";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The Postgres adapter against the store contract: every session is a new schema in the test database. */
runStoreContract({
	name: "postgres",
	create: async (options) => {
		const { pool, schemaName } = await createIsolatedTestPool();
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		return {
			store: createContentStore(pool, { site: testSite, schema: schemaName, afterCommit: options?.afterCommit }),
			close: () => dropIsolatedTestPool(pool, schemaName),
		};
	},
	dispose: closeGlobalPool,
});
