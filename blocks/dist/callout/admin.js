import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { CalloutProvider } from "./provider.js";
/** Admin UI side of the callout block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CalloutProvider);
