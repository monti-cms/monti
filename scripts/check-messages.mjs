#!/usr/bin/env node
/**
 * Message dictionary guard. The dictionaries (`defineMessages(...)`) of the packages in `PACKAGES` follow one naming convention, have the same keys in
 * English and Korean, and hold no key that nothing refers to.
 *
 *   node scripts/check-messages.mjs              # every package in PACKAGES; fails on any finding
 *   node scripts/check-messages.mjs admin seo    # only these packages
 *
 * Rules (each finding names its rule id):
 *   file-name      A file that defines a dictionary is `messages.ts` (the main dictionary of its folder) or `<name>.messages.ts` (any other).
 *   missing-key    A key present in one language only.
 *   unreferenced   A key no source of the package refers to. A key counts as referenced when its text appears as a string literal in the package's
 *                  source, or when it starts (and ends) like the static parts of a template literal that builds keys (`` `filter.${value}` ``).
 *
 * Tests (`__test__`, `*.test.*`, `test/`) are neither dictionaries nor references. The dictionaries are loaded (through Vite, for TypeScript), so the
 * keys are the ones the admin reads, whatever builds the object.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, createServerModuleRunner } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (file) => path.relative(root, file).split(path.sep).join("/");
const only = process.argv.slice(2);

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name === "dist") continue;
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(name)) out.push(full);
	}
	return out;
}

const isTest = (file) => /(^|\/)(__test__|test)\//.test(rel(file)) || /\.test\.tsx?$/.test(file);

/** `text` without the argument lists of its `defineMessages(...)` calls: a key's own `"key": "text"` line is not a reference to it. */
function withoutDefinitions(text) {
	let result = text;
	for (let from = result.indexOf("defineMessages("); from !== -1; from = result.indexOf("defineMessages(")) {
		let depth = 0;
		let end = from + "defineMessages".length;
		for (; end < result.length; end++) {
			const char = result[end];
			if (char === '"' || char === "'" || char === "`") {
				for (end++; end < result.length && result[end] !== char; end++) if (result[end] === "\\") end++;
			} else if (char === "(") depth++;
			else if (char === ")" && --depth === 0) break;
		}
		result = result.slice(0, from) + result.slice(end + 1);
	}
	return result;
}

/** The string literals of the package's sources, and the static ends of the template literals that build keys. */
function referencesOf(sources) {
	const literals = new Set();
	const templates = [];
	for (const { text: whole } of sources) {
		const text = withoutDefinitions(whole);
		// Each kind of quote is read on its own, so an apostrophe or a quote inside a template expression cannot swallow the literals around it.
		for (const match of text.matchAll(/"((?:\\.|[^"\\\n])*)"/g)) literals.add(match[1]);
		for (const match of text.matchAll(/'((?:\\.|[^'\\\n])*)'/g)) literals.add(match[1]);
		for (const match of text.matchAll(/`([^`]*\$\{[^`]*)`/g)) {
			const parts = match[1].split(/\$\{[^}]*\}/);
			const prefix = parts[0] ?? "";
			const suffix = parts.length > 1 ? (parts.at(-1) ?? "") : "";
			if (prefix.length + suffix.length >= 3) templates.push({ prefix, suffix });
		}
		for (const match of text.matchAll(/`([^`$]*)`/g)) literals.add(match[1]);
	}
	return (key) =>
		literals.has(key) || templates.some(({ prefix, suffix }) => key.startsWith(prefix) && key.endsWith(suffix));
}

const isBundle = (value) =>
	typeof value === "object" &&
	value !== null &&
	typeof value.namespace === "string" &&
	typeof value.messages === "object";

const ALL_RULES = ["file-name", "missing-key", "unreferenced"];
/**
 * The packages checked, with their rules. The core looks its block labels and error texts up by names built at run time (a block's name, an error
 * code), which the reference rule cannot see, so it is checked for names and keys only. The auth package has no dictionary of its own to check: it
 * builds `cms.auth` when it starts, from the button labels each login provider brings, and a provider from another package may bring English only.
 */
const PACKAGES = {
	admin: ALL_RULES,
	ai: ALL_RULES,
	blocks: ALL_RULES,
	core: ["file-name", "missing-key"],
	mdx: ALL_RULES,
	seo: ALL_RULES,
};
const packages = Object.keys(PACKAGES).filter((name) => only.length === 0 || only.includes(name));

const server = await createServer({
	configFile: false,
	root,
	logLevel: "error",
	appType: "custom",
	server: { middlewareMode: true, hmr: false, ws: false },
});
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });

const findings = [];
let dictionaryCount = 0;
try {
	for (const name of packages) {
		const add = (file, rule, message) => {
			if (PACKAGES[name].includes(rule)) findings.push({ file: rel(file), rule, message });
		};
		const sources = walk(path.join(root, "packages", name, "src"))
			.filter((file) => !isTest(file))
			.map((file) => ({ file, text: readFileSync(file, "utf8") }));
		const dictionaries = sources.filter(({ text }) => text.includes("defineMessages("));
		if (dictionaries.length === 0) continue;
		const referenced = referencesOf(sources);
		for (const { file } of dictionaries) {
			dictionaryCount += 1;
			if (!/^(.+\.)?messages\.ts$/.test(path.basename(file)))
				add(file, "file-name", "defines a dictionary; name it `messages.ts` or `<name>.messages.ts`");
			const module = await runner.import(file);
			for (const bundle of Object.values(module).filter(isBundle)) {
				const english = Object.keys(bundle.messages.en ?? {});
				const korean = Object.keys(bundle.messages.ko ?? {});
				const koreanSet = new Set(korean);
				const englishSet = new Set(english);
				for (const key of english) {
					if (!koreanSet.has(key)) add(file, "missing-key", `${bundle.namespace}: \`${key}\` has no ko text`);
					if (!referenced(key)) add(file, "unreferenced", `${bundle.namespace}: \`${key}\` is used by no source`);
				}
				for (const key of korean)
					if (!englishSet.has(key)) add(file, "missing-key", `${bundle.namespace}: \`${key}\` has no en text`);
			}
		}
	}
} finally {
	await runner.close();
	await server.close();
}

const HINTS = {
	"file-name": "A dictionary file is messages.ts or <name>.messages.ts.",
	"missing-key": "Write every key in both languages.",
	unreferenced: "Delete the key, or use it.",
};
if (findings.length > 0) {
	console.error(`check-messages: ${findings.length} finding(s) in the message dictionaries.\n`);
	for (const [rule, hint] of Object.entries(HINTS)) {
		const group = findings.filter((finding) => finding.rule === rule);
		if (group.length === 0) continue;
		console.error(`${rule} (${group.length}): ${hint}`);
		for (const { file, message } of group) console.error(`  ${file}: [${rule}] ${message}`);
		console.error("");
	}
	process.exit(1);
}
console.log(`check-messages: ok (${dictionaryCount} dictionaries in ${packages.length} packages)`);
