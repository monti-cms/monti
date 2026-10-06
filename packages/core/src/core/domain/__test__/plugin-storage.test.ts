import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import {
	assertExpectedVersionNumber,
	assertMigrationName,
	assertStorageKey,
	assertStorageName,
	assertStoredVersion,
	serializeStorageValue,
	storageConflict,
	storageNotFound,
} from "../plugin-storage";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? error.code : "other";
	}
	return null;
};

describe("plugin storage rules", () => {
	it("names plugins and collections as lowercase words that start with a letter", () => {
		for (const name of ["ai", "git-sync", "action-overrides", "v2"]) {
			expect(codeOf(() => assertStorageName("plugin", name))).toBeNull();
		}
		for (const name of ["", "AI", "two words", "1st", "under_score", "dot.ted", "-lead", "한글"]) {
			expect(codeOf(() => assertStorageName("collection", name))).toBe("invalid_input");
		}
	});

	it("names migration steps like collections, and also allows `_`", () => {
		expect(codeOf(() => assertMigrationName("import_legacy_tables"))).toBeNull();
		expect(codeOf(() => assertMigrationName("ai-features-to-actions"))).toBeNull();
		expect(codeOf(() => assertMigrationName("Import"))).toBe("invalid_input");
		expect(codeOf(() => assertMigrationName("_start"))).toBe("invalid_input");
	});

	it("keys are any non-empty text", () => {
		expect(codeOf(() => assertStorageKey("a/b c:ü"))).toBeNull();
		expect(codeOf(() => assertStorageKey(""))).toBe("invalid_input");
	});

	it("an expected version is 0 or a whole number that was read, and a stored version starts at 1", () => {
		expect(codeOf(() => assertExpectedVersionNumber(0))).toBeNull();
		expect(codeOf(() => assertExpectedVersionNumber(12))).toBeNull();
		for (const version of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(codeOf(() => assertExpectedVersionNumber(version))).toBe("invalid_input");
		}
		expect(codeOf(() => assertStoredVersion(1))).toBeNull();
		expect(codeOf(() => assertStoredVersion(0))).toBe("invalid_input");
	});

	it("stores values as JSON text, and rejects what JSON cannot hold", () => {
		expect(serializeStorageValue({ b: [1, null], a: "x" })).toBe('{"b":[1,null],"a":"x"}');
		expect(serializeStorageValue(null)).toBe("null");
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		for (const value of [undefined, () => 1, Symbol("s"), circular, 10n]) {
			expect(codeOf(() => serializeStorageValue(value))).toBe("invalid_input");
		}
	});

	it("a conflict carries the stored version, and a missing item is not_found", () => {
		expect(storageConflict(4)).toMatchObject({ code: "conflict", serverVersion: 4 });
		expect(storageNotFound()).toMatchObject({ code: "not_found" });
	});
});
