import { defineBlockAdmin } from "../shared/define-block-admin";
import { CodeExplorerProvider } from "./provider";

/** Admin UI side of the code explorer block plugin. Registers the whole editing view (`blockViews`). */
export default defineBlockAdmin(CodeExplorerProvider);
