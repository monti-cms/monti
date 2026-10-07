/**
 * The stored document model (`@monti-cms/core/document`): the document type and the helpers that work on a document without knowing the notation it
 * was written in. Screens, formats and plugins that edit, inspect or convert a body (the admin editor, AI, `@monti-cms/mdx`) import from here;
 * nothing in it parses or writes a text format.
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
} from "./doc/block-ids";
export {
	ENTRY_LINK_PREFIX,
	entryIdOfHref,
	entryIdOfMark,
	entryLinkHref,
	entryLinkIds,
	linkAttrs,
	linkMarkAttrs,
	mapLinkAttrs,
	normalizedLinkMark,
} from "./doc/entry-links";
export * from "./doc/image-src";
export * from "./doc/image-transform";
export {
	outOfRangeAnnotationNames,
	storedCodeBlockAttrs,
	storedCodeBlockFence,
	workingCodeBlockAttrs,
} from "./doc/stored-code-block";
export type { StoredDocument } from "./doc/stored-document";
export {
	CORE_NODE_TYPES,
	canonicalDocument,
	emptyStoredDocument,
	isUnparsedDocument,
	readStoredDocument,
	STORED_DOCUMENT_VERSION,
	sortJson,
	storedMark,
	storedNode,
	UNPARSED_NODE,
	unparsedDocument,
} from "./doc/stored-document";
export * from "./doc/table-layout";
export type { CmsJsonValue, CmsMark, CmsNode } from "./doc/types";
