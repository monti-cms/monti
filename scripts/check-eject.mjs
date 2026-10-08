#!/usr/bin/env node
/**
 * `monti eject` check against the packed bundles. Builds and packs the repo packages (`packages/*`) like `scripts/check-example.mjs`, copies the example app (`examples/blog`)
 * to a temp folder outside the repo and installs it from the bundles. Then it runs the command a user runs:
 *
 *   1. `monti eject` refuses `@monti-cms/core`, `@monti-cms/auth` and `@monti-cms/storage-s3`, and writes nothing.
 *   2. `monti eject @monti-cms/admin --yes` takes the admin's source out of the packed tarball (so the tarball must ship `src`) into `packages/monti-admin`.
 *   3. The app type checks and `next build`s from the ejected source: the admin that is bundled is the copy, not the installed `dist`.
 *   4. A small visible edit in the ejected source (a label) shows up in the next build.
 *   5. `monti doctor` lists the ejected package.
 *
 *   node scripts/check-eject.mjs            # build first
 *   node scripts/check-eject.mjs --no-build # use the dist that is already built
 *   node scripts/check-eject.mjs --keep     # keep the temp folder afterwards
 *
 * The build needs no database or login.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const run = (cmd, cmdArgs, cwd, env = {}) => {
	console.log(`\n$ (${path.relative(root, cwd) || "."}) ${cmd} ${cmdArgs.join(" ")}`);
	execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};
const fail = (message) => {
	throw new Error(`check-eject: ${message}`);
};

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

if (!args.has("--no-build")) run("pnpm", ["--filter", "./packages/*", "-r", "run", "build"], root);
const work = mkdtempSync(path.join(tmpdir(), "cms-eject-check-"));
const vendor = path.join(work, "vendor");
for (const pkg of packages) run("pnpm", ["pack", "--pack-destination", vendor], pkg.dir);
const tarballs = Object.fromEntries(
	packages.map((pkg) => {
		const file = readdirSync(vendor).find((name) => name.startsWith(`${pkg.name.replace("@", "").replace("/", "-")}-`));
		if (!file) fail(`no tarball for ${pkg.name}`);
		return [pkg.name, `file:${path.join(vendor, file)}`];
	}),
);

const app = path.join(work, "app");
const source = path.join(root, "examples/blog");
const skip = new Set(["node_modules", ".next", "vendor", "pnpm-lock.yaml", "next-env.d.ts", "tsconfig.tsbuildinfo"]);
cpSync(source, app, { recursive: true, filter: (from) => !skip.has(path.basename(from)) || from === source });
const pkgJsonPath = path.join(app, "package.json");
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
for (const name of Object.keys(pkgJson.dependencies))
	if (name.startsWith("@monti-cms/")) delete pkgJson.dependencies[name];
Object.assign(pkgJson.dependencies, tarballs);
pkgJson.pnpm = { overrides: tarballs };
writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, "\t")}\n`);
// `skipLibCheck` stays as the example sets it: the ejected source pulls in the declarations of libraries (@dnd-kit) that the packed `dist` types never load,
// and those are not ours to check.
// The ejected folder is not a workspace package yet: `monti eject` has to set that up itself, starting from the file a plain app has.
writeFileSync(
	path.join(app, "pnpm-workspace.yaml"),
	"onlyBuiltDependencies:\n  - esbuild\nallowBuilds:\n  esbuild: true\n",
);
// A `.gitignore` as `monti init` leaves it: it ignores `.monti/`, and the record of an eject must not be ignored.
writeFileSync(path.join(app, ".gitignore"), "node_modules\n.next\n.monti/\n");

run("pnpm", ["install", "--no-frozen-lockfile"], app);

try {
	// 1. What core guards is refused, and nothing is written.
	const manifestBefore = readFileSync(pkgJsonPath, "utf8");
	for (const name of ["@monti-cms/core", "@monti-cms/auth", "@monti-cms/storage-s3"]) {
		const refused = spawnSync("pnpm", ["exec", "monti", "eject", name, "--yes"], { cwd: app, encoding: "utf8" });
		const output = `${refused.stdout}${refused.stderr}`;
		if (refused.status === 0 || !output.includes("cannot be ejected"))
			fail(`monti eject ${name} was not refused:\n${output}`);
		if (existsSync(path.join(app, "packages")) || readFileSync(pkgJsonPath, "utf8") !== manifestBefore) {
			fail(`monti eject ${name} was refused but changed the app`);
		}
	}
	console.log("\ncheck-eject: core, auth and storage are refused");

	// 2. Eject the admin out of the packed tarball.
	run("pnpm", ["exec", "monti", "eject", "@monti-cms/admin", "--yes"], app);
	const ejected = path.join(app, "packages/monti-admin");
	for (const file of ["package.json", "src/index.ts", "src/hooks/public.ts", "prebuilt/styles.css"]) {
		if (!existsSync(path.join(ejected, file))) fail(`the ejected admin has no ${file}`);
	}
	if (JSON.parse(readFileSync(pkgJsonPath, "utf8")).dependencies["@monti-cms/admin"] !== "workspace:*") {
		fail("the app's dependency on @monti-cms/admin was not pointed at the workspace");
	}
	const record = JSON.parse(readFileSync(path.join(app, ".monti/ejected.json"), "utf8"));
	if (
		record.packages?.[0]?.package !== "@monti-cms/admin" ||
		!record.packages[0].version ||
		!record.packages[0].ejectedAt
	) {
		fail(`.monti/ejected.json is wrong: ${JSON.stringify(record)}`);
	}
	if (!readFileSync(path.join(app, ".gitignore"), "utf8").includes("!.monti/ejected.json")) {
		fail(".gitignore still ignores .monti/ejected.json");
	}
	// The app resolves the admin to the copy, not to the installed bundle.
	const resolved = execFileSync(
		"node",
		["-e", "console.log(require('node:fs').realpathSync('node_modules/@monti-cms/admin'))"],
		{ cwd: app, encoding: "utf8" },
	).trim();
	if (path.basename(resolved) !== "monti-admin")
		fail(`node_modules/@monti-cms/admin points at ${resolved}, not at the copy`);

	// 3. It type checks and builds from the ejected source.
	const build = (label) => {
		console.log(`\n=== ${label} ===`);
		run("pnpm", ["exec", "tsc", "--noEmit", "-p", "."], app);
		rmSync(path.join(app, ".next"), { recursive: true, force: true });
		run("pnpm", ["exec", "next", "build"], app, { NEXT_TELEMETRY_DISABLED: "1" });
	};
	/** Whether any file under `.next` holds the text. */
	const built = (text) => {
		const walk = (dir) =>
			readdirSync(dir, { withFileTypes: true }).some((entry) => {
				const file = path.join(dir, entry.name);
				if (entry.isDirectory()) return walk(file);
				return /\.(?:js|mjs|html|rsc|json|txt)$/.test(entry.name) && readFileSync(file, "utf8").includes(text);
			});
		return walk(path.join(app, ".next"));
	};
	build("ejected admin: unchanged source");
	if (built("check-eject-marker")) fail("the marker is in the build before the edit");

	// 4. A small visible edit in the ejected source is in the next build.
	const messages = path.join(ejected, "src/screens/messages.ts");
	const text = readFileSync(messages, "utf8");
	const edited = text.replace('"list.folderAdd": "Add folder"', '"list.folderAdd": "Add folder check-eject-marker"');
	if (edited === text) fail("could not find the label to edit in the ejected admin");
	writeFileSync(messages, edited);
	build("ejected admin: after a visible edit");
	if (!built("Add folder check-eject-marker")) fail("the edit in the ejected admin is not in the build");
	console.log("\ncheck-eject: the build picks up the edit in the ejected source");

	// 5. doctor lists it.
	const doctor = spawnSync("pnpm", ["exec", "monti", "doctor", "--only", "ejected", "--no-env-file"], {
		cwd: app,
		encoding: "utf8",
	});
	const doctorOutput = `${doctor.stdout}${doctor.stderr}`;
	if (doctor.status !== 0 || !doctorOutput.includes("@monti-cms/admin@")) {
		fail(`monti doctor did not list the ejected admin:\n${doctorOutput}`);
	}
	console.log("check-eject: ok");
} finally {
	if (args.has("--keep")) console.log(`kept: ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
