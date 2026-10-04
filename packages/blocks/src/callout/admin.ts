import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CalloutProvider } from "./provider";

/** Admin UI side of the callout block plugin. Registers the whole editing view (`blockViews`). */
export default defineAdminPlugin({ Provider: CalloutProvider });
