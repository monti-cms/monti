import { type BlockDefinition, type Plugin, type PluginContributions } from "@monti-cms/core";
/** What every block plugin gives: its blocks, the admin side that edits them and the render side that draws them. */
export interface BlockPluginInput<Name extends string, Options, Blocks extends readonly BlockDefinition[], Contributes extends PluginContributions> {
    readonly name: Name;
    /** Config values both sides read. Most blocks have none. */
    readonly options?: Options;
    readonly blocks: Blocks;
    /** The admin module (`defineAdminPlugin({ components })` as its default export). */
    readonly admin: NonNullable<Plugin["admin"]>;
    /** The public components of the blocks (a module with `defineRender({ ... })` as its default export). */
    readonly render: NonNullable<Plugin["render"]>;
    readonly checkConfig?: Plugin["checkConfig"];
    /** What the block adds to other plugins (the AI actions of a diagram block). */
    readonly contributes?: Contributes;
}
/**
 * A block extension (`callout()`, `tabs()`, `mermaid()` ...) as a plugin: blocks, an admin side and a render side, and nothing else. One place for what the nine
 * block plugins have in common.
 */
export declare function defineBlockPlugin<const Name extends string, Options = Record<string, never>, const Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[], const Contributes extends PluginContributions = PluginContributions>(plugin: BlockPluginInput<Name, Options, Blocks, Contributes>): Plugin<Name, Options, Blocks> & {
    readonly contributes?: Contributes | undefined;
};
