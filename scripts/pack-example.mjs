#!/usr/bin/env node
/**
 * Packs the repo packages (`packages/*`) into the example app's `vendor/` folder, where its `package.json` installs them from
 * (`file:vendor/monti-cms-core.tgz`, ...). The tarballs get names without a version, so the example keeps installing when a package version
 * changes.
 *
 *   node scripts/pack-example.mjs            # build first
 *   node scripts/pack-example.mjs --no-build # use the dist that is already built
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The repo packages, with the tarball name the example installs each from (`@monti-cms/core` → `monti-cms-core.tgz`). */
export const examplePackages = () =>
	readdirSync(path.join(root, "packages"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			const dir = path.join(root, "packages", entry.name);
			try {
				const { name } = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
				return [{ dir, name, tarball: `${name.replace("@", "").replace("/", "-")}.tgz` }];
			} catch {
				return [];
			}
		});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });
	if (!process.argv.includes("--no-build")) run("pnpm", ["--filter", "./packages/*", "-r", "run", "build"], root);

	const vendor = path.join(root, "examples/other-site/vendor");
	rmSync(vendor, { recursive: true, force: true });
	mkdirSync(vendor, { recursive: true });
	for (const pkg of examplePackages()) {
		// `pnpm pack` names the file after the version; pack into an empty folder and give it the stable name.
		const work = mkdtempSync(path.join(tmpdir(), "cms-pack-"));
		run("pnpm", ["pack", "--pack-destination", work], pkg.dir);
		const [file] = readdirSync(work).filter((name) => name.endsWith(".tgz"));
		if (!file) throw new Error(`pack-example: no tarball for ${pkg.name}`);
		copyFileSync(path.join(work, file), path.join(vendor, pkg.tarball));
		rmSync(work, { recursive: true, force: true });
	}
	console.log(`\npack-example: ${examplePackages().length} packages in ${path.relative(root, vendor)}`);
}
