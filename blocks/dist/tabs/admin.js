import { defineAdminPlugin } from "@monti-cms/admin";
import { tabsComponents } from "./provider.js";
/** Admin UI side of the tabs block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ components: tabsComponents });
