#!/usr/bin/env node
/**
 * Runtime code Hangul check. Korean strings in package runtime code (`packages/*\/src`) live only in the message dictionary files
 * (`messages.ts`, `*.messages.ts`). Comments, tests (`__test__`, `*.test.*`) and test helpers (`src/test`) are not checked.
 *
 *   node scripts/check-korean.mjs            # list what remains; fails if any
 *   node scripts/check-korean.mjs packages/admin/src/screens/media   # only part of the tree
 *
 * Hangul that is not message text, such as regexes or character checks for Korean users, gets `// cms-allow-korean: reason` at the end of its line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);
const roots = targets.length
	? targets.map((target) => path.resolve(target))
	: readdirSync(path.join(root, "packages"))
			.map((name) => path.join(root, "packages", name, "src"))
			.filter((dir) => {
				try {
					return statSync(dir).isDirectory();
				} catch {
					return false;
				}
			});

const SKIP_DIRS = new Set(["__test__", "node_modules", "dist", "test"]);
const isMessages = (file) => /(^|[./])messages\.tsx?$/.test(path.basename(file));
const isTest = (file) => /\.test\.tsx?$/.test(file);

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(name)) walk(full);
		} else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !isTest(name) && !isMessages(full)) {
			files.push(full);
		}
	}
};
for (const dir of roots) {
	if (statSync(dir).isDirectory()) walk(dir);
	else files.push(dir);
}

/** Strips comments (keeps `//` inside strings). Keeps newlines to preserve line numbers. */
function stripComments(source) {
	let out = "";
	let i = 0;
	let quote = null;
	while (i < source.length) {
		const char = source[i];
		const next = source[i + 1];
		if (quote) {
			out += char;
			if (char === "\\") {
				out += next ?? "";
				i += 2;
				continue;
			}
			if (char === quote) quote = null;
			i += 1;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			out += char;
			i += 1;
			continue;
		}
		// Skip regex literals whole so quotes, backticks and `//` inside them do not confuse string/comment detection.
		if (
			char === "/" &&
			next !== "/" &&
			next !== "*" &&
			/(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|void|throw))\s*$/.test(out)
		) {
			let j = i + 1;
			let inClass = false;
			while (j < source.length && source[j] !== "\n") {
				if (source[j] === "\\") j += 1;
				else if (source[j] === "[") inClass = true;
				else if (source[j] === "]") inClass = false;
				else if (source[j] === "/" && !inClass) break;
				j += 1;
			}
			if (source[j] === "/") {
				out += source.slice(i, j + 1);
				i = j + 1;
				continue;
			}
		}
		if (char === "/" && next === "/") {
			const end = source.indexOf("\n", i);
			const line = source.slice(i, end === -1 ? source.length : end);
			// Keep the allow marker (that line is skipped).
			out += line.includes("cms-allow-korean") ? "/*allow*/" : "";
			i = end === -1 ? source.length : end;
			continue;
		}
		if (char === "/" && next === "*") {
			const end = source.indexOf("*/", i + 2);
			const block = source.slice(i, end === -1 ? source.length : end + 2);
			out += block.replace(/[^\n]/g, "");
			i = end === -1 ? source.length : end + 2;
			continue;
		}
		out += char;
		i += 1;
	}
	return out;
}

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const found = [];
for (const file of files) {
	const lines = stripComments(readFileSync(file, "utf8")).split("\n");
	lines.forEach((line, index) => {
		if (HANGUL.test(line) && !line.includes("/*allow*/"))
			found.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
	});
}

if (found.length > 0) {
	console.error(
		`${found.length} line(s) of runtime code still contain Korean. Move them to the message dictionary (messages.ts).\n`,
	);
	console.error(found.join("\n"));
	process.exit(1);
}
console.log(`check-korean: ok (${files.length} files)`);
