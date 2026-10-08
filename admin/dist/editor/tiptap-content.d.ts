import { type Site } from "@monti-cms/core/client";
import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
/**
 * Stored document <-> Tiptap JSONContent conversion. This is the visual editor's load/save path, and it works on the stored document directly: no notation
 * (MDX or any other) is involved.
 *
 * - Load: `StoredDocument` → `storedToTiptap` → Tiptap JSON.
 * - Save: Tiptap `getJSON()` → `tiptapToStored` → `StoredDocument`.
 *
 * Neither direction **drops data.** Blocks missing from the Tiptap schema (merged-cell tables with block content, blocks without an edit view, nodes only a
 * notation can describe, a body that could not be read) are kept as a read-only box holding the stored node in `cmsOpaqueBlock` (nodes are never silently
 * deleted). A block is either entirely native or entirely a box: part of a box is never lost.
 */
export declare const OPAQUE_BLOCK_NAME = "cmsOpaqueBlock";
/** Writes a node as text for the box that shows it (the registered source format), or gives `""` for the box to show the node as JSON. */
export type BoxPreview = (node: CmsNode) => string;
/** The box preview for a format: the node as a one-block document written in it. A node the format cannot write is shown as JSON. */
export declare const boxPreviewOf: (format: {
    export(doc: StoredDocument): string;
} | undefined) => BoxPreview | undefined;
/** A stored document → Tiptap JSON, with its block ids. Converts what it can; a body that could not be read stays a box holding it. */
export declare const storedToTiptap: (site: Site, doc: StoredDocument, options?: {
    boxPreview?: BoxPreview;
}) => JSONContent;
/**
 * Tiptap `getJSON()` → the stored document, with the editor's block ids. It is in the canonical form every body is stored in (sorted keys, merged text runs,
 * no trailing empty paragraph), so the same content is the same document whether it came from the editor or from the server.
 */
export declare const tiptapToStored: (site: Site, content: JSONContent) => StoredDocument;
