import { createCms, postgres } from "@monti-cms/core/server";
import config from "../../packages/core/test/cms.config";

/**
 * Stands in for the host app's `monti.config.ts` (`@/monti.config`) when the registry sources are type checked here. It is not part of any item.
 * The types of `cms.read` come from the config it is created with, here the core package's test config.
 */
export const cms = createCms({
	config,
	// Never called: this file only gives `cms` its type.
	server: { database: postgres(), auth: undefined as never },
});
