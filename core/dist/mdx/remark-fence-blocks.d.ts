import type { Root } from "mdast";
/**
 * Remark plugin that turns an added code fence block (e.g. ` ```mermaid `) into that block's public renderer (`component`).
 * The code is passed as the `source` attribute (`<Mermaid source="graph TD…" />`). It is the same value as the editor preview (`fencePreviews`).
 *
 * In the public render chain, place it after `remarkDirectivesToMdx`. Fences the site already converted with its own plugin are left alone.
 */
export declare const remarkFenceBlocksToMdx: () => (tree: Root) => undefined;
