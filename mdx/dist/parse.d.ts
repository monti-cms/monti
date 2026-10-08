import type { Site } from "@monti-cms/core/client";
import type { Root } from "mdast";
import type { SyntaxExtension } from "./syntax/types.js";
/** `syntax` is the syntax extensions to read with (none: standard MDX). The site's are `configuredSyntax(site)`. */
export declare const parseMdxAst: (site: Site, body: string, syntax?: readonly SyntaxExtension[]) => Root;
