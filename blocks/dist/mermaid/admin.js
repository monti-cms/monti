import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { MermaidProvider } from "./provider.js";
/** Admin UI side of the Mermaid diagram block plugin. Registers the menu icon. */
export default defineBlockAdmin(MermaidProvider);
