import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { CodeExplorerProvider } from "./provider.js";
/** Admin UI side of the code explorer block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CodeExplorerProvider);
