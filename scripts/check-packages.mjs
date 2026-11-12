#!/usr/bin/env node
/**
 * Two of the release's three gates (docs/design/features/20-release.md, 20-14; the third is `scripts/try-release.mjs`): every packed tarball
 * passes `publint` (its `exports` and `files` agree with what it holds) and `@arethetypeswrong/cli` (its type declarations resolve the way its
 * `exports` say). The tarballs are the ones for a registry (no `--base`): an address in a dependency is the bundle's own business.
 *
 *   pnpm build && node scripts/check-packages.mjs
 *
 * Monti's packages are ESM only, so the types are checked as an ESM consumer resolves them (`--profile esm-only`). An entry that is not code
 * (the admin's stylesheet) has no types to check.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packRelease } from "./pack-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(path.join(tmpdir(), "monti-check-packages-"));
let failed = false;
const run = (name, args) => {
	try {
		execFileSync("pnpm", ["exec", name, ...args], { cwd: root, stdio: "inherit" });
	} catch {
		failed = true;
	}
};
try {
	const { packages } = packRelease({ root, out });
	for (const { name, tarball, notCode } of packages) {
		const file = path.join(out, tarball);
		console.log(`\n── ${name}`);
		run("publint", ["run", file, "--strict"]);
		run("attw", [file, "--profile", "esm-only", ...(notCode.length > 0 ? ["--exclude-entrypoints", ...notCode] : [])]);
	}
} catch (error) {
	failed = true;
	console.error(error instanceof Error ? error.message : error);
} finally {
	rmSync(out, { recursive: true, force: true });
}
if (failed) console.error("\nA package is not fit to release.");
process.exit(failed ? 1 : 0);
