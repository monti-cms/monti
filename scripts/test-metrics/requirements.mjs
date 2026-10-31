#!/usr/bin/env node
/**
 * Matches the requirement tables (`docs/testing/requirements/*.md`) with the tests that carry their IDs. A requirement row starts with its ID
 * (`| TRASH-R1 | …`) and names in its fifth cell the layer that checks it (`L1`…`L4`, or `—` for a promise with no code yet). A test carries
 * an ID as the start of its title: `it("TRASH-R1 restores an entry as a draft", …)`.
 *
 *   node scripts/test-metrics/requirements.mjs          # each requirement with the tests that carry it, by layer
 *   node scripts/test-metrics/requirements.mjs --check  # fails on a requirement with no test at its layer, or a test with an unknown ID (CI)
 *   node scripts/test-metrics/requirements.mjs --inverted  # the requirements with more tests in a layer above their own: to review, not a gate
 *
 * Tests are found by reading the test files for titles that start with an ID, so nothing has to run. The layer of a test comes from its file
 * name, as `docs/testing.md` names them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asCheck = process.argv.includes("--check");
const asInverted = process.argv.includes("--inverted");

const ID = /^[A-Z]+-[A-Z]+\d+$/;
const LAYERS = ["L1", "L2", "L3", "L4"];

const walk = (dir, keep, out = []) => {
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) walk(file, keep, out);
		else if (keep(file)) out.push(file);
	}
	return out;
};

/** The layer a test file runs at, from its name. Store contracts run against Postgres. */
const layerOf = (file) => {
	if (file.endsWith(".flow.ts")) return "L4";
	if (/\.(dom|browser)\.test\.tsx?$/.test(file)) return "L3";
	if (/\.int\.test\.ts$/.test(file) || file.endsWith(".contract.ts")) return "L2";
	return "L1";
};

const readRequirements = () => {
	const dir = path.join(root, "docs/testing/requirements");
	const requirements = new Map();
	for (const name of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
		let importance = "";
		for (const line of readFileSync(path.join(dir, name), "utf8").split("\n")) {
			if (line.startsWith("## "))
				importance = line.includes("🔴") ? "🔴" : line.includes("🟡") ? "🟡" : line.includes("⚪") ? "⚪" : "";
			if (!line.startsWith("| ")) continue;
			const cells = line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim());
			if (!ID.test(cells[0])) continue;
			if (requirements.has(cells[0])) throw new Error(`${cells[0]} is written twice (${name})`);
			const layer = cells[4];
			if (layer !== "—" && !LAYERS.includes(layer)) throw new Error(`${cells[0]} names no layer: "${layer}" (${name})`);
			requirements.set(cells[0], { id: cells[0], importance, layer, file: name, tests: [] });
		}
	}
	return requirements;
};

/**
 * A title that starts with an ID, as the first argument of a call: `it("…")`, `it.each(rows)("… %s")`, or a helper that builds one test per
 * case (`eachRunner("…")`).
 */
const TITLE = /\(\s*["'`]([A-Z]+-[A-Z]+\d+) ([^"'`]*)/g;

const readTests = () => {
	const files = [
		...walk(
			path.join(root, "packages"),
			(file) => /\.(test|contract)\.tsx?$/.test(file) || file.endsWith(".contract.ts"),
		),
		...walk(path.join(root, "flows"), (file) => file.endsWith(".flow.ts")),
	];
	const tests = [];
	for (const file of files) {
		for (const match of readFileSync(file, "utf8").matchAll(TITLE)) {
			tests.push({ id: match[1], title: match[2], file: path.relative(root, file), layer: layerOf(file) });
		}
	}
	return tests;
};

const requirements = readRequirements();
const problems = [];
for (const test of readTests()) {
	const requirement = requirements.get(test.id);
	if (requirement) requirement.tests.push(test);
	else problems.push(`${test.file}: "${test.id}" is in no requirement table`);
}
for (const requirement of requirements.values()) {
	if (requirement.layer === "—") {
		if (requirement.tests.length > 0) problems.push(`${requirement.id} has no code yet (—) but tests carry it`);
	} else if (!requirement.tests.some((test) => test.layer === requirement.layer)) {
		problems.push(`${requirement.id} is checked at ${requirement.layer}, and no ${requirement.layer} test carries it`);
	}
}

/**
 * Tests thin out going up from a requirement's own layer: that layer checks every case, each layer above checks only that the pieces are joined.
 * A requirement with more tests in a layer above its own is either written at the wrong layer or has upper tests re-checking cases. It is a
 * question for a person (`docs/testing/triage.md`, "뒤집힌 약속"), never a CI failure: a count is not the goal.
 */
const inverted = (requirement) => {
	const own = LAYERS.indexOf(requirement.layer);
	if (own < 0) return false;
	const count = (layer) => requirement.tests.filter((test) => test.layer === layer).length;
	return LAYERS.slice(own + 1).some((layer) => count(layer) > count(requirement.layer));
};

if (asInverted) {
	const rows = [...requirements.values()].filter(inverted);
	for (const requirement of rows) {
		const byLayer = LAYERS.map(
			(layer) => `${layer} ${requirement.tests.filter((test) => test.layer === layer).length}`,
		).join("  ");
		console.log(
			`${requirement.importance} ${requirement.id.padEnd(10)} at ${requirement.layer.padEnd(2)}   ${byLayer}`,
		);
	}
	console.log(`\n${rows.length} of ${requirements.size} requirements have more tests above their own layer`);
} else if (!asCheck) {
	for (const requirement of requirements.values()) {
		const byLayer = LAYERS.map(
			(layer) => `${layer} ${requirement.tests.filter((test) => test.layer === layer).length}`,
		).join("  ");
		console.log(
			`${requirement.importance} ${requirement.id.padEnd(10)} at ${requirement.layer.padEnd(2)}   ${byLayer}`,
		);
	}
	console.log(
		`\n${requirements.size} requirements, ${[...requirements.values()].reduce((n, r) => n + r.tests.length, 0)} tests carry them`,
	);
}
for (const problem of problems) console.error(problem);
if (asCheck && problems.length > 0) process.exit(1);
