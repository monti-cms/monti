/**
 * Translation state of a translation (`entry_bodies.translation`). `null` for a source.
 * Holds the source body the translator last confirmed (`baseSource`). If the source's latest draft differs from this value,
 * the translation screen shows "the source has changed" and compares the previous and current source block by block.
 */
export interface TranslationState {
    readonly version: 2;
    readonly baseSource: string;
}
/** Upper limit on translation state size. Same as the source body limit (2MiB). */
export declare const MAX_TRANSLATION_BYTES: number;
/** Validates an incoming value as a translation state. A wrong shape is treated as an error (returns `undefined`). */
export declare function parseTranslationState(value: unknown): TranslationState | null | undefined;
