import { type BlockDefinition, type CmsPlugin, definePlugin } from "@monti-cms/core";

/** What every block plugin gives: its blocks, the admin side that edits them and the render side that draws them. */
export interface BlockPluginInput<
	Name extends string,
	Options,
	Blocks extends readonly BlockDefinition[],
	Contributes extends Readonly<Record<string, unknown>>,
> {
	readonly name: Name;
	/** Config values both sides read. Most blocks have none. */
	readonly options?: Options;
	readonly blocks: Blocks;
	/** The admin module (`defineBlockAdmin(...)` as its default export). */
	readonly admin: NonNullable<CmsPlugin["admin"]>;
	/** The public components of the blocks (`documentComponents`). */
	readonly render: NonNullable<CmsPlugin["render"]>;
	readonly validate?: CmsPlugin["validate"];
	/** What the block adds to other plugins (the AI actions of a diagram block). */
	readonly contributes?: Contributes;
}

/**
 * A block extension (`callout()`, `tabs()`, `mermaid()` ...) as a plugin: blocks, an admin side and a render side, and nothing else. One place for what the nine
 * block plugins have in common.
 */
export function defineBlockPlugin<
	const Name extends string,
	Options = Record<string, never>,
	const Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
	const Contributes extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
>(plugin: BlockPluginInput<Name, Options, Blocks, Contributes>) {
	return definePlugin<Name, Options, Blocks, Contributes>(plugin);
}
