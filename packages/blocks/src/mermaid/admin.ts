import { defineAdminPlugin } from "@monti-cms/admin";
import { mermaidComponents } from "./provider";

/** Admin UI side of the Mermaid diagram block plugin. Registers the menu icon. */
export default defineAdminPlugin({ components: mermaidComponents });
