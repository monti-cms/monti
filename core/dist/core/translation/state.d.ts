import { type StoredDocument } from "../../doc/stored-document.js";
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
export declare const MAX_TRANSLATION_BYTES: number;
/** The state that confirms a source: its document. */
export declare function confirmedSourceState(doc: StoredDocument): TranslationState;
/** Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`). */
export declare function parseTranslationState(value: unknown): TranslationState | null | undefined;
