import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MontiConfig } from "../../config";
import { reportOf } from "../doctor/report";
import { type InitOptions, init } from "./command";

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A Next app as create-next-app leaves it, with Monti's three packages installed; `files` adds, changes or (with `null`) takes away. With
 * `under` it is a package of a workspace: its own files are in that folder, and the installed packages stay at the workspace's root.
 */
function site(files: Record<string, string | null> = {}, under = "") {
	const root = mkdtempSync(path.join(tmpdir(), "monti-init-"));
	made.push(root);
	const dir = path.join(root, under);
	const all: Record<string, string | null> = {
		"package.json": `${JSON.stringify({ name: "my-site", scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "16.4.6" } }, null, 2)}\n`,
		"tsconfig.json": "{}\n",
		"node_modules/next/package.json": '{ "version": "16.4.6" }',
		"node_modules/@monti-cms/core/package.json": '{ "version": "0.2.0" }',
		"node_modules/@monti-cms/admin/package.json": '{ "version": "0.2.0" }',
		"node_modules/@monti-cms/next/package.json": '{ "version": "0.2.0" }',
		"app/layout.tsx":
			'export default function Root({ children }) { return <html lang="ko"><body>{children}</body></html>; }\n',
		"app/page.tsx": "export default function Home() { return <main>Home</main>; }\n",
		".gitignore": "node_modules\n.next\n",
		...files,
	};
	for (const [name, text] of Object.entries(all)) {
		if (text === null) continue;
		const file = name.startsWith("node_modules/") ? path.join(root, name) : path.join(dir, name);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
	return dir;
}

/** Every file of the site (not the packages), with its text. */
function tree(dir: string, under = ""): Record<string, string> {
	return Object.fromEntries(
		readdirSync(path.join(dir, under), { withFileTypes: true }).flatMap((entry) => {
			const file = path.join(under, entry.name);
			if (entry.name === "node_modules") return [];
			return entry.isDirectory()
				? Object.entries(tree(dir, file))
				: [[file, readFileSync(path.join(dir, file), "utf8")]];
		}),
	);
}

const CONFIG = { schema: {}, database: "postgres://localhost/my_site" } as unknown as MontiConfig;

/** Runs `monti init` in a folder with nobody at the terminal unless `typed` is given, and no real database. */
async function run(cwd: string, argv: string[] = [], change: Partial<InitOptions> & { typed?: string[] } = {}) {
	const { typed, ...rest } = change;
	const lines: string[] = [];
	const input = Object.assign(new PassThrough(), { isTTY: typed !== undefined });
	const output = new PassThrough();
	let asked = "";
	output.on("data", (chunk: Buffer) => {
		asked += chunk.toString();
		// A person answers each question as it is asked.
		if (asked.endsWith("]: ") && typed && typed.length > 0) input.write(`${typed.shift()}\n`);
	});
	const database = { answers: vi.fn(async () => false), setUp: vi.fn(async () => {}) };
	const code = await init({
		cwd,
		argv,
		env: {},
		loadConfig: async () => CONFIG,
		input,
		output,
		out: (line) => lines.push(line),
		doctor: async (given) =>
			reportOf(given.cwd, [{ id: "site/next", status: "ok", message: "Next 16.4.6, App Router (app/)" }]),
		database,
		...rest,
	});
	return { code, text: lines.join("\n"), asked, database };
}

describe("monti init", () => {
	it("20-5 on a fresh Next app with -y it asks nothing and writes the site's Monti files, the env values, the ignore lines and the scripts", async () => {
		const dir = site();
		const before = tree(dir);
		const { code, text, asked } = await run(dir, ["-y"]);
		expect(code).toBe(0);
		expect(asked).toBe("");
		const after = tree(dir);
		expect(
			Object.keys(after)
				.filter((file) => !(file in before))
				.sort(),
		).toEqual([
			".env.example",
			".env.local",
			"app/admin/api/[...path]/route.ts",
			"app/admin/page.tsx",
			"lib/monti.ts",
			"monti.config.ts",
			"monti.schema.ts",
		]);
		// The language is the site's own (`<html lang="ko">`), by its own name.
		expect(after["monti.schema.ts"]).toContain('source: "ko"');
		expect(after["monti.schema.ts"]).toContain('{ code: "ko", name: "한국어" }');
		expect(after["monti.config.ts"]).toContain("auth: { password: true }");
		expect(after["monti.config.ts"]).toContain('base: "/admin/api"');
		// No alias of the site's is assumed: the files find each other by their place.
		expect(after["lib/monti.ts"]).toContain('import config from "../monti.config";');
		expect(after["app/admin/api/[...path]/route.ts"]).toContain('import { monti } from "../../../../lib/monti";');
		expect(after["app/admin/page.tsx"]).toContain('<AdminPage siteName="my-site" />');
		expect(after[".env.local"]).toMatch(
			/^DATABASE_URL=postgres:\/\/localhost\/my_site\nMONTI_SECRET=[A-Za-z0-9+/=]{44}\n$/,
		);
		expect(after[".gitignore"]).toBe("node_modules\n.next\n.env.local\n.monti/\n");
		// The site's own scripts are as they were; two are new. The file keeps its two-space indent.
		expect(JSON.parse(after["package.json"] as string).scripts).toEqual({
			dev: "next dev",
			build: "next build",
			"db:setup": "monti db:setup",
			"db:migrate": "monti db:migrate",
		});
		expect(after["package.json"]).toContain('\n  "name": "my-site"');
		// Nothing of the site's own pages changed.
		expect(after["app/layout.tsx"]).toBe(before["app/layout.tsx"]);
		expect(after["app/page.tsx"]).toBe(before["app/page.tsx"]);
		expect(text).toContain(
			"Wrote:\n  monti.schema.ts\n  monti.config.ts\n  lib/monti.ts\n  app/admin/page.tsx\n  app/admin/api/[...path]/route.ts\n  .env.example",
		);
		expect(text).toContain(
			"Added:\n  .env.local: DATABASE_URL, MONTI_SECRET\n  .gitignore: .env.local, .monti/\n  package.json: the script db:setup, the script db:migrate",
		);
	});

	it("20-5 each of the four has a flag, and a flag's value is what is written", async () => {
		const dir = site({ "node_modules/@monti-cms/storage-s3/package.json": '{ "version": "0.2.0" }' });
		const { code, text } = await run(dir, [
			"--admin-path",
			"/studio",
			"--locale",
			"pt-BR",
			"--login",
			"github",
			"--storage",
			"s3",
		]);
		expect(code).toBe(0);
		expect(text).toContain("admin /studio · language pt-BR · sign-in github · media files s3");
		const after = tree(dir);
		expect(after["app/studio/page.tsx"]).toContain("`/studio`");
		expect(after["monti.schema.ts"]).toContain('source: "pt-BR"');
		expect(after["monti.config.ts"]).toContain('import { s3Storage } from "@monti-cms/storage-s3";');
		expect(after["monti.config.ts"]).toContain("clientId: process.env.GITHUB_CLIENT_ID");
		expect(after["monti.config.ts"]).toContain("password: false");
		expect(
			Object.keys(
				Object.fromEntries(
					(after[".env.local"] as string)
						.trim()
						.split("\n")
						.map((line) => line.split("=")),
				),
			),
		).toEqual([
			"DATABASE_URL",
			"MONTI_SECRET",
			"GITHUB_CLIENT_ID",
			"GITHUB_CLIENT_SECRET",
			"GITHUB_ADMIN",
			"S3_BUCKET",
			"S3_REGION",
			"S3_ACCESS_KEY_ID",
			"S3_SECRET_ACCESS_KEY",
			"S3_PUBLIC_URL",
		]);
		expect(text).toContain("Its callback address: <the site's address>/studio/api/auth/github");
		// A flag's value that is not one, and a flag it does not know, stop it before anything is read or written.
		const other = site();
		const wrong = await run(other, ["--login", "magic"]);
		expect(wrong).toMatchObject({ code: 1, text: "--login magic: password or github." });
		expect((await run(other, ["--force"])).code).toBe(1);
		expect(existsSync(path.join(other, "monti.config.ts"))).toBe(false);
	});

	it("20-5 a person at the terminal is asked the four, Enter takes what is in brackets, and a wrong answer is asked again", async () => {
		const dir = site();
		const { code, asked, text } = await run(dir, [], { typed: ["studio", "/studio", "", "github", ""] });
		expect(code).toBe(0);
		expect(
			asked
				.split("]: ")
				.filter(Boolean)
				.map((line) => line.trim()),
		).toEqual([
			"Where should the admin be? [/admin",
			'The admin path is one folder: a slash, then lower-case letters, digits or "-" (/admin).\nWhere should the admin be? [/admin',
			"The site's language [ko",
			"How does the admin sign in? (password, github) [password",
			"Where do media files go? (local: a folder on this machine, s3, none) [local",
		]);
		expect(text).toContain("admin /studio · language ko · sign-in github · media files local");
		expect(existsSync(path.join(dir, "app/studio/page.tsx"))).toBe(true);
	});

	it("20-5 with nobody at the terminal (a pipe, CI) it does not wait for an answer: it takes the defaults and ends", async () => {
		const dir = site();
		// The input never ends and never speaks, as a CI job's does.
		const { code, asked, text } = await run(dir);
		expect(code).toBe(0);
		expect(asked).toBe("");
		expect(text).toContain("admin /admin · language ko · sign-in password · media files local");
		expect(existsSync(path.join(dir, "monti.config.ts"))).toBe(true);
	}, 5000);

	it("20-6 it looks first: a site under src/ gets its files there, and one that has the admin mounted keeps that address", async () => {
		const src = site({
			"app/layout.tsx": null,
			"app/page.tsx": null,
			"src/app/layout.tsx": "export default () => null;\n",
		});
		await run(src, ["-y"]);
		const files = Object.keys(tree(src));
		expect(files).toEqual(
			expect.arrayContaining([
				"src/lib/monti.ts",
				"src/app/admin/page.tsx",
				"src/app/admin/api/[...path]/route.ts",
				"monti.config.ts",
			]),
		);
		expect(tree(src)["src/lib/monti.ts"]).toContain('import config from "../../monti.config";');
		// No language in the layout: English.
		expect(tree(src)["monti.schema.ts"]).toContain('source: "en"');

		const mounted = site({
			"app/cms/page.tsx": "export default () => <AdminPage />;\n",
			"app/cms/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
		});
		const { text } = await run(mounted, ["-y"]);
		expect(text).toContain("admin /cms ·");
		expect(text).toContain("Left as they are (already there):\n  app/cms/page.tsx\n  app/cms/api/[...path]/route.ts");
		expect(existsSync(path.join(mounted, "app/admin"))).toBe(false);
	});

	it("20-6 a file that is there is never written over, whatever is in it, and the run says which it left alone", async () => {
		const edited = '// mine: do not touch\nimport schema from "./monti.schema";\nexport default { schema };\n';
		const dir = site({ "monti.config.ts": edited, "lib/monti.ts": "// mine too\n" });
		const { text } = await run(dir, ["-y"]);
		const after = tree(dir);
		expect(after["monti.config.ts"]).toBe(edited);
		expect(after["lib/monti.ts"]).toBe("// mine too\n");
		expect(text).toContain("Left as they are (already there):\n  monti.config.ts\n  lib/monti.ts");
		expect(text).toContain("Wrote:\n  monti.schema.ts\n  app/admin/page.tsx");
	});

	it("20-6 .env is never touched, and .env.local gets only the values neither file names: a value that is there stays, an empty one too", async () => {
		const env = "# shared\nDATABASE_URL=postgres://db.internal/site\n";
		const local = "# mine\nMONTI_SECRET=\nOTHER=1";
		const dir = site({ ".env": env, ".env.local": local });
		const { text } = await run(dir, ["-y", "--login", "github"]);
		const after = tree(dir);
		expect(after[".env"]).toBe(env);
		// What was there, to the letter, then the new names on lines of their own.
		expect(after[".env.local"]).toBe(`${local}\nGITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET=\nGITHUB_ADMIN=\n`);
		expect(text).toContain(".env.local: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ADMIN");
		expect(text).not.toContain(".env.local: DATABASE_URL");
	});

	it("20-6 a second run writes nothing and says what is there; a file taken away since is the one thing it writes back", async () => {
		const dir = site();
		await run(dir, ["-y"]);
		const first = tree(dir);
		const again = await run(dir, ["-y"]);
		expect(tree(dir)).toEqual(first);
		expect(again.code).toBe(0);
		expect(again.text).toContain("Monti is set up here already: nothing to write.");
		expect(again.text).toContain(
			"Left as they are (already there):\n  monti.schema.ts\n  monti.config.ts\n  lib/monti.ts\n  app/admin/page.tsx",
		);
		expect(again.text).not.toContain("Wrote:");
		expect(again.text).not.toContain("Added:");

		rmSync(path.join(dir, "lib/monti.ts"));
		const third = await run(dir, ["-y"]);
		expect(third.text).toContain("Wrote:\n  lib/monti.ts\nLeft as they are");
		expect(tree(dir)).toEqual(first);
	});

	it("20-6 --dry-run says what it would write and writes nothing", async () => {
		const dir = site();
		const before = tree(dir);
		const { code, text, database } = await run(dir, ["--dry-run"]);
		expect(code).toBe(0);
		expect(tree(dir)).toEqual(before);
		expect(text).toContain("Would write:\n  monti.schema.ts");
		expect(text).toContain("Would add:\n  .env.local: DATABASE_URL, MONTI_SECRET");
		expect(text).toContain("Nothing was written (--dry-run).");
		expect(database.answers).not.toHaveBeenCalled();
	});

	it("20-7 where it cannot work it writes nothing and says why and what to do: no Next, only pages/, no TypeScript, a package missing", async () => {
		for (const [files, why] of [
			[
				{ "package.json": '{ "name": "not-next" }', "node_modules/next/package.json": null },
				"Next is not one of this folder's packages",
			],
			[
				{ "app/layout.tsx": null, "app/page.tsx": null, "pages/index.tsx": "export default () => null;\n" },
				"only a pages/ folder",
			],
			[{ "tsconfig.json": null }, "no tsconfig.json"],
			[{ "node_modules/@monti-cms/next/package.json": null }, "@monti-cms/next is not installed."],
			[{ "node_modules/next/package.json": '{ "version": "15.3.0" }' }, "Next 15.3.0: Monti needs Next 16 or later."],
		] as const) {
			const dir = site(files);
			const before = tree(dir);
			const { code, text } = await run(dir, ["-y"]);
			expect(code).toBe(1);
			expect(text).toContain(why);
			expect(text).toContain("Nothing was written.\n  fix: ");
			expect(tree(dir)).toEqual(before);
		}
		// The S3 storage without its package: refused after the answers, before any file.
		const dir = site();
		const before = tree(dir);
		const { code, text } = await run(dir, ["-y", "--storage", "s3"]);
		expect(code).toBe(1);
		expect(text).toContain("@monti-cms/storage-s3: install it from the same release");
		expect(tree(dir)).toEqual(before);
	});

	it("20-7 leaving a question (the input ends, Ctrl+C) writes nothing and ends with 130", async () => {
		const dir = site();
		const before = tree(dir);
		const input = Object.assign(new PassThrough(), { isTTY: true });
		const output = new PassThrough();
		let questions = 0;
		output.on("data", (chunk: Buffer) => {
			if (!chunk.toString().endsWith("]: ")) return;
			questions += 1;
			// The first is answered; at the second the person leaves.
			if (questions === 1) input.write("/admin\n");
			else input.end();
		});
		const { code, text } = await run(dir, [], { input, output });
		expect(code).toBe(130);
		expect(text).toContain("Cancelled. Nothing was written.");
		expect(tree(dir)).toEqual(before);
	});

	it("20-15 under a top-level layout the admin gets no layout of its own and the run says what to move; without one it writes the admin's own", async () => {
		const shared = site();
		const under = await run(shared, ["-y"]);
		expect(existsSync(path.join(shared, "app/admin/layout.tsx"))).toBe(false);
		expect(under.text).toContain(
			"The admin is drawn inside the site's own layout (app/layout.tsx). If the site's header or styles show in the admin: move the site's pages and that layout into app/(site)/, then run monti init again (it writes app/admin/layout.tsx).",
		);

		const grouped = site({
			"app/layout.tsx": null,
			"app/page.tsx": null,
			"app/(site)/layout.tsx": 'export default ({ children }) => <html lang="ja"><body>{children}</body></html>;\n',
			"app/(site)/page.tsx": "export default () => null;\n",
		});
		const own = await run(grouped, ["-y", "--locale", "ja"]);
		expect(readFileSync(path.join(grouped, "app/admin/layout.tsx"), "utf8")).toContain('<html lang="ja">');
		expect(own.text).not.toContain("drawn inside the site's own layout");
		// The person who moved their pages runs it again: the one new file is the admin's layout.
		rmSync(path.join(shared, "app/layout.tsx"));
		const moved = await run(shared, ["-y"]);
		expect(moved.text).toContain("Wrote:\n  app/admin/layout.tsx\n");

		// A layout on the route group the admin is in is over it: a second one, with its own <html>, is not written under it.
		const inGroup = site({
			"app/layout.tsx": null,
			"app/page.tsx": null,
			"app/(cms)/layout.tsx": "export default ({ children }) => <html><body>{children}</body></html>;\n",
			"app/(cms)/admin/page.tsx": "export default () => <AdminPage />;\n",
			"app/(cms)/admin/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
		});
		await run(inGroup, ["-y"]);
		expect(existsSync(path.join(inGroup, "app/(cms)/admin/layout.tsx"))).toBe(false);
	});

	it("20-5 when the database answers it makes the tables (asking first when a person is there); when it does not, that is the first thing left to do", async () => {
		const answering = { answers: vi.fn(async () => true), setUp: vi.fn(async () => {}) };
		const yes = await run(site(), ["-y"], { database: answering });
		expect(answering.setUp).toHaveBeenCalledTimes(1);
		expect(yes.text).toContain("Monti's tables are made.");
		expect(yes.text).toContain("What is left:\n  1. The admin is drawn inside");

		const declined = { answers: vi.fn(async () => true), setUp: vi.fn(async () => {}) };
		const no = await run(site(), [], { database: declined, typed: ["", "", "", "", "no"] });
		expect(no.asked).toContain("The database answers. Make Monti's tables in it now? (yes, no) [yes]: ");
		expect(declined.setUp).not.toHaveBeenCalled();
		expect(no.text).toContain(
			"What is left:\n  1. Set DATABASE_URL in .env.local to your Postgres database, then make Monti's tables: npm run db:setup",
		);

		const silent = await run(site({ "pnpm-lock.yaml": "" }), ["-y"]);
		expect(silent.database.setUp).not.toHaveBeenCalled();
		expect(silent.text).toContain("then make Monti's tables: pnpm db:setup");
		expect(silent.text).toContain("Start the site (pnpm dev) and open http://localhost:3000/admin");
	});

	it("20-6 a site whose config has another of the names the command loads keeps it: no second config beside it, and the files read it by its own name", async () => {
		const mjs = site({ "monti.config.mjs": "export default { schema: {} };\n" });
		const given: string[] = [];
		const { code, text } = await run(mjs, ["-y"], {
			doctor: async (options) => {
				given.push(options.configFile ?? "none");
				return reportOf(options.cwd, []);
			},
		});
		expect(code).toBe(0);
		const after = tree(mjs);
		expect(after["monti.config.mjs"]).toBe("export default { schema: {} };\n");
		expect("monti.config.ts" in after).toBe(false);
		// The config names its own schema: no schema file that nothing reads.
		expect("monti.schema.ts" in after).toBe(false);
		expect(after["lib/monti.ts"]).toContain('import config from "../monti.config.mjs";');
		expect(text).toContain("Left as they are (already there):\n  monti.config.mjs");
		expect(given).toEqual([path.join(mjs, "monti.config.mjs")]);

		// A config that reads ./monti.schema gets the schema file it reads.
		const js = site({ "monti.config.js": 'import schema from "./monti.schema";\nexport default { schema };\n' });
		await run(js, ["-y"]);
		expect("monti.config.ts" in tree(js)).toBe(false);
		expect(tree(js)["monti.schema.ts"]).toContain("defineSchema");
		expect(tree(js)["lib/monti.ts"]).toContain('import config from "../monti.config";');
	});

	it("20-6 an admin in a route group or under another folder gets no second one, and another address for it is refused", async () => {
		const mounted = {
			"app/(cms)/admin/page.tsx": "export default () => <AdminPage />;\n",
			"app/(cms)/admin/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
		};
		const grouped = site(mounted);
		const { text, asked } = await run(grouped, [], { typed: ["", "", ""] });
		// Its address is where it is: a route group is no part of it, and it is not asked.
		expect(text).toContain("admin /admin ·");
		expect(asked).not.toContain("Where should the admin be?");
		expect(text).toContain(
			"Left as they are (already there):\n  app/(cms)/admin/page.tsx\n  app/(cms)/admin/api/[...path]/route.ts",
		);
		expect(existsSync(path.join(grouped, "app/admin"))).toBe(false);
		expect(tree(grouped)["monti.config.ts"]).toContain('base: "/admin/api"');

		const nested = site({
			"app/tools/cms/page.tsx": "export default () => <AdminPage />;\n",
			"app/tools/cms/api/[...path]/route.ts": "export const { GET, POST, PUT } = adminRoute(monti);\n",
		});
		const under = await run(nested, ["-y"]);
		expect(under.text).toContain("admin /tools/cms ·");
		expect(under.text).toContain("open http://localhost:3000/tools/cms");
		expect(existsSync(path.join(nested, "app/admin"))).toBe(false);

		const other = site(mounted);
		const before = tree(other);
		const refused = await run(other, ["-y", "--admin-path", "/cms"]);
		expect(refused.code).toBe(1);
		expect(refused.text).toContain(
			"The admin is already at /admin (app/(cms)/admin/), and a site has one admin. To move it, move that folder.",
		);
		expect(tree(other)).toEqual(before);

		// A page of the site's own at the address, in whatever group: two pages at one address do not build.
		const taken = site({ "app/(site)/admin/page.tsx": "export default () => <main>Staff</main>;\n" });
		const full = tree(taken);
		const clash = await run(taken, ["-y"]);
		expect(clash.code).toBe(1);
		expect(clash.text).toContain(
			"A page of the site already answers at /admin (app/(site)/admin/page.tsx). Give the admin another address.",
		);
		expect(tree(taken)).toEqual(full);
		expect((await run(taken, ["-y", "--admin-path", "/cms"])).code).toBe(0);
		expect(existsSync(path.join(taken, "app/cms/page.tsx"))).toBe(true);
	});

	it("20-6 package.json keeps its line endings, indentation and byte-order mark: the two scripts are all that is new", async () => {
		const manifest = { name: "my-site", scripts: { dev: "next dev" }, dependencies: { next: "16.4.6" } };
		const windows = `﻿${JSON.stringify(manifest, null, 4).replace(/\n/g, "\r\n")}\r\n`;
		const dir = site({ "package.json": windows });
		expect((await run(dir, ["-y"])).code).toBe(0);
		expect(readFileSync(path.join(dir, "package.json"), "utf8")).toBe(
			`﻿${JSON.stringify(
				{ ...manifest, scripts: { dev: "next dev", "db:setup": "monti db:setup", "db:migrate": "monti db:migrate" } },
				null,
				4,
			).replace(/\n/g, "\r\n")}\r\n`,
		);

		// Written as a formatter leaves it (a short list on one line): every other byte stays.
		const formatted =
			'{\n  "name": "my-site",\n  "files": ["dist"],\n  "scripts": {\n    "dev": "next dev"\n  },\n  "dependencies": { "next": "16.4.6" }\n}\n';
		const short = site({ "package.json": formatted });
		await run(short, ["-y"]);
		expect(readFileSync(path.join(short, "package.json"), "utf8")).toBe(
			formatted.replace(
				'"scripts": {\n',
				'"scripts": {\n    "db:setup": "monti db:setup",\n    "db:migrate": "monti db:migrate",\n',
			),
		);
	});

	it("20-6 a package.json it cannot edit surely is left as it is, checked before anything is written, and the run says which two lines to add", async () => {
		// Not JSON (a comment): the installed packages still say what the site is.
		const odd = '{\n  // the site\n  "name": "my-site",\n  "scripts": { "dev": "next dev" },\n}\n';
		const dir = site({ "package.json": odd });
		const { code, text } = await run(dir, ["-y"]);
		expect(code).toBe(0);
		expect(readFileSync(path.join(dir, "package.json"), "utf8")).toBe(odd);
		expect(existsSync(path.join(dir, "monti.config.ts"))).toBe(true);
		expect(text).not.toContain("package.json: the script");
		expect(text).toContain(
			'What is left:\n  1. Add to the scripts of package.json (it was left as it is): "db:setup": "monti db:setup", "db:migrate": "monti db:migrate"\n  2. Set DATABASE_URL in .env.local to your Postgres database, then make Monti\'s tables: npx monti db:setup',
		);
	});

	it("20-6 a placeholder never hides a value the site has: a name in any of its env files, or in the environment, is not added to .env.local", async () => {
		const dir = site({ ".env.production": "DATABASE_URL=postgres://db.internal/site\n" });
		const { text } = await run(dir, ["-y"], { env: { MONTI_SECRET: "the-secret-the-host-gave-this-site-0123456789" } });
		// .env.local comes before .env.production: a made-up address there would be the one the live site reads.
		expect(existsSync(path.join(dir, ".env.local"))).toBe(false);
		expect(text).not.toContain(".env.local:");

		// An example file names values, it does not hold them.
		const example = site({ ".env.example": "DATABASE_URL=\nMONTI_SECRET=\n" });
		await run(example, ["-y"]);
		expect(readFileSync(path.join(example, ".env.local"), "utf8")).toMatch(
			/^DATABASE_URL=postgres:\/\/localhost\/my_site\nMONTI_SECRET=.{40,}\n$/,
		);
	});

	it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
		"20-7 a write that fails partway ends with one plain line: what was written and what was not; .env.local is its owner's alone and ignored before it is there",
		async () => {
			const dir = site();
			chmodSync(path.join(dir, "app"), 0o555);
			try {
				const { code, text } = await run(dir, ["-y"]);
				expect(code).toBe(1);
				expect(text.split("\n").at(-1)).toBe(
					"Could not write app/admin/page.tsx (no permission to write there). Written: .gitignore, monti.schema.ts, monti.config.ts, lib/monti.ts. Not written: app/admin/page.tsx, app/admin/api/[...path]/route.ts, .env.example, .env.local, package.json. Run monti init again once it can be written: it writes only what is missing.",
				);
				expect(text).not.toContain("    at ");
				expect(text).not.toContain("What is left:");
			} finally {
				chmodSync(path.join(dir, "app"), 0o755);
			}
			// Once it can be written, a second run writes the rest.
			const again = await run(dir, ["-y"]);
			expect(again.code).toBe(0);
			expect(again.text).toContain("Wrote:\n  app/admin/page.tsx");
			expect(statSync(path.join(dir, ".env.local")).mode & 0o777).toBe(0o600);
		},
	);

	it("20-6 in a workspace it finds the packages and the lockfile above the site's folder", async () => {
		const dir = site({ "../../pnpm-lock.yaml": "" }, "apps/web");
		const { code, text } = await run(dir, ["-y"]);
		expect(code).toBe(0);
		expect(text).toContain("Monti for my-site: Next 16.4.6, App Router (app/), pnpm");
		expect(existsSync(path.join(dir, "app/admin/page.tsx"))).toBe(true);
		expect(existsSync(path.join(dir, "node_modules"))).toBe(false);

		// A lockfile above the repository is not the site's.
		const repo = site({ "../../yarn.lock": "", ".git/HEAD": "ref: refs/heads/main\n" }, "code/site");
		expect((await run(repo, ["-y"])).text).toContain("App Router (app/), npm");
	});
});
