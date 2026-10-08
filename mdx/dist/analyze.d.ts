import type { Site } from "@monti-cms/core/client";
import type { SyntaxExtension } from "./syntax/types.js";
import type { CmsMdxAnalysis } from "./types.js";
/** `syntax` is the syntax extensions to read with (none: standard MDX). */
export declare const analyze: (site: Site, mdx: string, name?: string, syntax?: readonly SyntaxExtension[]) => CmsMdxAnalysis;
