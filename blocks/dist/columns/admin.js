import { defineAdminPlugin } from "@monti-cms/admin";
import { columnsComponents } from "./provider.js";
/** Admin UI side of the columns block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ components: columnsComponents });
