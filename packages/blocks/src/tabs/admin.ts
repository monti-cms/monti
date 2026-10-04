import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { TabsProvider } from "./provider";

/** Admin UI side of the tabs block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ Provider: TabsProvider });
