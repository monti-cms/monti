import { readStoredDocument, type StoredDocument, unparsedDocument } from "../../doc/stored-document";

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

/**
 * Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`).
 * Older states are lifted to version 4, which is always the result: version 3 held the source's MDX (`baseSource`) and, when it had one, its document
 * (`baseDoc`); version 2 only the MDX. A source that has no document is kept as an `unparsed` body holding its MDX (the `mdx` format can read it again).
 */
export function parseTranslationState(value: unknown): TranslationState | null | undefined {
	if (value === null) return null;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	let state: TranslationState;
	if (record.version === 4) {
		if (Object.keys(record).length !== 2) return undefined;
		const baseDoc = readStoredDocument(record.baseDoc);
		if (!baseDoc) return undefined;
		state = { version: 4, baseDoc };
	} else if (record.version === 2 || record.version === 3) {
		if (typeof record.baseSource !== "string") return undefined;
		if (Object.keys(record).length !== (record.version === 2 ? 2 : 3)) return undefined;
		if (record.version === 3 && !("baseDoc" in record)) return undefined;
		const stored = record.version === 3 && record.baseDoc !== null ? readStoredDocument(record.baseDoc) : undefined;
		if (record.version === 3 && record.baseDoc !== null && !stored) return undefined;
		state = { version: 4, baseDoc: stored ?? unparsedDocument(record.baseSource) };
	} else {
		return undefined;
	}
	return byteLength(state) > MAX_TRANSLATION_BYTES ? undefined : state;
}
