import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CollapsibleProvider } from "./provider";

/** Admin UI side of the collapsible block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ Provider: CollapsibleProvider });
