import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ColumnsProvider } from "./provider.js";
/** Admin UI side of the columns block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ Provider: ColumnsProvider });
