import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "./env-files";

describe("the site's env files, as the monti command reads them", () => {
	let dir = "";
	afterEach(() => rmSync(dir, { recursive: true, force: true }));
	const site = (files: Record<string, string>) => {
		dir = mkdtempSync(path.join(tmpdir(), "monti-env-"));
		for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
		return dir;
	};

	it("20-8 what the environment holds wins, then .env.local, then .env: the order Next reads them in", () => {
		const env: Record<string, string | undefined> = { FROM_HOST: "host" };
		const from = loadEnvFiles(
			site({
				".env.local": "FROM_HOST=local\nDATABASE_URL=postgres://localhost/local\nMONTI_SECRET='quoted value'\n",
				".env": "DATABASE_URL=postgres://localhost/shared\nSITE_URL=https://example.dev\n",
			}),
			env,
		);
		expect(env).toEqual({
			FROM_HOST: "host",
			DATABASE_URL: "postgres://localhost/local",
			MONTI_SECRET: "quoted value",
			SITE_URL: "https://example.dev",
		});
		// Where each came from, for a message that names the file and not the value.
		expect(Object.fromEntries(from)).toEqual({
			DATABASE_URL: ".env.local",
			MONTI_SECRET: ".env.local",
			SITE_URL: ".env",
		});
	});

	it("20-8 a file for the mode comes before the plain one, and under test .env.local is left out", () => {
		const files = { ".env.production": "A=production\n", ".env.local": "A=local\nB=local\n", ".env.test": "A=test\n" };
		const production: Record<string, string | undefined> = { NODE_ENV: "production" };
		loadEnvFiles(site(files), production);
		expect(production).toMatchObject({ A: "local", B: "local" });
		rmSync(dir, { recursive: true, force: true });
		const test: Record<string, string | undefined> = { NODE_ENV: "test" };
		loadEnvFiles(site(files), test);
		expect(test).toEqual({ NODE_ENV: "test", A: "test" });
	});

	it("20-8 a folder with no env file changes nothing", () => {
		const env: Record<string, string | undefined> = {};
		expect(loadEnvFiles(site({}), env).size).toBe(0);
		expect(env).toEqual({});
	});
});
