// Package build: emits TypeScript sources as `dist` (ESM JS + type declarations). Run from a package folder:
// `node ../../scripts/build-package.mjs [--write-exports] [src subfolders to copy…]`.
//
// - Inside the repo, `exports` points at the source (`src/*.ts`); the release bundle (`pnpm pack`) uses `publishConfig.exports` (dist).
//   `publishConfig.exports` is derived from `exports`. If they differ the build stops (fix with `--write-exports`).
// - `tsc` runs per file, so "use client" directives are preserved.
// - Other workspace packages (@monti-cms/*) resolve to that package's `dist` type declarations (build it first).
// - Sources import without extensions, so `.js` and `/index.js` are appended to relative paths in the output.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const args = process.argv.slice(2);
const writeExports = args.includes("--write-exports");
const copies = args.filter((arg) => !arg.startsWith("--"));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const pkg = readJson(path.join(root, "package.json"));

/** Source path (`./src/x.ts`) → release path. */
const toDist = (target, ext) => target.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ext);
const publishTarget = (target) => {
	if (typeof target === "string") {
		if (!/\.tsx?$/.test(target)) return target;
		return { types: toDist(target, ".d.ts"), default: toDist(target, ".js") };
	}
	// Conditional entry points (e.g. an empty entry for browsers): JS per condition, types under the default condition.
	const out = { types: toDist(target.default, ".d.ts") };
	for (const [condition, value] of Object.entries(target)) out[condition] = toDist(value, ".js");
	return out;
};
const publishExports = Object.fromEntries(
	Object.entries(pkg.exports).map(([key, target]) => [key, publishTarget(target)]),
);
const current = JSON.stringify(pkg.publishConfig?.exports ?? null);
if (current !== JSON.stringify(publishExports)) {
	if (!writeExports) {
		console.error(`${pkg.name}: publishConfig.exports is out of date. Run the build with --write-exports.`);
		process.exit(1);
	}
	pkg.publishConfig = { ...pkg.publishConfig, exports: publishExports };
	writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, "\t")}\n`);
}

// Links the dist type declarations of workspace dependencies through `paths`.
const rel = (file) => {
	const relative = path.relative(root, file);
	return relative.startsWith("./") || relative.startsWith("../") ? relative : `./${relative}`;
};
const paths = {};
const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
for (const name of Object.keys(deps).filter((dep) => dep.startsWith("@monti-cms/"))) {
	const dir = path.join(root, "..", name.slice("@monti-cms/".length));
	const depPkg = readJson(path.join(dir, "package.json"));
	for (const [key, target] of Object.entries(depPkg.publishConfig?.exports ?? {})) {
		const types = typeof target === "string" ? target : target.types;
		if (!types) continue;
		paths[`${name}${key.slice(1)}`] = [rel(path.join(dir, types))];
	}
}
const generated = path.join(root, "tsconfig.build.generated.json");
writeFileSync(
	generated,
	`${JSON.stringify({ extends: "./tsconfig.build.json", compilerOptions: { paths } }, null, "\t")}\n`,
);

rmSync(dist, { recursive: true, force: true });
try {
	execFileSync("pnpm", ["exec", "tsc", "-p", generated], { stdio: "inherit" });
} finally {
	rmSync(generated, { force: true });
}

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else if (/\.(js|d\.ts)$/.test(name)) files.push(full);
	}
};
walk(dist);

const SPEC =
	/((?:from|import)\s*\(?\s*|export\s+\*\s+from\s+|export\s+\*\s+as\s+\w+\s+from\s+)(["'])(\.{1,2}\/[^"']+)\2/g;
const resolveSpec = (file, spec) => {
	if (/\.(js|mjs|cjs|json|css)$/.test(spec)) return spec;
	const base = path.resolve(path.dirname(file), spec);
	if (existsSync(`${base}.js`) || existsSync(`${base}.d.ts`)) return `${spec}.js`;
	if (existsSync(path.join(base, "index.js")) || existsSync(path.join(base, "index.d.ts"))) return `${spec}/index.js`;
	return spec;
};
for (const file of files) {
	const source = readFileSync(file, "utf8");
	const out = source.replace(SPEC, (_, head, quote, spec) => `${head}${quote}${resolveSpec(file, spec)}${quote}`);
	if (out !== source) writeFileSync(file, out);
}

// Test files only the tests use are not shipped. `__test__` files the exports reach (e.g. `./testing`) stay.
const importOf = new RegExp(SPEC.source, "g");
const reached = new Set();
const visit = (file) => {
	const base = file.replace(/(\.d)?\.[cm]?js$|\.d\.ts$/, "");
	if (reached.has(base)) return;
	reached.add(base);
	for (const ext of [".js", ".d.ts"]) {
		if (!existsSync(base + ext)) continue;
		for (const match of readFileSync(base + ext, "utf8").matchAll(importOf)) {
			if (match[3].startsWith(".")) visit(path.resolve(path.dirname(base), match[3]));
		}
	}
};
for (const target of JSON.stringify(publishExports).match(/\.\/dist\/[^"]+/g) ?? []) visit(path.join(root, target));
let dropped = 0;
for (const file of files) {
	if (!file.split(path.sep).includes("__test__")) continue;
	if (reached.has(file.replace(/(\.d)?\.js$|\.d\.ts$/, ""))) continue;
	rmSync(file, { force: true });
	dropped += 1;
}
const prune = (dir) => {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) prune(full);
	}
	if (dir !== dist && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
};
prune(dist);

for (const folder of copies) cpSync(path.join(root, "src", folder), path.join(dist, folder), { recursive: true });
console.log(`built ${pkg.name}: ${files.length - dropped} files`);
