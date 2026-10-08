import { describe, expect, it } from "vitest";
import { initProject } from "../init";
import { detectApp } from "../init-detect";
import { allowEsbuildBuild } from "../init-edits";
import { localesFromFileNames } from "../locale-names";
import { fakeHost, fixtureApp, POST_MDX, read, scriptedPrompter } from "./init-helpers";

const quiet = () => ({ host: fakeHost(), env: {}, install: false });

describe("languages found in the content files", () => {
	it("reads suffixes like hello.ko.mdx, and puts first the language whose files have no pair", () => {
		const found = localesFromFileNames(["hello.en.mdx", "hello.ko.mdx", "about.ko.mdx", "tips.ko.mdx"]);
		expect(found?.map((locale) => locale.code)).toEqual(["ko", "en"]);
		expect(found?.[0]).toMatchObject({ files: 3, unpaired: 2 });
		expect(found?.[1]).toMatchObject({ files: 1, unpaired: 0 });
	});

	it("takes the first language when every file has a pair", () => {
		expect(localesFromFileNames(["a.en.md", "a.ko.md", "b.en.md", "b.ko.md"])?.map((l) => l.code)).toEqual([
			"en",
			"ko",
		]);
	});

	it("does not take a name for a language", () => {
		expect(localesFromFileNames(["release.notes.md", "api.min.md", "a.md"])).toBeUndefined();
		// one file alone is more likely a name
		expect(localesFromFileNames(["notes.it.md", "a.md"])).toBeUndefined();
	});

	it("a file with no suffix next to a suffixed one counts as its pair", () => {
		const found = localesFromFileNames(["hello.mdx", "hello.ko.mdx", "bye.ko.mdx", "only.ko.mdx"]);
		expect(found?.[0]).toMatchObject({ code: "ko", files: 3, unpaired: 2 });
	});

	it("detectApp reports suffix languages of a content folder", () => {
		const app = detectApp(
			fixtureApp({
				"content/posts/hello.en.mdx": POST_MDX("hello"),
				"content/posts/hello.ko.mdx": POST_MDX("hello"),
				"content/posts/about.ko.mdx": POST_MDX("about"),
			}),
		);
		const folder = app.contentFolders[0];
		expect(folder?.dir).toBe("content/posts");
		expect(folder?.localesFrom).toBe("filename");
		expect(folder?.locales?.map((locale) => locale.code)).toEqual(["ko", "en"]);
	});

	it("detectApp merges sibling language folders into one set of posts", () => {
		const app = detectApp(
			fixtureApp({
				"content/en/hello.mdx": POST_MDX("hello"),
				"content/ko/hello.mdx": POST_MDX("hello"),
				"content/ko/about.mdx": POST_MDX("about"),
			}),
		);
		expect(app.contentFolders).toHaveLength(1);
		const folder = app.contentFolders[0];
		expect(folder).toMatchObject({ dir: "content", files: 3, localesFrom: "folder" });
		expect(folder?.locales?.map((locale) => locale.code)).toEqual(["ko", "en"]);
	});

	it("a single folder named like a language is left alone", () => {
		const app = detectApp(fixtureApp({ "content/it/pasta.mdx": POST_MDX("pasta") }));
		expect(app.contentFolders.map((folder) => [folder.dir, folder.locales])).toEqual([["content/it", undefined]]);
	});
});

describe("monti init and the languages of the content", () => {
	const PAIR = {
		"content/posts/hello.en.mdx": POST_MDX("hello"),
		"content/posts/hello.ko.mdx": POST_MDX("hello"),
		"content/posts/about.ko.mdx": POST_MDX("about"),
	};

	it("with --yes (no prompts) the site languages are the ones found, the default being the unpaired one", async () => {
		const dir = fixtureApp(PAIR);
		const report = await initProject({ cwd: dir, ...quiet() });
		const schema = JSON.parse(read(dir, "monti.schema.json"));
		expect(schema.locales.map((locale: { code: string }) => locale.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toMatch(/languages are ko, en, found in the file names of content\/posts\//);
	});

	it("offers them in the question, and the person can change them", async () => {
		const dir = fixtureApp(PAIR);
		const prompter = scriptedPrompter({
			"Languages of the site": "ko,en,ja",
			"Add withCms": true,
			"Add .env.local": true,
		});
		const report = await initProject({
			cwd: dir,
			prompter,
			...quiet(),
			database: "skip",
			databaseSchema: "",
			adminGithubId: "1",
			siteUrl: "http://localhost:3000",
			timeZone: "UTC",
			storage: "none",
			extras: "none",
			blocks: "none",
			adminPath: "/studio",
			blogTheme: false,
		});
		expect(prompter.asked.find((question) => question.includes("Languages of the site"))).toMatch(
			/Found ko, en in the file names of content\/posts\//,
		);
		expect(report.answers.locales).toEqual(["ko", "en", "ja"]);
		expect(report.notes.join("\n")).toMatch(
			/found in the file names of content\/posts\/, but the site languages are ko, en, ja/,
		);
	});

	it("an explicit --locales wins, and the report says what the files would have given", async () => {
		const dir = fixtureApp(PAIR);
		const report = await initProject({ cwd: dir, ...quiet(), locales: "en" });
		expect(report.answers.locales).toEqual(["en"]);
		expect(report.notes.join("\n")).toMatch(
			/ko, en found in the file names.*site languages are en.*skipped by `monti import`/,
		);
	});

	it("language folders give the languages too", async () => {
		const dir = fixtureApp({
			"content/en/hello.mdx": POST_MDX("hello"),
			"content/ko/hello.mdx": POST_MDX("hello"),
			"content/ko/about.mdx": POST_MDX("about"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toContain("found in the folders of content/");
	});

	it("an app with one language keeps en", async () => {
		const dir = fixtureApp({ "content/posts/a.mdx": POST_MDX("a"), "content/posts/b.mdx": POST_MDX("b") });
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.answers.locales).toEqual(["en"]);
	});
});

describe("allowEsbuildBuild", () => {
	it("writes the lines for a missing or empty file", () => {
		expect(allowEsbuildBuild(undefined)).toBe("allowBuilds:\n  esbuild: true\n");
		expect(allowEsbuildBuild("")).toBe("allowBuilds:\n  esbuild: true\n");
	});

	it("appends the block to a file that has none, whatever its last line", () => {
		expect(allowEsbuildBuild("packages:\n  - a")).toBe("packages:\n  - a\nallowBuilds:\n  esbuild: true\n");
		expect(allowEsbuildBuild("packages: []\n")).toBe("packages: []\nallowBuilds:\n  esbuild: true\n");
	});

	it("replaces pnpm's placeholder in place, keeping the indentation and the neighbours", () => {
		expect(
			allowEsbuildBuild("allowBuilds:\n    sharp: true\n    esbuild: set this to true or false\n    x: false\n"),
		).toBe("allowBuilds:\n    sharp: true\n    esbuild: true\n    x: false\n");
		expect(allowEsbuildBuild('allowBuilds:\n  "esbuild": "set this to true or false"\n')).toBe(
			'allowBuilds:\n  "esbuild": true\n',
		);
	});

	it("inserts esbuild into an allowBuilds that lacks it, with the indentation of its children", () => {
		expect(allowEsbuildBuild("allowBuilds:\n    sharp: true\nother: 1\n")).toBe(
			"allowBuilds:\n    esbuild: true\n    sharp: true\nother: 1\n",
		);
		expect(allowEsbuildBuild("allowBuilds:\nother: 1\n")).toBe("allowBuilds:\n  esbuild: true\nother: 1\n");
		expect(allowEsbuildBuild("allowBuilds: {}\n")).toBe("allowBuilds:\n  esbuild: true\n");
	});

	it("leaves true and false alone", () => {
		expect(allowEsbuildBuild("allowBuilds:\n  esbuild: true\n")).toBe("ok");
		expect(allowEsbuildBuild("allowBuilds:\n  esbuild: false # no\n")).toBe("ok");
		expect(allowEsbuildBuild("allowBuilds: { esbuild: true }\n")).toBe("ok");
	});

	it("gives up on a shape it would have to guess at", () => {
		expect(allowEsbuildBuild("allowBuilds: { sharp: true }\n")).toBeUndefined();
		expect(allowEsbuildBuild("allowBuilds: *anchor\n")).toBeUndefined();
	});

	it("keeps Windows line endings", () => {
		expect(allowEsbuildBuild("packages: []\r\nallowBuilds:\r\n  sharp: true\r\n")).toBe(
			"packages: []\r\nallowBuilds:\r\n  esbuild: true\r\n  sharp: true\r\n",
		);
	});

	it("the result is stable: running it on its own output changes nothing", () => {
		for (const input of [
			undefined,
			"packages: []\n",
			"allowBuilds:\n  esbuild: set this to true or false\n",
			"allowBuilds: {}\n",
		]) {
			const once = allowEsbuildBuild(input);
			expect(typeof once).toBe("string");
			expect(allowEsbuildBuild(once as string)).toBe("ok");
		}
	});
});
