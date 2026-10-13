import { defineBlockAdmin } from "../shared/define-block-admin";
import { TabsProvider } from "./provider";

/** Admin UI side of the tabs block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(TabsProvider);
