import type { Site } from "../../site";
import { CmsError } from "../store/errors";
import type { EntryStatus } from "../store/types";

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

export function assertKnownLocale(site: Site, locale: string): void {
	if (!site.isLocale(locale)) throw new CmsError("Unknown locale", "invalid_input");
}

/**
 * The entry to translate must exist, be the source of its translation group (no translation of a translation), belong to the
 * collection of the translation and to a collection that has a body, and not be in the trash. The translation's language must differ from the source's
 * (the store's unique index blocks a second translation in the same language).
 */
export function assertTranslationSource(
	site: Site,
	source: TranslationSource | undefined,
	translation: { readonly collection: string; readonly locale: string },
): void {
	if (!source) throw new CmsError("Source entry not found", "not_found");
	if (source.collection !== translation.collection || site.isItemCollection(translation.collection)) {
		throw new CmsError("Only content collections have translations", "invalid_input");
	}
	if (source.translationGroupId !== null) {
		throw new CmsError("Translate the source entry, not a translation", "invalid_input");
	}
	if (source.status === "trashed") throw new CmsError("A trashed entry cannot be translated", "invalid_status");
	if (source.locale === translation.locale) {
		throw new CmsError("A translation for this locale already exists", "translation_exists");
	}
}

/** A translation stores only per-language values. Shared fields belong to the source. */
export function assertTranslationMetadata(
	site: Site,
	collection: string,
	isTranslation: boolean,
	metadata: Record<string, unknown>,
): void {
	if (!isTranslation || !site.isCollection(collection)) return;
	const common = site.commonFieldKeys(collection, metadata);
	if (common.length > 0) {
		throw new CmsError(`Common fields belong to the source: ${common.join(", ")}`, "invalid_input");
	}
}

/** Only translations carry a translation status. */
export function assertTranslationStateAllowed(translation: unknown | null, isTranslation: boolean): void {
	if (translation !== null && !isTranslation) {
		throw new CmsError("Only translations have a translation state", "invalid_input");
	}
}
