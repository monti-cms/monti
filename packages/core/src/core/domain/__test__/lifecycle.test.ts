import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection } from "../../../../test/any-site";
import { CmsError } from "../../store/errors";
import type { EntryStatus } from "../../store/types";
import {
	assertArchivable,
	assertDeletable,
	assertRestoreSnapshot,
	assertSourceNotTrashed,
	assertTransitionAllowed,
	blockingTranslations,
	type GroupMember,
	type LifecycleAction,
	membersToArchive,
	membersToRestore,
	membersToTrash,
	membersToUnarchive,
	restorePublishesAgain,
	STATUS_AFTER,
	trashRequiresNoReferences,
} from "../lifecycle";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? { code: error.code, serverVersion: error.serverVersion } : "other";
	}
	return null;
};

const ALL: EntryStatus[] = ["draft", "published", "archived", "trashed"];

/** Statuses each transition may start from. */
const STARTS: Record<LifecycleAction, EntryStatus[]> = {
	archive: ["draft", "published"],
	unarchive: ["archived"],
	trash: ["draft", "published", "archived"],
	restore: ["trashed"],
};

describe("lifecycle transitions", () => {
	for (const action of Object.keys(STARTS) as LifecycleAction[]) {
		it(`${action} is allowed from ${STARTS[action].join(", ")} and rejects every other status with invalid_status`, () => {
			for (const status of ALL) {
				const result = codeOf(() => assertTransitionAllowed(action, status, 7));
				if (STARTS[action].includes(status)) expect(result).toBeNull();
				else expect(result).toEqual({ code: "invalid_status", serverVersion: 7 });
			}
		});
	}

	it("a restore never takes a published entry offline: only a trashed entry can be restored", () => {
		expect(codeOf(() => assertTransitionAllowed("restore", "published", 1))).toMatchObject({ code: "invalid_status" });
	});

	it("leaves an entry as archived, draft, trashed and draft after archive, unarchive, trash and restore", () => {
		expect(STATUS_AFTER).toEqual({ archive: "archived", unarchive: "draft", trash: "trashed", restore: "draft" });
	});

	it("archives content collections, but not record collections", () => {
		expect(codeOf(() => assertArchivable(contentCollection, 3))).toBeNull();
		expect(codeOf(() => assertArchivable(recordCollection, 3))).toEqual({ code: "invalid_status", serverVersion: 3 });
	});

	it("requires a record to be unreferenced before trashing and publishes it again on restore; a content collection does neither", () => {
		expect(trashRequiresNoReferences(recordCollection)).toBe(true);
		expect(restorePublishesAgain(recordCollection)).toBe(true);
		expect(trashRequiresNoReferences(contentCollection)).toBe(false);
		expect(restorePublishesAgain(contentCollection)).toBe(false);
	});

	it("restoring a translation needs its source out of the trash", () => {
		expect(codeOf(() => assertSourceNotTrashed("trashed", 4))).toEqual({ code: "source_trashed", serverVersion: 4 });
		expect(codeOf(() => assertSourceNotTrashed("draft", 4))).toBeNull();
		expect(codeOf(() => assertSourceNotTrashed(undefined, 4))).toBeNull();
	});

	it("restoring a record needs its prepared draft", () => {
		expect(codeOf(() => assertRestoreSnapshot(undefined))).toMatchObject({ code: "invalid_input" });
		expect(codeOf(() => assertRestoreSnapshot({}))).toBeNull();
	});

	it("deletes for good only a trashed entry", () => {
		for (const status of ALL) {
			const result = codeOf(() => assertDeletable(status, 2));
			if (status === "trashed") expect(result).toBeNull();
			else expect(result).toEqual({ code: "invalid_status", serverVersion: 2 });
		}
	});
});

describe("what a source's transition does to its translations", () => {
	const at = (iso: string) => new Date(iso);
	const group: GroupMember[] = [
		{ id: "draft", status: "draft", trashedAt: null },
		{ id: "published", status: "published", trashedAt: null },
		{ id: "archived", status: "archived", trashedAt: null },
		{ id: "trashed-with-source", status: "trashed", trashedAt: at("2026-01-01T00:00:00Z") },
		{ id: "trashed-earlier", status: "trashed", trashedAt: at("2025-06-01T00:00:00Z") },
	];

	it("archives the drafts and published translations only", () => {
		expect(membersToArchive(group)).toEqual(["draft", "published"]);
	});

	it("unarchives the archived translations only", () => {
		expect(membersToUnarchive(group)).toEqual(["archived"]);
	});

	it("trashes every translation that is not in the trash yet", () => {
		expect(membersToTrash(group)).toEqual(["draft", "published", "archived"]);
	});

	it("restores only the translations trashed together with the source (the same trash time)", () => {
		expect(membersToRestore(group, at("2026-01-01T00:00:00Z"))).toEqual(["trashed-with-source"]);
	});

	it("restores no translation when the source has no trash time", () => {
		expect(membersToRestore(group, null)).toEqual([]);
	});

	it("blocks deleting a source while a translation is outside the trash", () => {
		expect(blockingTranslations(group)).toEqual(["draft", "published", "archived"]);
		expect(blockingTranslations(group.filter((member) => member.status === "trashed"))).toEqual([]);
	});
});
