import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { MermaidProvider } from "./provider.js";
/** Admin UI side of the Mermaid diagram block plugin. Registers the menu icon. */
export default defineAdminPlugin({ Provider: MermaidProvider });
