import { readStoredDocument, type StoredDocument } from "../../mdx";

/**
 * Translation state of a translation (`entry_bodies.translation`). `null` for a source.
 * Holds the source body the translator last confirmed: its MDX (`baseSource`) and, when it had one, its stored document (`baseDoc`).
 * If the source's latest draft differs from this value, the translation screen shows "the source has changed" and compares the
 * previous and current source block by block. With both documents the blocks are paired by their block ids (moves show as moves);
 * without (`baseDoc` is `null`) only the MDX is compared.
 */
export interface TranslationState {
	readonly version: 3;
	readonly baseSource: string;
	readonly baseDoc: StoredDocument | null;
}

/** Upper limit on translation state size (the whole JSON). Same as the source body limit (2MiB). */
export const MAX_TRANSLATION_BYTES = 2 * 1024 * 1024;

const byteLength = (state: TranslationState) => new TextEncoder().encode(JSON.stringify(state)).length;

/**
 * The state that confirms a source: its MDX and document. A document that would push the state over the size limit is left out
 * (`baseDoc: null`), so a large source can still be confirmed, compared by its MDX only.
 */
export function confirmedSourceState(mdx: string, doc: StoredDocument | null): TranslationState {
	const state: TranslationState = { version: 3, baseSource: mdx, baseDoc: doc };
	return doc && byteLength(state) > MAX_TRANSLATION_BYTES ? { version: 3, baseSource: mdx, baseDoc: null } : state;
}

/**
 * Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`).
 * Version 2 (no document) is lifted to version 3 with `baseDoc: null`; the result is always version 3.
 */
export function parseTranslationState(value: unknown): TranslationState | null | undefined {
	if (value === null) return null;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (typeof record.baseSource !== "string") return undefined;
	let state: TranslationState;
	if (record.version === 2) {
		if (Object.keys(record).length !== 2) return undefined;
		state = { version: 3, baseSource: record.baseSource, baseDoc: null };
	} else if (record.version === 3) {
		if (Object.keys(record).length !== 3 || !("baseDoc" in record)) return undefined;
		const baseDoc = record.baseDoc === null ? null : (readStoredDocument(record.baseDoc) ?? undefined);
		if (baseDoc === undefined) return undefined;
		state = { version: 3, baseSource: record.baseSource, baseDoc };
	} else {
		return undefined;
	}
	return byteLength(state) > MAX_TRANSLATION_BYTES ? undefined : state;
}
