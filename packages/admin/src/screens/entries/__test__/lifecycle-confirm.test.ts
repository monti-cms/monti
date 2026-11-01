import { describe, expect, it } from "vitest";
import { defaultLocale } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { deleteMessages } from "../../shared/delete.messages";
import { nounVars } from "../../shared/noun.messages";
import {
	lifecycleConfirm,
	type TrashSubject,
	trashConfirm,
	trashSubjectOfEntry,
	trashSubjectOfRow,
} from "../lifecycle-confirm";
import { entriesMessages } from "../messages";

const t = testSite.createTranslator(entriesMessages);
const td = testSite.createTranslator(deleteMessages);

/** Two languages other than the default: the site's own, then made-up codes on a site with fewer (the code under test only reads them). */
const [FIRST = "", SECOND = ""] = [...testSite.LOCALES.filter((code) => code !== defaultLocale), "x-first", "x-second"];

const source = {
	id: "src",
	translationGroupId: "src",
	translations: [
		{ id: "src", locale: defaultLocale, status: "published", isSource: true },
		{ id: "en-1", locale: FIRST, status: "draft", isSource: false },
		{ id: "ja-1", locale: SECOND, status: "trashed", isSource: false },
	],
} as never;
const translation = { id: "en-1", translationGroupId: "src", translations: [] } as never;
const collection = testSite.DEFAULT_COLLECTION;
const noun = nounVars(testSite, collection);

describe("status transition confirmation text", () => {
	it("WRITE-W9 counts and reports only usages in the published version", () => {
		const confirm = lifecycleConfirm(
			testSite,
			"archive",
			null,
			[{ state: "published" }, { state: "published" }, { state: "draft" }] as never,
			collection,
		);
		expect(confirm.description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0, ...noun })}${t("lifecycle.usage", { count: 2, ...noun })}`,
		);
	});

	it("WRITE-W9 archiving the original reports that translations are archived too", () => {
		expect(lifecycleConfirm(testSite, "archive", source, [], collection).description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0, ...noun })}${t("lifecycle.archive.group")}`,
		);
	});

	it("WRITE-W9 there is no group notice when archiving a translation", () => {
		expect(lifecycleConfirm(testSite, "archive", translation, [], collection).description).toBe(
			t("lifecycle.archive.ask", { translation: 1, ...noun }),
		);
	});
});

describe("when the trash asks", () => {
	const subject = (status: string, alongside: TrashSubject["alongside"] = [], title: string | null = "첫 글") => ({
		title,
		status,
		alongside,
	});

	it("TRASH-T3 does not ask for a draft, an archived entry or a trashed one", () => {
		for (const status of ["draft", "archived", "trashed"])
			expect(trashConfirm(testSite, collection, [subject(status)])).toBeNull();
	});

	it("TRASH-T3 asks for a published entry, with or without changes after it, and says it goes off the site", () => {
		const ask = trashConfirm(testSite, collection, [subject("published")]);
		expect(ask).toEqual({
			title: td("trash.ask.title"),
			description: td("trash.ask.one", { title: "첫 글" }),
			confirmLabel: td("trash.ask.confirm"),
			destructive: true,
		});
	});

	it("TRASH-T3 names the translations that go with a published entry, by their language", () => {
		const ask = trashConfirm(testSite, collection, [
			subject("published", [
				{ locale: FIRST, status: "draft" },
				{ locale: SECOND, status: "published" },
			]),
		]);
		const languages = `${testSite.localeLabel(FIRST)}·${testSite.localeLabel(SECOND)}`;
		expect(ask?.description).toBe(
			`${td("trash.ask.one", { title: "첫 글" })}${td("trash.ask.translations", { languages })}`,
		);
	});

	it("TRASH-T3 asks when only a translation is published, with the same two sentences", () => {
		const ask = trashConfirm(testSite, collection, [subject("draft", [{ locale: FIRST, status: "published" }])]);
		expect(ask?.description).toBe(
			`${td("trash.ask.one", { title: "첫 글" })}${td("trash.ask.translations", { languages: testSite.localeLabel(FIRST) })}`,
		);
	});

	it("TRASH-T3 does not ask when a draft only has draft translations", () => {
		expect(trashConfirm(testSite, collection, [subject("draft", [{ locale: FIRST, status: "draft" }])])).toBeNull();
	});

	it("TRASH-T3 asks once for several rows when any is published, counting those that come down", () => {
		const ask = trashConfirm(testSite, collection, [subject("draft"), subject("published"), subject("published")]);
		expect(ask?.description).toBe(td("trash.ask.many", { count: 2 }));
		expect(trashConfirm(testSite, collection, [subject("draft"), subject("archived")])).toBeNull();
	});

	it("TRASH-T3 never asks for items such as tags, even though they are published records", () => {
		const items = testSite.COLLECTIONS.find((name) => testSite.isItemCollection(name));
		expect(items).toEqual(expect.any(String));
		expect(trashConfirm(testSite, items as string, [subject("published")])).toBeNull();
	});

	it("TRASH-T3 reads a list row as its title, its status and the other languages of its group", () => {
		const row = {
			id: "src",
			title: "첫 글",
			status: "published",
			translations: (source as { translations: never[] }).translations,
		} as never;
		expect(trashSubjectOfRow(row)).toEqual({
			title: "첫 글",
			status: "published",
			alongside: [{ id: "en-1", locale: FIRST, status: "draft", isSource: false }],
		});
	});

	it("TRASH-T3 reads the open original as its group's other languages, and a translation as alone", () => {
		const original = {
			...(source as object),
			collection,
			status: "published",
			working: { metadata: { title: "첫 글" } },
		} as never;
		expect(trashSubjectOfEntry(testSite, original).alongside.map((member) => member.locale)).toEqual([FIRST]);
		const open = { ...(translation as object), collection, status: "draft", working: { metadata: {} } } as never;
		expect(trashSubjectOfEntry(testSite, open).alongside).toEqual([]);
	});
});
