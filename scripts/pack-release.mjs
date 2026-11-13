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
 *
 * The same built files make the same tarballs, byte for byte (`packedBytes` below): packing a tag a second time gives the files of the first.
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
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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
 * tarball is installed together. The command it names, `monti init`, is the one the release's proof runs in a fresh site.
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
npx monti init
\`\`\`

\`monti init\` writes the site's Monti files (its schema and config, the admin's page and API route), adds what \`.env.local\` lacks, and says
what is left to do; \`npx monti doctor\` checks a set-up. What the files are is in the
[\`@monti-cms/next\` README](https://github.com/monti-cms/monti/tree/v${version}/packages/next#readme), and
[\`examples/blog\`](https://github.com/monti-cms/monti/tree/v${version}/examples/blog) is a whole site. The admin brings its own stylesheet,
already built. npm is the package manager this release was proven with; pnpm and yarn are untried.
${
	packages.some(({ name }) => name === `${SCOPE}storage-s3`)
		? `
Media files in S3, or a storage that speaks its API (Cloudflare R2, MinIO): install \`${SCOPE}storage-s3\` from the table below too, and run
\`npx monti init --storage s3\`. Files then go straight from the browser to the bucket.
`
		: ""
}
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

/**
 * The names `exports` and `bin` give that no file of the tarball answers. A subpath pattern (`./blocks/*.tsx`, a package whose files are copied whole,
 * doc 18) is answered by any file it matches, its `*` standing for any part of a path as Node reads it; a plain name only by that file.
 */
export function missingFiles(named, files) {
	return named.filter((name) => {
		if (!name.includes("*")) return !files.includes(name);
		const [head, tail] = name.split("*");
		return !files.some(
			(file) => file.startsWith(head) && file.endsWith(tail) && file.length > head.length + tail.length,
		);
	});
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

/** The time every entry of a tarball carries: the one npm gives its own tarballs' entries. */
const PACKED_AT = Date.parse("1985-10-26T08:15:00.000Z") / 1000;

/** A tar header's name fields for a path: `name` holds 100 bytes, and a longer path puts its leading folders in `prefix` (155 bytes). */
function headerName(file) {
	if (Buffer.byteLength(file) <= 100) return { name: file, prefix: "" };
	for (let at = file.indexOf("/"); at >= 0; at = file.indexOf("/", at + 1)) {
		const [prefix, name] = [file.slice(0, at), file.slice(at + 1)];
		if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
	}
	throw new Error(`${file}: the path is too long for a tarball`);
}

/**
 * A gzipped tar of a folder's files, each under `package/`, that is the same bytes whenever the files are the same: the entries are in the
 * order of their names, and none carries what differs from one run to the next (the time, the owner, the folder's own order, the machine's
 * permission mask). The system's `tar` writes all of those. A file is 0644, or 0755 when it may be run (the `monti` command).
 * The bytes also rest on Node's zlib: the same Node packs the same tarball, another may compress differently.
 */
export function packedBytes(dir) {
	const blocks = [];
	const field = (header, text, at, length) => header.write(text, at, length, "utf8");
	const octal = (value, length) => value.toString(8).padStart(length - 1, "0");
	// By code unit, not by the machine's language: the same order everywhere.
	for (const file of filesUnder(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
		const body = readFileSync(path.join(dir, file));
		const header = Buffer.alloc(512);
		const { name, prefix } = headerName(`package/${file}`);
		field(header, name, 0, 100);
		field(header, octal(statSync(path.join(dir, file)).mode & 0o111 ? 0o755 : 0o644, 8), 100, 8);
		field(header, octal(0, 8), 108, 8);
		field(header, octal(0, 8), 116, 8);
		field(header, octal(body.length, 12), 124, 12);
		field(header, octal(PACKED_AT, 12), 136, 12);
		// The checksum is counted with its own field as spaces.
		field(header, "        ", 148, 8);
		field(header, "0", 156, 1);
		field(header, "ustar\u000000", 257, 8);
		field(header, prefix, 345, 155);
		field(
			header,
			`${octal(
				header.reduce((sum, byte) => sum + byte, 0),
				7,
			)}\u0000 `,
			148,
			8,
		);
		blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
	}
	// Two empty blocks end a tar.
	blocks.push(Buffer.alloc(1024));
	const zipped = gzipSync(Buffer.concat(blocks), { level: 9 });
	// The header's byte for the system that made it: "unknown", on every system. (Its time is already zero.)
	zipped[9] = 255;
	return zipped;
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
			const lost = missingFiles(namedFiles(manifest), files);
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
			// Written here and not by the system's tar: the package's files only (a Mac's tar adds `._name` entries), and the same bytes each time.
			writeFileSync(path.join(out, name), packedBytes(unpacked));
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
