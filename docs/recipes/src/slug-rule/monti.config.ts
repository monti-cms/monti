import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "../site/schema";
import { lowercaseSlugs, slugRule } from "./hooks";

export const cms = defineConfig({
	schema,
	database: postgres(),
	// Fix first, then refuse the rest. Different stages, so the lists do not overlap.
	hooks: { ...lowercaseSlugs, ...slugRule },
});
