import { describe, expect, it } from "vitest";
import { TRASH_DAYS } from "../../trash";
import {
	blockingMediaUsages,
	blockingUsages,
	cameWith,
	entriesToTrash,
	foldersToTrash,
	isTrashExpired,
	mediaToTrash,
	nextTrashStamp,
	planMediaFolderTrash,
	restoredWith,
} from "../trash";

const at = (iso: string) => new Date(iso);
const DAY = 24 * 60 * 60 * 1000;

describe("what a folder trash takes", () => {
	it("takes the folders and entries not in the trash yet, and leaves what was trashed earlier alone", () => {
		expect(
			foldersToTrash([
				{ id: "a", deletedAt: null },
				{ id: "b", deletedAt: at("2030-01-01T00:00:00Z") },
				{ id: "c", deletedAt: null },
			]),
		).toEqual(["a", "c"]);
		expect(
			entriesToTrash([
				{ id: "draft", status: "draft" },
				{ id: "live", status: "published" },
				{ id: "old", status: "archived" },
				{ id: "gone", status: "trashed" },
			]),
		).toEqual(["draft", "live", "old"]);
	});

	it("takes only ready media files", () => {
		expect(
			mediaToTrash([
				{ id: "ready", status: "ready" },
				{ id: "uploading", status: "pending" },
				{ id: "broken", status: "failed" },
				{ id: "already", status: "trashed" },
			]),
		).toEqual(["ready"]);
	});
});

describe("the stamp of a trash action", () => {
	it("is the clock cut to the millisecond when nothing in the subtree is newer", () => {
		expect(nextTrashStamp(at("2030-01-01T00:00:00.123Z"), [null, at("2029-12-31T00:00:00Z")])).toEqual(
			at("2030-01-01T00:00:00.123Z"),
		);
	});

	it("never equals a stamp already in the subtree, so earlier trashing cannot come back with this one", () => {
		const earlier = at("2030-01-01T00:00:00.123Z");
		const stamp = nextTrashStamp(at("2030-01-01T00:00:00.123Z"), [earlier]);
		expect(cameWith(earlier, stamp)).toBe(false);
		expect(stamp.getTime()).toBeGreaterThan(earlier.getTime());
	});
});

describe("what comes back with a restore", () => {
	const stamp = at("2030-02-01T10:00:00.000Z");

	it("brings back only what carries the stamp of the same action", () => {
		const items = [
			{ id: "with", deletedAt: stamp },
			{ id: "earlier", deletedAt: at("2030-01-15T10:00:00.000Z") },
			{ id: "live", deletedAt: null },
		];
		expect(restoredWith(items, stamp).map((item) => item.id)).toEqual(["with"]);
	});
});

describe("expiry", () => {
	it("expires once it has been kept for the whole time", () => {
		const trashed = at("2030-01-01T00:00:00Z");
		expect(isTrashExpired(trashed, new Date(trashed.getTime() + (TRASH_DAYS - 1) * DAY))).toBe(false);
		expect(isTrashExpired(trashed, new Date(trashed.getTime() + TRASH_DAYS * DAY))).toBe(true);
	});
});

describe("media folders with files in use", () => {
	it("goes whole when nothing is in use, and otherwise takes only the unused files", () => {
		expect(planMediaFolderTrash(["a", "b"], new Set())).toEqual({ whole: true, trash: ["a", "b"], kept: [] });
		expect(planMediaFolderTrash(["a", "b", "c"], new Set(["b"]))).toEqual({
			whole: false,
			trash: ["a", "c"],
			kept: ["b"],
		});
	});
});

describe("what blocks a permanent delete", () => {
	const row = (entryId: string, types: string[], trashed = false) => ({
		entryId,
		collection: "post",
		title: entryId,
		trashed,
		occurrences: types.map((type) => ({ type })),
	});

	it("blocks on relation fields only, once per entry, and marks the ones in the trash", () => {
		const usages = blockingUsages(
			[row("b", ["metadata"]), row("a", ["metadata", "body"], true), row("a", ["body"]), row("c", ["body"])],
			new Set(),
		);
		expect(usages).toEqual([
			{ entryId: "a", title: "a", collection: "post", trashed: true },
			{ entryId: "b", title: "b", collection: "post", trashed: false },
		]);
	});

	it("does not count entries that are deleted along with the target", () => {
		expect(
			blockingUsages([row("a", ["metadata"]), row("b", ["metadata"])], new Set(["a"])).map((u) => u.entryId),
		).toEqual(["b"]);
	});

	it("blocks a media file by any reference to it", () => {
		expect(
			blockingMediaUsages([row("a", ["body"]), row("b", ["metadata"])], new Set(["b"])).map((u) => u.entryId),
		).toEqual(["a"]);
	});
});
