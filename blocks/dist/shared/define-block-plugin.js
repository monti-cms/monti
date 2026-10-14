import { definePlugin } from "@monti-cms/core";
/**
 * A block extension (`callout()`, `tabs()`, `mermaid()` ...) as a plugin: blocks, an admin side and a render side, and nothing else. One place for what the nine
 * block plugins have in common.
 */
export function defineBlockPlugin(plugin) {
    return definePlugin(plugin);
}
