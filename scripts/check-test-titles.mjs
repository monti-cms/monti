#!/usr/bin/env node
/**
 * A browser test that fails leaves a picture of the page, named after the test: its `describe`s and its title, as one file name. A name
 * over 255 bytes cannot be made (ENAMETOOLONG), and the failure then leaves nothing to look at: a test whose button was not on the page
 * failed in CI with no picture to say what was there instead (#490's run, 2026-11-13). This fails when a browser test's name is too long
 * for its picture.
 *
 *   node scripts/check-test-titles.mjs
 *
 * What it cannot see: a title built at run time (`it.each`, a template with a value in it), and a test in a file whose `describe` or `it`
 * is not written at the start of a line as `describe("…", …` or `it("…", …`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The longest a test's name may be: the picture's file name is the name with every other character as a dash, then `-1.png` (the number
 * goes up with each picture of one test). 255 is the file system's limit; the rest is room for that ending.
 */
export const LONGEST = 240;

/** The tests of a file whose name (its `describe`s and its title, joined) is over the limit: the line, the length and the title. */
export function tooLong(source) {
	const found = [];
	let inside = [];
	for (const [index, line] of source.split("\n").entries()) {
		const group = line.match(/^(\t*)(?:\w+\.)?describe(?:\.\w+)?\((["'`])(.*)\2, /);
		if (group) {
			inside = [...inside.filter(({ depth }) => depth < group[1].length), { depth: group[1].length, name: group[3] }];
			continue;
		}
		const test = line.match(/^(\t*)(?:\w+\.)?(?:it|test)(?:\.\w+)?\((["'`])(.*)\2, /);
		if (!test) continue;
		const name = [...inside.filter(({ depth }) => depth < test[1].length).map((each) => each.name), test[3]].join(" ");
		if (name.length > LONGEST) found.push({ line: index + 1, length: name.length, title: test[3] });
	}
	return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const files = execFileSync("git", ["ls-files", "*.screen.test.tsx", "*.browser.test.tsx"], {
		cwd: root,
		encoding: "utf8",
	})
		.split("\n")
		.filter(Boolean);
	let failed = 0;
	for (const file of files)
		for (const { line, length, title } of tooLong(readFileSync(path.join(root, file), "utf8"))) {
			failed++;
			console.error(
				`${file}:${line}: the test's name is ${length} characters, over ${LONGEST}: "${title.slice(0, 60)}…"`,
			);
		}
	if (failed > 0) {
		console.error(
			"\nA failure of these tests could not save its picture. Shorten the title; what it leaves out goes in a comment over the test.",
		);
		process.exit(1);
	}
	console.log(`check-test-titles: ok (${files.length} files)`);
}
