#!/usr/bin/env node
/**
 * Starts the example app (`examples/blog`) for the flow tests, as a deployed site would run: packed packages, a production build, `next start`.
 * Production matters: under `next dev` the admin signs you in by itself (the dev bypass), so the login screen would never show.
 *
 *   node e2e/start-example.mjs            # pack the packages, install the example, reset the database, build, start
 *   E2E_NO_PACK=1 node e2e/start-example.mjs  # use the vendor bundles and install already there
 *
 * The database is the test database only (`CMS_TEST_DATABASE_URL`, from the environment or the repo's `.env.local`), in a schema of its own
 * (`cms_e2e`) that is dropped and created again each run, so every run starts with no admin and no content.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { E2E_ENV } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "examples/blog");
const env = { ...process.env, ...E2E_ENV(readRootEnv()) };

function readRootEnv() {
	const file = path.join(root, ".env.local");
	return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
}

const run = (cmd, args, cwd) => {
	console.log(`$ (${path.relative(root, cwd) || "."}) ${cmd} ${args.join(" ")}`);
	execFileSync(cmd, args, { cwd, stdio: "inherit", env });
};

if (!process.env.E2E_NO_PACK) {
	run("pnpm", ["example:pack"], root);
	run("pnpm", ["install", "--ignore-workspace"], app);
}

// A fresh schema: no admin, no content. `pg` is a dependency of the core package, so it is loaded from there.
const { Client } = createRequire(path.join(root, "packages/core/package.json"))("pg");
const client = new Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
	await client.query(`DROP SCHEMA IF EXISTS ${env.DATABASE_SCHEMA} CASCADE`);
	await client.query(`CREATE SCHEMA ${env.DATABASE_SCHEMA}`);
} finally {
	await client.end();
}
run("pnpm", ["exec", "monti", "db:setup", "--no-env-file"], app);
run("pnpm", ["exec", "next", "build"], app);

const server = spawn("pnpm", ["exec", "next", "start", "-p", env.E2E_PORT, "-H", "127.0.0.1"], {
	cwd: app,
	stdio: "inherit",
	env,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
