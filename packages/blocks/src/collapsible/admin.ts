import { defineAdminPlugin } from "@monti-cms/admin";
import { collapsibleComponents } from "./provider";

/** Admin UI side of the collapsible block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ components: collapsibleComponents });
