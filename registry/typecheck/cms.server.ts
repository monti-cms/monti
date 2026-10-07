import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";

/**
 * Stands in for the host app's `cms.server.ts` (`@/cms.server`) when the registry sources are type checked here. It is not part of any item.
 * The types of `cms.read` come from `@cms-config`, which `tsconfig.json` points at the core package's test config.
 */
export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		// Never called: this file only gives `cms` its type.
		auth: undefined as never,
		secret: process.env.CMS_SECRET,
	}),
});
