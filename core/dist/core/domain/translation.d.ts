import type { Site } from "../../site/index.js";
import type { EntryStatus } from "../store/types.js";
/**
 * Translation rules. A translation shares its source's translation group, has one content per language, and stores only
 * the per-language values; the shared fields belong to the source.
 */
/** The entry a translation is made from, as the store reads it (locked) before creating the translation. */
export interface TranslationSource {
    readonly collection: string;
    readonly status: EntryStatus;
    readonly locale: string;
    /** The source's translation group ID. Null for a source (only sources can be translated). */
    readonly translationGroupId: string | null;
}
export declare function assertKnownLocale(site: Site, locale: string): void;
/**
 * The entry to translate must exist, be the source of its translation group (no translation of a translation), belong to the
 * collection of the translation and to a collection that has a body, and not be in the trash. The translation's language must differ from the source's
 * (the store's unique index blocks a second translation in the same language).
 */
export declare function assertTranslationSource(site: Site, source: TranslationSource | undefined, translation: {
    readonly collection: string;
    readonly locale: string;
}): void;
/** A translation stores only per-language values. Shared fields belong to the source. */
export declare function assertTranslationMetadata(site: Site, collection: string, isTranslation: boolean, metadata: Record<string, unknown>): void;
/** Only translations carry a translation status. */
export declare function assertTranslationStateAllowed(translation: unknown | null, isTranslation: boolean): void;
