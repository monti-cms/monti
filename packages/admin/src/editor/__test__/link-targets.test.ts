import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { linkTargetText } from "../link-target-view";
import { linkTargetOfRow } from "../link-targets";
import { editorMessages } from "../messages";

const { LINKABLE_COLLECTIONS, DEFAULT_LOCALE, PREFIXED_LOCALES, adminUrl, contentPath, localizePath } = testSite;
const t = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);

/** A collection with a public path, whichever site config the tests run with: only such entries can be linked to. */
const COLLECTION = LINKABLE_COLLECTIONS[0] as string;
const TARGET = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";

const entryRow = (changes: Partial<Parameters<typeof linkTargetOfRow>[1]> = {}) =>
	linkTargetOfRow(testSite, {
		id: TARGET,
		collection: COLLECTION,
		status: "published",
		locale: DEFAULT_LOCALE,
		workingSlug: "hello-draft",
		publishedSlug: "hello",
		working: { metadata: {} },
		...changes,
	});

describe("where an internal link goes", () => {
	it("EDIT-L3 shows and opens the address with the locale prefix the site gives the entry's language", () => {
		for (const locale of [DEFAULT_LOCALE, ...PREFIXED_LOCALES]) {
			const target = entryRow({ locale });
			const expected = localizePath(locale, contentPath(COLLECTION, "hello") as string);
			expect(target.path, locale).toBe(expected);
			expect(target.href, locale).toBe(expected);
			expect(linkTargetText(t, tc, target).address, locale).toBe(expected);
		}
	});

	it("EDIT-L3 opens the entry in the admin while it is not published, and says so", () => {
		const target = entryRow({ status: "draft", publishedSlug: null });
		expect(target.href).toBe(adminUrl(`/entries/${TARGET}/edit`));
		const draftPath = localizePath(DEFAULT_LOCALE, contentPath(COLLECTION, "hello-draft") as string);
		const text = linkTargetText(t, tc, target);
		expect(text.address).toBe(`${draftPath} · ${t("link.targetDraft")}`);
		expect(text.label).toBe(t("link.targetOpenAdmin", { title: tc("untitled") }));
		expect(linkTargetText(t, tc, entryRow()).label).toBe(t("link.targetOpenSite", { title: tc("untitled") }));
	});
});
