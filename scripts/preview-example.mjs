#!/usr/bin/env node
/**
 * Prepares a local preview of the example app (`examples/blog`) with the showcase posts, memo and series in it, to look at on screen after a change.
 *
 *   pnpm preview:example               # pack the packages, install the example, reset the schema, migrate, seed
 *   pnpm preview:example --seed-only   # skip packing and installing; reset the schema, migrate and seed again
 *   pnpm preview:example --port 4000   # print URLs for another port than 3997 (when 3997 is busy)
 *
 * It only ever touches the schema `cms_preview_example` of the test database (`CMS_TEST_DATABASE_URL`, read from the repo's `.env.local` or the
 * environment), and refuses to run without that variable. The schema is dropped and created again each run. It does not start the dev server;
 * it prints the command at the end.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { writeRegularFile } from "./write-regular-file.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "examples/blog");
const SCHEMA = "cms_preview_example";
const seedOnly = process.argv.includes("--seed-only");
// Only used in the printed URLs and the printed dev server command (default 3997); the script does not start a server.
const portFlag = process.argv.indexOf("--port");
const PORT = portFlag > -1 ? String(process.argv[portFlag + 1]) : "3997";

const run = (cmd, args, cwd, env = {}) => {
	console.log(`\n$ (${path.relative(root, cwd) || "."}) ${cmd} ${args.join(" ")}`);
	execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};

// 1. The test database. Nothing else is ever used: no `CMS_DATABASE_URL` from the shell, no other env file.
const envFile = path.join(root, ".env.local");
const fileValues = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const databaseUrl = fileValues.CMS_TEST_DATABASE_URL || process.env.CMS_TEST_DATABASE_URL;
if (!databaseUrl) {
	console.error(
		"preview-example: CMS_TEST_DATABASE_URL is not set (put it in the repo's .env.local). Refusing to run: this command only uses the test database.",
	);
	process.exit(1);
}

// 2. Bundles and install. The seed run below needs the installed example.
if (!seedOnly) {
	run("pnpm", ["example:pack"], root);
	run("pnpm", ["install", "--ignore-workspace"], app);
} else if (!existsSync(path.join(app, "node_modules"))) {
	console.error("preview-example: --seed-only needs an installed example. Run `pnpm preview:example` once without it.");
	process.exit(1);
}

// 3. A fresh schema. `pg` is a dependency of the core package, so it is loaded from there.
const { Client } = createRequire(path.join(root, "packages/core/package.json"))("pg");
const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
	await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
	await client.query(`CREATE SCHEMA ${SCHEMA}`);
} finally {
	await client.end();
}
console.log(`schema ${SCHEMA} created`);

// 4. The example's env file, and the same values for the commands below (values from the shell would win over an env file, so they are set explicitly).
const env = {
	CMS_DATABASE_URL: databaseUrl,
	CMS_SCHEMA: SCHEMA,
	CMS_DEV_AUTH_BYPASS: "1",
	AUTH_SECRET: "local-only",
};
// Never write through a symlink (a linked `.env.local` would overwrite the file it points to): replace the link with a regular file.
const replacedLink = writeRegularFile(
	path.join(app, ".env.local"),
	`${Object.entries(env)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n")}\n`,
);
if (replacedLink)
	console.log("examples/blog/.env.local was a symlink: replaced it with a regular file (its target is untouched)");
console.log("wrote examples/blog/.env.local");

// 5. Tables and content.
run("pnpm", ["exec", "monti", "migrate", "--no-env-file"], app, env);
run("pnpm", ["exec", "tsx", "--env-file=.env.local", "showcase/seed.ts", PORT], app, env);

console.log(
	`\nStart the preview (Ctrl+C stops it), then open the URLs above:\n  cd examples/blog && pnpm exec next dev -p ${PORT}`,
);
console.log("Do not commit the AGENTS.md and CLAUDE.md that `next dev` creates in that folder.");
