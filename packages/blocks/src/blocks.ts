import { callout } from "./callout";
import { chart } from "./chart";
import { codeExplorer } from "./code-explorer";
import { codeRef } from "./code-ref";
import { collapsible } from "./collapsible";
import { type ColorOptions, color } from "./color";
import { columns } from "./columns";
import { mermaid } from "./mermaid";
import { tabs } from "./tabs";
import { tooltip } from "./tooltip";

/**
 * Block extension factory functions (name -> function). `blocks()` adds them in this order. The order of the inline marks (tooltip, code-ref, color) is the order in which overlapping marks
 * are stored (outermost first).
 */
const FACTORIES = {
	callout,
	collapsible,
	tabs,
	columns,
	codeExplorer,
	mermaid,
	chart,
	tooltip,
	codeRef,
	color,
} as const;

/** Names of the block extensions `blocks()` adds. */
export type BlockExtensionName = keyof typeof FACTORIES;

/** Block extension name -> that extension's options. Extensions without options accept only `true`. */
interface BlockExtensionOptions {
	readonly callout: true;
	readonly collapsible: true;
	readonly tabs: true;
	readonly columns: true;
	readonly codeExplorer: true;
	readonly mermaid: true;
	readonly chart: true;
	readonly tooltip: true;
	readonly codeRef: true;
	readonly color: ColorOptions;
}

export type BlocksOptions = {
	/** Extensions to include (all when omitted). */
	readonly only?: readonly BlockExtensionName[];
	/** Extensions to leave out. */
	readonly omit?: readonly BlockExtensionName[];
} & {
	/** Per-extension options (e.g. `color: { palette }`). `false` leaves that extension out. */
	readonly [K in BlockExtensionName]?: BlockExtensionOptions[K] | false;
};

type BlockPlugin = ReturnType<(typeof FACTORIES)[BlockExtensionName]>;

/** The extensions `blocks(options)` adds: `only` picks, `omit` and `false` leave out. Typed so the site config knows which blocks (and their props) are installed. */
type SelectedNames<Options extends BlocksOptions> = Exclude<
	Options extends { readonly only: readonly (infer Name)[] } ? Extract<Name, BlockExtensionName> : BlockExtensionName,
	| (Options extends { readonly omit: readonly (infer Name)[] } ? Name : never)
	| {
			[Name in BlockExtensionName]: Options extends { readonly [Key in Name]: false } ? Name : never;
	  }[BlockExtensionName]
>;

/** The plugins `blocks(options)` returns (their `blocks` are literal types). */
export type BlocksPlugins<Options extends BlocksOptions = BlocksOptions> = ReturnType<
	(typeof FACTORIES)[SelectedNames<Options>]
>[];

/**
 * Adds all of this package's block extensions at once. Spread it into the site config's `plugins`.
 *
 * ```ts
 * plugins: [...blocks()]                                  // everything
 * plugins: [...blocks({ omit: ["chart"] })]               // everything except chart
 * plugins: [...blocks({ only: ["callout", "tooltip"] })]  // only the chosen ones
 * plugins: [...blocks({ color: { palette } })]            // per-extension options
 * ```
 *
 * The individual factories (`callout()`, `color({ palette })`, ...) can also be used directly. Adding the same extension twice is a config error.
 */
export function blocks<const Options extends BlocksOptions = BlocksOptions>(
	options: Options = {} as Options,
): BlocksPlugins<Options> {
	const names = Object.keys(FACTORIES) as BlockExtensionName[];
	for (const name of [...(options.only ?? []), ...(options.omit ?? [])]) {
		if (!names.includes(name)) throw new Error(`@monti-cms/blocks: unknown block extension "${name}"`);
	}
	const plugins: BlockPlugin[] = names
		.filter((name) => !options.only || options.only.includes(name))
		.filter((name) => !options.omit?.includes(name) && options[name] !== false)
		.map((name) => (name === "color" ? color(options.color || {}) : FACTORIES[name]()));
	return plugins as BlocksPlugins<Options>;
}
