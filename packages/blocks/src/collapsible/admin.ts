import { defineBlockAdmin } from "../shared/define-block-admin";
import { CollapsibleProvider } from "./provider";

/** Admin UI side of the collapsible block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CollapsibleProvider);
