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
 * It stops when the versions differ, when a package's `exports` name a file the tarball does not hold, when sources, tests or stories got in,
 * or when a file that says `"use client"` in the source no longer starts with it in the tarball (a Next site tells server from browser by it).
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

/**
 * `sideEffects` as the tarball must say it. In the repo it names sources (`./src/admin.tsx`, the file that brings the admin's stylesheet); the
 * sources do not ship, so left as it is every built file would count as free of side effects and a bundler could drop the stylesheet's import.
 * A source becomes its built file, and a package that names any file with side effects names its stylesheets too.
 */
export function builtSideEffects(sideEffects) {
	if (!Array.isArray(sideEffects)) return sideEffects;
	const built = sideEffects.map((file) => file.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ".js"));
	return built.some((file) => file.endsWith(".css")) ? built : [...built, "**/*.css"];
}

/**
 * The bundle's README, which is also a release's notes: the lines a site installs by. With a base the packages follow each other from the
 * bundle's address, so a site names the three it uses; without one they name each other by a version that is on no registry, so every
 * tarball is installed together. It names no command that does not exist yet: the files a site writes are in the adapter's README.
 */
export function bundleReadme({ version, packages, base }) {
	const where = (tarball) => (base ? `${base.replace(/\/$/, "")}/${tarball}` : `./${tarball}`);
	// What a Next site uses itself, the core first.
	const site = ["core", "admin", "next"].flatMap((short) => packages.filter(({ name }) => name === `${SCOPE}${short}`));
	const install = base ? site : packages;
	const how = base
		? "The packages name each other by this bundle's address, so a site installs the ones it uses and the rest follow."
		: "The packages name each other by version, and that version is on no registry: install every tarball together, from the folder they are in.";
	return `# Monti ${version}

One tarball for each package. ${how}

A Next.js site (App Router, Next 16 or later), with npm:

\`\`\`sh
npm install ${install.map(({ tarball }) => where(tarball)).join(" ")}
\`\`\`

Then the site writes four small files (its schema and config, the admin page, the admin's API route): they are in the
[\`@monti-cms/next\` README](https://github.com/monti-cms/monti/tree/v${version}/packages/next#readme), and
[\`examples/blog\`](https://github.com/monti-cms/monti/tree/v${version}/examples/blog) is a whole site. The admin brings its own stylesheet,
already built. npm is the package manager this release was proven with; pnpm and yarn are untried.

| Package | Address |
| --- | --- |
${packages.map(({ name, tarball }) => `| \`${name}\` | \`${where(tarball)}\` |`).join("\n")}
`;
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

const CLIENT = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

/** Whether a file's first statement is `"use client"` (comments may come before it). */
export const saysClient = (text) => CLIENT.test(text);

/**
 * The built files (`dist/x.js`) whose source (`src/x.ts`, `src/x.tsx`) says `"use client"` and that no longer start with it: a bundler or a
 * build step that dropped the line turns a browser component into a server one in the site.
 */
export function lostClient(packageDir, unpacked) {
	const src = path.join(packageDir, "src");
	if (!existsSync(src)) return [];
	return filesUnder(src)
		.filter(
			(file) =>
				/\.tsx?$/.test(file) && !/\.d\.ts$/.test(file) && saysClient(readFileSync(path.join(src, file), "utf8")),
		)
		.map((file) => `dist/${file.replace(/\.tsx?$/, ".js")}`)
		.filter(
			(built) =>
				existsSync(path.join(unpacked, built)) && !saysClient(readFileSync(path.join(unpacked, built), "utf8")),
		);
}

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
			const server = lostClient(dir, unpacked);
			if (server.length > 0)
				throw new Error(`${pkg.name}: "use client" is gone from ${server.slice(0, 5).join(", ")} (the source says it)`);
			const shipped = { ...(base ? withBundleAddresses(manifest, base) : manifest) };
			if ("sideEffects" in shipped) shipped.sideEffects = builtSideEffects(shipped.sideEffects);
			// A file named as having side effects is in the tarball, as an export is.
			const gone = (Array.isArray(shipped.sideEffects) ? shipped.sideEffects : [])
				.filter((file) => !file.includes("*"))
				.map((file) => file.replace(/^\.\//, ""))
				.filter((file) => !files.includes(file));
			if (gone.length > 0)
				throw new Error(`${pkg.name}: "sideEffects" names ${gone.join(", ")}, which the tarball does not hold`);
			writeFileSync(manifestFile, `${JSON.stringify(shipped, null, "\t")}\n`);
			// The license lives once at the repo root: every package carries a copy.
			copyFileSync(path.join(root, "LICENSE"), path.join(unpacked, "LICENSE"));
			const name = tarballName(pkg.name, version);
			// macOS's tar adds a `._name` entry for each file's extended attributes unless told not to: a tarball must hold the package's files only.
			execFileSync("tar", ["-czf", path.join(out, name), "-C", packed, "package"], {
				env: { ...process.env, COPYFILE_DISABLE: "1" },
			});
			// The entries that are not code (a stylesheet): a check of types leaves them out.
			const notCode = Object.entries(manifest.exports ?? {})
				.filter(([, target]) => typeof target === "string" && !/\.[cm]?js$/.test(target))
				.map(([entry]) => entry);
			made.push({ name: pkg.name, tarball: name, notCode });
			console.log(`${pkg.name}@${version} → ${name}`);
		}
	} finally {
		rmSync(work, { recursive: true, force: true });
	}

	writeFileSync(path.join(out, "README.md"), bundleReadme({ version, packages: made, base }));
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
