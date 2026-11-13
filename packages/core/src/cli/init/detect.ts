import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { adminFolder, appFolder, configFileOf, fileUpward, installedPackage, readJson, sourceIn } from "../site";

/** What `monti init` reads of a site before it asks or writes anything (docs/design/features/20-release.md, `monti init`). */
export type Site = {
	cwd: string;
	/** The site's name, from `package.json`. */
	name: string;
	/** The installed Next, or the range `package.json` asks for; `null` when Next is not one of its packages. */
	next: string | null;
	/** `app`, or `src/app`; `null` when the site has no App Router folder. */
	app: string | null;
	/** Whether the site keeps its code under `src/`. */
	src: boolean;
	typescript: boolean;
	packageManager: "npm" | "pnpm" | "yarn" | "bun";
	/** The site's language as its root layout says it (`<html lang="ko">`). */
	lang: string | null;
	/** The top-level layout (`app/layout.tsx`): with one, the admin's page is drawn inside it. */
	topLayout: string | null;
	/** The Monti packages that are installed, by short name. */
	packages: Record<"core" | "admin" | "next" | "storage-s3" | "seo" | "mdx", string | null>;
	/** Posts the site already has as files (`.md`, `.mdx`): the folder that holds the most, and how many. `null` when it has none. */
	posts: { folder: string; count: number } | null;
	/**
	 * Where the admin is mounted already, when a route of the site exports its API: its folder, wherever in the app it is, and the address it
	 * answers at (`app/(cms)/admin` is `/admin`).
	 */
	admin: { folder: string; address: string } | null;
	/** The site's config file by its own name (`monti.config.mjs`), when it has one the `monti` command would load. */
	config: string | null;
};

/** Each package manager's lockfile. A workspace keeps one at its root, above the site's folder. */
const LOCKFILES = {
	"package-lock.json": "npm",
	"npm-shrinkwrap.json": "npm",
	"pnpm-lock.yaml": "pnpm",
	"yarn.lock": "yarn",
	"bun.lock": "bun",
	"bun.lockb": "bun",
} as const;

/** Where a site's posts usually are when it keeps them as files. */
const POST_FOLDERS = ["content", "posts", "_posts", "blog", "data"].flatMap((name) => [name, `src/${name}`]);

const isPost = (name: string) => /\.mdx?$/i.test(name) && !/^readme\./i.test(name);

/** How many posts a folder holds, itself and below: at most a few levels down, never into packages or build output. */
function countPosts(dir: string, depth = 0): number {
	let count = 0;
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		if (entry.isDirectory()) count += depth < 4 ? countPosts(path.join(dir, entry.name), depth + 1) : 0;
		else if (isPost(entry.name)) count += 1;
	}
	return count;
}

/**
 * The posts a site already has as files (T198): the usual folders, and pages written as MDX in the app folder are not posts to import (they
 * are the site's pages). The folder with the most wins; a tie goes to the first.
 */
function findPosts(cwd: string, app: string | null): Site["posts"] {
	let best: Site["posts"] = null;
	for (const folder of POST_FOLDERS) {
		if (app !== null && (folder === app || folder.startsWith(`${app}/`))) continue;
		const count = countPosts(path.join(cwd, folder));
		if (count > (best?.count ?? 0)) best = { folder, count };
	}
	return best;
}

export function detectSite(cwd: string): Site {
	const manifest = readJson(path.join(cwd, "package.json"));
	const asked = { ...(manifest?.dependencies as object), ...(manifest?.devDependencies as object) } as Record<
		string,
		string
	>;
	const installed = (name: string) => (installedPackage(cwd, name)?.version as string | undefined) ?? null;
	const app = appFolder(cwd);
	const layout = app ? sourceIn(path.join(cwd, app), "layout") : undefined;
	const topLayout = layout ? path.relative(cwd, layout) : null;
	const lockfile = fileUpward(cwd, Object.keys(LOCKFILES));
	const admin = adminFolder(cwd);
	const lang = topLayout
		? (readFileSync(path.join(cwd, topLayout), "utf8").match(/<html[^>]*\blang=["']([A-Za-z-]+)["']/)?.[1] ?? null)
		: null;
	return {
		cwd,
		name: typeof manifest?.name === "string" && manifest.name !== "" ? manifest.name : path.basename(cwd),
		next: installed("next") ?? asked.next ?? null,
		app,
		src: app?.startsWith("src") ?? false,
		typescript: existsSync(path.join(cwd, "tsconfig.json")),
		packageManager: lockfile ? LOCKFILES[lockfile.name as keyof typeof LOCKFILES] : "npm",
		lang,
		topLayout,
		packages: {
			core: installed("@monti-cms/core"),
			admin: installed("@monti-cms/admin"),
			next: installed("@monti-cms/next"),
			"storage-s3": installed("@monti-cms/storage-s3"),
			seo: installed("@monti-cms/seo"),
			mdx: installed("@monti-cms/mdx"),
		},
		posts: findPosts(cwd, app),
		admin: admin ? { folder: admin.folder, address: admin.address } : null,
		config: configFileOf(cwd),
	};
}

/**
 * Why `monti init` cannot work in this folder, with what to do; `null` when it can. Nothing is written when it cannot.
 */
export function cannotInit(site: Site): { what: string; fix: string } | null {
	if (site.next === null)
		return {
			what: "Next is not one of this folder's packages: monti init adds Monti to a Next.js site.",
			fix: "make one first (npx create-next-app@latest), then run monti init in it",
		};
	const major = Number.parseInt(site.next.replace(/^[^\d]*/, ""), 10);
	if (Number.isFinite(major) && major < 16)
		return { what: `Next ${site.next}: Monti needs Next 16 or later.`, fix: "npm install next@latest" };
	if (site.app === null)
		return {
			what:
				existsSync(path.join(site.cwd, "pages")) || existsSync(path.join(site.cwd, "src", "pages"))
					? "This site has only a pages/ folder: Monti needs the App Router."
					: "This site has no app/ folder: Monti needs the App Router.",
			fix: "add an app/ folder (it can stand beside pages/), then run monti init again",
		};
	if (!site.typescript)
		return {
			what: "This site has no tsconfig.json: Monti's schema and config are TypeScript files.",
			fix: "add TypeScript to the site (Next sets it up: add an empty tsconfig.json and run the dev server once), then run monti init again",
		};
	const missing = (["admin", "next"] as const)
		.filter((name) => site.packages[name] === null)
		.map((name) => `@monti-cms/${name}`);
	if (missing.length > 0)
		return {
			what: `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not installed.`,
			fix: "install them from the same release as @monti-cms/core (the release's notes give the line), then run monti init again",
		};
	return null;
}
