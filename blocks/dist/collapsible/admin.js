import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { CollapsibleProvider } from "./provider.js";
/** Admin UI side of the collapsible block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CollapsibleProvider);
