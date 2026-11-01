import { createMemoryPluginStorage } from "../memory-storage";
import { runPluginStorageContract } from "./storage.contract";

runPluginStorageContract({
	name: "in-memory",
	create: async () => {
		const memory = createMemoryPluginStorage();
		return {
			storage: memory.storage,
			close: async () => undefined,
		};
	},
});
