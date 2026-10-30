import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * L4: one test per 🔴 flow (`docs/testing/features.md`), in a real browser against the example app (`examples/blog`) on a real database.
 * The app is a copy of the example with the packed packages (`pnpm flows --prepare` makes it in `flows/.app`), run with `next dev`, which signs the browser in as the
 * admin by itself. `pnpm flows` (`scripts/flows.mjs`) resets the schema `cms_e2e_flows` of the test database and sets up its tables first.
 * No retries: a flow that fails is fixed, in the test or in the app.
 */
const root = path.resolve(import.meta.dirname, "..");
const databaseUrl = process.env.MONTI_FLOWS_DATABASE_URL;
const schema = process.env.MONTI_FLOWS_SCHEMA;
if (!databaseUrl || !schema) throw new Error("flows: run them with `pnpm flows`, which prepares the database first");
const PORT = Number(process.env.MONTI_FLOWS_PORT ?? 3905);

export default defineConfig({
	testDir: import.meta.dirname,
	testMatch: "*.flow.ts",
	outputDir: path.join(import.meta.dirname, "test-results"),
	// The flows share one database, so they run one after another.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	reporter: process.env.CI
		? [["list"], ["html", { outputFolder: path.join(import.meta.dirname, "report"), open: "never" }]]
		: [["list"]],
	use: {
		viewport: { width: 1440, height: 900 },
		locale: "ko-KR",
		trace: "retain-on-failure",
	},
	projects: [
		// Every flow but the first install runs signed in already (`next dev`'s login bypass).
		{ name: "signed in", testIgnore: "first-install.flow.ts", use: { baseURL: `http://localhost:${PORT}` } },
		// The first install runs on the copy with a password login and no bypass (`flows/.app-login`, its own schema).
		{ name: "login", testMatch: "first-install.flow.ts", use: { baseURL: `http://localhost:${PORT + 1}` } },
	],
	webServer: [
		{ dir: "flows/.app", port: PORT, schema },
		{ dir: "flows/.app-login", port: PORT + 1, schema: `${schema}_login` },
	].map((server) => ({
		command: `pnpm exec next dev -p ${server.port}`,
		cwd: path.join(root, server.dir),
		// An API route, so the first save of a flow does not wait for `next dev` to compile the API (401 on the login copy also counts as up).
		url: `http://localhost:${server.port}/api/monti/v1/meta`,
		timeout: 240_000,
		reuseExistingServer: false,
		env: { DATABASE_URL: databaseUrl, DATABASE_SCHEMA: server.schema, MONTI_SECRET: "local-only-flows-secret" },
	})),
});
