import {
	assignBlockIds,
	type CmsNode,
	canonicalDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "@monti-cms/core/document";
import { testSite } from "../../../core/test/site";

/**
 * Story helpers for documents that are built by hand (a block with attributes, ...): the admin has no text notation for them, so a story names the stored
 * nodes directly. The result is canonical and has block ids, as a document read by a format does.
 */

/** A stored document of `content`, in its canonical form with block ids. */
export const storedDoc = (...content: CmsNode[]): StoredDocument => {
	const doc = canonicalDocument(testSite, { type: "doc", version: STORED_DOCUMENT_VERSION, content });
	return { ...doc, content: assignBlockIds(doc.content, []) };
};
