import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildMap } from "./map.mjs";

const GUARD = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.join(GUARD, "map.mjs");

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A repository root whose `packages/core/src` holds `files`. */
function fixture(files) {
	const root = mkdtempSync(path.join(tmpdir(), "monti-map-"));
	roots.push(root);
	for (const [file, text] of Object.entries(files)) {
		const full = path.join(root, "packages/core/src", file);
		mkdirSync(path.dirname(full), { recursive: true });
		writeFileSync(full, text);
	}
	return root;
}

const lines = (map) => map.split("\n");

test("lists each file's exports and internal functions, grouped by layer in the core's order", () => {
	const map = buildMap(
		fixture({
			"index.ts": 'export { migrate } from "./db/migrate";\nexport * from "./engine/run";\n',
			"engine/run.ts": "export function run(): void {}\n",
			"db/migrate.ts":
				"async function ensure(db: Db): Promise<void> {}\nexport async function migrate(db: Db): Promise<void> {\n\tawait ensure(db);\n}\n",
			"zeta/extra.ts": "export const z = 1;\n",
		}),
	);
	assert.deepEqual(lines(map).slice(2), [
		"",
		"## db/",
		"db/migrate.ts",
		"  export async function migrate(db: Db): Promise<void>",
		"  [internal] async function ensure(db: Db): Promise<void>",
		"",
		"## engine/",
		"engine/run.ts",
		"  export function run(): void",
		"",
		"## index.ts",
		"index.ts",
		'  export { migrate } from "./db/migrate"',
		'  export * from "./engine/run"',
		"",
		"## zeta/",
		"zeta/extra.ts",
		"  export const z",
	]);
});

test("leaves out tests and test helpers", () => {
	const map = buildMap(
		fixture({
			"db/a.ts": "export const a = 1;\n",
			"db/a.test.ts": "export function inTest(): void {}\n",
			"__test__/database.ts": "export function helper(): void {}\n",
		}),
	);
	assert.doesNotMatch(map, /inTest|helper|__test__/);
	assert.match(map, /db\/a\.ts\n {2}export const a/);
});

test("collapses a multi-line signature to one line and shows function values and their types", () => {
	const map = buildMap(
		fixture({
			"engine/ops.ts": [
				"export function long(",
				"\tfirst: string,",
				"\tsecond: number,",
				"): Promise<",
				"\tvoid",
				"> {",
				"\treturn Promise.resolve();",
				"}",
				"export const arrow = async (a: string): Promise<number> => a.length;",
				"const inner = (b: number): number => b + 1;",
				"export const typed: Runner = () => undefined;",
				"const plain = 3;",
				"",
			].join("\n"),
		}),
	);
	assert.deepEqual(lines(map).slice(-4), [
		"  export function long(first: string, second: number): Promise<void>",
		"  export const arrow = async (a: string): Promise<number> => …",
		"  export const typed: Runner",
		"  [internal] const inner = (b: number): number => …",
	]);
	assert.doesNotMatch(map, /plain/);
});

test("shows interfaces, types, classes and enums with their members, and no internals of types.ts", () => {
	const map = buildMap(
		fixture({
			"db/types.ts": [
				"type Hidden = string;",
				"function helper(): void {}",
				"export interface Row extends Base {\n\tid: string;\n\tname: Hidden;\n}",
				"export type Kind = 'a' | 'b';",
				"",
			].join("\n"),
			"engine/error.ts": [
				"export class MontiError extends Error {",
				"\tcode: string;",
				"\tconstructor(code: string) {\n\t\tsuper(code);\n\t\tthis.code = code;\n\t}",
				"\tdescribe(): string {\n\t\treturn this.code;\n\t}",
				"}",
				"export enum Level { Low, High }",
				"",
			].join("\n"),
		}),
	);
	assert.match(
		map,
		/db\/types\.ts\n {2}export interface Row extends Base \{ id, name \}\n {2}export type Kind = 'a' \| 'b'\n/,
	);
	assert.doesNotMatch(map, /Hidden|helper/);
	assert.match(map, / {2}export class MontiError extends Error \{ code, constructor\(\), describe\(\) \}/);
	assert.match(map, / {2}export enum Level \{ Low, High \}/);
});

test("treats a declaration named in a local export list as exported", () => {
	const map = buildMap(
		fixture({
			"engine/a.ts":
				"function one(): void {}\nfunction two(): void {}\nfunction three(): void {}\nexport { one, two as second };\n",
		}),
	);
	assert.deepEqual(lines(map).slice(-4), [
		"  export function one(): void",
		"  export function two(): void",
		"  export { one, two as second }",
		"  [internal] function three(): void",
	]);
});

test("says so when the core has no source files", () => {
	assert.match(buildMap(fixture({})), /No source files yet\.$/);
});

test("prints the map when run, and nothing when imported", () => {
	const run = spawnSync(process.execPath, [MAP], { encoding: "utf8" });
	assert.equal(run.status, 0);
	assert.match(run.stdout, /^# Core symbol map \(packages\/core\/src\)\n/);
	const imported = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(MAP)});`], {
		encoding: "utf8",
	});
	assert.equal(imported.status, 0);
	assert.equal(imported.stdout, "");
});
