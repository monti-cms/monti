import { isAdminPath } from "../config/define";
import type { DetectedApp } from "./init-detect";
import {
	BLOCK_CHOICES,
	DEFAULT_BLOCK_IDS,
	DEFAULT_INIT_ADMIN_PATH,
	DEFAULT_INIT_LOCALE,
	DEFAULT_INIT_TIME_ZONE,
	githubCallbackUrl,
	type InitAnswers,
} from "./templates";

/**
 * The questions of `monti init`. Each one has a flag; a question whose flag is given is not asked, and without a terminal (or with `--yes`) every unanswered
 * question takes its default. The prompt library sits behind {@link Prompter}, so the flow is tested with scripted answers and the library is only loaded
 * when a person is at the terminal.
 */

/** The prompts the flow uses. */
export interface Prompter {
	intro(message: string): void;
	outro(message: string): void;
	/** A framed block of text (instructions, values to copy). */
	note(body: string, title?: string): void;
	select<T extends string>(question: {
		message: string;
		options: readonly { value: T; label: string; hint?: string }[];
		initial?: T;
	}): Promise<T>;
	multiselect<T extends string>(question: {
		message: string;
		options: readonly { value: T; label: string; hint?: string }[];
		initial?: readonly T[];
	}): Promise<T[]>;
	text(question: {
		message: string;
		placeholder?: string;
		initial?: string;
		validate?: (value: string) => string | undefined;
	}): Promise<string>;
	confirm(question: { message: string; initial?: boolean }): Promise<boolean>;
}

/** Thrown when the person cancels a prompt (Ctrl+C). Nothing has been written at that point. */
export class InitCancelled extends Error {
	constructor() {
		super("Cancelled. Nothing was written.");
		this.name = "InitCancelled";
	}
}

/** The raw flag values (strings as typed). `undefined` means the flag was not given. */
export interface InitAnswerFlags {
	/** A `postgres://` URL, `docker` or `skip`. */
	readonly database?: string;
	/** The Postgres schema for the tables (`DATABASE_SCHEMA`). */
	readonly databaseSchema?: string;
	readonly adminGithubId?: string;
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
	readonly blogTheme?: boolean;
}

const LOCALE_CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const POSTGRES_URL = /^postgres(?:ql)?:\/\/\S+$/;

const isTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
};

const isHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

/** An admin path becomes a folder in the app, so it is plain path segments only. */
export const validAdminPath = (value: string): boolean =>
	isAdminPath(value) && /^(?:\/[A-Za-z0-9_-]+)+$/.test(value) && !value.startsWith("/api");

const splitList = (value: string): string[] => value.split(/[\s,]+/).filter(Boolean);
const BLOCK_IDS = BLOCK_CHOICES.map((block) => block.id);
const EXTRAS = ["ai", "git-sync"] as const;

/** Every validator returns the error text, or `undefined` when the value is fine. The same text is used for a flag and for a prompt. */
const check = {
	database: (value: string) =>
		["docker", "skip"].includes(value) || POSTGRES_URL.test(value)
			? undefined
			: 'must be a postgres:// URL, "docker" (a local Postgres in Docker) or "skip"',
	databaseSchema: (value: string) =>
		value === "" || /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)
			? undefined
			: "must be a schema name: letters, digits and _, not starting with a digit (up to 63 characters)",
	githubId: (value: string) =>
		value === "" || /^\d+$/.test(value) ? undefined : "must be the numeric GitHub id (digits only), for example 583231",
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
	adminPath: (value: string) =>
		validAdminPath(value)
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
	checked("database", flags.database, check.database);
	checked("database-schema", flags.databaseSchema, check.databaseSchema);
	checked("admin-github-id", flags.adminGithubId, check.githubId);
	checked("site-url", flags.siteUrl, check.siteUrl);
	checked("locales", flags.locales, check.locales);
	checked("time-zone", flags.timeZone, check.timeZone);
	checked("storage", flags.storage, check.storage);
	checked("extras", flags.extras, check.extras);
	checked("blocks", flags.blocks, check.blocks);
	checked("admin-path", flags.adminPath, check.adminPath);
}

const databaseOf = (value: string): InitAnswers["database"] =>
	value === "docker" ? { kind: "docker" } : value === "skip" ? { kind: "skip" } : { kind: "url", url: value };

/** The steps for the GitHub OAuth app, with the callback URL for the site URL. */
export function oauthInstructions(siteUrl: string): string {
	return [
		"Admin login is GitHub. Create an OAuth app (it takes a minute):",
		"  1. Open https://github.com/settings/developers and choose OAuth Apps > New OAuth App",
		`  2. Homepage URL:               ${siteUrl}`,
		`     Authorization callback URL: ${githubCallbackUrl(siteUrl)}`,
		"  3. Put its Client ID in AUTH_GITHUB_ID and a new client secret in AUTH_GITHUB_SECRET (.env.local)",
		'  4. Put your numeric GitHub id in MONTI_ADMIN_GITHUB_ID (https://api.github.com/users/<your-name>, the "id" field)',
		"For a deployed site, make a second OAuth app (or edit this one) with your site URL in the same two places.",
		"You can do this later: under `next dev` you are signed in as the admin without it.",
	].join("\n");
}

/** What the questions ask, for the tests and the docs. */
export const QUESTIONS = {
	database: "Where is your Postgres database?",
	adminLogin: "Admin login",
	databaseSchema: "Postgres schema for the tables (empty: public). Use one when the database is shared with other apps",
	adminGithubId: "Your numeric GitHub id (MONTI_ADMIN_GITHUB_ID). Leave empty to fill it in later",
	locales: "Languages of the site (comma-separated, the default first)",
	storage: "Where should uploaded images go?",
	extras: "Extra features",
	blocks: "Which body blocks do you want?",
	blockList: "Pick the blocks",
	adminPath: "Where should the admin live?",
	blogTheme: "Install the blog theme pages (monti add blog-theme)? Skip it if your blog already has pages",
} as const;

/** The languages found in the names of the content files (`hello.ko.mdx`) or in language folders (`ko/`), default first, and where they were found. */
export function detectedLocales(
	app: DetectedApp,
): { codes: string[]; dir: string; from: "filename" | "folder" } | undefined {
	const folder = app.contentFolders.find((entry) => entry.locales !== undefined && entry.locales.length > 0);
	if (!folder?.locales || !folder.localesFrom) return undefined;
	return { codes: folder.locales.map((locale) => locale.code), dir: folder.dir, from: folder.localesFrom };
}

/**
 * Settles every question: from its flag when given, by asking when `prompter` is there, else with the default. Throws {@link InitCancelled} when the
 * person cancels, and an Error naming the flag when a flag value is wrong.
 */
export async function collectAnswers(
	app: DetectedApp,
	flags: InitAnswerFlags,
	prompter?: Prompter,
): Promise<InitAnswers> {
	validateFlags(flags);
	const siteUrl = flags.siteUrl ?? `http://localhost:${app.devPort}`;

	// Database
	let database: InitAnswers["database"];
	if (flags.database !== undefined) database = databaseOf(flags.database);
	else if (prompter) {
		const choice = await prompter.select({
			message: QUESTIONS.database,
			options: [
				{ value: "url", label: "I have a Postgres URL", hint: "paste it next" },
				{ value: "docker", label: "Use a local Postgres in Docker", hint: "writes docker-compose.yml" },
				{ value: "skip", label: "Skip, I will fill DATABASE_URL in later" },
			],
			initial: "docker",
		});
		if (choice === "url") {
			const url = await prompter.text({
				message: "Postgres URL",
				placeholder: "postgres://user:password@host:5432/dbname",
				validate: (value) =>
					POSTGRES_URL.test(value.trim()) ? undefined : "must start with postgres:// or postgresql://",
			});
			database = { kind: "url", url: url.trim() };
		} else database = { kind: choice };
	} else database = { kind: "skip" };

	// Schema of the tables. Not asked for the Docker database, which is yours alone.
	let databaseSchema = flags.databaseSchema?.trim() || undefined;
	if (flags.databaseSchema === undefined && prompter && database.kind !== "docker") {
		databaseSchema =
			(
				await prompter.text({
					message: QUESTIONS.databaseSchema,
					placeholder: "public",
					validate: (value) => check.databaseSchema(value.trim()),
				})
			).trim() || undefined;
	}

	// Admin login (GitHub)
	let adminGithubId = flags.adminGithubId || undefined;
	if (flags.adminGithubId === undefined && prompter) {
		prompter.note(oauthInstructions(siteUrl), QUESTIONS.adminLogin);
		const id = (
			await prompter.text({ message: QUESTIONS.adminGithubId, validate: (value) => check.githubId(value.trim()) })
		).trim();
		adminGithubId = id || undefined;
	}

	// Locales, the default first
	let locales: string[];
	const foundLocales = detectedLocales(app);
	if (flags.locales !== undefined) locales = splitList(flags.locales);
	else if (prompter) {
		locales = splitList(
			await prompter.text({
				message: foundLocales
					? `${QUESTIONS.locales}. Found ${foundLocales.codes.join(", ")} in the ${foundLocales.from === "filename" ? "file names" : "folders"} of ${foundLocales.dir}/`
					: QUESTIONS.locales,
				initial: foundLocales ? foundLocales.codes.join(",") : DEFAULT_INIT_LOCALE,
				validate: (value) => check.locales(value),
			}),
		);
	} else locales = foundLocales ? foundLocales.codes : [DEFAULT_INIT_LOCALE];
	locales = [...new Set(locales)];

	// Image storage
	const storage =
		flags.storage !== undefined
			? (flags.storage as "s3" | "none")
			: prompter
				? await prompter.select({
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
	else if (prompter) {
		extras = await prompter.multiselect({
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
	else if (prompter) {
		const heavy = BLOCK_CHOICES.filter((block) => block.heavy);
		const mode = await prompter.select({
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
					: await prompter.multiselect({
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
		(prompter
			? (
					await prompter.text({
						message: QUESTIONS.adminPath,
						initial: DEFAULT_INIT_ADMIN_PATH,
						validate: (value) => check.adminPath(value.trim()),
					})
				).trim()
			: DEFAULT_INIT_ADMIN_PATH);

	// Blog theme
	const blogTheme =
		flags.blogTheme ?? (prompter ? await prompter.confirm({ message: QUESTIONS.blogTheme, initial: false }) : false);

	return {
		database,
		...(databaseSchema ? { databaseSchema } : {}),
		adminGithubId,
		siteUrl,
		locales,
		timeZone: flags.timeZone ?? DEFAULT_INIT_TIME_ZONE,
		storage,
		ai: extras.includes("ai"),
		gitSync: extras.includes("git-sync"),
		blocks: blocks.filter((id) => BLOCK_IDS.includes(id)),
		adminPath,
		blogTheme,
	};
}

/** The prompter for a person at the terminal, on `@clack/prompts` (loaded here, so non-interactive runs never load it). */
export async function createClackPrompter(): Promise<Prompter> {
	const clack = await import("@clack/prompts");
	const answer = <T>(value: T | symbol): T => {
		if (clack.isCancel(value)) throw new InitCancelled();
		return value as T;
	};
	return {
		intro: (message) => clack.intro(message),
		outro: (message) => clack.outro(message),
		note: (body, title) => clack.note(body, title),
		select: async (question) =>
			answer(
				await clack.select({
					message: question.message,
					options: question.options.map((option) => ({ ...option })) as never,
					initialValue: question.initial as never,
				}),
			) as never,
		multiselect: async (question) =>
			answer(
				await clack.multiselect({
					message: question.message,
					options: question.options.map((option) => ({ ...option })) as never,
					initialValues: question.initial ? [...question.initial] : [],
					required: false,
				}),
			) as never,
		text: async (question) =>
			answer<string>(
				await clack.text({
					message: question.message,
					placeholder: question.placeholder,
					initialValue: question.initial,
					validate: question.validate ? (value) => question.validate?.(value ?? "") : undefined,
				}),
			),
		confirm: async (question) =>
			answer<boolean>(await clack.confirm({ message: question.message, initialValue: question.initial })),
	};
}
