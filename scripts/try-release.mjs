#!/usr/bin/env node
/**
 * The release's proof (docs/design/features/20-release.md, 20-3): a new Next app outside this workspace installs Monti from the packed
 * tarballs with npm and runs. What it does, stopping at the first thing that fails:
 *
 *   1. packs the built packages into a bundle whose packages name each other by the bundle's own address;
 *   2. copies the fresh app (`testing/release/app`, a Next app as create-next-app leaves it) to a temporary folder;
 *   3. `npm install`s core, admin and next from the tarballs (no workspace links: the least forgiving way);
 *   4. writes the Monti files a site has (the example app's, until `monti init` writes them);
 *   5. makes a database of its own, then `monti db:setup`, `tsc --noEmit`, `next build`;
 *   6. `next start`, and a browser opens `/admin`: the admin is drawn with its own styles, the console is clean, the admin's API answers,
 *      and the site's own page looks as it did.
 *
 *   pnpm build && node scripts/try-release.mjs [--shot <png>] [--keep]
 *
 * `DATABASE_URL` (or `CMS_TEST_DATABASE_URL`) names a Postgres server the script may make a database on; the database is dropped at the end.
 * `--shot` keeps the browser's picture of `/admin`; `--keep` leaves the temporary site in place and says where it is.
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

const freePort = () =>
	new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address();
			probe.close(() => resolve(port));
		});
	});

async function waitFor(url, running) {
	for (let tries = 0; tries < 120; tries++) {
		if (running.exitCode !== null) throw new Error(`next start stopped (exit ${running.exitCode})`);
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
				ground: style.backgroundColor,
			};
		});
		if (!admin) wrong.push("the admin's frame is not on the page");
		else {
			// A control at a token height with a pill's corner and a ground, in the admin's own font: the stylesheet is on the page.
			if (admin.token === "") wrong.push("the admin's tokens are not defined: its stylesheet did not load");
			if (![24, 28, 32, 36].includes(Math.round(admin.height)))
				wrong.push(`the admin's button is ${admin.height}px high: not a control's height, so its styles are missing`);
			if (admin.radius < 12) wrong.push(`the admin's button has a ${admin.radius}px corner: not a pill`);
			if (/rgba\(0, 0, 0, 0\)|transparent/.test(admin.ground) && admin.token === "")
				wrong.push("the admin's button has no ground");
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

let running;
let made = false;
let failed = false;
try {
	step("pack");
	const { version } = packRelease({ root, out: bundle, base: pathToFileURL(bundle).href });

	step("a fresh Next app, outside the workspace");
	cpSync(path.join(root, "testing", "release", "app"), site, { recursive: true });
	inSite("npm", [
		"install",
		"--no-audit",
		"--no-fund",
		...["core", "admin", "next"].map((name) => path.join(bundle, tarballName(`@monti-cms/${name}`, version))),
	]);

	step("the site's Monti files");
	// Until `monti init` writes them (T82): the example app's own.
	const example = path.join(root, "examples", "blog");
	for (const file of [
		"monti.config.ts",
		"monti.schema.ts",
		"lib/monti.ts",
		"app/admin/page.tsx",
		"app/admin/api/[...path]/route.ts",
	]) {
		mkdirSync(path.dirname(path.join(site, file)), { recursive: true });
		cpSync(path.join(example, file), path.join(site, file));
	}
	writeFileSync(path.join(site, ".env.local"), `DATABASE_URL=${databaseUrl}\nMONTI_SECRET=${env.MONTI_SECRET}\n`);

	step(`a database of its own (${database})`);
	onServer(`create database ${database}`);
	made = true;
	inSite("npx", ["monti", "db:setup"], { env: live });

	step("tsc");
	inSite("npx", ["tsc", "--noEmit"]);

	step("next build");
	inSite("npx", ["next", "build"], { env: live });

	step("next start, and a browser");
	const port = await freePort();
	running = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
		cwd: site,
		env: live,
		stdio: "inherit",
	});
	const base = `http://127.0.0.1:${port}`;
	await waitFor(`${base}/`, running);
	const wrong = await look(base);
	if (wrong.length > 0) {
		failed = true;
		console.error(`\nThe fresh site does not run as it should:\n${wrong.map((line) => `  - ${line}`).join("\n")}`);
	} else {
		console.log(
			`\nA fresh Next app installed Monti ${version} from the tarballs and runs: the admin is drawn with its styles, its API answers,`,
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
			setTimeout(() => {
				running.kill("SIGKILL");
				done();
			}, 5000);
		});
	}
	if (made)
		try {
			onServer(`drop database if exists ${database} with (force)`);
		} catch {
			console.error(`The database ${database} was not dropped.`);
		}
	if (keep) console.log(`The site is kept at ${site}`);
	else rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
