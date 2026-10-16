import { defineAdminPlugin } from "@monti-cms/admin";
import { codeExplorerComponents } from "./provider";

/** Admin UI side of the code explorer block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ components: codeExplorerComponents });
