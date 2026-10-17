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
