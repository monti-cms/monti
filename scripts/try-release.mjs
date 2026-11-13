#!/usr/bin/env node
/**
 * The release's proof (docs/design/features/20-release.md, 20-3): a new Next app outside this workspace installs Monti from the packed
 * tarballs with npm and runs. What it does, stopping at the first thing that fails:
 *
 *   1. packs the built packages into a bundle and serves it over HTTP on this machine: the bundle's packages name each other by that address,
 *      as a release's name each other by the release's, so the ones a site does not list are fetched the way they will be;
 *   2. copies the fresh app (`testing/release/app`, a Next app as create-next-app leaves it) to a temporary folder;
 *   3. `npm install`s core, admin, next and ai from those addresses (no workspace links: the least forgiving way), and loads each in Node;
 *   4. makes a database of its own, and runs `monti init --yes`: it writes the site's Monti files and makes the tables. A second run writes
 *      nothing, and `monti doctor` finds no failure;
 *   5. `tsc --noEmit` as the site runs it, then once more over every declaration file Monti ships, checked and not skipped (a new Next
 *      app skips the insides of libraries' declarations: `skipLibCheck`), then `next build`;
 *   6. `next start`, and a browser opens `/admin`: the admin is drawn with its own styles, the console is clean, the admin's API answers,
 *      and the site's own page looks as it did.
 *
 *   pnpm build && node scripts/try-release.mjs [--shot <png>] [--keep]
 *
 * `DATABASE_URL` (or `CMS_TEST_DATABASE_URL`) names a Postgres server the script may make a database on; the database is dropped at the end.
 * `--shot` keeps the browser's picture of `/admin`; `--keep` leaves the temporary site in place and says where it is.
 *
 * What it cannot show: the release's own assets are packed once more with the release's address (`release.yml`), so GitHub's download
 * address (a redirect) and a repository that is not public are not tried here. Only npm installs; pnpm and yarn are untried.
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packRelease, tarballName } from "./pack-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const given = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const keep = args.includes("--keep");
const shot = given("--shot") && path.resolve(given("--shot"));

const server = process.env.DATABASE_URL ?? process.env.CMS_TEST_DATABASE_URL;
if (!server) {
	console.error("Set DATABASE_URL (or CMS_TEST_DATABASE_URL) to a Postgres server this proof may make a database on.");
	process.exit(1);
}

const step = (name) => console.log(`\n── ${name}`);
const work = mkdtempSync(path.join(tmpdir(), "monti-try-release-"));
const bundle = path.join(work, "bundle");
const site = path.join(work, "site");
const database = `monti_release_${process.pid}`;
const databaseUrl = (() => {
	const url = new URL(server);
	url.pathname = `/${database}`;
	return url.toString();
})();
// What the site's own environment has on a host: nothing of this workspace's.
const env = { ...process.env, DATABASE_URL: databaseUrl, MONTI_SECRET: "try-release-secret-that-is-long-enough" };
// A live site: `next build` and `next start` set it themselves, and the CLI on a host runs under it. Not the install: npm leaves out what a
// build needs (TypeScript) when it is set.
const live = { ...env, NODE_ENV: "production" };
const inSite = (command, commandArgs, options = {}) =>
	execFileSync(command, commandArgs, { cwd: site, env, stdio: "inherit", ...options });

/** Runs a query on the server's own database with the `pg` the site installed: this workspace's packages are not the site's. */
const onServer = (sql) =>
	execFileSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`import pg from "pg"; const client = new pg.Client({ connectionString: process.env.SERVER }); await client.connect(); await client.query(process.env.SQL); await client.end();`,
		],
		{ cwd: site, env: { ...process.env, SERVER: server, SQL: sql }, stdio: "inherit" },
	);

/**
 * The bundle over HTTP, from a process of its own: this script waits on its commands one at a time (`execFileSync`), and a server inside it
 * could not answer while npm asks.
 */
function serveBundle(port) {
	const code = `
		import { createReadStream, existsSync } from "node:fs";
		import { createServer } from "node:http";
		import path from "node:path";
		const [dir, port] = process.argv.slice(1);
		createServer((request, answer) => {
			const file = path.join(dir, path.basename(decodeURIComponent(new URL(request.url, "http://x").pathname)));
			if (!existsSync(file)) return answer.writeHead(404).end();
			answer.writeHead(200, { "content-type": "application/octet-stream" });
			createReadStream(file).pipe(answer);
		}).listen(Number(port), "127.0.0.1");
	`;
	return spawn(process.execPath, ["--input-type=module", "-e", code, bundle, String(port)], { stdio: "inherit" });
}

const freePort = () =>
	new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address();
			probe.close(() => resolve(port));
		});
	});

async function waitFor(url, child, name) {
	for (let tries = 0; tries < 120; tries++) {
		if (child.exitCode !== null) throw new Error(`${name} stopped (exit ${child.exitCode})`);
		try {
			const answer = await fetch(url);
			if (answer.status < 500) return;
		} catch {}
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error(`${url} did not answer in a minute`);
}

/** What the browser saw: each line is something that is not as it should be. */
async function look(base) {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const wrong = [];
	try {
		const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
		const said = [];
		page.on("console", (message) => {
			if (message.type() === "error") said.push(message.text());
		});
		page.on("pageerror", (error) => said.push(String(error)));

		// The site's own page first, before any of the admin's files are in the browser.
		await page.goto(`${base}/`, { waitUntil: "networkidle" });
		const before = await page.evaluate(() => {
			const body = getComputedStyle(document.body);
			return {
				words: document.querySelector("main")?.textContent ?? "",
				margin: body.margin,
				font: body.fontFamily,
				token: getComputedStyle(document.documentElement).getPropertyValue("--monti-bg-page").trim(),
			};
		});
		if (before.words !== "A fresh site") wrong.push(`the site's page says "${before.words}"`);

		await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
		// The admin is drawn in the browser: wait for a control of it.
		const control = page.locator(".monti-admin [data-slot=button]").first();
		await control
			.waitFor({ state: "visible", timeout: 30_000 })
			.catch(() => wrong.push("no admin control was drawn at /admin"));
		const admin = await page.evaluate(() => {
			const frame = document.querySelector(".monti-admin");
			const button = document.querySelector(".monti-admin [data-slot=button]");
			if (!frame || !button) return null;
			const style = getComputedStyle(button);
			return {
				token: getComputedStyle(frame).getPropertyValue("--monti-bg-page").trim(),
				font: getComputedStyle(frame).fontFamily,
				height: button.getBoundingClientRect().height,
				radius: Number.parseFloat(style.borderTopLeftRadius),
			};
		});
		if (!admin) wrong.push("the admin's frame is not on the page");
		else {
			// A control at a token height with a pill's corner and a ground, in the admin's own font: the stylesheet is on the page.
			if (admin.token === "") wrong.push("the admin's tokens are not defined: its stylesheet did not load");
			if (![24, 28, 32, 36].includes(Math.round(admin.height)))
				wrong.push(`the admin's button is ${admin.height}px high: not a control's height, so its styles are missing`);
			if (admin.radius < 12) wrong.push(`the admin's button has a ${admin.radius}px corner: not a pill`);
			if (!/Pretendard/i.test(admin.font)) wrong.push(`the admin's font is ${admin.font}: its own font did not come`);
		}
		const fonts = await page.evaluate(async () => {
			await document.fonts.ready;
			return [...document.fonts].filter((face) => face.status === "error").map((face) => face.family);
		});
		if (fonts.length > 0) wrong.push(`fonts that did not load: ${fonts.join(", ")}`);

		const api = await page.evaluate(async () => {
			const answer = await fetch("/admin/api/operations/auth.state", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ input: {} }),
			});
			return { status: answer.status, body: await answer.json().catch(() => null) };
		});
		if (api.status !== 200 || api.body === null) wrong.push(`the admin's API answered ${api.status}`);

		if (shot) {
			mkdirSync(path.dirname(shot), { recursive: true });
			await page.screenshot({ path: shot });
		}

		// Back on the site's page, with the admin's files in the browser's cache: nothing of the admin reached it.
		await page.goto(`${base}/`, { waitUntil: "networkidle" });
		const after = await page.evaluate(() => {
			const body = getComputedStyle(document.body);
			return {
				margin: body.margin,
				font: body.fontFamily,
				token: getComputedStyle(document.documentElement).getPropertyValue("--monti-bg-page").trim(),
			};
		});
		if (after.margin !== before.margin || after.font !== before.font || after.token !== "" || before.token !== "")
			wrong.push(`the site's own page changed: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
		for (const line of said) wrong.push(`the browser's console: ${line}`);
	} finally {
		await browser.close();
	}
	return wrong;
}

let serving;
let running;
let made = false;
let failed = false;
let cleaned = false;

/** Puts everything back, once: the servers stopped, the database dropped, the temporary site gone. Also on Ctrl-C and on a cancelled job. */
function cleanUp() {
	if (cleaned) return;
	cleaned = true;
	for (const child of [running, serving]) if (child && child.exitCode === null) child.kill("SIGKILL");
	if (made)
		try {
			onServer(`drop database if exists ${database} with (force)`);
		} catch {
			console.error(`The database ${database} was not dropped.`);
		}
	if (keep) console.log(`The site is kept at ${site}`);
	else rmSync(work, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
	process.on(signal, () => {
		console.error(`\n${signal}: stopping and cleaning up.`);
		cleanUp();
		process.exit(130);
	});

try {
	step("pack, and serve the bundle over HTTP");
	const bundlePort = await freePort();
	const address = `http://127.0.0.1:${bundlePort}`;
	const { version } = packRelease({ root, out: bundle, base: address });
	serving = serveBundle(bundlePort);
	await waitFor(`${address}/README.md`, serving, "the bundle's server");

	step("a fresh Next app, outside the workspace");
	cpSync(path.join(root, "testing", "release", "app"), site, { recursive: true });
	// By address, as a person installs a release: what a site uses itself, and the packages no page of this site imports (the assistant,
	// the S3 storage, the SEO plugin).
	const named = ["core", "admin", "next", "ai", "storage-s3", "seo"];
	inSite("npm", [
		"install",
		"--no-audit",
		"--no-fund",
		...named.map((name) => `${address}/${tarballName(`@monti-cms/${name}`, version)}`),
	]);
	// Each package resolves and loads in Node from the site's own node_modules (the admin and the adapter are loaded by the build below).
	for (const name of ["core", "core/render", "ai", "storage-s3", "seo"])
		inSite(process.execPath, ["--input-type=module", "-e", `await import("@monti-cms/${name}");`]);

	step(`a database of its own (${database})`);
	onServer(`create database ${database}`);
	made = true;

	step("monti init, and monti doctor");
	// As a person does it, with nobody to answer: the defaults. The database answers, so it makes the tables too.
	inSite("npx", ["monti", "init", "--yes"]);
	for (const file of [
		"monti.config.ts",
		"monti.schema.ts",
		"lib/monti.ts",
		"app/admin/page.tsx",
		"app/admin/api/[...path]/route.ts",
	])
		if (!existsSync(path.join(site, file))) throw new Error(`monti init did not write ${file}`);
	// A second run finds everything there and writes nothing.
	const again = execFileSync("npx", ["monti", "init", "--yes"], { cwd: site, env, encoding: "utf8" });
	if (!again.includes("nothing to write")) throw new Error(`a second monti init wrote something:\n${again}`);
	// The set-up it left has no failure: `monti doctor` ends with 1 on one.
	inSite("npx", ["monti", "doctor"], { env: live });

	step("tsc");
	inSite("npx", ["tsc", "--noEmit"]);

	step("tsc, over Monti's own declarations");
	// The site's check skips what is inside a library's declaration files, so a declaration of Monti's that is wrong (a type it names and does
	// not bring, a file it points at and did not ship) passes it, and fails in a site that checks its libraries. Every declaration file Monti
	// ships is checked here with the site's own TypeScript and settings. Other libraries' declarations are read on the way and theirs to
	// answer for: only what is wrong in Monti's files counts.
	writeFileSync(
		path.join(site, "tsconfig.monti.json"),
		`${JSON.stringify({
			extends: "./tsconfig.json",
			compilerOptions: { skipLibCheck: false, incremental: false },
			include: ["node_modules/@monti-cms/*/dist/**/*.d.ts"],
			exclude: [],
		})}\n`,
	);
	let said = "";
	let ended = 0;
	try {
		said = execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false", "-p", "tsconfig.monti.json"], {
			cwd: site,
			env,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "inherit"],
		});
	} catch (error) {
		// tsc ends with a failure on any error, another library's too: what it said decides.
		if (typeof error.stdout !== "string") throw error;
		said = error.stdout;
		ended = error.status ?? 1;
	}
	const lines = said.split("\n").filter((line) => /\berror TS\d+/.test(line));
	// It failed and named no error: it did not get to check (it ran out of memory, it crashed). That is no pass.
	if (ended !== 0 && lines.length === 0)
		throw new Error(`tsc stopped (exit ${ended}) before it checked Monti's declarations:\n${said}`);
	// Another library's errors start with its path under node_modules. Everything else counts: Monti's own files, and an error with no
	// file of a library to it (the settings, no file found to check).
	const monti = lines.filter(
		(line) => /^node_modules[\\/]@monti-cms[\\/]/.test(line) || !/^node_modules[\\/]/.test(line),
	);
	if (monti.length > 0)
		throw new Error(`Monti's declaration files do not pass the site's TypeScript:\n${monti.join("\n")}`);
	console.log(`Monti's declarations pass (${lines.length} errors in other libraries' declarations, not counted).`);
	rmSync(path.join(site, "tsconfig.monti.json"));

	step("next build");
	inSite("npx", ["next", "build"], { env: live });

	step("next start, and a browser");
	const port = await freePort();
	// Next itself, not through `npx`: a signal sent to npm does not reach the server under it, which would keep the port.
	running = spawn(path.join(site, "node_modules", ".bin", "next"), ["start", "-p", String(port), "-H", "127.0.0.1"], {
		cwd: site,
		env: live,
		stdio: "inherit",
	});
	const base = `http://127.0.0.1:${port}`;
	await waitFor(`${base}/`, running, "next start");
	const wrong = await look(base);
	if (wrong.length > 0) {
		failed = true;
		console.error(`\nThe fresh site does not run as it should:\n${wrong.map((line) => `  - ${line}`).join("\n")}`);
	} else {
		console.log(
			`\nA fresh Next app installed Monti ${version} from the tarballs with npm and runs: the admin is drawn with its styles, its API answers,`,
		);
		console.log("the console is clean and the site's own page is untouched.");
	}
	if (shot) console.log(`The picture of /admin: ${shot}`);
} catch (error) {
	failed = true;
	console.error(`\n${error instanceof Error ? error.message : error}`);
} finally {
	if (running && running.exitCode === null) {
		running.kill("SIGTERM");
		await new Promise((done) => {
			running.once("exit", done);
			setTimeout(done, 5000);
		});
	}
	cleanUp();
}
process.exit(failed ? 1 : 0);
