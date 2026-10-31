import { describe, expect, it } from "vitest";
import { initProject } from "../init";
import { fakeHost, fixtureApp, POST_MDX, schemaOf } from "./init-helpers";

const quiet = () => ({ host: fakeHost(), install: false });

describe("monti init and the languages of the content", () => {
	const PAIR = {
		"content/posts/hello.en.mdx": POST_MDX("hello"),
		"content/posts/hello.ko.mdx": POST_MDX("hello"),
		"content/posts/about.ko.mdx": POST_MDX("about"),
	};

	it("INIT-Q3 with --yes (no prompts) the site languages are the ones found, the default being the unpaired one", async () => {
		const dir = fixtureApp(PAIR);
		const report = await initProject({ cwd: dir, ...quiet() });
		const schema = schemaOf(dir);
		expect(schema.locales.map((locale: { code: string }) => locale.code)).toEqual(["ko", "en"]);
		expect(schema.defaultLocale).toBe("ko");
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toMatch(/languages are ko, en, found in the file names of content\/posts\//);
	});

	it("INIT-Q3 language folders give the languages too", async () => {
		const dir = fixtureApp({
			"content/en/hello.mdx": POST_MDX("hello"),
			"content/ko/hello.mdx": POST_MDX("hello"),
			"content/ko/about.mdx": POST_MDX("about"),
		});
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.answers.locales).toEqual(["ko", "en"]);
		expect(report.notes.join("\n")).toContain("found in the folders of content/");
	});
});
