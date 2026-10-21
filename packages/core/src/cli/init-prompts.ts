import { isAdminPath, isHttpUrl, isTimeZone, LOCALE_CODE } from "../config/rules";
import { BLOCK_CHOICES, DEFAULT_BLOCK_IDS } from "./block-choices";
import { DEFAULT_INIT_ADMIN_PATH, DEFAULT_INIT_LOCALE, DEFAULT_INIT_TIME_ZONE, type InitAnswers } from "./init-answers";
import type { DetectedApp } from "./init-detect";
import { COMMON_LOCALES, languageLabel } from "./locale-names";
import type { Prompter } from "./prompt";

/**
 * The questions of `monti init`. Each one has a flag; a question whose flag is given is not asked, and without a terminal (or with `--yes`) every unanswered
 * question takes its default. The prompt library sits behind {@link Prompter}, so the flow is tested with scripted answers and the library is only loaded
 * when a person is at the terminal.
 */

/** The raw flag values (strings as typed). `undefined` means the flag was not given. */
export interface InitAnswerFlags {
	readonly siteUrl?: string;
	/** Comma-separated locale codes, the default first. */
	readonly locales?: string;
	readonly timeZone?: string;
	/** `s3` or `none`. */
	readonly storage?: string;
	/** Comma-separated: `ai`, `git-sync`, or `none`. */
	readonly extras?: string;
	/** `all`, `none`, `default` (the light set) or comma-separated block names. */
	readonly blocks?: string;
	readonly adminPath?: string;
	/** `password` or `github`. */
	readonly login?: string;
	/** `--directive-syntax` (true) or `--no-directive-syntax` (false): write blocks as `:::callout` (the directive syntax), without asking. */
	readonly directiveSyntax?: boolean;
}

/** The time zone of this computer (what the OS says, as an IANA name), or `undefined` when it cannot be read. */
export const detectSystemTimeZone = (): string | undefined => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
	} catch {
		return undefined;
	}
};

const splitList = (value: string): string[] => value.split(/[\s,]+/).filter(Boolean);
const BLOCK_IDS = BLOCK_CHOICES.map((block) => block.id);
const EXTRAS = ["ai", "git-sync"] as const;

/** Every validator returns the error text, or `undefined` when the value is fine. The same text is used for a flag and for a prompt. */
const check = {
	siteUrl: (value: string) => (isHttpUrl(value) ? undefined : "must be an http(s) URL like http://localhost:3000"),
	locales: (value: string) => {
		const codes = splitList(value);
		if (codes.length === 0) return 'name at least one language code, the default first, for example "en,ko"';
		const bad = codes.find((code) => !LOCALE_CODE.test(code));
		return bad ? `"${bad}" must be a language code like "en", "ko" or "pt-BR"` : undefined;
	},
	timeZone: (value: string) => (isTimeZone(value) ? undefined : 'must be an IANA time zone like "UTC" or "Asia/Seoul"'),
	storage: (value: string) => (["s3", "none"].includes(value) ? undefined : 'must be "s3" or "none"'),
	extras: (value: string) => {
		const bad = splitList(value).find((name) => name !== "none" && !(EXTRAS as readonly string[]).includes(name));
		return bad ? `"${bad}" is not an extra; use ${EXTRAS.join(", ")} or none` : undefined;
	},
	blocks: (value: string) => {
		const bad = splitList(value).find((name) => !["all", "none", "default", ...BLOCK_IDS].includes(name));
		return bad ? `"${bad}" is not a block; use default, all, none or any of ${BLOCK_IDS.join(", ")}` : undefined;
	},
	login: (value: string) => (["password", "github"].includes(value) ? undefined : 'must be "password" or "github"'),
	adminPath: (value: string) =>
		isAdminPath(value)
			? undefined
			: 'must be a path like "/studio" (letters, digits, - and _; not "/" and not under "/api")',
};

/** Fails with the flag's name when its value is wrong. */
function checked(flag: string, value: string | undefined, validate: (value: string) => string | undefined): void {
	const problem = value === undefined ? undefined : validate(value);
	if (problem) throw new Error(problem.startsWith('"') ? `--${flag}: ${problem}` : `--${flag} "${value}" ${problem}`);
}

const parseBlocks = (value: string): string[] => {
	const names = splitList(value);
	if (names.includes("all")) return [...BLOCK_IDS];
	if (names.includes("default")) return BLOCK_IDS.filter((id) => DEFAULT_BLOCK_IDS.includes(id) || names.includes(id));
	if (names.includes("none")) return [];
	return BLOCK_IDS.filter((id) => names.includes(id));
};

/** Checks every flag that was given, before anything is asked. */
export function validateFlags(flags: InitAnswerFlags): void {
	checked("site-url", flags.siteUrl, check.siteUrl);
	checked("locales", flags.locales, check.locales);
	checked("time-zone", flags.timeZone, check.timeZone);
	checked("storage", flags.storage, check.storage);
	checked("extras", flags.extras, check.extras);
	checked("blocks", flags.blocks, check.blocks);
	checked("admin-path", flags.adminPath, check.adminPath);
	checked("login", flags.login, check.login);
}

/** What the questions ask, for the tests and the docs. */
export const QUESTIONS = {
	setup: "How do you want to set up Monti?",
	setupNow: "Set up .env.local, the secret and the database now?",
	defaultLocale: "Default language of the site",
	otherLocales: "Other languages (optional)",
	localesOther: "Language code (or several, comma-separated, like pt-BR or sv)",
	storage: "Where should uploaded images go?",
	extras: "Extra features",
	blocks: "Which body blocks do you want?",
	blockList: "Pick the blocks",
	adminPath: "Where should the admin live?",
	login: "How should people sign in to the admin?",
	directive: "How are blocks written in Markdown?",
} as const;

/** The languages found in the names of the content files (`hello.ko.mdx`) or in language folders (`ko/`), default first, and where they were found. */
export function detectedLocales(
	app: DetectedApp,
): { codes: string[]; dir: string; from: "filename" | "folder" } | undefined {
	const folder = app.contentFolders.find((entry) => entry.locales !== undefined && entry.locales.length > 0);
	if (!folder?.locales || !folder.localesFrom) return undefined;
	return { codes: folder.locales.map((locale) => locale.code), dir: folder.dir, from: folder.localesFrom };
}

/** The "Other..." entry of the language picker. It is not a language code (it has no valid one's shape), so it cannot collide with one. */
const OTHER_LOCALES = "Other...";

/** Asks for the default language, then (unless `asksOthers` is false) the others; the default is first in the result. */
async function askLocales(
	prompter: Prompter,
	found: ReturnType<typeof detectedLocales>,
	asksOthers: boolean,
): Promise<string[]> {
	const detected = found?.codes ?? [];
	const known = new Set(COMMON_LOCALES.map((locale) => locale.code));
	const label = (code: string) => `${languageLabel(code)} (${code})`;
	const languages = [...COMMON_LOCALES.map((locale) => locale.code), ...detected.filter((code) => !known.has(code))];
	const other = { value: OTHER_LOCALES, label: "Other...", hint: "type a language code" };
	const askCodes = async (message: string) =>
		splitList(await prompter.text({ message, validate: (value) => check.locales(value) }));

	const foundNote = found
		? ` (found ${found.codes.join(", ")} in the ${found.from === "filename" ? "file names" : "folders"} of ${found.dir}/)`
		: "";
	const first = await prompter.select({
		message: `${QUESTIONS.defaultLocale}${foundNote}`,
		options: [...languages.map((code) => ({ value: code, label: label(code) })), other],
		initial: detected[0] ?? DEFAULT_INIT_LOCALE,
	});
	const defaultLocale =
		first === OTHER_LOCALES ? ((await askCodes(QUESTIONS.localesOther))[0] ?? DEFAULT_INIT_LOCALE) : first;

	// The recommended setup asks the default language only; the other languages found in the content stay.
	if (!asksOthers) return [...new Set([defaultLocale, ...detected])];

	const remaining = languages.filter((code) => code !== defaultLocale);
	const more = await prompter.multiselect({
		message: QUESTIONS.otherLocales,
		options: [...remaining.map((code) => ({ value: code, label: label(code) })), other],
		initial: detected.filter((code) => code !== defaultLocale),
	});
	const typed = more.includes(OTHER_LOCALES) ? await askCodes(QUESTIONS.localesOther) : [];
	return [...new Set([defaultLocale, ...more.filter((code) => code !== OTHER_LOCALES), ...typed])];
}

/**
 * Settles every question: from its flag when given, by asking when `prompter` is there, else with the default. Throws {@link Cancelled} when the
 * person cancels, and an Error naming the flag when a flag value is wrong.
 */
export async function collectAnswers(
	app: DetectedApp,
	flags: InitAnswerFlags,
	prompter?: Prompter,
	systemTimeZone: () => string | undefined = detectSystemTimeZone,
): Promise<InitAnswers> {
	validateFlags(flags);
	const siteUrl = flags.siteUrl ?? `http://localhost:${app.devPort}`;

	// The first question: the recommended setup asks the default language and the login, and takes the default for everything else.
	// With the flags of all of those given there is nothing left for it to decide, so it is not asked.
	const decides = [flags.storage, flags.extras, flags.blocks, flags.adminPath, flags.directiveSyntax];
	const recommended =
		prompter !== undefined &&
		decides.some((value) => value === undefined) &&
		(await prompter.select<"recommended" | "custom">({
			message: QUESTIONS.setup,
			options: [
				{
					value: "recommended",
					label: "Recommended setup",
					hint: "asks only the default language and how to sign in",
				},
				{
					value: "custom",
					label: "Choose each option",
					hint: "languages, storage, features, blocks, admin path, syntax",
				},
			],
			initial: "recommended",
		})) === "recommended";
	// A question is asked only when a person is there, did not give its flag, and chose to be asked.
	const asking = recommended ? undefined : prompter;

	// Locales, the default first
	let locales: string[];
	const foundLocales = detectedLocales(app);
	if (flags.locales !== undefined) locales = splitList(flags.locales);
	else if (prompter) locales = await askLocales(prompter, foundLocales, !recommended);
	else locales = foundLocales ? foundLocales.codes : [DEFAULT_INIT_LOCALE];
	locales = [...new Set(locales)];

	// Image storage
	const storage =
		flags.storage !== undefined
			? (flags.storage as "s3" | "none")
			: asking
				? await asking.select({
						message: QUESTIONS.storage,
						options: [
							{ value: "none", label: "Nowhere yet", hint: "the media menu stays hidden" },
							{ value: "s3", label: "S3-compatible storage", hint: "AWS S3, Cloudflare R2, MinIO" },
						],
						initial: "none",
					})
				: "none";

	// Extras (Bareun is not offered)
	let extras: string[];
	if (flags.extras !== undefined) extras = splitList(flags.extras);
	else if (asking) {
		extras = await asking.multiselect({
			message: QUESTIONS.extras,
			options: [
				{ value: "ai", label: "AI writing", hint: "polish, draft and translate buttons" },
				{ value: "git-sync", label: "Git sync", hint: "sync published entries with files in a GitHub repo" },
			],
			initial: [],
		});
	} else extras = [];

	// Blocks
	let blocks: string[];
	if (flags.blocks !== undefined) blocks = parseBlocks(flags.blocks);
	else if (asking) {
		const heavy = BLOCK_CHOICES.filter((block) => block.heavy);
		const mode = await asking.select({
			message: QUESTIONS.blocks,
			options: [
				{
					value: "default",
					label: "The light set",
					hint: `${DEFAULT_BLOCK_IDS.join(", ")}; the rest is one line away in monti.config.ts`,
				},
				{
					value: "all",
					label: "All of them",
					hint: `adds ${heavy.map((block) => block.id).join(" and ")}, which are heavy`,
				},
				{ value: "pick", label: "Let me pick" },
			],
			initial: "default",
		});
		blocks =
			mode === "default"
				? BLOCK_IDS.filter((id) => DEFAULT_BLOCK_IDS.includes(id))
				: mode === "all"
					? [...BLOCK_IDS]
					: await asking.multiselect({
							message: QUESTIONS.blockList,
							options: BLOCK_CHOICES.map((block) => ({
								value: block.id,
								label: block.id,
								hint: block.heavy ? `${block.description}. Heavy: ${block.heavy}` : block.description,
							})),
							initial: BLOCK_IDS.filter((id) => DEFAULT_BLOCK_IDS.includes(id)),
						});
	} else blocks = BLOCK_IDS.filter((id) => DEFAULT_BLOCK_IDS.includes(id));

	// Admin path
	const adminPath =
		flags.adminPath ??
		(asking
			? (
					await asking.text({
						message: QUESTIONS.adminPath,
						initial: DEFAULT_INIT_ADMIN_PATH,
						validate: (value) => check.adminPath(value.trim()),
					})
				).trim()
			: DEFAULT_INIT_ADMIN_PATH);

	// Login. There is no "none" choice: a config without a login is only what a hand-written config can be.
	const login =
		flags.login !== undefined
			? (flags.login as "password" | "github")
			: prompter
				? await prompter.select<"password" | "github">({
						message: QUESTIONS.login,
						options: [
							{ value: "password", label: "Email and password (built in, no other service needed)" },
							{ value: "github", label: "GitHub (needs a GitHub OAuth app)" },
						],
						initial: "password",
					})
				: "password";

	// Directive syntax (`:::callout`): the default follows the blocks that get installed (a callout or tabs is written as a ::: block), so a site without blocks stays plain MDX.
	const blocksInstalled = blocks.filter((id) => BLOCK_IDS.includes(id)).length > 0;
	const directiveSyntax =
		flags.directiveSyntax ??
		(asking
			? (await asking.select<"directive" | "mdx">({
					message: QUESTIONS.directive,
					options: [
						{ value: "directive", label: "With ::: blocks, e.g. :::callout (directive syntax)" },
						{ value: "mdx", label: "Plain MDX only" },
					],
					initial: blocksInstalled ? "directive" : "mdx",
				})) === "directive"
			: blocksInstalled);

	return {
		siteUrl,
		locales,
		...resolveTimeZone(flags.timeZone, systemTimeZone),
		storage,
		ai: extras.includes("ai"),
		gitSync: extras.includes("git-sync"),
		blocks: blocks.filter((id) => BLOCK_IDS.includes(id)),
		adminPath,
		login,
		directiveSyntax,
	};
}

/** `--time-zone` wins; else this computer's time zone; else UTC when that cannot be read or is not an IANA name. */
function resolveTimeZone(
	flag: string | undefined,
	systemTimeZone: () => string | undefined,
): Pick<InitAnswers, "timeZone" | "timeZoneSource"> {
	if (flag !== undefined) return { timeZone: flag, timeZoneSource: "flag" };
	const system = systemTimeZone();
	return system !== undefined && isTimeZone(system)
		? { timeZone: system, timeZoneSource: "computer" }
		: { timeZone: DEFAULT_INIT_TIME_ZONE, timeZoneSource: "fallback" };
}
