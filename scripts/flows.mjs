#!/usr/bin/env node
/**
 * Runs the L4 flows (`flows/*.flow.ts`): one test per 🔴 flow, in a real browser against the example app on the test database.
 *
 *   pnpm flows               # reset the schema, set up the tables, run every flow
 *   pnpm flows --prepare     # first pack the packages, copy the example to flows/.app and install it there (once, and after a change)
 *   pnpm flows -- <args>     # pass the rest to `playwright test` (a file, `-g <title>`, `--headed`)
 *
 * It only ever touches the schema `cms_e2e_flows` of the test database (`CMS_TEST_DATABASE_URL`, read from the repo's `.env.local` or the environment),
 * and refuses to run without that variable. The schema is dropped and created again each run, so every run starts on an empty site.
 * `MONTI_FLOWS_SCHEMA=cms_e2e_<name>` and `MONTI_FLOWS_PORT` let another checkout run its flows at the same time.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, "examples/blog");
// The flows run a copy of the example: the schema screen rewrites `monti.schema.ts` under `next dev`, and a flow must not change the repo.
// It also lets a server run in `examples/blog` at the same time (`next dev` runs once per folder).
const app = path.join(root, "flows/.app");
// Another checkout running flows at the same time sets its own schema (and `MONTI_FLOWS_PORT`); the name must start with `cms_e2e_`.
const SCHEMA = process.env.MONTI_FLOWS_SCHEMA ?? "cms_e2e_flows";
if (!/^cms_e2e_[a-z0-9_]+$/.test(SCHEMA)) {
	console.error(`flows: MONTI_FLOWS_SCHEMA must look like cms_e2e_<name>, not "${SCHEMA}"`);
	process.exit(1);
}
const args = process.argv.slice(2);
const prepare = args.includes("--prepare");
const rest = args.filter((arg) => arg !== "--prepare" && arg !== "--");

const run = (cmd, cmdArgs, cwd, env = {}) => {
	console.log(`\n$ (${path.relative(root, cwd) || "."}) ${cmd} ${cmdArgs.join(" ")}`);
	execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};

const envFile = path.join(root, ".env.local");
const fileValues = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const databaseUrl = process.env.CMS_TEST_DATABASE_URL || fileValues.CMS_TEST_DATABASE_URL;
if (!databaseUrl) {
	console.error(
		"flows: CMS_TEST_DATABASE_URL is not set (put it in the repo's .env.local). Refusing to run: flows only use the test database.",
	);
	process.exit(1);
}

// Two copies of the example. `flows/.app` signs every request in as the admin (`next dev`'s login bypass) for the flows that edit content.
// `flows/.app-login` turns the bypass off and logs in with a password, for the first-install flow (the first admin, then signing in), on a schema of its own.
const apps = [
	{ dir: app, schema: SCHEMA },
	{ dir: path.join(root, "flows/.app-login"), schema: `${SCHEMA}_login`, login: true },
];
const loginConfig = (text) => {
	const next = text
		.replace('import { github } from "@monti-cms/auth/github";', 'import { password } from "@monti-cms/auth/password";')
		.replace("auth: auth({ providers: [github()] }),", "auth: auth({ devBypass: false, providers: [password()] }),");
	if (next === text || next.includes("github()"))
		throw new Error("flows: the example's login line changed; update loginConfig in scripts/flows.mjs");
	return next;
};

// The example's own files, without what a run or an install adds. Copied again each run, so a flow that rewrote `monti.schema.ts` leaves nothing behind.
const skip = new Set(["node_modules", ".next", ".env.local", "AGENTS.md", "CLAUDE.md"]);
// The example's demo storage refuses uploads, so the copies store media on disk (`flows/overlay`: the storage and the route it uploads to).
const diskStorageConfig = (text) => {
	const next = text
		.replace('import { dummyStorage } from "./dummy-storage";', 'import { flowsStorage } from "./flows-storage";')
		.replace("storage: dummyStorage(),", "storage: flowsStorage(),");
	if (next === text || next.includes("dummyStorage"))
		throw new Error("flows: the example's storage line changed; update diskStorageConfig in scripts/flows.mjs");
	return next;
};
const copyExample = ({ dir, login }) => {
	cpSync(example, dir, { recursive: true, filter: (source) => !skip.has(path.basename(source)) });
	cpSync(path.join(root, "flows/overlay"), dir, { recursive: true });
	rmSync(path.join(dir, ".flows-files"), { recursive: true, force: true });
	// The last run's build cache was made from the schema that run left; `next dev` on it reloads the page over and over.
	rmSync(path.join(dir, ".next"), { recursive: true, force: true });
	const config = path.join(dir, "monti.config.ts");
	const text = diskStorageConfig(readFileSync(config, "utf8"));
	writeFileSync(config, login ? loginConfig(text) : text);
};
if (prepare) run("pnpm", ["example:pack"], root);
for (const copy of apps) {
	if (prepare) {
		rmSync(copy.dir, { recursive: true, force: true });
		copyExample(copy);
		run("pnpm", ["install", "--ignore-workspace"], copy.dir);
	} else if (!existsSync(path.join(copy.dir, "node_modules"))) {
		console.error("flows: the example copies are not installed. Run `pnpm flows --prepare` once.");
		process.exit(1);
	} else {
		copyExample(copy);
	}
}

const { Client } = createRequire(path.join(root, "packages/core/package.json"))("pg");
for (const copy of apps) {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query(`DROP SCHEMA IF EXISTS ${copy.schema} CASCADE`);
		await client.query(`CREATE SCHEMA ${copy.schema}`);
	} finally {
		await client.end();
	}
	const env = { DATABASE_URL: databaseUrl, DATABASE_SCHEMA: copy.schema, MONTI_SECRET: "local-only-flows-secret" };
	run("pnpm", ["exec", "monti", "db:setup", "--no-env-file"], copy.dir, env);
}
// `next dev` stops every other start to show an upgrade notice when it detects a coding agent in the environment, which a test server cannot answer.
// The flows run as a person would, so the agent's variables are left out.
const AGENT_VARIABLE = /^(CLAUDE|CLAUDECODE|CODEX|CURSOR|AI_AGENT|AGENT)/;
const runEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !AGENT_VARIABLE.test(key)));
console.log("\n$ pnpm exec playwright test --config flows/playwright.config.ts", rest.join(" "));
execFileSync("pnpm", ["exec", "playwright", "test", "--config", "flows/playwright.config.ts", ...rest], {
	cwd: root,
	stdio: "inherit",
	env: { ...runEnv, MONTI_FLOWS_DATABASE_URL: databaseUrl, MONTI_FLOWS_SCHEMA: SCHEMA },
});
