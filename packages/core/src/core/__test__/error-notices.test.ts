import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection } from "../../../test/any-site";
import { testConfig, testSite } from "../../../test/site";
import { assertSchemaWritable } from "../../http/v1/schema/shared";
import { createTranslator } from "../../i18n";
import { schemaEditAccess } from "../../schema-edit";
import { createSite } from "../../site";
import { assertNoFolderCycle } from "../domain/folders";
import { assertArchivable, assertDeletable, assertDuplicable, assertTransitionAllowed } from "../domain/lifecycle";
import { assertEditableStatus, assertPublishableStatus } from "../domain/publish";
import {
	assertKnownLocale,
	assertTranslationMetadata,
	assertTranslationSource,
	type TranslationSource,
} from "../domain/translation";
import { noticeText } from "../error-notice";
import { noticeMessages } from "../error-notices.messages";
import { CmsError, type NoticeRef } from "../store/errors";

/** The notice a function throws as an error (`undefined` when it throws none, or throws something else). */
const noticeOf = (run: () => unknown): NoticeRef | undefined => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError && error.notice && "key" in error.notice ? error.notice : undefined;
	}
	return undefined;
};

const placeholdersOf = (text: unknown) =>
	typeof text === "string" ? [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : [];

describe("core notice dictionary", () => {
	const en = noticeMessages.messages.en;
	const ko = noticeMessages.messages.ko ?? {};

	it("ADMIN-E3 has the same keys in English and Korean", () => {
		expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
	});

	it("ADMIN-E3 shows the same values in both languages for every key, and leaves no {placeholder} unfilled", () => {
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			const names = [...new Set([...placeholdersOf(en[key]), ...placeholdersOf(ko[key])])];
			const vars = Object.fromEntries(names.map((name) => [name, `<${name}>`]));
			const shown = (language: string) => {
				const text = createTranslator(noticeMessages, language)(key, vars);
				expect(text, `${language} ${key}`).not.toMatch(/\{\w+\}/);
				return names.filter((name) => text.includes(`<${name}>`));
			};
			expect(shown("ko"), key).toEqual(shown("en"));
		}
	});

	it("only has a `.fix` key for a key that says what went wrong", () => {
		for (const key of Object.keys(en).filter((name) => name.endsWith(".fix"))) {
			expect(key.slice(0, -".fix".length) in en, key).toBe(true);
		}
	});

	it("fills the values a notice carries, in both languages", () => {
		const ref: NoticeRef = { key: "media.rename.extension", vars: { extension: ".png" } };
		for (const language of ["en", "ko"]) {
			const site = {
				createTranslator: createSite({ ...testConfig, admin: { ...testConfig.admin, language } } as never)
					.createTranslator,
			};
			const text = noticeText(site, { code: "invalid_input", notice: ref });
			expect(text.what).toContain(".png");
			expect(text.fix).toContain(".png");
		}
	});
});

describe("notices of the domain rules", () => {
	const t = testSite.createTranslator(noticeMessages);

	it("tells which status change cannot be made", () => {
		expect(noticeOf(() => assertTransitionAllowed("archive", "trashed", 1))).toEqual({ key: "entry.archive.status" });
		expect(noticeOf(() => assertTransitionAllowed("unarchive", "draft", 1))).toEqual({ key: "entry.unarchive.status" });
		expect(noticeOf(() => assertTransitionAllowed("trash", "trashed", 1))).toEqual({ key: "entry.trash.status" });
		expect(noticeOf(() => assertTransitionAllowed("restore", "published", 1))).toEqual({ key: "entry.restore.status" });
		expect(noticeOf(() => assertTransitionAllowed("restore", "trashed", 1))).toBeUndefined();
	});

	it("tells that a trashed entry is restored first, and that records are not archived", () => {
		expect(noticeOf(() => assertDuplicable("trashed"))).toEqual({ key: "entry.duplicate.trashed" });
		expect(noticeOf(() => assertEditableStatus("trashed"))).toEqual({ key: "entry.edit.trashed" });
		expect(noticeOf(() => assertPublishableStatus("trashed"))).toEqual({ key: "entry.publish.trashed" });
		expect(noticeOf(() => assertPublishableStatus("archived"))).toEqual({ key: "entry.publish.archived" });
		expect(noticeOf(() => assertArchivable(testSite, recordCollection, 1))).toEqual({ key: "entry.archive.record" });
		expect(noticeOf(() => assertDeletable("draft", 1))).toEqual({ key: "entry.delete.not_trashed" });
		expect(noticeOf(() => assertDeletable("trashed", 1))).toBeUndefined();
	});

	it("ADMIN-E1 every notice above has the text and a way out in the admin language", () => {
		for (const key of ["entry.duplicate.trashed", "entry.delete.not_trashed", "entry.publish.trashed"] as const) {
			const text = noticeText(testSite, { code: "invalid_status", notice: { key } });
			expect(text.what).toBe(t(key));
			expect(text.fix).toBe(t(`${key}.fix`));
		}
	});

	it("tells why a folder cannot move", () => {
		expect(noticeOf(() => assertNoFolderCycle("a", ["b", "a"]))).toEqual({ key: "folder.cycle" });
	});

	it("names the language that is not set up", () => {
		expect(noticeOf(() => assertKnownLocale(testSite, "xx-unknown"))).toEqual({
			key: "translation.locale_unknown",
			vars: { locale: "xx-unknown" },
		});
	});

	describe("translation", () => {
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
		const check = (patch: Partial<TranslationSource>, to = target) =>
			noticeOf(() => assertTranslationSource(translationSite, source(patch), to));

		it("tells why an entry cannot be translated", () => {
			expect(check({})).toBeUndefined();
			expect(check({ status: "trashed" })).toEqual({ key: "translation.source_trashed" });
			expect(check({ status: "archived" })).toEqual({ key: "translation.source_archived" });
			expect(check({ translationGroupId: "some-source" })).toEqual({ key: "translation.of_translation" });
			expect(check({ collection: recordCollection })).toEqual({ key: "translation.not_translatable" });
			expect(check({}, { ...target, locale: translationSite.DEFAULT_LOCALE })).toEqual({
				key: "translation.same_locale",
				vars: { locale: translationSite.DEFAULT_LOCALE },
			});
		});

		it("tells when the site does not use translations", () => {
			const off = createSite({
				...testConfig,
				admin: { ...testConfig.admin, translations: false },
			} as typeof testConfig);
			expect(noticeOf(() => assertTranslationSource(off, source(), target))).toEqual({ key: "translation.disabled" });
		});

		it("lists the fields that belong to the original entry", () => {
			const everyField = Object.fromEntries(testSite.storedFields(contentCollection).map(({ name }) => [name, "x"]));
			const common = testSite.commonFieldKeys(contentCollection, everyField);
			if (common.length === 0) return;
			expect(noticeOf(() => assertTranslationMetadata(testSite, contentCollection, true, everyField))).toEqual({
				key: "translation.common_fields",
				vars: { fields: common.join(", ") },
			});
		});
	});
});

describe("notice of a schema that is read-only", () => {
	it("names the reason the server gives", () => {
		const cms = { schemaFile: () => undefined };
		const access = schemaEditAccess(cms);
		if (access.writable) throw new Error("a test server has no schema file to write");
		expect(noticeOf(() => assertSchemaWritable(cms))).toEqual({ key: `schema.read_only.${access.reason}` });
	});
});
