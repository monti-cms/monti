import { describe, expect, it } from "vitest";
import { detectApp } from "../init-detect";
import { collectAnswers, QUESTIONS } from "../init-prompts";
import { fixtureApp, scriptedPrompter } from "./init-helpers";

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
});
