import { callout } from "./callout/index.js";
import { chart } from "./chart/index.js";
import { codeRef } from "./code-ref/index.js";
import { collapsible } from "./collapsible/index.js";
import { type ColorOptions, color } from "./color/index.js";
import { columns } from "./columns/index.js";
import { mermaid } from "./mermaid/index.js";
import { tabs } from "./tabs/index.js";
import { tooltip } from "./tooltip/index.js";
/**
 * Block extension factory functions (name -> function). `blocks()` adds them in this order. The order of the inline marks (tooltip, code-ref, color) is the order in which overlapping marks
 * are stored (outermost first).
 */
declare const FACTORIES: {
    readonly callout: typeof callout;
    readonly collapsible: typeof collapsible;
    readonly tabs: typeof tabs;
    readonly columns: typeof columns;
    readonly mermaid: typeof mermaid;
    readonly chart: typeof chart;
    readonly tooltip: typeof tooltip;
    readonly codeRef: typeof codeRef;
    readonly color: typeof color;
};
/** Names of the block extensions `blocks()` adds. */
export type BlockExtensionName = keyof typeof FACTORIES;
/** Block extension name -> that extension's options. Extensions without options accept only `true`. */
interface BlockExtensionOptions {
    readonly callout: true;
    readonly collapsible: true;
    readonly tabs: true;
    readonly columns: true;
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
export declare function blocks(options?: BlocksOptions): BlockPlugin[];
export {};
