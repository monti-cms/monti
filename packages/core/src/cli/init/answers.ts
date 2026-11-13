import { readFileSync } from "node:fs";
import path from "node:path";
import { LOCALE } from "../../schema/define";
import type { Ask } from "../prompt";
import { pagesAt } from "../site";
import type { Site } from "./detect";

/** What the questions of `monti init` settle. Each has a flag, and a default that `--yes` or a run with nobody at the terminal takes. */
export type Answers = {
	/** The admin's address, which is the folder its page goes in: `/admin`. */
	adminPath: string;
	/** The site's own language. */
	locale: string;
	login: "password" | "github";
	storage: "local" | "s3" | "none";
	/** The plugins the config starts with, by short name (`seo`, `mdx`): each is its own package. */
	plugins: string[];
};

/** The plugins `monti init` can add, in the order they are written. */
export const PLUGINS = ["seo", "mdx"] as const;

/** A plugin list as it is typed: names with commas, or `none`. */
const pluginsOf = (value: string) =>
	value.trim() === "none" || value.trim() === ""
		? []
		: value
				.split(",")
				.map((name) => name.trim())
				.filter(Boolean);

export type InitFlags = Partial<Answers> & { yes: boolean; dryRun: boolean };

const FLAGS = {
	"--admin-path": "adminPath",
	"--locale": "locale",
	"--login": "login",
	"--storage": "storage",
	"--plugins": "plugins",
} as const;

const check = {
	adminPath: (value: string) =>
		/^\/[a-z0-9][a-z0-9-]*$/.test(value)
			? null
			: 'The admin path is one folder: a slash, then lower-case letters, digits or "-" (/admin).',
	locale: (value: string) => (LOCALE.test(value) ? null : "A language code: en, ko, pt-BR."),
	login: (value: string) => (value === "password" || value === "github" ? null : "password or github."),
	storage: (value: string) => (value === "local" || value === "s3" || value === "none" ? null : "local, s3 or none."),
	plugins: (value: string) =>
		pluginsOf(value).every((name) => (PLUGINS as readonly string[]).includes(name))
			? null
			: `${PLUGINS.join(", ")} (with commas), or none.`,
};

/** The command's arguments as flags. Throws, naming the flag, on one it does not know or a value that is not one. */
export function readFlags(argv: string[]): InitFlags {
	const flags: InitFlags = { yes: false, dryRun: false };
	for (let at = 0; at < argv.length; at++) {
		const arg = argv[at] as string;
		if (arg === "--yes" || arg === "-y") flags.yes = true;
		else if (arg === "--dry-run") flags.dryRun = true;
		else if (arg in FLAGS) {
			const name = FLAGS[arg as keyof typeof FLAGS];
			const value = argv[++at];
			if (value === undefined) throw new Error(`${arg} needs a value.`);
			const wrong = check[name](value);
			if (wrong) throw new Error(`${arg} ${value}: ${wrong}`);
			(flags as Record<string, unknown>)[name] = name === "plugins" ? pluginsOf(value) : value;
		} else
			throw new Error(
				`monti init does not know ${arg}. Its flags: --admin-path, --locale, --login, --storage, --plugins, --yes (-y), --dry-run.`,
			);
	}
	return flags;
}

/**
 * Why the admin cannot go at an address, or `null` when it can. A site has one admin: where one is mounted, that is its address and no other
 * is taken; where none is, the address must be free of the site's own pages, whatever route group they are in (two pages at one address do
 * not build).
 */
function addressTaken(site: Site, address: string): string | null {
	if (site.admin)
		return site.admin.address === address
			? null
			: `The admin is already at ${site.admin.address} (${site.admin.folder}/), and a site has one admin. To move it, move that folder.`;
	const own = path.join(site.app ?? "app", address.slice(1), "page");
	const page = pagesAt(site.cwd, address).find(
		(file) =>
			// A page of the admin's own, left without its API route, is completed, not refused.
			file.replace(/\.[a-z]+$/, "") !== own || !readFileSync(path.join(site.cwd, file), "utf8").includes("AdminPage"),
	);
	return page ? `A page of the site already answers at ${address} (${page}). Give the admin another address.` : null;
}

/** The answer each question starts from: what the site already says, else the usual. */
export function defaults(site: Site): Answers {
	return {
		// A site that has the admin mounted keeps its address.
		adminPath: site.admin?.address ?? "/admin",
		locale: site.lang && LOCALE.test(site.lang) ? site.lang : "en",
		login: "password",
		storage: "local",
		// The plugins that are installed: a package put in is one the site means to use.
		plugins: PLUGINS.filter((name) => site.packages[name] !== null),
	};
}

/**
 * Settles them: from its flag when given, by asking when a person is there (`ask`), else the default. Nothing is asked with `--yes` or
 * without a terminal, so a run in CI never waits. `s3` needs its package: it is refused with what to install when the package is not there.
 * Where the admin is mounted its address is not asked: it is where it is, and a flag that names another is refused.
 */
export async function settle(site: Site, flags: InitFlags, ask: Ask | null): Promise<Answers> {
	const start = defaults(site);
	const asking = flags.yes ? null : ask;
	const one = async <Name extends Exclude<keyof Answers, "plugins">>(
		name: Name,
		message: string,
		also: (value: string) => string | null = () => null,
	): Promise<Answers[Name]> => {
		if (flags[name] !== undefined) return flags[name] as Answers[Name];
		if (!asking) return start[name];
		return (await asking({
			message,
			initial: start[name],
			check: (value) => check[name](value) ?? also(value),
		})) as Answers[Name];
	};
	// Asked only where there is something to pick: a plugin is its own package, and with none installed the answer could only be "none".
	const plugins = async (): Promise<string[]> => {
		if (flags.plugins !== undefined) return flags.plugins;
		if (!asking || start.plugins.length === 0) return start.plugins;
		return pluginsOf(
			await asking({
				message: `Which plugins? (${start.plugins.join(", ")}; with commas, or none)`,
				initial: start.plugins.join(","),
				check: (value) =>
					check.plugins(value) ??
					(pluginsOf(value).every((name) => start.plugins.includes(name as (typeof PLUGINS)[number]))
						? null
						: "That plugin's package is not installed."),
			}),
		);
	};
	const answers: Answers = {
		adminPath:
			site.admin && flags.adminPath === undefined
				? site.admin.address
				: await one("adminPath", "Where should the admin be?", (value) => addressTaken(site, value)),
		locale: await one("locale", "The site's language"),
		login: await one("login", "How does the admin sign in? (password, github)"),
		storage: await one("storage", "Where do media files go? (local: a folder on this machine, s3, none)"),
		plugins: await plugins(),
	};
	const taken = addressTaken(site, answers.adminPath);
	if (taken) throw new Error(taken);
	if (answers.storage === "s3" && site.packages["storage-s3"] === null)
		throw new Error(
			"The S3 storage is its own package, @monti-cms/storage-s3: install it from the same release, then run monti init again.",
		);
	const missing = answers.plugins.filter((name) => site.packages[name as (typeof PLUGINS)[number]] === null);
	if (missing.length > 0)
		throw new Error(
			`${missing.map((name) => `@monti-cms/${name}`).join(" and ")} ${missing.length === 1 ? "is" : "are"} not installed: a plugin is its own package. Install ${missing.length === 1 ? "it" : "them"} from the same release, then run monti init again.`,
		);
	return answers;
}
