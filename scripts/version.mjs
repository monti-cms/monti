#!/usr/bin/env node
/**
 * Changes the version of all packages (`packages/*`) at once. Packages are always released with the same version.
 *
 *   node scripts/version.mjs 0.1.0
 *
 * After that, commit and push a `v0.1.0` tag; the release workflow (`.github/workflows/release.yml`) builds the release bundle.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
	console.error("Usage: node scripts/version.mjs <version>  (e.g. 0.1.0)");
	process.exit(1);
}

for (const entry of readdirSync(path.join(root, "packages"), { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const file = path.join(root, "packages", entry.name, "package.json");
	const pkg = JSON.parse(readFileSync(file, "utf8"));
	pkg.version = version;
	writeFileSync(file, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`${pkg.name}@${version}`);
}
