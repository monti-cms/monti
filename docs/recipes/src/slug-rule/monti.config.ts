import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "../site/schema";
import { lowercaseSlug, refuseBadSlug } from "./rules";

export const cms = defineConfig({
	schema,
	database: postgres(),
	// Fix first, then refuse the rest: `beforeValidate` runs before core prepares the data, `beforeSave` after.
	on: { entry: { beforeValidate: [lowercaseSlug], beforeSave: [refuseBadSlug] } },
});
