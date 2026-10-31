import { describe, expect, it } from "vitest";
import { BLOCK_CHOICES } from "../block-choices";
import { detectApp } from "../init-detect";
import { timeZoneNote } from "../init-plan";
import { collectAnswers, QUESTIONS } from "../init-prompts";
import { fixtureApp, POST_MDX, scriptedPrompter } from "./init-helpers";

/** The question flow with mocked answers: the order, what each answer decides, and what a flag or `--yes` skips. */

const app = () => detectApp(fixtureApp());

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

describe("the recommended setup", () => {
	const other = [
		QUESTIONS.storage,
		QUESTIONS.extras,
		QUESTIONS.blocks,
		QUESTIONS.blockList,
		QUESTIONS.adminPath,
		QUESTIONS.directive,
	];

	it("INIT-Q1 asks the setup question first, then only the default language and the login", async () => {
		const prompter = scriptedPrompter({
			[QUESTIONS.setup]: "recommended",
			[QUESTIONS.defaultLocale]: "ko",
			[QUESTIONS.login]: "github",
		});
		const answers = await collectAnswers(app(), {}, prompter, () => "UTC");
		expect(prompter.asked).toEqual([QUESTIONS.setup, QUESTIONS.defaultLocale, QUESTIONS.login]);
		for (const question of other) expect(prompter.asked).not.toContain(question);
		expect(answers.login).toBe("github");
		expect(answers.locales).toEqual(["ko"]);
	});

	it("INIT-Q1 takes the same defaults as a run without a terminal for everything it does not ask", async () => {
		const prompter = scriptedPrompter({
			[QUESTIONS.setup]: "recommended",
			[QUESTIONS.defaultLocale]: "en",
			[QUESTIONS.login]: "password",
		});
		const recommended = await collectAnswers(app(), {}, prompter, () => "UTC");
		const defaults = await collectAnswers(app(), {}, undefined, () => "UTC");
		expect(recommended).toEqual(defaults);
	});

	it("INIT-Q3 keeps the other languages found in the content, and still asks for the login when a flag skips the rest", async () => {
		const found = detectApp(fixtureApp({ "content/ko/a.mdx": POST_MDX("a"), "content/ja/b.mdx": POST_MDX("b") }));
		const prompter = scriptedPrompter({
			[QUESTIONS.setup]: "recommended",
			[QUESTIONS.defaultLocale]: "ja",
			[QUESTIONS.login]: "password",
		});
		const answers = await collectAnswers(found, {}, prompter, () => "UTC");
		expect(answers.locales[0]).toBe("ja");
		expect(new Set(answers.locales)).toEqual(new Set(["ja", "ko"]));
		expect(prompter.asked).not.toContain(QUESTIONS.otherLocales);
	});

	it("INIT-Q1 is not asked when the flags already settle everything it would decide, and the login is still asked", async () => {
		const prompter = scriptedPrompter({ [QUESTIONS.login]: "password" });
		await collectAnswers(
			app(),
			{ locales: "en", storage: "none", extras: "none", blocks: "none", adminPath: "/studio", directiveSyntax: false },
			prompter,
		);
		expect(prompter.asked).toEqual([QUESTIONS.login]);
	});

	it("INIT-Q2 never picks a login silently: without a flag the login is asked, only a run without a terminal defaults it", async () => {
		const prompter = scriptedPrompter({
			[QUESTIONS.setup]: "recommended",
			[QUESTIONS.defaultLocale]: "en",
			[QUESTIONS.login]: "github",
		});
		expect((await collectAnswers(app(), {}, prompter, () => "UTC")).login).toBe("github");
		expect((await collectAnswers(app(), {}, undefined, () => "UTC")).login).toBe("password");
	});
});

describe("the questions of monti init", () => {
	it("INIT-Q1 asks in the order locales, storage, extras, blocks, admin path, login", async () => {
		const prompter = scriptedPrompter(everything);
		const answers = await collectAnswers(app(), {}, prompter, () => "UTC");
		expect(prompter.asked).toEqual([
			QUESTIONS.setup,
			QUESTIONS.defaultLocale,
			QUESTIONS.otherLocales,
			QUESTIONS.storage,
			QUESTIONS.extras,
			QUESTIONS.blocks,
			QUESTIONS.blockList,
			QUESTIONS.adminPath,
			QUESTIONS.login,
			QUESTIONS.directive,
		]);
		expect(answers).toEqual({
			siteUrl: "http://localhost:3000",
			locales: ["ko", "en"],
			timeZone: "UTC",
			timeZoneSource: "computer",
			storage: "s3",
			ai: true,
			blocks: ["callout", "mermaid"],
			adminPath: "/cms",
			login: "github",
			directiveSyntax: false,
		});
	});

	it("the default is first, the others follow, and none is fine", async () => {
		const many = await collectAnswers(
			app(),
			{},
			scriptedPrompter({ ...everything, [QUESTIONS.defaultLocale]: "en", [QUESTIONS.otherLocales]: ["ko", "ja"] }),
		);
		expect(many.locales).toEqual(["en", "ko", "ja"]);
		const single = await collectAnswers(
			app(),
			{},
			scriptedPrompter({ ...everything, [QUESTIONS.defaultLocale]: "ja", [QUESTIONS.otherLocales]: [] }),
		);
		expect(single.locales).toEqual(["ja"]);
	});

	it("INIT-Q3 Other... asks for codes as text, for the default and for the others", async () => {
		const prompter = scriptedPrompter({
			...everything,
			[QUESTIONS.defaultLocale]: "Other...",
			[QUESTIONS.otherLocales]: ["en", "Other..."],
			[QUESTIONS.localesOther]: "pt-BR",
		});
		const answers = await collectAnswers(app(), {}, prompter);
		expect(answers.locales).toEqual(["pt-BR", "en"]);
		expect(prompter.asked.filter((message) => message.includes(QUESTIONS.localesOther))).toHaveLength(2);
	});

	it("INIT-Q1 the light set is what is offered first, and it leaves out the heavy blocks", async () => {
		const prompter = scriptedPrompter({ ...everything, [QUESTIONS.blocks]: "default" });
		const answers = await collectAnswers(app(), {}, prompter);
		expect(answers.blocks).toEqual(["callout", "collapsible", "tabs", "code-ref", "color"]);
		expect(answers.blocks).not.toContain("mermaid");
		expect(answers.blocks).not.toContain("chart");
	});

	it("INIT-Q2 asks how to sign in with the built-in email and password login first and GitHub second, and has no choice for no login", async () => {
		let offered: readonly { value: string; label: string }[] = [];
		let initial: string | undefined;
		const prompter = scriptedPrompter(everything);
		const select = prompter.select.bind(prompter);
		prompter.select = async (question) => {
			if (question.message === QUESTIONS.login) {
				offered = question.options;
				initial = question.initial;
			}
			return select(question);
		};
		await collectAnswers(app(), {}, prompter);
		expect(prompter.asked).toContain(QUESTIONS.login);
		expect(offered.map((option) => option.value)).toEqual(["password", "github"]);
		// Each choice says what it needs: nothing else for the built-in login, an OAuth app for GitHub.
		expect(offered[0]?.label).toMatch(/password/i);
		expect(offered[1]?.label).toContain("OAuth app");
		expect(initial).toBe("password");
	});

	it("INIT-Q2 --login takes password or github, skips the question, and refuses anything else", async () => {
		const prompter = scriptedPrompter({ [QUESTIONS.extras]: [] });
		const flags = { locales: "en", storage: "none", blocks: "none", adminPath: "/studio", directiveSyntax: false };
		expect((await collectAnswers(app(), { ...flags, login: "github" }, prompter)).login).toBe("github");
		expect(prompter.asked).toEqual([QUESTIONS.setup, QUESTIONS.extras]);
		expect((await collectAnswers(app(), { login: "password" })).login).toBe("password");
		await expect(collectAnswers(app(), { login: "none" })).rejects.toThrow(
			'--login "none" must be "password" or "github"',
		);
	});

	it("a question whose flag is given is not asked", async () => {
		const prompter = scriptedPrompter({ [QUESTIONS.extras]: [] });
		const answers = await collectAnswers(
			app(),
			{
				locales: "ja",
				storage: "none",
				blocks: "none",
				adminPath: "/studio",
				login: "password",
				directiveSyntax: false,
				timeZone: "Asia/Tokyo",
			},
			prompter,
		);
		expect(prompter.asked).toEqual([QUESTIONS.setup, QUESTIONS.extras]);
		expect(answers).toMatchObject({
			locales: ["ja"],
			storage: "none",
			blocks: [],
			timeZone: "Asia/Tokyo",
		});
	});

	it("INIT-Q4 the time zone follows this computer, is never asked, and --time-zone wins", async () => {
		const prompter = scriptedPrompter(everything);
		const seoul = await collectAnswers(app(), {}, prompter, () => "Asia/Seoul");
		expect(prompter.asked.some((question) => /time ?zone/i.test(question))).toBe(false);
		expect(seoul).toMatchObject({ timeZone: "Asia/Seoul", timeZoneSource: "computer" });
		const flagged = await collectAnswers(app(), { timeZone: "Asia/Tokyo" }, undefined, () => "Asia/Seoul");
		expect(flagged).toMatchObject({ timeZone: "Asia/Tokyo", timeZoneSource: "flag" });
	});

	it("INIT-Q4 a computer time zone that is missing or invalid becomes UTC, and says so", async () => {
		for (const system of [undefined, "Not/AZone", ""]) {
			const answers = await collectAnswers(app(), {}, undefined, () => system);
			expect(answers).toMatchObject({ timeZone: "UTC", timeZoneSource: "fallback" });
			expect(timeZoneNote(answers, "monti.schema.ts")).toContain("could not be read");
		}
	});

	it("INIT-Q1 without a prompter every question takes its default", async () => {
		expect(await collectAnswers(app(), {}, undefined, () => "UTC")).toEqual({
			siteUrl: "http://localhost:3000",
			locales: ["en"],
			timeZone: "UTC",
			timeZoneSource: "computer",
			storage: "none",
			ai: false,
			// the light set: no mermaid or chart, which are heavy
			blocks: ["callout", "collapsible", "tabs", "code-ref", "color"],
			adminPath: "/studio",
			login: "password",
			directiveSyntax: true,
		});
	});


	it("INIT-Q3 the locale list drops duplicates and keeps the first as the default", async () => {
		const answers = await collectAnswers(app(), { locales: "ko,en,ko" });
		expect(answers.locales).toEqual(["ko", "en"]);
	});

	it("cancelling at any question rejects", async () => {
		await expect(
			collectAnswers(app(), {}, scriptedPrompter({ ...everything, [QUESTIONS.storage]: "cancel" })),
		).rejects.toThrow("Cancelled. Nothing was written.");
	});
});
