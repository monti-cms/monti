import { defineBlockAdmin } from "../shared/define-block-admin";
import { MermaidProvider } from "./provider";

/** Admin UI side of the Mermaid diagram block plugin. Registers the menu icon. */
export default defineBlockAdmin(MermaidProvider);
