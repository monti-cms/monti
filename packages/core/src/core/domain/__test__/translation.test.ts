import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, secondLocale } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
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

const source = (patch: Partial<TranslationSource> = {}): TranslationSource => ({
	collection: contentCollection,
	status: "published",
	locale: testSite.DEFAULT_LOCALE,
	translationGroupId: null,
	...patch,
});
const target = { collection: contentCollection, locale: secondLocale ?? "xx" };

describe("translation source", () => {
	it("accepts the source of its group, in the same content collection, in another language", () => {
		expect(codeOf(() => assertTranslationSource(testSite, source(), target))).toBeNull();
		expect(codeOf(() => assertTranslationSource(testSite, source({ status: "draft" }), target))).toBeNull();
		expect(codeOf(() => assertTranslationSource(testSite, source({ status: "archived" }), target))).toBeNull();
	});

	it("rejects a source that does not exist", () => {
		expect(codeOf(() => assertTranslationSource(testSite, undefined, target))).toBe("not_found");
	});

	it("rejects a translation of a translation", () => {
		expect(codeOf(() => assertTranslationSource(testSite, source({ translationGroupId: "some-source" }), target))).toBe(
			"invalid_input",
		);
	});

	it("rejects a source in the trash", () => {
		expect(codeOf(() => assertTranslationSource(testSite, source({ status: "trashed" }), target))).toBe(
			"invalid_status",
		);
	});

	it("rejects a translation in the language of the source", () => {
		expect(
			codeOf(() => assertTranslationSource(testSite, source(), { ...target, locale: testSite.DEFAULT_LOCALE })),
		).toBe("translation_exists");
	});

	it("rejects a collection other than the source's, and record collections, which have no translations", () => {
		expect(codeOf(() => assertTranslationSource(testSite, source({ collection: recordCollection }), target))).toBe(
			"invalid_input",
		);
		expect(
			codeOf(() =>
				assertTranslationSource(testSite, source({ collection: recordCollection }), {
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

	it("lets a source carry any field", () => {
		expect(codeOf(() => assertTranslationMetadata(testSite, contentCollection, false, everyField))).toBeNull();
	});

	it("lets a translation carry its per-language values", () => {
		expect(codeOf(() => assertTranslationMetadata(testSite, contentCollection, true, perLanguage))).toBeNull();
	});

	it.skipIf(common.length === 0)("rejects a translation that carries a field shared with the source, naming it", () => {
		const key = common[0] as string;
		try {
			assertTranslationMetadata(testSite, contentCollection, true, { ...perLanguage, [key]: "x" });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(CmsError);
			expect((error as CmsError).code).toBe("invalid_input");
			expect((error as CmsError).message).toContain(key);
		}
	});
});

describe("translation state and language", () => {
	it("only a translation carries a translation state", () => {
		expect(codeOf(() => assertTranslationStateAllowed({ status: "x" }, false))).toBe("invalid_input");
		expect(codeOf(() => assertTranslationStateAllowed({ status: "x" }, true))).toBeNull();
		expect(codeOf(() => assertTranslationStateAllowed(null, false))).toBeNull();
	});

	it("knows only the site's languages", () => {
		expect(codeOf(() => assertKnownLocale(testSite, testSite.DEFAULT_LOCALE))).toBeNull();
		expect(codeOf(() => assertKnownLocale(testSite, "xx-unknown"))).toBe("invalid_input");
	});
});
