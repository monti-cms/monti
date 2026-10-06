import { createMemoryPluginStorage } from "../memory-storage";
import { runPluginStorageContract } from "./storage-contract";

runPluginStorageContract({
	name: "in-memory",
	create: async () => {
		const memory = createMemoryPluginStorage();
		return {
			storage: memory.storage,
			seedLegacyTable: async (table, rows) => memory.seedLegacyTable(table, rows),
			recordMigration: async (name) => memory.recordMigration(name),
			close: async () => undefined,
		};
	},
});
