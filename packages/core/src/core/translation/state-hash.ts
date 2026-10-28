import { createHash } from "node:crypto";
import { emptyStoredDocument, type StoredDocument } from "../../doc/stored-document";
import { sourceContentKey, type TranslationState } from "./state";

/**
 * The hash a store keeps of a document for the translation filter: the hash of `sourceContentKey`, so two documents have the same hash exactly when
 * `sourceHasChanged` says the source did not change. A source's working body keeps the hash of its own document, a translation keeps the hash of the
 * document it was confirmed against, and the list compares the two in SQL instead of reading any document.
 */
export const documentKeyHash = (doc: StoredDocument): string =>
	createHash("sha256").update(sourceContentKey(doc)).digest("hex");

/**
 * What a translation keeps of the source it was confirmed against: the hash of that document, or `null` for a source. A state from before the document was kept
 * has none, and reads as an empty one, as the translation editor reads it.
 */
export const translationBaseHash = (translation: TranslationState | null): string | null =>
	translation === null ? null : documentKeyHash(translation.baseDoc ?? emptyStoredDocument());
