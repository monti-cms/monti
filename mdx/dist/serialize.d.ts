import type { Site } from "@monti-cms/core/client";
import type { SyntaxExtension } from "./syntax/types.js";
/**
 * Writes a document as MDX for `site`. The standard notation is CommonMark + GFM + standard MDX JSX; `extensions` (none: standard MDX only)
 * write their own notation first, in precedence order, wherever they do not defer.
 */
export declare const serialize: (site: Site, doc: unknown, extensions?: readonly SyntaxExtension[]) => string;
