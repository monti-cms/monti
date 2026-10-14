import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { TabsProvider } from "./provider.js";
/** Admin UI side of the tabs block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(TabsProvider);
