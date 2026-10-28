import { withoutBlockIds } from "../../doc/block-ids";
import { readStoredDocument, type StoredDocument } from "../../doc/stored-document";

/**
 * Translation state of a translation (`entry_bodies.translation`). `null` for a source.
 * Holds the source document the translator last confirmed (`baseDoc`). If the source's latest draft differs from this value, the translation screen
 * shows "the source has changed" and compares the previous and current source block by block, pairing the blocks by their block ids (moves show as moves).
 */
export interface TranslationState {
	readonly version: 4;
	readonly baseDoc: StoredDocument;
}

/** Upper limit on translation state size (the whole JSON). Same as the limit on a stored document (8MiB). */
export const MAX_TRANSLATION_BYTES = 8 * 1024 * 1024;

const byteLength = (state: TranslationState) => new TextEncoder().encode(JSON.stringify(state)).length;

/** The state that confirms a source: its document. */
export function confirmedSourceState(doc: StoredDocument): TranslationState {
	return { version: 4, baseDoc: doc };
}

/** Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`). */
export function parseTranslationState(value: unknown): TranslationState | null | undefined {
	if (value === null) return null;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (record.version !== 4 || Object.keys(record).length !== 2) return undefined;
	const baseDoc = readStoredDocument(record.baseDoc);
	if (!baseDoc) return undefined;
	const state: TranslationState = { version: 4, baseDoc };
	return byteLength(state) > MAX_TRANSLATION_BYTES ? undefined : state;
}

/** What a document says, without its block ids: two documents with the same key read the same. */
const contentKey = (doc: StoredDocument) => JSON.stringify(withoutBlockIds(doc.content));

/**
 * Whether the source's document differs from the one a translation was confirmed against (`TranslationState.baseDoc`). Block ids do not count: they say
 * which block is which, not what the body says. The translation editor and the list's translation filter both ask this, so they never disagree.
 */
export const sourceHasChanged = (source: StoredDocument, confirmed: StoredDocument): boolean =>
	contentKey(source) !== contentKey(confirmed);
