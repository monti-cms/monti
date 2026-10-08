import type { BlockConverter } from "./types.js";
/**
 * GFM footnote definition (`[^label]: content`). The content is ordinary block content, and a definition with none is given an empty paragraph so the editor has
 * somewhere to type (saving an empty paragraph writes `[^label]:` again).
 */
export declare const footnoteDefinitionConverter: BlockConverter;
