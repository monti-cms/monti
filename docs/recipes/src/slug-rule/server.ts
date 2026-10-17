import { defineServerPlugin } from "@monti-cms/core/server";
import { lowercaseSlug, refuseBadSlug } from "./rules";

export default defineServerPlugin({
	on: { entry: { beforeValidate: [lowercaseSlug], beforeSave: [refuseBadSlug] } },
});
