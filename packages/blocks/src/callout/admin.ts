import { defineBlockAdmin } from "../shared/define-block-admin";
import { CalloutProvider } from "./provider";

/** Admin UI side of the callout block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CalloutProvider);
