import { describe, expect, it } from "vitest";
import { detectApp } from "../init-detect";
import { collectAnswers, QUESTIONS } from "../init-prompts";
import { fixtureApp, scriptedPrompter } from "./init-helpers";

/** The question flow with mocked answers: the order, what each answer decides, and what a flag or `--yes` skips. */

const app = () => detectApp(fixtureApp());

const everything = {
	[QUESTIONS.database]: "url",
	"Postgres URL": "postgres://me:pw@db.example.com:5432/blog",
	[QUESTIONS.databaseSchema]: "blog",
	[QUESTIONS.adminGithubId]: "583231",
	[QUESTIONS.locales]: "ko, en",
	[QUESTIONS.storage]: "s3",
	[QUESTIONS.extras]: ["ai", "git-sync"],
	[QUESTIONS.blocks]: "pick",
	[QUESTIONS.blockList]: ["callout", "mermaid"],
	[QUESTIONS.adminPath]: "/cms",
};

describe("the questions of monti init", () => {
	it("asks in the order database, schema, login, locales, storage, extras, blocks, admin path", async () => {
		const prompter = scriptedPrompter(everything);
		const answers = await collectAnswers(app(), {}, prompter);
		expect(prompter.asked).toEqual([
			QUESTIONS.database,
			"Postgres URL",
			QUESTIONS.databaseSchema,
			QUESTIONS.adminGithubId,
			QUESTIONS.locales,
			QUESTIONS.storage,
			QUESTIONS.extras,
			QUESTIONS.blocks,
			QUESTIONS.blockList,
			QUESTIONS.adminPath,
		]);
		expect(answers).toEqual({
			database: { kind: "url", url: "postgres://me:pw@db.example.com:5432/blog" },
			databaseSchema: "blog",
			adminGithubId: "583231",
			siteUrl: "http://localhost:3000",
			locales: ["ko", "en"],
			timeZone: "UTC",
			storage: "s3",
			ai: true,
			gitSync: true,
			blocks: ["callout", "mermaid"],
			adminPath: "/cms",
		});
	});

	it("explains the GitHub OAuth app with the exact callback URL before asking for the id", async () => {
		const prompter = scriptedPrompter(everything);
		await collectAnswers(app(), { siteUrl: "https://blog.example.com" }, prompter);
		const note = prompter.notes.find((entry) => entry.title === QUESTIONS.adminLogin);
		expect(note?.body).toContain("https://github.com/settings/developers");
		expect(note?.body).toContain("Authorization callback URL: https://blog.example.com/api/cms/auth/callback/github");
		expect(note?.body).toContain("AUTH_GITHUB_ID");
		expect(note?.body).toContain("AUTH_GITHUB_SECRET");
		expect(note?.body).toContain("MONTI_ADMIN_GITHUB_ID");
	});

	it("the offered extras are AI and git-sync; Bareun is not offered", async () => {
		const offered: string[] = [];
		const prompter = scriptedPrompter(everything);
		const multiselect = prompter.multiselect.bind(prompter);
		prompter.multiselect = async (question) => {
			offered.push(...question.options.map((option) => option.value));
			return multiselect(question);
		};
		await collectAnswers(app(), {}, prompter);
		expect(offered.filter((value) => ["ai", "git-sync", "bareun"].includes(value))).toEqual(["ai", "git-sync"]);
		expect(offered).toContain("callout");
		expect(offered).not.toContain("bareun");
	});

	it("lists every block with a one-line description when picking", async () => {
		let options: readonly { value: string; hint?: string }[] = [];
		const prompter = scriptedPrompter(everything);
		const multiselect = prompter.multiselect.bind(prompter);
		prompter.multiselect = async (question) => {
			if (question.message === QUESTIONS.blockList) options = question.options;
			return multiselect(question);
		};
		await collectAnswers(app(), {}, prompter);
		expect(options.map((option) => option.value)).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"code-explorer",
			"mermaid",
			"chart",
			"tooltip",
			"code-ref",
			"color",
		]);
		for (const option of options) {
			expect(option.hint).toBeTruthy();
			expect(option.hint).not.toContain("\n");
		}
	});

	it("choosing all blocks does not open the list", async () => {
		const prompter = scriptedPrompter({ ...everything, [QUESTIONS.blocks]: "all" });
		const answers = await collectAnswers(app(), {}, prompter);
		expect(prompter.asked).not.toContain(QUESTIONS.blockList);
		expect(answers.blocks).toHaveLength(10);
	});

	it("the light set is what is offered first, and it leaves out the heavy blocks", async () => {
		const prompter = scriptedPrompter({ ...everything, [QUESTIONS.blocks]: "default" });
		const answers = await collectAnswers(app(), {}, prompter);
		expect(answers.blocks).toEqual(["callout", "collapsible", "tabs", "code-ref", "color"]);
		expect(answers.blocks).not.toContain("mermaid");
		expect(answers.blocks).not.toContain("chart");
	});

	it("the heavy blocks say why they are heavy in the list", async () => {
		let options: readonly { value: string; hint?: string }[] = [];
		const prompter = scriptedPrompter(everything);
		const multiselect = prompter.multiselect.bind(prompter);
		prompter.multiselect = async (question) => {
			if (question.message === QUESTIONS.blockList) options = question.options;
			return multiselect(question);
		};
		await collectAnswers(app(), {}, prompter);
		expect(options.find((option) => option.value === "mermaid")?.hint).toMatch(/Heavy: .*MB/);
		expect(options.find((option) => option.value === "chart")?.hint).toMatch(/Heavy: .*recharts/);
		expect(options.find((option) => option.value === "callout")?.hint).not.toMatch(/Heavy/);
	});

	it("--database-schema skips the question, and a wrong name is refused", async () => {
		const prompter = scriptedPrompter(everything);
		const answers = await collectAnswers(app(), { databaseSchema: "preview" }, prompter);
		expect(prompter.asked).not.toContain(QUESTIONS.databaseSchema);
		expect(answers.databaseSchema).toBe("preview");
		await expect(collectAnswers(app(), { databaseSchema: "my-schema" })).rejects.toThrow(/--database-schema/);
	});

	it("the database question offers a URL or skip, and nothing else", async () => {
		let offered: string[] = [];
		const prompter = scriptedPrompter(everything);
		const select = prompter.select.bind(prompter);
		prompter.select = async (question) => {
			if (question.message === QUESTIONS.database) offered = question.options.map((option) => option.value);
			return select(question);
		};
		await collectAnswers(app(), {}, prompter);
		expect(offered).toEqual(["url", "skip"]);
	});

	it("skip needs no URL, and a docker flag is refused", async () => {
		const skip = scriptedPrompter({ ...everything, [QUESTIONS.database]: "skip" });
		expect((await collectAnswers(app(), {}, skip)).database).toEqual({ kind: "skip" });
		expect(skip.asked).not.toContain("Postgres URL");
		await expect(collectAnswers(app(), { database: "docker" })).rejects.toThrow(/--database/);
	});

	it("an empty GitHub id is allowed (filled in later); a wrong one is refused", async () => {
		const empty = await collectAnswers(app(), {}, scriptedPrompter({ ...everything, [QUESTIONS.adminGithubId]: "  " }));
		expect(empty.adminGithubId).toBeUndefined();
		await expect(
			collectAnswers(app(), {}, scriptedPrompter({ ...everything, [QUESTIONS.adminGithubId]: "octocat" })),
		).rejects.toThrow(/numeric GitHub id/);
	});

	it("a question whose flag is given is not asked", async () => {
		const prompter = scriptedPrompter({ [QUESTIONS.adminGithubId]: "", [QUESTIONS.extras]: [] });
		const answers = await collectAnswers(
			app(),
			{
				database: "skip",
				databaseSchema: "",
				locales: "ja",
				storage: "none",
				blocks: "none",
				adminPath: "/studio",
				timeZone: "Asia/Tokyo",
			},
			prompter,
		);
		expect(prompter.asked).toEqual([QUESTIONS.adminGithubId, QUESTIONS.extras]);
		expect(answers).toMatchObject({
			locales: ["ja"],
			storage: "none",
			blocks: [],
			timeZone: "Asia/Tokyo",
		});
	});

	it("without a prompter every question takes its default", async () => {
		expect(await collectAnswers(app(), {})).toEqual({
			database: { kind: "skip" },
			adminGithubId: undefined,
			siteUrl: "http://localhost:3000",
			locales: ["en"],
			timeZone: "UTC",
			storage: "none",
			ai: false,
			gitSync: false,
			// the light set: no mermaid or chart, which are heavy
			blocks: ["callout", "collapsible", "tabs", "code-ref", "color"],
			adminPath: "/studio",
		});
	});

	it("the locale list drops duplicates and keeps the first as the default", async () => {
		const answers = await collectAnswers(app(), { locales: "ko,en,ko" });
		expect(answers.locales).toEqual(["ko", "en"]);
	});

	it("cancelling at any question rejects", async () => {
		await expect(
			collectAnswers(app(), {}, scriptedPrompter({ ...everything, [QUESTIONS.storage]: "cancel" })),
		).rejects.toThrow("Cancelled. Nothing was written.");
	});
});
