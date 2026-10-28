import type { CmsConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { bulkBarMessages } from "../../entries/bulk-bar.messages";
import { entryEditorShellMessages } from "../../entries/entry-editor-shell.messages";
import { lifecycleConfirm } from "../../entries/lifecycle-confirm";
import { entriesMessages } from "../../entries/messages";
import { screensMessages } from "../../messages";
import { collectionNoun, nounVars } from "../noun.messages";

/** The site of the test config with its first content collection relabeled and the admin in `language`. */
const siteLabeled = (label: string, language: "en" | "ko") => {
	const probe = createSite(testConfig);
	const name = probe.DEFAULT_COLLECTION;
	return {
		name,
		site: createSite({
			...testConfig,
			collections: { ...testConfig.collections, [name]: { ...testConfig.collections[name], label } },
			admin: { ...testConfig.admin, locale: language },
		} as CmsConfig),
	};
};

describe("collection label in admin messages", () => {
	it("reads the label of the collection, and nothing for an unknown one", () => {
		const { site, name } = siteLabeled("Memo", "en");
		expect(collectionNoun(site, name)).toBe("Memo");
		expect(collectionNoun(site, "no-such-collection")).toBe("");
	});

	it("English messages name the entry with the label, lower case, and never say post", () => {
		const { site, name } = siteLabeled("Memo", "en");
		const noun = nounVars(site, name);
		const confirm = lifecycleConfirm(site, "archive", null, [{ state: "published" }] as never, name);
		expect(confirm.description).toContain("this memo");
		expect(confirm.description).not.toMatch(/post/i);

		const t = site.createTranslator(entryEditorShellMessages);
		expect(t("trashNotice", noun)).toContain("This memo is in the trash");
		expect(t("permanentDeleteAsk", noun)).toContain("this memo");

		const tc = site.createTranslator(entriesMessages);
		expect(tc("editor.readOnly", noun)).toBe("This memo can't be edited.");
		expect(tc("editor.notLoaded", noun)).toBe("The memo isn't loaded yet.");

		const ts = site.createTranslator(screensMessages);
		expect(ts("archive.askMany", { count: 3, ...noun })).toContain("3 selected memo entries");
		expect(ts("archive.askMany", { count: 3, ...noun })).not.toMatch(/post/i);
	});

	it("keeps a label with capitals of its own", () => {
		const { site, name } = siteLabeled("FAQ", "en");
		expect(site.createTranslator(entryEditorShellMessages)("trashNotice", nounVars(site, name))).toContain("This FAQ");
	});

	it("uses a neutral word when the collection is unknown", () => {
		const { site } = siteLabeled("Memo", "en");
		const noun = nounVars(site, "");
		expect(site.createTranslator(entryEditorShellMessages)("trashNotice", noun)).toContain("This entry");
		expect(site.createTranslator(screensMessages)("archive.askMany", { count: 2, ...noun })).toContain(
			"2 selected items",
		);
	});

	it("Korean messages pick the particle that fits the label", () => {
		const withFinal = siteLabeled("메모", "ko");
		const noun = nounVars(withFinal.site, withFinal.name);
		const tc = withFinal.site.createTranslator(entriesMessages);
		// "메모" has no final consonant: 를 and 가; "글" has one: 을.
		expect(tc("lifecycle.archive.ask", { translation: 0, ...noun })).toBe("이 메모를 보관할까요? 공개가 종료돼요.");
		expect(withFinal.site.createTranslator(entryEditorShellMessages)("trashNotice", noun)).toContain(
			"휴지통에 있는 메모예요",
		);

		const withBatchim = siteLabeled("글", "ko");
		const batchim = nounVars(withBatchim.site, withBatchim.name);
		expect(
			withBatchim.site.createTranslator(entriesMessages)("lifecycle.archive.ask", { translation: 0, ...batchim }),
		).toBe("이 글을 보관할까요? 공개가 종료돼요.");
		expect(withBatchim.site.createTranslator(screensMessages)("archive.askMany", { count: 2, ...batchim })).toBe(
			"선택한 글 2개를 보관할까요? 공개가 종료돼요.",
		);
	});

	it("bulk confirmations of a list name the label in both languages", () => {
		for (const [language, label, expected] of [
			["en", "Memo", "memo"],
			["ko", "메모", "메모"],
		] as const) {
			const { site, name } = siteLabeled(label, language);
			const t = site.createTranslator(bulkBarMessages);
			const asks = (["ask.publish", "ask.archive", "ask.unarchive"] as const).map((key) =>
				t(key, { count: 2, ...nounVars(site, name) }),
			);
			for (const ask of asks) {
				expect(ask).toContain(expected);
				expect(ask).not.toMatch(/post|글/);
			}
		}
	});
});
