import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import config from "../../packages/core/test/cms.config";

/**
 * Stands in for the host app's `cms.server.ts` (`@/cms.server`) when the registry sources are type checked here. It is not part of any item.
 * The types of `cms.read` come from the config it is created with, here the core package's test config.
 */
export const cms = createCms({
	config,
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		// Never called: this file only gives `cms` its type.
		auth: undefined as never,
		secret: process.env.CMS_SECRET,
	}),
});
