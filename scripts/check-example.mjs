#!/usr/bin/env node
/**
 * Example app bundle check. Builds and packs the repo packages (`packages/*`), copies the example app (`examples/other-site`) to a temp folder outside the repo,
 * installs it from those bundles, then runs a type check (`skipLibCheck: false`) and `next build`. Runs once more with a config that includes every extension.
 * Inside the repo the sources are used directly, so this catches what breaks only in the bundles (`dist`, `exports`, dependency declarations).
 *
 *   node scripts/check-example.mjs            # build first
 *   node scripts/check-example.mjs --no-build # use the dist that is already built
 *   node scripts/check-example.mjs --keep     # keep the temp folder afterwards
 *
 * No DB or login connection is used (the build works without one).
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const run = (cmd, cmdArgs, cwd, env = {}) => {
	console.log(`\n$ (${path.relative(root, cwd) || "."}) ${cmd} ${cmdArgs.join(" ")}`);
	execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};

// 1. Take the package list from packages/* (new packages are picked up automatically).
const packages = readdirSync(path.join(root, "packages"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const dir = path.join(root, "packages", entry.name);
		try {
			return { dir, name: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).name };
		} catch {
			return null;
		}
	})
	.filter(Boolean);
console.log(`packages: ${packages.map((pkg) => pkg.name).join(", ")}`);

// 2. Build (in dependency order) and pack.
if (!args.has("--no-build")) run("pnpm", ["--filter", "./packages/*", "-r", "run", "build"], root);
const work = mkdtempSync(path.join(tmpdir(), "cms-example-check-"));
const vendor = path.join(work, "vendor");
for (const pkg of packages) run("pnpm", ["pack", "--pack-destination", vendor], pkg.dir);
const tarballs = Object.fromEntries(
	packages.map((pkg) => {
		const file = readdirSync(vendor).find((name) => name.startsWith(`${pkg.name.replace("@", "").replace("/", "-")}-`));
		if (!file) throw new Error(`no tarball for ${pkg.name}`);
		return [pkg.name, `file:${path.join(vendor, file)}`];
	}),
);

// 3. Copy the example app outside the repo and link every package through its bundle.
const app = path.join(work, "app");
const source = path.join(root, "examples/other-site");
const skip = new Set(["node_modules", ".next", "vendor", "pnpm-lock.yaml", "next-env.d.ts", "tsconfig.tsbuildinfo"]);
cpSync(source, app, { recursive: true, filter: (from) => !skip.has(path.basename(from)) || from === source });
const pkgJsonPath = path.join(app, "package.json");
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
for (const name of Object.keys(pkgJson.dependencies))
	if (name.startsWith("@monti-cms/")) delete pkgJson.dependencies[name];
Object.assign(pkgJson.dependencies, tarballs);
// Packages that find each other as peers also use the same bundle.
pkgJson.pnpm = { overrides: tarballs };
writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, "\t")}\n`);
const tsconfigPath = path.join(app, "tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
tsconfig.compilerOptions.skipLibCheck = false;
writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, "\t")}\n`);
// Outside the repo, the repo's pnpm settings are not read. Allow the esbuild install script (`onlyBuiltDependencies` in pnpm 10,
// `allowBuilds` from 11).
writeFileSync(
	path.join(app, "pnpm-workspace.yaml"),
	"packages: []\nonlyBuiltDependencies:\n  - esbuild\nallowBuilds:\n  esbuild: true\n",
);

run("pnpm", ["install", "--no-frozen-lockfile"], app);

// 4. The example config as-is → the config with every extension.
const configPath = path.join(app, "cms.config.ts");
const exampleConfig = readFileSync(configPath, "utf8");
const allExtensions = exampleConfig
	.replace(
		'import { blocks } from "@monti-cms/blocks";',
		'import { aiPlugin } from "@monti-cms/ai";\nimport { blocks } from "@monti-cms/blocks";\nimport { bareun } from "@monti-cms/bareun";',
	)
	.replace(/plugins: \[[^\n]*\],/, "plugins: [...blocks(), seo(), aiPlugin(), bareun()],");
if (allExtensions === exampleConfig || !allExtensions.includes("aiPlugin()")) {
	throw new Error("check-example: could not rewrite cms.config.ts plugins for the all-extensions run");
}

const check = (label) => {
	console.log(`\n=== ${label} ===`);
	run("pnpm", ["exec", "tsc", "--noEmit", "-p", "."], app);
	rmSync(path.join(app, ".next"), { recursive: true, force: true });
	run("pnpm", ["exec", "next", "build"], app, { NEXT_TELEMETRY_DISABLED: "1" });
};

try {
	check("example config");
	writeFileSync(configPath, allExtensions);
	check("all extensions");
	console.log("\ncheck-example: ok");
} finally {
	if (args.has("--keep")) console.log(`kept: ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
