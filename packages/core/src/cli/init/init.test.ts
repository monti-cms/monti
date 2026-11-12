import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** A Next app as create-next-app leaves it, with Monti's three packages installed; `files` adds, changes or (with `null`) takes away. */
function site(files: Record<string, string | null> = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-init-"));
	made.push(dir);
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
	for (const [file, text] of Object.entries(all)) {
		if (text === null) continue;
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), text);
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
		const edited = "// mine: do not touch\nexport default {};\n";
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
});
