#!/usr/bin/env node
/**
 * Example app bundle check. Builds and packs the repo packages (`packages/*`), copies the example app (`examples/blog`) to a temp folder outside the repo,
 * installs it from those bundles, then runs a type check (`skipLibCheck: false`) and `next build`, once with `cacheComponents` on (as in a new Next app) and once with it off. The example config attaches every extension. It also runs the config checks of `monti doctor` (the config loads, and no client component imports it).
 * Last it turns the copy into the app a newcomer gets with the default blocks: no `mermaid()` or `chart()` in the config and neither `mermaid` nor `recharts` installed. That app must type check,
 * build and (with the test database) serve the pages, content saved with the heavy blocks included. The heavy blocks come from `@monti-cms/blocks/chart` and `/mermaid`, so nothing of them may load.
 * Inside the repo the sources are used directly, so this catches what breaks only in the bundles (`dist`, `exports`, dependency declarations).
 *
 *   node scripts/check-example.mjs            # build first
 *   node scripts/check-example.mjs --no-build # use the dist that is already built
 *   node scripts/check-example.mjs --keep     # keep the temp folder afterwards
 *
 * The build needs no DB or login. The HTTP status checks do: with `CMS_TEST_DATABASE_URL` (the repo's `.env.local` or the environment) the built app is started on the
 * schema `cms_example_check` of the test database and must answer 200 for a known post, 404 for an unknown one and 308 for an old address, with and without
 * `cacheComponents`. Without that variable they are skipped, and the script says so.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { examplePackages } from "./pack-example.mjs";

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

// 3. The example's own `package.json` (what `pnpm example:pack` + `pnpm install` in its README use) must name the tarballs
// `example:pack` writes; below it is rewritten to these bundles, so a wrong name would not fail anywhere else.
const packedNames = new Map(examplePackages().map((pkg) => [pkg.name, `file:vendor/${pkg.tarball}`]));
const exampleDeps = JSON.parse(readFileSync(path.join(root, "examples/blog/package.json"), "utf8")).dependencies;
for (const [name, spec] of Object.entries(exampleDeps)) {
	if (!name.startsWith("@monti-cms/")) continue;
	if (packedNames.get(name) !== spec) {
		throw new Error(
			`check-example: examples/blog/package.json ${name} is "${spec}", expected "${packedNames.get(name)}"`,
		);
	}
}

// 4. Copy the example app outside the repo and link every package through its bundle.
const app = path.join(work, "app");
const source = path.join(root, "examples/blog");
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

// The types of the schema file (`monti-env.d.ts`) are committed, like `next-env.d.ts`: they must be in step with `monti.schema.json`, and the schema must be valid.
run("pnpm", ["exec", "monti", "schema:types", "--check"], app);

// `monti.config.ts` holds the database and login settings and is server-only: no client component may import it (directly or through other files).
run("pnpm", ["exec", "monti", "doctor", "--only", "config"], app);

// The blog theme as `monti add blog-theme` gives it to a newcomer (its pages under app/(site)/<the path of the collection in monti.schema.json> and app/(site)/preview/..., here /posts) is built too, next to the
// example's own copy of the theme: the registry sources are what new apps get, and they must build with and without `cacheComponents`.
const exampleProxyPath = path.join(app, "proxy.ts");
const exampleProxy = readFileSync(exampleProxyPath, "utf8");
run(
	"pnpm",
	["exec", "monti", "add", "blog-theme", "--registry", path.join(root, "registry/r"), "--overwrite", "--yes"],
	app,
);
for (const page of [
	"app/(site)/posts/page.tsx",
	"app/(site)/posts/[slug]/page.tsx",
	"app/(site)/preview/posts/[slug]/page.tsx",
]) {
	if (!existsSync(path.join(app, page))) throw new Error(`check-example: monti add blog-theme did not write ${page}`);
}

// The registry's proxy.ts (blog routes) replaced the example's, which also covers its memos: put the example's back for the status checks.
if (!existsSync(exampleProxyPath)) throw new Error("check-example: monti add blog-theme did not write proxy.ts");
writeFileSync(exampleProxyPath, exampleProxy);

/** The test database, or `undefined` when none is configured. */
const databaseUrl = (() => {
	const file = path.join(root, ".env.local");
	const values = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
	return values.CMS_TEST_DATABASE_URL || process.env.CMS_TEST_DATABASE_URL;
})();
const SCHEMA = "cms_example_check";
const appEnv = databaseUrl
	? {
			DATABASE_URL: databaseUrl,
			DATABASE_SCHEMA: SCHEMA,
			MONTI_SECRET: "check-example-secret",
			NEXT_TELEMETRY_DISABLED: "1",
		}
	: undefined;
if (appEnv) {
	const { Client } = createRequire(path.join(root, "packages/core/package.json"))("pg");
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
		await client.query(`CREATE SCHEMA ${SCHEMA}`);
	} finally {
		await client.end();
	}
	run("pnpm", ["exec", "monti", "migrate", "--no-env-file"], app, appEnv);
	run("pnpm", ["exec", "tsx", "showcase/seed.ts", "3000"], app, appEnv);
} else {
	console.log("\ncheck-example: CMS_TEST_DATABASE_URL is not set, so the HTTP status checks are skipped");
}

const freePort = () =>
	new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});

/**
 * Starts the built app and checks the status of the post addresses. A page under Cache Components streams after its `200`, so these are decided in
 * `proxy.ts`: a known post 200, an unknown post 404 (not a `200` with `noindex`), an old address a real 308 to the new one.
 */
async function checkStatuses(label) {
	if (!appEnv) return;
	const port = await freePort();
	console.log(`\n--- status checks, ${label}, port ${port} ---`);
	const server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
		cwd: app,
		env: { ...process.env, ...appEnv },
		stdio: "inherit",
	});
	try {
		const origin = `http://127.0.0.1:${port}`;
		for (let tries = 0; ; tries++) {
			try {
				await fetch(origin, { redirect: "manual" });
				break;
			} catch (error) {
				if (tries > 60) throw error;
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}
		const expectations = [
			["/ko/posts/cms-elements", 200],
			["/ko/posts/no-such-post", 404],
			["/ko/posts/cms-elements-draft", 404],
			["/ko/memos/no-such-memo", 404],
			["/ko/posts/renamed-post-old", 308, "/ko/posts/renamed-post"],
			// The app has no GitHub login settings in production: the admin and the draft preview answer 503 (a page cannot send that status under Cache Components; proxy.ts does).
			["/studio", 503],
			["/preview/ko/posts/cms-elements", 503],
		];
		const failures = [];
		for (const [address, status, location] of expectations) {
			const response = await fetch(origin + address, { redirect: "manual" });
			const to = response.headers.get("location");
			const ok = response.status === status && (location === undefined || (to ?? "").endsWith(location));
			console.log(
				`${ok ? "ok  " : "FAIL"} ${address} -> ${response.status}${to ? ` ${to}` : ""} (expected ${status}${location ? ` ${location}` : ""})`,
			);
			if (!ok) failures.push(address);
		}
		if (failures.length > 0) throw new Error(`check-example: wrong status for ${failures.join(", ")} (${label})`);
	} finally {
		server.kill();
	}
}

const check = async (label) => {
	console.log(`\n=== ${label} ===`);
	run("pnpm", ["exec", "tsc", "--noEmit", "-p", "."], app);
	rmSync(path.join(app, ".next"), { recursive: true, force: true });
	run("pnpm", ["exec", "next", "build"], app, { NEXT_TELEMETRY_DISABLED: "1" });
	await checkStatuses(label);
};

// New Next apps start with `cacheComponents` and `partialPrefetching` on, so the example keeps them on: the build with them is the one a newcomer gets
// (the studio route and the blog theme pages must build), and the build without them proves the same sources work for an app that has not turned them on.
const nextConfigPath = path.join(app, "next.config.ts");
const nextConfigText = readFileSync(nextConfigPath, "utf8");
if (!/cacheComponents:\s*true/.test(nextConfigText) || !/partialPrefetching:\s*true/.test(nextConfigText)) {
	throw new Error("check-example: examples/blog/next.config.ts must turn on cacheComponents and partialPrefetching");
}
const withoutCacheComponents = nextConfigText.replace(/^\s*(?:cacheComponents|partialPrefetching):\s*true,\n/gm, "");
if (withoutCacheComponents === nextConfigText || /cacheComponents/.test(withoutCacheComponents)) {
	throw new Error("check-example: could not turn cacheComponents off in the copied next.config.ts");
}

try {
	await check("example config, cacheComponents on (the default of a new Next app)");
	writeFileSync(nextConfigPath, withoutCacheComponents);
	// `export const instant = false` (the opt-out of the instant validation and of the static shell) is only valid with cacheComponents, so an app without it has no such line.
	const pagesDir = path.join(app, "app");
	const strip = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const file = path.join(dir, entry.name);
			if (entry.isDirectory()) strip(file);
			else if (entry.name === "page.tsx") {
				const text = readFileSync(file, "utf8");
				const next = text.replace(/^(?:\/\/[^\n]*\n)*export const instant = false;[^\n]*\n\n?/gm, "");
				if (next !== text) writeFileSync(file, next);
			}
		}
	};
	strip(pagesDir);
	await check("example config, cacheComponents off");

	// The default blocks need neither mermaid nor recharts: take them out of the config and out of node_modules, and build again.
	const configPath = path.join(app, "monti.config.ts");
	const heavy =
		/^(?:\/\/ The two heavy blocks[^\n]*\n|import \{ (?:chart|mermaid) \} from "@monti-cms\/blocks\/(?:chart|mermaid)";\n|\t\t(?:chart|mermaid)\(\),\n)/gm;
	const configText = readFileSync(configPath, "utf8");
	const lightConfig = configText.replace(heavy, "");
	if (lightConfig === configText || /\b(?:chart|mermaid)\(\)|blocks\/(?:chart|mermaid)/.test(lightConfig)) {
		throw new Error("check-example: could not take chart() and mermaid() out of the copied monti.config.ts");
	}
	writeFileSync(configPath, lightConfig);
	const lightPackage = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
	delete lightPackage.dependencies.mermaid;
	delete lightPackage.dependencies.recharts;
	writeFileSync(pkgJsonPath, `${JSON.stringify(lightPackage, null, "\t")}\n`);
	// A clean install: the lockfile of the heavy app has both libraries in it, and pnpm would keep them in the store (and hoist them for the bundler to find).
	rmSync(path.join(app, "pnpm-lock.yaml"), { force: true });
	rmSync(path.join(app, "node_modules"), { recursive: true, force: true });
	run("pnpm", ["install", "--no-frozen-lockfile"], app);
	for (const heavyPackage of ["mermaid", "recharts"]) {
		const stored = readdirSync(path.join(app, "node_modules/.pnpm")).filter((name) =>
			name.startsWith(`${heavyPackage}@`),
		);
		if (existsSync(path.join(app, "node_modules", heavyPackage)) || stored.length > 0) {
			throw new Error(`check-example: ${heavyPackage} is still installed in the light app`);
		}
	}
	run("pnpm", ["exec", "monti", "doctor", "--only", "config"], app);
	await check("light config: the default blocks, no mermaid and no recharts installed");

	// The other way round: a heavy block in the config without its library is named by `monti doctor`, with the command that installs it.
	writeFileSync(configPath, configText);
	const doctor = spawnSync("pnpm", ["exec", "monti", "doctor", "--only", "config/plugin-packages"], {
		cwd: app,
		encoding: "utf8",
	});
	const doctorOutput = `${doctor.stdout ?? ""}${doctor.stderr ?? ""}`;
	if (doctor.status === 0) {
		throw new Error(
			"check-example: monti doctor passed with chart() and mermaid() configured and neither library installed",
		);
	}
	if (!/pnpm add [^\n]*recharts/.test(doctorOutput) || !/mermaid/.test(doctorOutput)) {
		throw new Error(
			`check-example: monti doctor did not name the missing packages and their install command:\n${doctorOutput}`,
		);
	}
	console.log("\ncheck-example: doctor names recharts and mermaid when they are missing");
	console.log("\ncheck-example: ok");
} finally {
	if (args.has("--keep")) console.log(`kept: ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
