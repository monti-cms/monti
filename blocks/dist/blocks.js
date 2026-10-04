import { callout } from "./callout/index.js";
import { chart } from "./chart/index.js";
import { codeRef } from "./code-ref/index.js";
import { collapsible } from "./collapsible/index.js";
import { color } from "./color/index.js";
import { columns } from "./columns/index.js";
import { mermaid } from "./mermaid/index.js";
import { tabs } from "./tabs/index.js";
import { tooltip } from "./tooltip/index.js";
/**
 * Block extension factory functions (name -> function). `blocks()` adds them in this order. The order of the inline marks (tooltip, code-ref, color) is the order in which overlapping marks
 * are stored (outermost first).
 */
const FACTORIES = { callout, collapsible, tabs, columns, mermaid, chart, tooltip, codeRef, color };
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
export function blocks(options = {}) {
    const names = Object.keys(FACTORIES);
    for (const name of [...(options.only ?? []), ...(options.omit ?? [])]) {
        if (!names.includes(name))
            throw new Error(`@monti-cms/blocks: unknown block extension "${name}"`);
    }
    return names
        .filter((name) => !options.only || options.only.includes(name))
        .filter((name) => !options.omit?.includes(name) && options[name] !== false)
        .map((name) => (name === "color" ? color(options.color || {}) : FACTORIES[name]()));
}
