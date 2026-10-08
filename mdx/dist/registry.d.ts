import type { Site } from "@monti-cms/core/client";
/** The JSX names of a site's body: which elements the body may hold, which of them are blocks, and which are text decorations (marks). */
export interface JsxRegistry {
    /** Every renderer name the body may use: the standard elements and the site's added blocks. */
    readonly REGISTERED_JSX_NAMES: ReadonlySet<string>;
    /** Renderer names of elements that are blocks (not text decorations). */
    readonly BLOCK_JSX_NAMES: ReadonlySet<string>;
    /** Text decoration renderer name → document mark name. For added text decorations (block extensions), the block name is the mark name. */
    readonly INLINE_JSX_MARKS: Readonly<Record<string, string>>;
}
/** The JSX names of a site, built from its added blocks. */
export declare const jsxRegistryOf: (site: Site) => JsxRegistry;
/** Names removed in batch 4. If one remains in the body, `analyze` rejects it (read compatibility is also over). */
export declare const RETIRED_JSX_NAMES: Set<string>;
/** Event handler attribute names. React does not preserve case, so `onerror` is blocked as well. */
export declare const EVENT_HANDLER_NAME: RegExp;
