import { defineBlockAdmin } from "../shared/define-block-admin";
import { ColumnsProvider } from "./provider";

/** Admin UI side of the columns block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(ColumnsProvider);
