import { defineAdminPlugin } from "@monti-cms/admin";
import { chartComponents } from "./provider.js";
/** Admin UI side of the chart block plugin. Adds the menu icon. */
export default defineAdminPlugin({ components: chartComponents });
