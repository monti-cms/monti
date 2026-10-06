/**
 * The stored document model (`@monti-cms/core/document`): the document type and the helpers that work on a document without knowing the notation it
 * was written in. Screens and plugins that edit or inspect a body (the admin editor, AI) import from here; nothing in it parses or writes MDX.
 */

export { TEXT_ALIGN_VALUES } from "./blocks/derive";
export {
	assignBlockIds,
	BLOCK_ID_PATTERN,
	copyBlockIds,
	forEachBlock,
	isBlockId,
	newBlockId,
	regenerateBlockIds,
	withoutBlockIds,
} from "./mdx/block-ids";
export {
	ENTRY_LINK_PREFIX,
	entryIdOfHref,
	entryIdOfMark,
	entryLinkHref,
	entryLinkIds,
	linkAttrs,
	mapLinkAttrs,
} from "./mdx/entry-links";
export * from "./mdx/image-src";
export * from "./mdx/image-transform";
export { sortMarks } from "./mdx/registry";
export { storedCodeBlockAttrs, storedCodeBlockFence } from "./mdx/stored-code-block";
export type { StoredDocument } from "./mdx/stored-document";
export {
	canonicalDocument,
	emptyStoredDocument,
	isUnparsedDocument,
	readStoredDocument,
	STORED_DOCUMENT_VERSION,
	UNPARSED_NODE,
	unparsedDocument,
} from "./mdx/stored-document";
export * from "./mdx/table-layout";
export type { CmsJsonValue, CmsMark, CmsNode } from "./mdx/types";
