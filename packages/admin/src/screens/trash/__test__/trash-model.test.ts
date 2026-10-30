import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { TrashReferrer } from "../../../api/trash";
import { trashMessages } from "../messages";
import {
	blockerOf,
	blockersFromResults,
	canDelete,
	daysLeftOf,
	deleteRequestOf,
	groupUsages,
	isUrgent,
	itemKey,
	keepsAddress,
	metaOf,
	newPlan,
	openOf,
	rowActionOf,
	summarizeRestore,
	usagesFromReferrers,
} from "../trash-model";
import { kindValues } from "../use-trash";
import { ago, content, entry, folder, inside, media, record, secondLocale } from "./trash-fixtures";

const t = testSite.createTranslator(trashMessages);
const now = new Date();
const none = new Map<string, number>();

describe("days left", () => {
	it("TRASH-B2 counts the thirty days from the day it was discarded, and has none inside a trashed folder", () => {
		expect(daysLeftOf(entry("a", "a", { deletedAt: ago(0) }), now)).toBe(30);
		expect(daysLeftOf(entry("a", "a", { deletedAt: ago(27) }), now)).toBe(3);
		expect(daysLeftOf(inside(entry("a", "a")), now)).toBeNull();
	});

	it("TRASH-B2 turns urgent at three days", () => {
		expect([4, 3, 0].map(isUrgent)).toEqual([false, true, true]);
	});
});

describe("which button a row has", () => {
	it("TRASH-R3 restores; restores the original of a translation whose original is in the trash; deletes what the last emptying kept", () => {
		const plain = entry("a", "a");
		const translation = entry("b", "b", { isSource: false, sourceTrashed: true, sourceTitle: "원문" });
		expect(rowActionOf(plain, none)).toBe("restore");
		expect(rowActionOf(translation, none)).toBe("restoreOriginal");
		expect(rowActionOf(plain, new Map([[itemKey(plain), 4]]))).toBe("delete");
		expect(rowActionOf(folder("f", "f"), none)).toBe("restore");
	});
});

describe("what pressing a row does", () => {
	it("TRASH-B1 goes into a folder, opens a document in the editor, and shows an item or a file in the panel", () => {
		expect(openOf(testSite, folder("f", "f"))).toEqual({ kind: "folder" });
		expect(openOf(testSite, entry("a", "a"))).toEqual({ kind: "editor", href: testSite.adminEntryEditHref("a") });
		expect(openOf(testSite, entry("a", "a", { collection: record }))).toEqual({ kind: "panel" });
		expect(openOf(testSite, media("m", "m.jpg"))).toEqual({ kind: "panel" });
	});
});

describe("the second line of a row", () => {
	it("TRASH-B1 names a translation by its language and a translation with its original in the trash by that", () => {
		const translation = entry("b", "b", { isSource: false, locale: secondLocale });
		expect(metaOf(testSite, translation, { searching: false }).text).toBe(
			t("meta.translation", { language: testSite.localeLabel(secondLocale) }),
		);
		const orphan = entry("c", "c", { isSource: false, sourceTrashed: true, sourceTitle: "원문" });
		expect(metaOf(testSite, orphan, { searching: false })).toEqual({
			text: t("row.sourceTrashed", { title: "원문" }),
			tone: "warning",
		});
	});

	it("TRASH-B1 starts with the folder in a search, ends with why in a kept row, and a file keeps its folder at the end", () => {
		const found = entry("a", "a", { path: ["시리즈 원고"] });
		expect(
			metaOf(testSite, found, { searching: true }).text.startsWith(t("meta.inFolder", { path: "시리즈 원고" })),
		).toBe(true);
		expect(metaOf(testSite, found, { searching: false }).text.startsWith("시리즈 원고")).toBe(false);
		const kept = metaOf(testSite, entry("t", "t", { collection: record }), { searching: false, kept: 4 });
		expect(kept.tone).toBe("warning");
		// An item has no line of its own: the kept row's line is only why it stayed.
		expect(kept.text).toBe(t("meta.pointed", { count: 4 }));
		expect(
			metaOf(testSite, media("m", "m.jpg", { path: ["Blog Assets"] }), { searching: true }).text.endsWith(
				"Blog Assets",
			),
		).toBe(true);
	});
});

describe("what points at an entry", () => {
	const referrer = (sourceId: string, occurrences: TrashReferrer["occurrences"], trashed = false): TrashReferrer => ({
		state: "working",
		sourceId,
		sourceCollection: content,
		sourceTitle: sourceId,
		sourceSlug: null,
		kind: "entry",
		isStale: false,
		occurrences,
		sourceStatus: trashed ? "trashed" : "published",
	});

	it("TRASH-D2 counts relation fields only, once per entry, and says which are in the trash", () => {
		const usages = usagesFromReferrers([
			referrer("a", [{ type: "metadata", path: "tagIds" }]),
			{ ...referrer("a", [{ type: "metadata", path: "tagIds" }]), state: "published" },
			referrer("b", [{ type: "body" }]),
			referrer("c", [{ type: "metadata", path: "tagIds" }], true),
		]);
		expect(usages.map((usage) => [usage.entryId, usage.trashed])).toEqual([
			["a", false],
			["c", true],
		]);
		expect(groupUsages(usages)).toEqual({ live: [usages[0]], trashed: [usages[1]] });
	});
});

describe("the permanent delete plan", () => {
	const tag = entry("tag", "임시", { collection: record });
	const usages = [
		{ entryId: "r1", title: "r1", collection: content, trashed: false },
		{ entryId: "r2", title: "r2", collection: content, trashed: true },
	];

	it("TRASH-D2 is allowed at once when nothing points at it", () => {
		expect(canDelete(newPlan([tag], []))).toBe(true);
	});

	it("TRASH-D3 waits for each kind of referrer to be dealt with, and sends the ones deleted together first", () => {
		const plan = newPlan([tag], [blockerOf(tag, usages)]);
		expect(canDelete(plan)).toBe(false);
		const unlinked = { ...plan, unlinked: new Set([itemKey(tag)]) };
		expect(canDelete(unlinked)).toBe(false);
		const both = { ...unlinked, together: new Set([itemKey(tag)]) };
		expect(canDelete(both)).toBe(true);
		expect(deleteRequestOf(both).map((target) => target.id)).toEqual(["r2", "tag"]);
		expect(deleteRequestOf(unlinked).map((target) => target.id)).toEqual(["tag"]);
	});

	it("TRASH-D2 takes the blockers a refused delete names, and only for the units that came back in use", () => {
		const other = entry("other", "other");
		const blockers = blockersFromResults(
			[tag, other],
			[
				{ type: "entry", id: "tag", ok: false, error: "in_use", usages },
				{ type: "entry", id: "other", ok: true },
			],
		);
		expect(blockers.map((blocker) => [blocker.item.id, blocker.live.length, blocker.trashed.length])).toEqual([
			["tag", 1, 1],
		]);
	});

	it("TRASH-D5 keeps the address of what was published", () => {
		expect(keepsAddress([entry("a", "a", { everPublished: true })])).toBe(true);
		expect(keepsAddress([entry("a", "a"), folder("f", "f")])).toBe(false);
	});
});

describe("what a restore tells", () => {
	const ok = (id: string, extra: Record<string, unknown> = {}) => ({
		type: "entry" as const,
		id,
		ok: true as const,
		...extra,
	});

	it("TRASH-R8 says a document is a draft again and names it for 열기, or that its folder was made again", () => {
		const doc = entry("a", "a");
		expect(summarizeRestore(testSite, [doc], [ok("a")], null)).toMatchObject({
			message: t("restore.draft"),
			openId: "a",
		});
		expect(summarizeRestore(testSite, [doc], [ok("a", { recreated: true })], "시리즈 원고")).toMatchObject({
			message: t("restore.recreatedDraft", { folder: "시리즈 원고" }),
			openId: "a",
		});
	});

	it("TRASH-R8 only says restored for an item, a file, a folder and for several", () => {
		const item = entry("t", "t", { collection: record });
		expect(summarizeRestore(testSite, [item], [ok("t")], null)).toMatchObject({
			message: t("restore.done"),
			openId: null,
		});
		expect(
			summarizeRestore(testSite, [media("m", "m.jpg")], [{ type: "media", id: "m", ok: true }], null),
		).toMatchObject({ message: t("restore.done") });
		expect(summarizeRestore(testSite, [folder("f", "f")], [{ type: "folder", id: "f", ok: true }], null)).toMatchObject(
			{ message: t("restore.done") },
		);
		const two = [entry("a", "a"), entry("b", "b")];
		expect(summarizeRestore(testSite, two, [ok("a"), ok("b")], null)).toMatchObject({
			message: t("restore.done"),
			openId: null,
		});
	});

	it("TRASH-R8 keeps what failed apart, with the original named for a translation", () => {
		const translation = entry("b", "b", { isSource: false });
		const summary = summarizeRestore(
			testSite,
			[translation],
			[{ type: "entry", id: "b", ok: false, error: "source_trashed", sourceId: "a" }],
			null,
		);
		expect(summary.message).toBeNull();
		expect(summary.failed).toEqual([{ item: translation, error: "source_trashed", sourceId: "a" }]);
	});
});

describe("the kind filter", () => {
	it("TRASH-B3 offers every collection in the site's order, then the media, each with its count and 0 for none", () => {
		const collections = testSite.COLLECTIONS;
		const values = kindValues({ media: 2, [collections[0] ?? content]: 3 }, collections);
		expect(values.map((value) => value.kind)).toEqual([...collections, "media"]);
		expect(values.find((value) => value.kind === "media")?.count).toBe(2);
		expect(values.find((value) => value.kind === collections[0])?.count).toBe(3);
		if (collections[1]) expect(values.find((value) => value.kind === collections[1])?.count).toBe(0);
	});
});
