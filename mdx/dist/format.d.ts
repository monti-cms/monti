import { type CmsFormat } from "@monti-cms/core/format";
import type { SyntaxExtension } from "./syntax/types.js";
export interface MdxFormatOptions {
    /** Syntax extensions (`directiveSyntax()`, `shikiNotationSyntax()`), in precedence order for writing. None: standard MDX only. */
    readonly syntax?: readonly SyntaxExtension[];
}
/** The `mdx` format reading and writing with the given syntax extensions. */
export declare const createMdxFormat: (options?: MdxFormatOptions) => CmsFormat<"mdx">;
/** The `mdx` format with no syntax extension (standard MDX). It holds nothing of a site: it reads the site from the context of each call. A site with extensions gets its own from `mdx({ syntax })`. */
export declare const mdxFormat: CmsFormat<"mdx">;
export { analyze } from "./analyze.js";
export { type Body, type BodyOptions, bodyDocument, bodyFromDocument, bodyFromMdx, documentToMdx, fromStoredDocument, type OutOfRangeAnnotation, toStoredDocument, } from "./body.js";
export * from "./directives.js";
export { mdxMessages } from "./messages.js";
export { parseMdxAst } from "./parse.js";
export { type JsxRegistry, jsxRegistryOf, RETIRED_JSX_NAMES } from "./registry.js";
export { remarkFenceBlocksToMdx } from "./remark-fence-blocks.js";
export { serialize } from "./serialize.js";
export { insertSoftBreaks, type SoftBreakResult } from "./soft-breaks.js";
export { configuredSyntax, NO_SYNTAX, siteCodeLineEffects, siteSyntaxBlocks, syntaxRemarkPlugins, } from "./syntax-config.js";
export { toDocument } from "./to-document.js";
export { compareMdxStructure, readableMdx } from "./translation-check.js";
export type { CmsJsxAttribute, CmsMdxAnalysis, CmsMdxError, CmsMdxErrorCode, CmsMdxPosition, } from "./types.js";
