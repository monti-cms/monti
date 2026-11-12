#!/usr/bin/env node
/**
 * Makes the release bundle (docs/design/features/20-release.md): one tarball for each package, the file `npm publish` would send, and a README
 * with the lines a site installs them by.
 *
 *   pnpm build && node scripts/pack-release.mjs <output folder> [--base <address>]
 *
 * Each package is packed with `pnpm pack` (`publishConfig` and the `workspace:*` versions are applied). With `--base`, the packages of the bundle
 * name each other by the bundle's own address (`<base>/monti-cms-core-0.2.0.tgz`) instead of a version number, so a site installs from the bundle
 * alone: the versions are on no registry until the packages are published. Without it the tarballs are the ones for a registry.
 *
 * It stops when the versions differ, when a package's `exports` name a file the tarball does not hold, or when sources, tests or stories got in.
 */
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "@monti-cms/";

/** The tarball's name for a package at a version, as `npm pack` names it: `@monti-cms/core` 0.2.0 is `monti-cms-core-0.2.0.tgz`. */
export const tarballName = (name, version) => `${name.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;

/** A package's manifest with the bundle's packages named by the bundle's address. */
export function withBundleAddresses(manifest, base) {
	const out = { ...manifest };
	for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
		if (!manifest[field]) continue;
		out[field] = Object.fromEntries(
			Object.entries(manifest[field]).map(([name, range]) => [
				name,
				name.startsWith(SCOPE) ? `${base.replace(/\/$/, "")}/${tarballName(name, manifest.version)}` : range,
			]),
		);
	}
	return out;
}

/** Every file a manifest's `exports` and `bin` name, as paths in the package. */
export function namedFiles(manifest) {
	const found = [];
	const walk = (target) => {
		if (typeof target === "string") found.push(target);
		else if (target && typeof target === "object") for (const each of Object.values(target)) walk(each);
	};
	walk(manifest.exports);
	walk(manifest.bin);
	return found.map((file) => file.replace(/^\.\//, ""));
}

/** What must not ship: sources, tests and stories. The names of the files of a package that are one of them. */
export const unwanted = (files) =>
	files.filter((file) => /^src\/|\.test\.[cm]?[jt]sx?$|\.stories\.[jt]sx?$|(^|\/)__screenshots__\//.test(file));

function filesUnder(dir, prefix = "") {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`)
			: [`${prefix}${entry.name}`],
	);
}

export function packRelease({ root, out, base }) {
	const packages = readdirSync(path.join(root, "packages"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(path.join(root, "packages", entry.name, "package.json")))
		.map((entry) => {
			const dir = path.join(root, "packages", entry.name);
			return { dir, pkg: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) };
		});

	// Packages are always released with the same version (`scripts/version.mjs`).
	const versions = new Set(packages.map(({ pkg }) => pkg.version));
	if (versions.size !== 1)
		throw new Error(`Package versions differ: ${[...versions].join(", ")}. Run scripts/version.mjs first.`);
	const [version] = versions;

	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });
	const work = mkdtempSync(path.join(tmpdir(), "monti-release-"));
	const made = [];
	try {
		for (const { dir, pkg } of packages) {
			const packed = path.join(work, pkg.name.replace(/\W+/g, "-"));
			mkdirSync(packed);
			execFileSync("pnpm", ["pack", "--pack-destination", packed], {
				cwd: dir,
				stdio: ["ignore", "ignore", "inherit"],
			});
			const tarball = readdirSync(packed).find((file) => file.endsWith(".tgz"));
			if (!tarball) throw new Error(`${pkg.name}: pnpm pack produced no tarball`);
			execFileSync("tar", ["-xzf", path.join(packed, tarball), "-C", packed]);
			// A tarball holds its files under `package/`.
			const unpacked = path.join(packed, "package");
			const manifestFile = path.join(unpacked, "package.json");
			const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
			const files = filesUnder(unpacked);
			const lost = namedFiles(manifest).filter((file) => !files.includes(file));
			if (lost.length > 0)
				throw new Error(`${pkg.name}: the tarball has no ${lost.join(", ")} (build the packages first: pnpm build)`);
			const extra = unwanted(files);
			if (extra.length > 0) throw new Error(`${pkg.name}: the tarball holds ${extra.slice(0, 5).join(", ")}`);
			if (base) writeFileSync(manifestFile, `${JSON.stringify(withBundleAddresses(manifest, base), null, "\t")}\n`);
			// The license lives once at the repo root: every package carries a copy.
			copyFileSync(path.join(root, "LICENSE"), path.join(unpacked, "LICENSE"));
			const name = tarballName(pkg.name, version);
			// macOS's tar adds a `._name` entry for each file's extended attributes unless told not to: a tarball must hold the package's files only.
			execFileSync("tar", ["-czf", path.join(out, name), "-C", packed, "package"], {
				env: { ...process.env, COPYFILE_DISABLE: "1" },
			});
			made.push({ name: pkg.name, tarball: name });
			console.log(`${pkg.name}@${version} → ${name}`);
		}
	} finally {
		rmSync(work, { recursive: true, force: true });
	}

	const where = (tarball) => (base ? `${base.replace(/\/$/, "")}/${tarball}` : `./${tarball}`);
	const site = made.filter(({ name }) => /\/(core|admin|next)$/.test(name));
	writeFileSync(
		path.join(out, "README.md"),
		`# Monti ${version}

One tarball for each package. The packages name each other by ${base ? "this bundle's address" : "version"}, so a site installs the ones it uses and the rest follow.

A Next.js site (App Router, Next 16 or later):

\`\`\`sh
npm install ${site.map(({ tarball }) => where(tarball)).join(" ")}
npx monti init
\`\`\`

| Package | Address |
| --- | --- |
${made.map(({ name, tarball }) => `| \`${name}\` | \`${where(tarball)}\` |`).join("\n")}
`,
	);
	return { version, packages: made };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const at = args.indexOf("--base");
	const base = at >= 0 ? args[at + 1] : undefined;
	const [out] = at >= 0 ? args.filter((_, index) => index !== at && index !== at + 1) : args;
	if (!out || (at >= 0 && !base)) {
		console.error("Usage: node scripts/pack-release.mjs <out-dir> [--base <address>]");
		process.exit(1);
	}
	try {
		packRelease({
			root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
			out: path.resolve(out),
			base,
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
