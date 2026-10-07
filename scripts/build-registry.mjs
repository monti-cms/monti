#!/usr/bin/env node
/**
 * Builds the component registry (shadcn registry schema): reads `registry/registry.json` (the source manifest, files by path) and the source files,
 * and writes `registry/r/registry.json` (the index, no file contents) and one `registry/r/<name>.json` per item (with the file contents).
 * The output is committed, so a checkout can serve it as it is and `monti add` has a default registry; `--check` fails when it is out of date.
 *
 *   node scripts/build-registry.mjs                          # write registry/r
 *   node scripts/build-registry.mjs --check                  # fail if registry/r is not what the sources build
 *   node scripts/build-registry.mjs --out <dir>              # write somewhere else
 *   node scripts/build-registry.mjs --base-url <url>         # registryDependencies become <url>/<name>.json, for `npx shadcn add <url>/<name>.json`
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";

/** The first problem with an item of the source manifest, or `undefined`. */
function problemOf(item, seen) {
	if (typeof item.name !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.name))
		return `item name "${item.name}" must be kebab-case`;
	if (seen.has(item.name)) return `item "${item.name}" is listed twice`;
	if (typeof item.type !== "string" || !item.type.startsWith("registry:"))
		return `item "${item.name}" needs a type like "registry:component"`;
	if (!Array.isArray(item.files) || item.files.length === 0) return `item "${item.name}" has no files`;
	return undefined;
}

/**
 * Builds the registry from `<registryDir>/registry.json`. Returns the files to write (`name` is relative to the output folder), so a caller can
 * write them or compare them with what is there.
 */
export function buildRegistry({ registryDir = path.join(root, "registry"), baseUrl } = {}) {
	const source = JSON.parse(readFileSync(path.join(registryDir, "registry.json"), "utf8"));
	const names = new Set(source.items.map((item) => item.name));
	const seen = new Set();
	const files = [];
	const index = { ...source, items: [] };
	for (const item of source.items) {
		const problem = problemOf(item, seen);
		if (problem) throw new Error(`registry.json: ${problem}`);
		seen.add(item.name);
		for (const dependency of item.registryDependencies ?? []) {
			if (!/^https?:\/\//.test(dependency) && !names.has(dependency))
				throw new Error(`registry.json: item "${item.name}" needs "${dependency}", which is not in the registry`);
		}
		const registryDependencies = item.registryDependencies?.map((dependency) =>
			baseUrl && names.has(dependency) ? `${baseUrl.replace(/\/$/, "")}/${dependency}.json` : dependency,
		);
		const withDependencies = registryDependencies ? { ...item, registryDependencies } : item;
		index.items.push(withDependencies);
		files.push({
			name: `${item.name}.json`,
			content: {
				$schema: ITEM_SCHEMA,
				...withDependencies,
				files: item.files.map((file) => {
					const full = path.join(registryDir, file.path);
					if (!existsSync(full))
						throw new Error(`registry.json: item "${item.name}" lists ${file.path}, which does not exist`);
					return { ...file, content: readFileSync(full, "utf8") };
				}),
			},
		});
	}
	files.push({ name: "registry.json", content: index });
	return files.map((file) => ({ name: file.name, text: `${JSON.stringify(file.content, null, "\t")}\n` }));
}

/** Names of the `.json` files in a folder, `[]` if it does not exist. */
const jsonFilesIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")) : []);

/** What differs between a build and the folder: the files that are missing, changed, or no longer built. Empty when it is up to date. */
export function registryDrift(built, outDir) {
	const drift = [];
	for (const file of built) {
		const target = path.join(outDir, file.name);
		if (!existsSync(target)) drift.push(`missing ${file.name}`);
		else if (readFileSync(target, "utf8") !== file.text) drift.push(`changed ${file.name}`);
	}
	const names = new Set(built.map((file) => file.name));
	for (const name of jsonFilesIn(outDir)) if (!names.has(name)) drift.push(`stale ${name}`);
	return drift;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const args = process.argv.slice(2);
	const option = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
	const outDir = path.resolve(option("--out") ?? path.join(root, "registry/r"));
	const built = buildRegistry({ baseUrl: option("--base-url") });
	if (args.includes("--check")) {
		const drift = registryDrift(built, outDir);
		if (drift.length > 0) {
			console.error(
				`registry: ${path.relative(root, outDir)} is out of date (${drift.join(", ")}). Run \`pnpm registry:build\`.`,
			);
			process.exit(1);
		}
		console.log(`registry: ${built.length - 1} items, up to date`);
	} else {
		for (const name of jsonFilesIn(outDir)) rmSync(path.join(outDir, name));
		mkdirSync(outDir, { recursive: true });
		for (const file of built) writeFileSync(path.join(outDir, file.name), file.text);
		console.log(`registry: wrote ${built.length - 1} items to ${path.relative(root, outDir)}`);
	}
}
