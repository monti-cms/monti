/**
 * The stored document model (`@monti-cms/core/document`): the document type and the helpers that work on a document without knowing the notation it
 * was written in. Screens, formats and plugins that edit, inspect or convert a body (the admin editor, AI, `@monti-cms/mdx`) import from here;
 * nothing in it parses or writes a text format.
 */
export { TEXT_ALIGN_VALUES } from "./blocks/derive.js";
export { assignBlockIds, BLOCK_ID_PATTERN, copyBlockIds, forEachBlock, isBlockId, newBlockId, regenerateBlockIds, withoutBlockIds, } from "./doc/block-ids.js";
export { ENTRY_LINK_PREFIX, entryIdOfHref, entryIdOfMark, entryLinkHref, entryLinkIds, linkAttrs, linkMarkAttrs, mapLinkAttrs, normalizedLinkMark, } from "./doc/entry-links.js";
export * from "./doc/image-src.js";
export * from "./doc/image-transform.js";
export { outOfRangeAnnotationNames, storedCodeBlockAttrs, storedCodeBlockFence, workingCodeBlockAttrs, } from "./doc/stored-code-block.js";
export type { StoredDocument } from "./doc/stored-document.js";
export { CORE_NODE_TYPES, canonicalDocument, emptyStoredDocument, isUnparsedDocument, readStoredDocument, STORED_DOCUMENT_VERSION, sortJson, storedMark, storedNode, UNPARSED_NODE, unparsedDocument, } from "./doc/stored-document.js";
export * from "./doc/table-layout.js";
export type { CmsJsonValue, CmsMark, CmsNode } from "./doc/types.js";
