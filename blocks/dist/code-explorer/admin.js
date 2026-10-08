import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CodeExplorerProvider } from "./provider.js";
/** Admin UI side of the code explorer block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ Provider: CodeExplorerProvider });
