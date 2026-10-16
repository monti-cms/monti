import { defineAdminPlugin } from "@monti-cms/admin";
import { calloutComponents } from "./provider";

/** Admin UI side of the callout block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ components: calloutComponents });
