import type { Site } from "@monti-cms/core/client";
import { type CmsNode } from "@monti-cms/core/document";
import type { CmsMdxAnalysis } from "./types.js";
/**
 * The working document of an analysis, for the blocks, mark order and code fence rules of `site`. Everything that reads the document being converted (its
 * definitions and its source) lives inside this call, so two conversions never share state.
 */
export declare const toDocument: (site: Site, analysis: CmsMdxAnalysis) => CmsNode;
