// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the `${NAME}` here is an env file's own, as a site writes it.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnvConfig, updateInitialEnv } from "@next/env";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFiles, takeEnvFile } from "./env-files";

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

	it("20-16 a value that names another has it put in: from the environment, from a file read before, from its own file, or a fallback", () => {
		const env: Record<string, string | undefined> = { DB_HOST: "db.internal", NODE_ENV: "production" };
		loadEnvFiles(
			site({
				".env.local": "DB_NAME=site\nDATABASE_URL=postgres://$DB_HOST/${DB_NAME}\nPRICE='5\\$ each'\n",
				".env":
					"REPLICA_URL=postgres://${REPLICA_HOST:-localhost}/$DB_NAME\nDATABASE_URL=postgres://elsewhere/$DB_NAME\n",
			}),
			env,
		);
		expect(env).toEqual({
			DB_HOST: "db.internal",
			NODE_ENV: "production",
			DB_NAME: "site",
			DATABASE_URL: "postgres://db.internal/site",
			// A `$` of the value's own, written with a backslash.
			PRICE: "5$ each",
			REPLICA_URL: "postgres://localhost/site",
		});
	});

	it("20-16 a name every object has (toString) is a name like any other: read from the file, and not found in the environment", () => {
		const env = Object.create({ inherited: "no" }) as Record<string, string | undefined>;
		loadEnvFiles(site({ ".env": "toString=text\nA=$inherited-$toString\n" }), env);
		expect(env.toString).toBe("text");
		expect(env.A).toBe("-text");
	});

	it("20-16 a value that names itself is refused with its file's name", () => {
		expect(() => loadEnvFiles(site({ ".env": "A=${A}/more\n" }), {})).toThrow(".env: a value names itself.");
	});

	it("20-16 the values are the ones Next reads from the same files and environment", () => {
		// Each: the environment before, and the files. Read by `@next/env` itself and by the command, and compared name by name.
		const cases: { held: Record<string, string>; files: Record<string, string> }[] = [
			{
				held: { MONTI_T215_HOST: "db.internal" },
				files: {
					".env.test.local": "MONTI_T215_NAME=site\nMONTI_T215_URL=postgres://$MONTI_T215_HOST/${MONTI_T215_NAME}\n",
					".env.test": "MONTI_T215_URL=postgres://other/$MONTI_T215_NAME\nMONTI_T215_B=${MONTI_T215_NAME}-b\n",
					".env": "MONTI_T215_C=$MONTI_T215_B/$MONTI_T215_LATER\nMONTI_T215_LATER=later\nMONTI_T215_NAME=shared\n",
				},
			},
			{
				held: {},
				files: {
					".env": [
						"MONTI_T215_PASSWORD=pa$word",
						"MONTI_T215_ESCAPED=pa\\$word",
						"MONTI_T215_SINGLE='$MONTI_T215_ESCAPED'",
						'MONTI_T215_DOUBLE="${MONTI_T215_ESCAPED} and ${MONTI_T215_NONE:-a fallback}"',
						"MONTI_T215_ENDS=price$",
						"MONTI_T215_TWO=$MONTI_T215_ENDS$MONTI_T215_ESCAPED",
						"MONTI_T215_EMPTY=",
						"MONTI_T215_OVER_EMPTY=${MONTI_T215_EMPTY:-filled}",
						// A name later in the file, and one before it by the alphabet: the file's order counts.
						"MONTI_T215_Z=z\\$z",
						"MONTI_T215_AFTER=$MONTI_T215_Z",
						"export MONTI_T215_EXPORTED=yes # a note",
						"MONTI_T215_YAML: like-this",
						"",
					].join("\n"),
				},
			},
			{
				// A value the environment holds, named by a file too: Next puts the names in it.
				held: { MONTI_T215_HELD: "from-$MONTI_T215_WHERE", MONTI_T215_WHERE: "host" },
				files: {
					".env.test": "MONTI_T215_HELD=file\nMONTI_T215_SEES=$MONTI_T215_HELD\n",
					".env": "MONTI_T215_HELD=again\n",
				},
			},
		];
		const before = { ...process.env };
		const quiet = { info: () => {}, error: () => {} };
		try {
			for (const { held, files } of cases) {
				const root = site(files);
				// Next keeps the environment it first saw, and is told of a change to it.
				const mine = Object.keys(process.env).filter((key) => key.startsWith("MONTI_T215_"));
				for (const key of mine) delete process.env[key];
				Object.assign(process.env, held);
				updateInitialEnv({ ...Object.fromEntries(mine.map((key) => [key, undefined])), ...held });
				const ours: Record<string, string | undefined> = { ...process.env };
				loadEnvFiles(root, ours, "test");
				// Next under test reads `.env.test.local`, `.env.test`, `.env`.
				const { combinedEnv } = loadEnvConfig(root, false, quiet, true);
				const read = (all: Record<string, string | undefined>) =>
					Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith("MONTI_T215_")));
				expect(read(ours)).toEqual(read(combinedEnv));
				expect(Object.keys(read(ours)).length).toBeGreaterThan(Object.keys(held).length);
				rmSync(root, { recursive: true, force: true });
			}
		} finally {
			const mine = Object.keys(process.env).filter((key) => !(key in before));
			for (const key of mine) delete process.env[key];
			Object.assign(process.env, before);
			updateInitialEnv(Object.fromEntries(mine.map((key) => [key, undefined])));
		}
	});

	it("20-8 --env-file is read with a space or an equals sign, taken out of the command's arguments; one with no path is refused", () => {
		expect(takeEnvFile(["doctor", "--env-file", ".env.production", "--json"])).toEqual({
			argv: ["doctor", "--json"],
			file: ".env.production",
		});
		expect(takeEnvFile(["--env-file=.env.production", "doctor"])).toEqual({
			argv: ["doctor"],
			file: ".env.production",
		});
		expect(takeEnvFile(["doctor", "--json"])).toEqual({ argv: ["doctor", "--json"], file: undefined });
		// Passing it over would run the command on other values without saying so.
		expect(() => takeEnvFile(["doctor", "--env-file"])).toThrow("--env-file needs a path");
		expect(() => takeEnvFile(["doctor", "--env-file="])).toThrow("--env-file needs a path");
	});
});
