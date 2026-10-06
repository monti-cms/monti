import type { BlockAttribute, BlockDefinition } from "../../blocks/define";

/**
 * Prop types of block components, derived from block definitions. A definition (`defineBlock`) keeps its `attributes` as literals,
 * so the names, the option keys and which values are always present are known to the type system.
 */

/** Flattens an intersection into one object type (readable in editor hover text). */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The type of one attribute's value: a boolean, the keys of its `options`, or a string. */
type AttributeValue<A extends BlockAttribute> = A extends { readonly type: "boolean" }
	? boolean
	: A extends { readonly options: infer Options }
		? Extract<keyof Options, string>
		: string;

/**
 * Whether the renderer always passes the attribute. A boolean is always there (`false` when absent), and so is a value with a default and a
 * required string without options (`""` when absent). A choice without a default is absent when the stored value is not one of its options.
 */
type AlwaysSet<A extends BlockAttribute> = A extends { readonly type: "boolean" }
	? true
	: A extends { readonly defaultValue: string | boolean }
		? true
		: A extends { readonly options: object }
			? false
			: A extends { readonly required: true }
				? true
				: false;

/** The component props that come from a block's attributes (flat: `variant`, `title`, ...). */
export type AttributeProps<D extends BlockDefinition> = Simplify<
	{
		readonly [K in keyof D["attributes"] as AlwaysSet<D["attributes"][K]> extends true ? K : never]: AttributeValue<
			D["attributes"][K]
		>;
	} & {
		readonly [K in keyof D["attributes"] as AlwaysSet<D["attributes"][K]> extends true ? never : K]?: AttributeValue<
			D["attributes"][K]
		>;
	}
>;

/** The kind of a definition as a type: a text block is a mark, anything else is a block. */
export type IsMarkBlock<D extends BlockDefinition> = D["syntax"]["kind"] extends "text" ? true : false;

/** Definitions whose names are literals. A definition typed as the wide `BlockDefinition` (name `string`) cannot be told apart, so it adds no key. */
export type LiteralBlock<D> = D extends BlockDefinition ? (string extends D["name"] ? never : D) : never;

type BlocksOf<List> = List extends readonly (infer D)[] ? D : never;

type PluginBlocksOf<Plugins> = Plugins extends readonly (infer P)[]
	? P extends { readonly blocks?: infer List }
		? BlocksOf<List>
		: never
	: never;

/** Every block definition a site config holds: its own `blocks` and the `blocks` of its plugins. */
export type SiteBlockDefinitions<Config> = LiteralBlock<
	| (Config extends { readonly blocks?: infer List } ? BlocksOf<List> : never)
	| (Config extends { readonly plugins?: infer Plugins } ? PluginBlocksOf<Plugins> : never)
>;
