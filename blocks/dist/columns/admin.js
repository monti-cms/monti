import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { ColumnsProvider } from "./provider.js";
/** Admin UI side of the columns block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(ColumnsProvider);
