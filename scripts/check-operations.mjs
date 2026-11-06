#!/usr/bin/env node
/**
 * Feature docs, the tracker and the code agree (docs/design/features/build.md, rule 4; docs/tracker.md, "쓰는 법").
 *
 *   node scripts/check-operations.mjs
 *
 * Rules (each finding names its rule id):
 *   undocumented    An operation defined in code (`defineOperation({ name: "…" })` in a package's src) is in no doc's "기능 목록" table.
 *   missing         A doc marked 끝 or 통합 대기 has an operation in its table that no code defines.
 *   open-item       A doc marked 끝 still has an open item in the tracker's "남은 일" that is to be done with it.
 *   unblocked       A doc marked 통합 대기 has no open item whose 나온 곳 names that doc.
 *   bad-item        An item's id repeats (open, finished or dropped), or an open item's "할 때" is neither a doc number nor 출시 전.
 *   unknown-id      A test title starts with a done-criterion id (`00-1 …`) that no doc's "끝 조건" lists.
 *
 * Operations defined in tests (`__test__`, `*.test.ts`) are samples, not Monti's, and are left out.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs/design/features");
const rel = (file) => path.relative(root, file);

function walk(dir, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (["node_modules", "dist", "storybook-static"].includes(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (/\.tsx?$/.test(entry.name)) out.push(full);
	}
	return out;
}

/** The lines of a doc between `## <title>` and the next `## `. */
function section(text, title) {
	const lines = text.split("\n");
	const start = lines.findIndex((line) => line.trim() === `## ${title}`);
	if (start < 0) return [];
	const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
	return lines.slice(start + 1, end < 0 ? undefined : end);
}

const docs = readdirSync(docsDir)
	.filter((name) => /^\d\d-.*\.md$/.test(name))
	.map((name) => {
		const text = readFileSync(path.join(docsDir, name), "utf8");
		const operations = section(text, "기능 목록")
			.filter((line) => line.startsWith("| `"))
			.flatMap((line) => [...line.split("|")[1].matchAll(/`([a-z][\w]*(?:\.[a-zA-Z]+)+)`/g)].map((match) => match[1]));
		const ids = section(text, "끝 조건").flatMap((line) =>
			[...line.matchAll(/\*\*(\d\d-\d+)\*\*/g)].map((match) => match[1]),
		);
		return { number: name.slice(0, 2), file: path.join(docsDir, name), operations, ids };
	});

const trackerFile = path.join(root, "docs/tracker.md");
const tracker = readFileSync(trackerFile, "utf8");
const rows = (title) =>
	section(tracker, title)
		.filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
		.slice(1)
		.map((line) =>
			line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);
const status = new Map(rows("문서마다 상태").map((cells) => [cells[0], cells[2]]));
const openItems = rows("남은 일").map(([id, , when, from]) => ({ id, when, from }));

const sources = readdirSync(path.join(root, "packages"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.flatMap((entry) => {
		try {
			return walk(path.join(root, "packages", entry.name, "src"));
		} catch {
			return [];
		}
	});
const isTest = (file) => /\.test\.tsx?$/.test(file) || file.split(path.sep).includes("__test__");

const defined = new Map();
const testIds = [];
for (const file of sources) {
	const text = readFileSync(file, "utf8");
	if (isTest(file)) {
		for (const match of text.matchAll(/\b(?:it|test|describe)\(\s*["'`](\d\d-\d+)\b/g))
			testIds.push({ file, id: match[1], line: text.slice(0, match.index).split("\n").length });
		continue;
	}
	for (const match of text.matchAll(/defineOperation\(\{\s*name:\s*"([^"]+)"/g))
		defined.set(match[1], { file, line: text.slice(0, match.index).split("\n").length });
}

const findings = [];
const documented = new Set(docs.flatMap((doc) => doc.operations));
for (const [name, where] of defined)
	if (!documented.has(name))
		findings.push(`${rel(where.file)}:${where.line}: [undocumented] \`${name}\` is in no feature doc's 기능 목록`);
for (const doc of docs) {
	if (!new Set(["끝", "통합 대기"]).has(status.get(doc.number))) continue;
	for (const name of doc.operations)
		if (!defined.has(name))
			findings.push(`${rel(doc.file)}: [missing] \`${name}\` is listed and the doc is 끝, but no code defines it`);
}
// A number is never used twice, across open, finished and dropped items.
const seen = new Set();
for (const [id] of [...rows("남은 일"), ...rows("끝낸 일"), ...rows("그만둔 일")]) {
	if (seen.has(id)) findings.push(`${rel(trackerFile)}: [bad-item] ${id} is used twice`);
	seen.add(id);
}
for (const item of openItems) {
	if (item.when !== "출시 전" && !docs.some((doc) => doc.number === item.when))
		findings.push(
			`${rel(trackerFile)}: [bad-item] ${item.id} is to be done with "${item.when}", which is no doc number`,
		);
	else if (status.get(item.when) === "끝")
		findings.push(
			`${rel(trackerFile)}: [open-item] doc ${item.when} is 끝, but ${item.id} is still to be done with it`,
		);
}
for (const [number, state] of status)
	if (state === "통합 대기" && !openItems.some((item) => new RegExp(`(^|\\D)${number}(\\D|$)`).test(item.from)))
		findings.push(`${rel(trackerFile)}: [unblocked] doc ${number} is 통합 대기, but no open item's 나온 곳 names it`);
for (const doc of docs)
	if (!status.has(doc.number))
		findings.push(`${rel(trackerFile)}: [bad-item] doc ${doc.number} has no row in 문서마다 상태`);

const knownIds = new Set(docs.flatMap((doc) => doc.ids));
for (const { file, id, line } of testIds)
	if (!knownIds.has(id)) findings.push(`${rel(file)}:${line}: [unknown-id] ${id} is no doc's 끝 조건`);

if (findings.length > 0) {
	console.error(findings.join("\n"));
	process.exit(1);
}
console.log(`check-operations: ok (${defined.size} operations, ${testIds.length} tests with ids)`);
