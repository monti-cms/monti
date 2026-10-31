import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { CmsError } from "../../store/errors";
import type { EntryStatus } from "../../store/types";
import {
	assertArchivable,
	assertDeletable,
	assertRestoreSnapshot,
	assertSourceNotTrashed,
	assertTransitionAllowed,
	blockingTranslations,
	canTransition,
	type GroupMember,
	type LifecycleAction,
	membersToArchive,
	membersToRestore,
	membersToTrash,
	membersToUnarchive,
	restorePublishesAgain,
	STATUS_AFTER,
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
	const allowedFrom = (action: LifecycleAction) => {
		for (const status of ALL) {
			const result = codeOf(() => assertTransitionAllowed(action, status, 7));
			if (STARTS[action].includes(status)) expect(result).toBeNull();
			else expect(result).toEqual({ code: "invalid_status", serverVersion: 7 });
		}
	};
	// Archiving is a write rule, trashing and restoring are trash rules.
	for (const action of ["archive", "unarchive"] as const) {
		it(`WRITE-W13 ${action} is allowed from ${STARTS[action].join(", ")} and rejects every other status with invalid_status`, () =>
			allowedFrom(action));
	}
	for (const action of ["trash", "restore"] as const) {
		it(`TRASH-R9 ${action} is allowed from ${STARTS[action].join(", ")} and rejects every other status with invalid_status`, () =>
			allowedFrom(action));
	}

	it("canTransition agrees with assertTransitionAllowed for every action and status", () => {
		for (const action of Object.keys(STARTS) as LifecycleAction[]) {
			for (const status of ALL) {
				expect(canTransition(action, status), `${action} from ${status}`).toBe(
					codeOf(() => assertTransitionAllowed(action, status, 1)) === null,
				);
			}
		}
	});

	it("TRASH-R9 a restore never takes a published entry offline: only a trashed entry can be restored", () => {
		expect(codeOf(() => assertTransitionAllowed("restore", "published", 1))).toMatchObject({ code: "invalid_status" });
	});

	it("TRASH-R1 leaves an entry as archived, draft, trashed and draft after archive, unarchive, trash and restore", () => {
		expect(STATUS_AFTER).toEqual({ archive: "archived", unarchive: "draft", trash: "trashed", restore: "draft" });
	});

	it("WRITE-W13 archives content collections, but not record collections", () => {
		expect(codeOf(() => assertArchivable(testSite, contentCollection, 3))).toBeNull();
		expect(codeOf(() => assertArchivable(testSite, recordCollection, 3))).toEqual({
			code: "invalid_status",
			serverVersion: 3,
		});
	});

	it("TRASH-R1 publishes a record again on restore; a content collection returns to draft", () => {
		expect(restorePublishesAgain(testSite, recordCollection)).toBe(true);
		expect(restorePublishesAgain(testSite, contentCollection)).toBe(false);
	});

	it("TRASH-R3 restoring a translation needs its source out of the trash", () => {
		expect(codeOf(() => assertSourceNotTrashed("trashed", 4))).toEqual({ code: "source_trashed", serverVersion: 4 });
		expect(codeOf(() => assertSourceNotTrashed("draft", 4))).toBeNull();
		expect(codeOf(() => assertSourceNotTrashed(undefined, 4))).toBeNull();
	});

	it("restoring a record needs its prepared draft", () => {
		expect(codeOf(() => assertRestoreSnapshot(undefined))).toMatchObject({ code: "invalid_input" });
		expect(codeOf(() => assertRestoreSnapshot({}))).toBeNull();
	});

	it("TRASH-D1 deletes for good only a trashed entry", () => {
		for (const status of ALL) {
			const result = codeOf(() => assertDeletable(status, 2));
			if (status === "trashed") expect(result).toBeNull();
			else expect(result).toEqual({ code: "invalid_status", serverVersion: 2 });
		}
	});
});

describe("what a source's transition does to its translations", () => {
	const group: GroupMember[] = [
		{ id: "draft", status: "draft", trashedWithSource: false },
		{ id: "published", status: "published", trashedWithSource: false },
		{ id: "archived", status: "archived", trashedWithSource: false },
		{ id: "trashed-with-source", status: "trashed", trashedWithSource: true },
		{ id: "trashed-earlier", status: "trashed", trashedWithSource: false },
	];

	it("TRANS-N8 archives the drafts and published translations only", () => {
		expect(membersToArchive(group)).toEqual(["draft", "published"]);
	});

	it("TRANS-N8 unarchives the archived translations only", () => {
		expect(membersToUnarchive(group)).toEqual(["archived"]);
	});

	it("TRASH-T2 trashes every translation that is not in the trash yet", () => {
		expect(membersToTrash(group)).toEqual(["draft", "published", "archived"]);
	});

	it("TRASH-R2 restores only the translations trashed together with the source (the same trash time)", () => {
		expect(membersToRestore(group)).toEqual(["trashed-with-source"]);
	});

	it("TRASH-D6 blocks deleting a source while a translation is outside the trash", () => {
		expect(blockingTranslations(group)).toEqual(["draft", "published", "archived"]);
		expect(blockingTranslations(group.filter((member) => member.status === "trashed"))).toEqual([]);
	});
});
