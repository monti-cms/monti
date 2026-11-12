import { readFileSync } from "node:fs";
import path from "node:path";
import { LOCALE } from "../../schema/define";
import type { Ask } from "../prompt";
import { pagesAt } from "../site";
import type { Site } from "./detect";

/** What the four questions of `monti init` settle. Each has a flag, and a default that `--yes` or a run with nobody at the terminal takes. */
export type Answers = {
	/** The admin's address, which is the folder its page goes in: `/admin`. */
	adminPath: string;
	/** The site's own language. */
	locale: string;
	login: "password" | "github";
	storage: "local" | "s3" | "none";
};

export type InitFlags = Partial<Answers> & { yes: boolean; dryRun: boolean };

const FLAGS = {
	"--admin-path": "adminPath",
	"--locale": "locale",
	"--login": "login",
	"--storage": "storage",
} as const;

const check = {
	adminPath: (value: string) =>
		/^\/[a-z0-9][a-z0-9-]*$/.test(value)
			? null
			: 'The admin path is one folder: a slash, then lower-case letters, digits or "-" (/admin).',
	locale: (value: string) => (LOCALE.test(value) ? null : "A language code: en, ko, pt-BR."),
	login: (value: string) => (value === "password" || value === "github" ? null : "password or github."),
	storage: (value: string) => (value === "local" || value === "s3" || value === "none" ? null : "local, s3 or none."),
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
			(flags as Record<string, unknown>)[name] = value;
		} else
			throw new Error(
				`monti init does not know ${arg}. Its flags: --admin-path, --locale, --login, --storage, --yes (-y), --dry-run.`,
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
	};
}

/**
 * Settles the four: from its flag when given, by asking when a person is there (`ask`), else the default. Nothing is asked with `--yes` or
 * without a terminal, so a run in CI never waits. `s3` needs its package: it is refused with what to install when the package is not there.
 * Where the admin is mounted its address is not asked: it is where it is, and a flag that names another is refused.
 */
export async function settle(site: Site, flags: InitFlags, ask: Ask | null): Promise<Answers> {
	const start = defaults(site);
	const asking = flags.yes ? null : ask;
	const one = async <Name extends keyof Answers>(
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
	const answers: Answers = {
		adminPath:
			site.admin && flags.adminPath === undefined
				? site.admin.address
				: await one("adminPath", "Where should the admin be?", (value) => addressTaken(site, value)),
		locale: await one("locale", "The site's language"),
		login: await one("login", "How does the admin sign in? (password, github)"),
		storage: await one("storage", "Where do media files go? (local: a folder on this machine, s3, none)"),
	};
	const taken = addressTaken(site, answers.adminPath);
	if (taken) throw new Error(taken);
	if (answers.storage === "s3" && site.packages["storage-s3"] === null)
		throw new Error(
			"The S3 storage is its own package, @monti-cms/storage-s3: install it from the same release, then run monti init again.",
		);
	return answers;
}
