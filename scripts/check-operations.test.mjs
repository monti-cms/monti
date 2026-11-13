import assert from "node:assert/strict";
import { test } from "node:test";
import { namesDoc } from "./check-operations.mjs";

test("an item's 나온 곳 names a doc by its number alone, not inside a date or a longer number", () => {
	assert.equal(namesDoc("11", "11"), true);
	assert.equal(namesDoc("11 · 18", "11"), true);
	assert.equal(namesDoc("03 블록 표", "03"), true);
	assert.equal(namesDoc("디자인 검토 #499 (11)", "11"), true);
	// A date names no doc: "2026-11-06" kept doc 11 waiting on rows that were not its own.
	assert.equal(namesDoc("예전 CMS 비교, 2026-11-06", "11"), false);
	assert.equal(namesDoc("예전 CMS 비교, 2026-11-06", "06"), false);
	assert.equal(namesDoc("T110에서 나눔", "11"), false);
	assert.equal(namesDoc("#1103", "11"), false);
});
