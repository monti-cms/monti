import { migratePlugins } from "../../plugin/server";
import { cmsServerConfig } from "../../server/resolved";

/**
 * Creates the tables in the store from the server config (`cms.server.ts`) or brings them up to date (including plugin tables). Running it repeatedly gives the same result.
 * Called by the `monti migrate` command. Returns `true` on success.
 */
export async function runMigrate(log: (message: string) => void = console.log): Promise<boolean> {
	const { database } = cmsServerConfig;
	log(`Starting CMS database migration (${database.name})...`);
	try {
		await database.migrate();
		await migratePlugins();
		log("CMS database migration completed successfully!");
		return true;
	} catch (err) {
		console.error("Migration failed:", err);
		return false;
	} finally {
		await database.close?.();
	}
}
