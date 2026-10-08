import type { Site } from "@monti-cms/core/client";
import type { PluggableList } from "unified";
import type { SyntaxExtension } from "./syntax/types.js";
/** The blocks the site uses, as syntax extensions see them. */
export declare const siteSyntaxBlocks: (site: Site) => import("@monti-cms/core/format").BlockCatalog;
/** The code block line effect names the site uses, as syntax extensions see them. */
export declare const siteCodeLineEffects: (site: Site) => ReadonlySet<string>;
/** No syntax extension: standard MDX (CommonMark + GFM + standard MDX JSX). The same array every time, so parsers can be cached by it. */
export declare const NO_SYNTAX: readonly SyntaxExtension[];
/** The syntax extensions the site gave to `mdx({ syntax })`, in precedence order (none when the site config has no `mdx()` plugin). */
export declare const configuredSyntax: (site: Pick<Site, "getPluginOptions">) => readonly SyntaxExtension[];
/** Remark plugins of the extensions (parsing), built for the site's blocks and line effects. The parser and the public render chain both use them. */
export declare const syntaxRemarkPlugins: (site: Site, extensions: readonly SyntaxExtension[]) => PluggableList;
