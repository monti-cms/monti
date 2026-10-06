import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import type { Reference } from "../../types";
import {
	assertEditableStatus,
	assertExpectedVersion,
	assertPublishableStatus,
	assertSameCollection,
	isRepublish,
	isSameWorkingBody,
	mergePublishReferences,
} from "../publish";
import { isReferencesEqual } from "../references";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? { code: error.code, serverVersion: error.serverVersion } : "other";
	}
	return null;
};

describe("who may be published and edited", () => {
	it("publishes drafts and already published entries, but not archived or trashed ones", () => {
		expect(codeOf(() => assertPublishableStatus("draft"))).toBeNull();
		expect(codeOf(() => assertPublishableStatus("published"))).toBeNull();
		expect(codeOf(() => assertPublishableStatus("archived"))).toMatchObject({ code: "invalid_status" });
		expect(codeOf(() => assertPublishableStatus("trashed"))).toMatchObject({ code: "invalid_status" });
	});

	it("edits everything but a trashed entry", () => {
		expect(codeOf(() => assertEditableStatus("published"))).toBeNull();
		expect(codeOf(() => assertEditableStatus("archived"))).toBeNull();
		expect(codeOf(() => assertEditableStatus("trashed"))).toMatchObject({ code: "invalid_status" });
	});

	it("rejects a stale version with a conflict that carries the stored version", () => {
		expect(codeOf(() => assertExpectedVersion(3, 3))).toBeNull();
		expect(codeOf(() => assertExpectedVersion(4, 3))).toEqual({ code: "conflict", serverVersion: 4 });
	});

	it("rejects saving a draft into another collection", () => {
		expect(codeOf(() => assertSameCollection("post", "post"))).toBeNull();
		expect(codeOf(() => assertSameCollection("post", "tag"))).toMatchObject({ code: "invalid_input" });
	});
});

describe("references a publish checks", () => {
	const ref = (
		targetId: string,
		occurrences: Reference["occurrences"] = [],
		kind: Reference["kind"] = "entry",
	): Reference => ({
		kind,
		targetId,
		isStale: false,
		occurrences,
	});

	it("checks the snapshot's references and also the ones the saved draft still has", () => {
		const merged = mergePublishReferences([ref("a")], [ref("b")]);
		expect(merged.map((item) => item.targetId).sort()).toEqual(["a", "b"]);
	});

	it("merges a reference present in both, keeping every occurrence once", () => {
		const first = { type: "body", blockId: "aaaaaaaa" } as const;
		const second = { type: "body", blockId: "bbbbbbbb" } as const;
		const merged = mergePublishReferences([ref("a", [first])], [ref("a", [first, second])]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.occurrences).toEqual([first, second]);
	});

	it("treats an entry and a media file with the same id as different targets", () => {
		expect(mergePublishReferences([ref("a", [], "entry")], [ref("a", [], "media")])).toHaveLength(2);
	});

	it("compares two reference lists regardless of order and id case, occurrences included", () => {
		const occurrence = { type: "body", blockId: "x" } as const;
		expect(isReferencesEqual([ref("A", [occurrence]), ref("b")], [ref("b"), ref("a", [{ ...occurrence }])])).toBe(true);
		expect(isReferencesEqual([ref("a", [occurrence])], [ref("a", [{ ...occurrence, blockId: "y" }])])).toBe(false);
		expect(isReferencesEqual([ref("a")], [ref("a"), ref("b")])).toBe(false);
		expect(isReferencesEqual([{ ...ref("a"), isStale: true }], [ref("a")])).toBe(false);
	});
});

describe("when saving or publishing changes nothing", () => {
	const body = {
		contentHash: "h",
		schemaVersion: 1,
		slug: "s",
		metadata: { title: "t", tags: ["a"] },
		translation: null,
	};

	it("a save of the same body, slug, metadata and translation status is the same body", () => {
		expect(isSameWorkingBody(body, { ...body, metadata: { title: "t", tags: ["a"] } })).toBe(true);
	});

	it("a save into an entry without a body is never the same", () => {
		expect(isSameWorkingBody(null, body)).toBe(false);
	});

	it("any difference in hash, schema version, slug, metadata or translation status is a change", () => {
		expect(isSameWorkingBody(body, { ...body, contentHash: "other" })).toBe(false);
		expect(isSameWorkingBody(body, { ...body, schemaVersion: 2 })).toBe(false);
		expect(isSameWorkingBody(body, { ...body, slug: null })).toBe(false);
		expect(isSameWorkingBody(body, { ...body, metadata: { title: "t", tags: ["b"] } })).toBe(false);
		expect(isSameWorkingBody(body, { ...body, translation: { state: "stale" } })).toBe(false);
	});

	it("an unset translation status equals a stored null", () => {
		expect(isSameWorkingBody({ ...body, translation: undefined }, body)).toBe(true);
	});

	const state = {
		contentHash: "h",
		schemaVersion: 1,
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		metadata: { title: "t" },
		translation: null,
	};
	const slugs = { current: "s", target: "s" };

	it("publishing a draft that already is the published body at the public slug is a republish", () => {
		expect(isRepublish({ ...state, updatedAt: new Date(state.updatedAt) }, state, slugs)).toBe(true);
	});

	it("a first publish is not a republish", () => {
		expect(isRepublish(null, state, slugs)).toBe(false);
	});

	it("a changed body, modified date, metadata or public slug makes it a real publish", () => {
		expect(isRepublish({ ...state, contentHash: "old" }, state, slugs)).toBe(false);
		expect(isRepublish({ ...state, updatedAt: new Date("2025-01-01T00:00:00Z") }, state, slugs)).toBe(false);
		expect(isRepublish({ ...state, metadata: { title: "old" } }, state, slugs)).toBe(false);
		expect(isRepublish(state, state, { current: "old", target: "s" })).toBe(false);
	});
});
