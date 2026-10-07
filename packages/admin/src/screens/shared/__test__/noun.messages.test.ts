import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { taxonomyActions } from "../../entries/bulk-bar";
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
		} as AnyCmsConfig),
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
		expect(t("newEntry", noun)).toBe("New memo");
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
		expect(site.createTranslator(entryEditorShellMessages)("newEntry", nounVars(site, name))).toBe("New FAQ");
	});

	it("uses a neutral word when the collection is unknown", () => {
		const { site } = siteLabeled("Memo", "en");
		const noun = nounVars(site, "");
		expect(site.createTranslator(entryEditorShellMessages)("newEntry", noun)).toBe("New entry");
		expect(site.createTranslator(screensMessages)("archive.askMany", { count: 2, ...noun })).toContain(
			"2 selected items",
		);
	});

	it("Korean messages pick the particle that fits the label", () => {
		const withFinal = siteLabeled("메모", "ko");
		const noun = nounVars(withFinal.site, withFinal.name);
		const tc = withFinal.site.createTranslator(entriesMessages);
		// "메모" has no final consonant: 를 and 가; "글" has one: 을.
		expect(tc("lifecycle.archive.ask", { translation: 0, ...noun })).toBe("이 메모를 보관할까요? 공개가 종료됩니다.");
		expect(withFinal.site.createTranslator(entryEditorShellMessages)("newEntry", noun)).toBe("새 메모");

		const withBatchim = siteLabeled("글", "ko");
		const batchim = nounVars(withBatchim.site, withBatchim.name);
		expect(
			withBatchim.site.createTranslator(entriesMessages)("lifecycle.trash.ask", { translation: 0, ...batchim }),
		).toBe("이 글을 휴지통으로 이동할까요? 공개가 종료됩니다.");
		expect(withBatchim.site.createTranslator(screensMessages)("archive.askMany", { count: 2, ...batchim })).toBe(
			"선택한 글 2개를 보관할까요? 공개가 종료됩니다.",
		);
	});

	it("bulk confirmations of a list name the label in both languages", () => {
		for (const [language, label, expected] of [
			["en", "Memo", "memo"],
			["ko", "메모", "메모"],
		] as const) {
			const { site, name } = siteLabeled(label, language);
			const asks = taxonomyActions(site, name).map((action) => action.ask(2, "x"));
			expect(asks.length).toBeGreaterThan(0);
			for (const ask of asks) {
				expect(ask).toContain(expected);
				expect(ask).not.toMatch(/post|글/);
			}
		}
	});
});
