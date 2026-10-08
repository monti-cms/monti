import { type Site } from "@monti-cms/core/client";
import { type StoredDocument } from "@monti-cms/core/document";
/**
 * What a document says, as a string: the same body reads the same whichever way it was made. Block ids are not content, trailing empty paragraphs and the way text
 * is split into runs do not change what a body says (`canonicalDocument`), and key order does not either. The editor, the draft and the recovery copy compare
 * bodies by this key.
 */
export declare const documentKey: (site: Pick<Site, "sortMarks">, doc: StoredDocument) => string;
