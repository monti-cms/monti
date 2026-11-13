// `pnpm check:screens` on Monti's pack: where a banner may stand in a mockup, and what a part cannot go without (tracker T150).
// Run: node --test scripts/check-screens.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** What the check says of one spec: whether it passed, and its lines. */
function check(spec) {
	const dir = mkdtempSync(path.join(tmpdir(), "screens-"));
	const file = path.join(dir, "mockup.screen.json");
	writeFileSync(file, JSON.stringify(spec));
	const run = spawnSync(process.execPath, ["scripts/check-screens.mjs", file], { cwd: ROOT, encoding: "utf8" });
	rmSync(dir, { recursive: true });
	return { ok: run.status === 0, said: `${run.stdout}${run.stderr}` };
}

const banner = (props = { title: { text: "saveRefused" } }) => ({ type: "Banner", props });
const header = { type: "PageHeader", slots: { title: [{ text: "posts" }] } };

test("a banner in the frame's top place passes", () => {
	const result = check({
		root: "frame",
		elements: {
			frame: { type: "PageFrame", slots: { banner: ["notice"] }, children: ["header"] },
			notice: banner(),
			header,
		},
	});
	assert.equal(result.ok, true, result.said);
});

test("a banner among the page's own parts is refused, with its place", () => {
	const result = check({
		root: "frame",
		elements: {
			frame: { type: "PageFrame", children: ["header", "notice"] },
			notice: banner(),
			header,
		},
	});
	assert.equal(result.ok, false);
	assert.match(result.said, /notice: Banner stands only in PageFrame\.banner, not in frame\.children\[1\]/);
});

test("a banner in another part's named place is refused too", () => {
	const result = check({
		root: "frame",
		elements: {
			frame: { type: "PageFrame", children: ["header"] },
			header: { type: "PageHeader", slots: { title: [{ text: "posts" }], meta: ["notice"] } },
			notice: banner(),
		},
	});
	assert.equal(result.ok, false);
	assert.match(result.said, /notice: Banner stands only in PageFrame\.banner, not in header\.slots\.meta/);
});

test("a banner as the screen's root is refused", () => {
	const result = check({ root: "notice", elements: { notice: banner() } });
	assert.equal(result.ok, false);
	assert.match(result.said, /notice: Banner stands only in PageFrame\.banner, not in root/);
});

test("a banner with no sentence is refused", () => {
	const result = check({
		root: "frame",
		elements: {
			frame: { type: "PageFrame", slots: { banner: ["notice"] } },
			notice: banner({ meta: { text: "detail" } }),
		},
	});
	assert.equal(result.ok, false);
	assert.match(result.said, /notice\.props\.title: Banner is not drawn without it/);
});
