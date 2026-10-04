import type { CmsNode } from "@monti-cms/core/mdx";
import type { JSONContent } from "@tiptap/core";
/**
 * CmsNode <-> Tiptap JSONContent conversion. This is the visual editor's load/save path.
 *
 * - Load: MDX → `analyze` → `toDocument` → this module → Tiptap JSON.
 * - Save: Tiptap `getJSON()` → this module → CmsNode → `serialize` → MDX.
 *
 * Neither direction **drops data.** Blocks missing from the Tiptap schema (tables, math, charts, callouts, tabs,
 * JSX other than math, etc.) are kept as a read-only box holding the original MDX in `cmsOpaqueBlock`
 * (nodes are never silently deleted or turned into arbitrary HTML). A block is either entirely native or
 * entirely a box — part of a box is never lost.
 */
export declare const OPAQUE_BLOCK_NAME = "cmsOpaqueBlock";
/** MDX body → Tiptap JSON. Converts what it can even with parse errors (boxes hold the original source). */
export declare const cmsNodeToTiptap: (node: CmsNode) => JSONContent;
/** MDX body string → Tiptap JSON. For loading into the editor. */
export declare const mdxToTiptap: (source: string) => JSONContent;
/** Tiptap `getJSON()` → CmsNode. For saving. */
export declare const tiptapToCmsNode: (content: JSONContent) => CmsNode;
/** Tiptap `getJSON()` → MDX body. For saving from the editor. */
export declare const tiptapToMdx: (content: JSONContent) => string;
