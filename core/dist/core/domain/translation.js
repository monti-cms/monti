import { CmsError } from "../store/errors.js";
export function assertKnownLocale(site, locale) {
    if (!site.isLocale(locale))
        throw new CmsError("Unknown locale", "invalid_input");
}
/**
 * The entry to translate must exist, be the source of its translation group (no translation of a translation), belong to the
 * collection of the translation and to a collection that has a body, and not be in the trash. The translation's language must differ from the source's
 * (the store's unique index blocks a second translation in the same language).
 */
export function assertTranslationSource(site, source, translation) {
    if (!source)
        throw new CmsError("Source entry not found", "not_found");
    if (source.collection !== translation.collection || site.isItemCollection(translation.collection)) {
        throw new CmsError("Only content collections have translations", "invalid_input");
    }
    if (source.translationGroupId !== null) {
        throw new CmsError("Translate the source entry, not a translation", "invalid_input");
    }
    if (source.status === "trashed")
        throw new CmsError("A trashed entry cannot be translated", "invalid_status");
    if (source.locale === translation.locale) {
        throw new CmsError("A translation for this locale already exists", "translation_exists");
    }
}
/** A translation stores only per-language values. Shared fields belong to the source. */
export function assertTranslationMetadata(site, collection, isTranslation, metadata) {
    if (!isTranslation || !site.isCollection(collection))
        return;
    const common = site.commonFieldKeys(collection, metadata);
    if (common.length > 0) {
        throw new CmsError(`Common fields belong to the source: ${common.join(", ")}`, "invalid_input");
    }
}
/** Only translations carry a translation status. */
export function assertTranslationStateAllowed(translation, isTranslation) {
    if (translation !== null && !isTranslation) {
        throw new CmsError("Only translations have a translation state", "invalid_input");
    }
}
