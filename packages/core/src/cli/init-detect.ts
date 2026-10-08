import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { detectPackageManager } from "./add";
import { parseJsonc } from "./config-paths";
import {
	type DetectedLocale,
	defaultFirst,
	isLanguageCode,
	localesFromFileNames,
	normalizeLanguageCode,
} from "./locale-names";

/** What `monti init` finds out about the app before it asks anything. Read-only: nothing is written here. */

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type FrontMatterType = "string" | "list" | "boolean" | "number" | "date";

/** One front matter key seen in a content folder. */
export interface FrontMatterKey {
	readonly name: string;
	/** The type of the value in most files. */
	readonly type: FrontMatterType;
	/** In how many of the sampled files the key appears. */
	readonly count: number;
}

/** A folder of Markdown or MDX files the app already has. */
export interface ContentFolder {
	/** Relative to the app folder, with `/`. */
	readonly dir: string;
	/** Markdown (`.md`) and MDX (`.mdx`) files directly in it. */
	readonly files: number;
	/** The front matter keys of up to {@link SAMPLE_FILES} files, most common first. */
	readonly keys: readonly FrontMatterKey[];
	/**
	 * The languages the files are written in, default first, when their names say so: `hello.ko.mdx` and `hello.en.mdx` (`filename`), or sibling folders named
	 * `ko/` and `en/` that this folder merges (`folder`, then `dir` is their parent).
	 */
	readonly locales?: readonly DetectedLocale[];
	readonly localesFrom?: "filename" | "folder";
}

export interface DetectedApp {
	readonly cwd: string;
	/** `name` of package.json. */
	readonly packageName?: string;
	/** The `next` version range listed in package.json, if Next is a dependency. */
	readonly next?: string;
	/** `app` or `src/app`: where the App Router folder is (or will be created). */
	readonly appDir: "app" | "src/app";
	/** Whether the project keeps its code in `src/`. */
	readonly src: boolean;
	/** Whether the app folder exists. */
	readonly hasAppRouter: boolean;
	/** `pages/` exists and `app/` does not. */
	readonly pagesRouterOnly: boolean;
	readonly packageManager: PackageManager;
	readonly typescript: boolean;
	/** `undefined` when there is no tsconfig. */
	readonly resolveJsonModule?: boolean;
	readonly tailwind: { readonly installed: boolean; readonly typography: boolean };
	readonly contentFolders: readonly ContentFolder[];
	/** The next config file (`next.config.ts`, `.mjs` or `.js`), if any. */
	readonly nextConfig?: string;
	/** The port `next dev` is set to listen on, from the `dev` script. */
	readonly devPort: number;
	/** Whether the package.json already lists these packages. */
	readonly dependencies: ReadonlySet<string>;
	/** Config files of an earlier Monti setup, which `init` leaves alone. */
	readonly legacyConfig: readonly string[];
	/** The existing `monti.config.ts` (relative to cwd), if any. */
	readonly existingConfig?: string;
	/** Whether `.gitignore` covers `.env.local`. */
	readonly envLocalIgnored: boolean;
}

export const NEXT_CONFIG_FILES = ["next.config.ts", "next.config.mjs", "next.config.js"] as const;
/** Folders searched for Markdown and MDX (each, and the folders up to {@link MAX_DEPTH} levels under it). */
const CONTENT_ROOTS = ["content", "src/content", "posts", "src/posts", "_posts", "blog", "src/blog", "data"];
const MAX_DEPTH = 3;
/** Files read per folder for front matter keys. */
export const SAMPLE_FILES = 50;
const SKIP_FOLDERS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const MARKDOWN = /\.(md|mdx)$/i;

const posix = (file: string) => file.split(path.sep).join("/");

/** The `key: value` lines at the top level of a front matter block (`---` fenced) as key -> type. Empty when the file has none. */
export function parseFrontMatterKeys(text: string): Map<string, FrontMatterType> {
	const keys = new Map<string, FrontMatterType>();
	const lines = text.replace(/^﻿/, "").split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return keys;
	for (let index = 1; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (line.trim() === "---") break;
		const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
		if (!match) continue;
		const [, name = "", rawValue = ""] = match;
		const value = rawValue.trim().replace(/\s+#.*$/, "");
		let type: FrontMatterType = "string";
		if (value === "" && /^\s*-\s/.test(lines[index + 1] ?? "")) type = "list";
		else if (value.startsWith("[")) type = "list";
		else if (/^(true|false)$/i.test(value)) type = "boolean";
		else if (/^-?\d+(\.\d+)?$/.test(value)) type = "number";
		else if (/^["']?\d{4}-\d{2}-\d{2}/.test(value)) type = "date";
		keys.set(name, type);
	}
	return keys;
}

/** Folders under the content roots that hold Markdown or MDX files, with the front matter keys of their files. */
function findContentFolders(cwd: string): ContentFolder[] {
	const folders: ContentFolder[] = [];
	const names = new Map<string, string[]>();
	const seen = new Set<string>();
	const visit = (dir: string, depth: number) => {
		if (seen.has(dir)) return;
		seen.add(dir);
		let entries: import("node:fs").Dirent[];
		try {
			entries = readdirSync(path.join(cwd, dir), { withFileTypes: true });
		} catch {
			return;
		}
		const files = entries.filter((entry) => entry.isFile() && MARKDOWN.test(entry.name)).map((entry) => entry.name);
		if (files.length > 0) {
			const tally = new Map<string, { count: number; types: Map<FrontMatterType, number> }>();
			for (const file of files.slice(0, SAMPLE_FILES)) {
				let text = "";
				try {
					text = readFileSync(path.join(cwd, dir, file), "utf8");
				} catch {
					continue;
				}
				for (const [name, type] of parseFrontMatterKeys(text)) {
					const entry = tally.get(name) ?? { count: 0, types: new Map() };
					entry.count++;
					entry.types.set(type, (entry.types.get(type) ?? 0) + 1);
					tally.set(name, entry);
				}
			}
			const keys = [...tally.entries()]
				.map(([name, { count, types }]) => ({
					name,
					count,
					type: [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "string",
				}))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
			names.set(posix(dir), files);
			const locales = localesFromFileNames(files);
			folders.push({
				dir: posix(dir),
				files: files.length,
				keys,
				...(locales ? { locales, localesFrom: "filename" as const } : {}),
			});
		}
		if (depth >= MAX_DEPTH) return;
		for (const entry of entries) {
			if (entry.isDirectory() && !SKIP_FOLDERS.has(entry.name) && !entry.name.startsWith(".")) {
				visit(path.join(dir, entry.name), depth + 1);
			}
		}
	};
	for (const root of CONTENT_ROOTS) {
		if (existsSync(path.join(cwd, root)) && statSync(path.join(cwd, root)).isDirectory()) visit(root, 0);
	}
	return mergeLocaleFolders(folders, names);
}

/**
 * Sibling folders named after languages (`content/ko`, `content/en`) are one set of posts in two languages, not two collections: they are merged into their parent,
 * which then lists the languages. A single folder named like a language is left alone (it may be a name).
 */
function mergeLocaleFolders(folders: ContentFolder[], names: ReadonlyMap<string, string[]>): ContentFolder[] {
	const byParent = new Map<string, ContentFolder[]>();
	for (const folder of folders) {
		const base = path.posix.basename(folder.dir);
		const parent = path.posix.dirname(folder.dir);
		if (parent === "." || !isLanguageCode(base)) continue;
		byParent.set(parent, [...(byParent.get(parent) ?? []), folder]);
	}
	let result = folders;
	for (const [parent, children] of byParent) {
		if (children.length < 2) continue;
		const stems = (folder: ContentFolder) =>
			new Set((names.get(folder.dir) ?? []).map((name) => name.replace(/\.(md|mdx)$/i, "").toLowerCase()));
		const stemSets = children.map(stems);
		const locales = defaultFirst(
			children.map((folder, index) => ({
				code: normalizeLanguageCode(path.posix.basename(folder.dir)),
				files: folder.files,
				unpaired: [...(stemSets[index] ?? [])].filter(
					(stem) => !stemSets.some((other, otherIndex) => otherIndex !== index && other.has(stem)),
				).length,
			})),
		);
		const own = folders.find((folder) => folder.dir === parent);
		const members = [...(own ? [own] : []), ...children];
		const tally = new Map<string, { count: number; types: Map<FrontMatterType, number> }>();
		for (const member of members) {
			for (const key of member.keys) {
				const entry = tally.get(key.name) ?? { count: 0, types: new Map() };
				entry.count += key.count;
				entry.types.set(key.type, (entry.types.get(key.type) ?? 0) + key.count);
				tally.set(key.name, entry);
			}
		}
		const merged: ContentFolder = {
			dir: parent,
			files: members.reduce((sum, member) => sum + member.files, 0),
			keys: [...tally.entries()]
				.map(([name, { count, types }]) => ({
					name,
					count,
					type: [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ("string" as const),
				}))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
			locales,
			localesFrom: "folder",
		};
		const drop = new Set<ContentFolder>(members);
		const first = result.findIndex((folder) => drop.has(folder));
		result = result.flatMap((folder, index) => (index === first ? [merged] : drop.has(folder) ? [] : [folder]));
	}
	return result;
}

/** Whether a `.gitignore` line list covers `.env.local`. */
export function ignoresEnvLocal(gitignore: string): boolean {
	return gitignore
		.split(/\r?\n/)
		.map((line) => line.trim())
		.some((line) => [".env.local", ".env*.local", ".env*", ".env", "*.local", ".env.*"].includes(line));
}

/** Reads the app in `cwd`. Throws when there is no package.json. */
export function detectApp(cwd: string): DetectedApp {
	const packageFile = path.join(cwd, "package.json");
	if (!existsSync(packageFile)) {
		throw new Error("package.json not found; run `monti init` in the folder of your Next app");
	}
	const pkg = (parseJsonc(readFileSync(packageFile, "utf8")) ?? {}) as {
		name?: unknown;
		scripts?: Record<string, unknown>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	const dependencies = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
	const exists = (file: string) => existsSync(path.join(cwd, file));
	const src = exists("src/app") || (exists("src") && !exists("app"));
	const appDir = exists("src/app") ? "src/app" : exists("app") ? "app" : src ? "src/app" : "app";
	const tsconfig = exists("tsconfig.json")
		? parseJsonc(readFileSync(path.join(cwd, "tsconfig.json"), "utf8"))
		: undefined;
	const compilerOptions = (tsconfig as { compilerOptions?: { resolveJsonModule?: boolean } } | undefined)
		?.compilerOptions;
	const configRoots = src ? ["src/", ""] : [""];
	const dev = typeof pkg.scripts?.dev === "string" ? pkg.scripts.dev : "";
	const port = /(?:-p|--port)[ =]+(\d{2,5})/.exec(dev)?.[1];
	const gitignore = exists(".gitignore") ? readFileSync(path.join(cwd, ".gitignore"), "utf8") : "";
	return {
		cwd,
		packageName: typeof pkg.name === "string" ? pkg.name : undefined,
		next: pkg.dependencies?.next ?? pkg.devDependencies?.next,
		appDir,
		src,
		hasAppRouter: exists("app") || exists("src/app"),
		pagesRouterOnly: !(exists("app") || exists("src/app")) && (exists("pages") || exists("src/pages")),
		packageManager: detectPackageManager(cwd),
		typescript: exists("tsconfig.json") || dependencies.has("typescript"),
		resolveJsonModule: tsconfig === undefined ? undefined : compilerOptions?.resolveJsonModule === true,
		tailwind: {
			installed: dependencies.has("tailwindcss"),
			typography: dependencies.has("@tailwindcss/typography"),
		},
		contentFolders: findContentFolders(cwd),
		nextConfig: NEXT_CONFIG_FILES.find(exists),
		devPort: port ? Number(port) : 3000,
		dependencies,
		legacyConfig: configRoots
			.flatMap((root) => ["cms.config.ts", "cms.server.ts"].map((file) => `${root}${file}`))
			.filter(exists),
		existingConfig: configRoots.map((root) => `${root}monti.config.ts`).find(exists),
		envLocalIgnored: ignoresEnvLocal(gitignore),
	};
}
