import { describe, expect, it } from "vitest";
import type { ContentFolder, DetectedApp } from "../init-detect";
import { collectAnswers, QUESTIONS } from "../init-prompts";
import { scriptedPrompter } from "./init-helpers";

/** The decisions of the question flow that need no app on disk: an app is a value here, as `detectApp` would have returned it. */

const appOf = (contentFolders: readonly ContentFolder[] = []): DetectedApp => ({
	cwd: "/app",
	appDir: "app",
	src: false,
	hasAppRouter: true,
	pagesRouterOnly: false,
	packageManager: "pnpm",
	typescript: true,
	contentFolders,
	devPort: 3000,
	dependencies: new Set(["next", "react"]),
});

/** A content folder whose sibling language folders were merged, as `detectApp` reports `content/ko` and `content/ja`. */
const koJa: ContentFolder = {
	dir: "content",
	files: 2,
	keys: [],
	locales: [
		{ code: "ko", files: 1, unpaired: 1 },
		{ code: "ja", files: 1, unpaired: 1 },
	],
	localesFrom: "folder",
};

const everything = {
	[QUESTIONS.defaultLocale]: "ko",
	[QUESTIONS.otherLocales]: ["en"],
	[QUESTIONS.storage]: "s3",
	[QUESTIONS.extras]: ["ai"],
	[QUESTIONS.blocks]: "pick",
	[QUESTIONS.blockList]: ["callout", "mermaid"],
	[QUESTIONS.adminPath]: "/cms",
	[QUESTIONS.login]: "github",
	[QUESTIONS.directive]: "mdx",
};

describe("the languages of monti init", () => {
	it("INIT-Q3 keeps the other languages found in the content, and still asks for the login when a flag skips the rest", async () => {
		const prompter = scriptedPrompter({
			[QUESTIONS.setup]: "recommended",
			[QUESTIONS.defaultLocale]: "ja",
			[QUESTIONS.login]: "password",
		});
		const answers = await collectAnswers(appOf([koJa]), {}, prompter, () => "UTC");
		expect(answers.locales[0]).toBe("ja");
		expect(new Set(answers.locales)).toEqual(new Set(["ja", "ko"]));
		expect(prompter.asked).not.toContain(QUESTIONS.otherLocales);
	});

	it("INIT-Q3 Other... asks for codes as text, for the default and for the others", async () => {
		const prompter = scriptedPrompter({
			...everything,
			[QUESTIONS.defaultLocale]: "Other...",
			[QUESTIONS.otherLocales]: ["en", "Other..."],
			[QUESTIONS.localesOther]: "pt-BR",
		});
		const answers = await collectAnswers(appOf(), {}, prompter);
		expect(answers.locales).toEqual(["pt-BR", "en"]);
		expect(prompter.asked.filter((message) => message.includes(QUESTIONS.localesOther))).toHaveLength(2);
	});

	it("INIT-Q3 the locale list drops duplicates and keeps the first as the default", async () => {
		const answers = await collectAnswers(appOf(), { locales: "ko,en,ko" });
		expect(answers.locales).toEqual(["ko", "en"]);
	});

	it("INIT-Q3 an explicit --locales wins over the languages found in the content", async () => {
		expect((await collectAnswers(appOf([koJa]), { locales: "en" })).locales).toEqual(["en"]);
		expect((await collectAnswers(appOf([koJa]), {})).locales).toEqual(["ko", "ja"]);
	});
});

describe("the time zone of monti init", () => {
	it("INIT-Q4 the time zone follows this computer, is never asked, and --time-zone wins", async () => {
		const prompter = scriptedPrompter(everything);
		const seoul = await collectAnswers(appOf(), {}, prompter, () => "Asia/Seoul");
		expect(prompter.asked.some((question) => /time ?zone/i.test(question))).toBe(false);
		expect(seoul).toMatchObject({ timeZone: "Asia/Seoul", timeZoneSource: "computer" });
		const flagged = await collectAnswers(appOf(), { timeZone: "Asia/Tokyo" }, undefined, () => "Asia/Seoul");
		expect(flagged).toMatchObject({ timeZone: "Asia/Tokyo", timeZoneSource: "flag" });
	});

	it("INIT-Q4 a computer time zone that is missing or invalid becomes UTC", async () => {
		for (const system of [undefined, "Not/AZone", ""]) {
			const answers = await collectAnswers(appOf(), {}, undefined, () => system);
			expect(answers).toMatchObject({ timeZone: "UTC", timeZoneSource: "fallback" });
		}
	});
});
