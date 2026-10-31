import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection } from "../../../../test/any-site";
import { testConfig, testSite } from "../../../../test/site";
import { createSite } from "../../../site";
import { CmsError } from "../../store/errors";
import {
	assertKnownLocale,
	assertTranslationMetadata,
	assertTranslationSource,
	assertTranslationStateAllowed,
	type TranslationSource,
} from "../translation";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? error.code : "other";
	}
	return null;
};

/** A site whose translations are on: the config under test, with a second language when it has only one. */
const translationSite = testSite.ADMIN_TRANSLATIONS
	? testSite
	: createSite({ ...testConfig, locales: [...testConfig.locales, { code: "xx", name: "Other" }] });

const source = (patch: Partial<TranslationSource> = {}): TranslationSource => ({
	collection: contentCollection,
	status: "published",
	locale: translationSite.DEFAULT_LOCALE,
	translationGroupId: null,
	...patch,
});
const target = {
	collection: contentCollection,
	locale: translationSite.LOCALES.find((code) => code !== translationSite.DEFAULT_LOCALE) ?? "xx",
};

describe("translation source", () => {
	it("TRANS-N1 accepts the source of its group, in the same content collection, in another language", () => {
		expect(codeOf(() => assertTranslationSource(translationSite, source(), target))).toBeNull();
		expect(codeOf(() => assertTranslationSource(translationSite, source({ status: "draft" }), target))).toBeNull();
	});

	it("TRANS-N1 rejects every translation when the site turns translations off", () => {
		const off = createSite({ ...testConfig, admin: { ...testConfig.admin, translations: false } } as typeof testConfig);
		expect(off.ADMIN_TRANSLATIONS).toBe(false);
		expect(codeOf(() => assertTranslationSource(off, source(), target))).toBe("invalid_input");
	});

	it("TRANS-N1 rejects a source that does not exist", () => {
		expect(codeOf(() => assertTranslationSource(translationSite, undefined, target))).toBe("not_found");
	});

	it("TRANS-N1 rejects a translation of a translation", () => {
		expect(
			codeOf(() => assertTranslationSource(translationSite, source({ translationGroupId: "some-source" }), target)),
		).toBe("invalid_input");
	});

	it("TRANS-N1 rejects a source in the trash", () => {
		expect(codeOf(() => assertTranslationSource(translationSite, source({ status: "trashed" }), target))).toBe(
			"invalid_status",
		);
	});

	it("TRANS-N1 rejects an archived source: its group is hidden, so a new draft in it would be too", () => {
		expect(codeOf(() => assertTranslationSource(translationSite, source({ status: "archived" }), target))).toBe(
			"invalid_status",
		);
	});

	it("TRANS-N1 rejects a translation in the language of the source", () => {
		expect(
			codeOf(() =>
				assertTranslationSource(translationSite, source(), { ...target, locale: translationSite.DEFAULT_LOCALE }),
			),
		).toBe("translation_exists");
	});

	it("TRANS-N1 rejects a collection other than the source's, and record collections, which have no translations", () => {
		expect(
			codeOf(() => assertTranslationSource(translationSite, source({ collection: recordCollection }), target)),
		).toBe("invalid_input");
		expect(
			codeOf(() =>
				assertTranslationSource(translationSite, source({ collection: recordCollection }), {
					...target,
					collection: recordCollection,
				}),
			),
		).toBe("invalid_input");
	});
});

describe("translation metadata", () => {
	const everyField = Object.fromEntries(testSite.storedFields(contentCollection).map(({ name }) => [name, "x"]));
	/** Fields the config shares between a source and its translations, and the ones each language has of its own. */
	const common = testSite.commonFieldKeys(contentCollection, everyField);
	const perLanguage = Object.fromEntries(Object.entries(everyField).filter(([name]) => !common.includes(name)));

	it("TRANS-N3 lets a source carry any field", () => {
		expect(codeOf(() => assertTranslationMetadata(testSite, contentCollection, false, everyField))).toBeNull();
	});

	it("TRANS-N3 lets a translation carry its per-language values", () => {
		expect(codeOf(() => assertTranslationMetadata(testSite, contentCollection, true, perLanguage))).toBeNull();
	});

	it.skipIf(common.length === 0)(
		"TRANS-N3 rejects a translation that carries a field shared with the source, naming it",
		() => {
			const key = common[0] as string;
			try {
				assertTranslationMetadata(testSite, contentCollection, true, { ...perLanguage, [key]: "x" });
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(CmsError);
				expect((error as CmsError).code).toBe("invalid_input");
				expect((error as CmsError).message).toContain(key);
			}
		},
	);
});

describe("translation state and language", () => {
	it("TRANS-N9 only a translation carries a translation state", () => {
		expect(codeOf(() => assertTranslationStateAllowed({ status: "x" }, false))).toBe("invalid_input");
		expect(codeOf(() => assertTranslationStateAllowed({ status: "x" }, true))).toBeNull();
		expect(codeOf(() => assertTranslationStateAllowed(null, false))).toBeNull();
	});

	it("TRANS-N1 knows only the site's languages", () => {
		expect(codeOf(() => assertKnownLocale(testSite, testSite.DEFAULT_LOCALE))).toBeNull();
		expect(codeOf(() => assertKnownLocale(testSite, "xx-unknown"))).toBe("invalid_input");
	});
});
