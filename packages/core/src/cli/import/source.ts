import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseFile } from "../../front-matter";
import { isLanguageCode } from "../locale-names";

/** The files of the source: finding them, reading their front matter, and what their path says (language, folder, address). */

export const SOURCE_EXTENSIONS = ["md", "mdx"] as const;
export type SourceExtension = (typeof SOURCE_EXTENSIONS)[number];

const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".next", ".astro", ".contentlayer", "dist", "build"]);

export interface SourceFile {
	/** Absolute path. */
	readonly abs: string;
	/** Path relative to the scanned folder, with `/`. */
	readonly rel: string;
	/** Path relative to the working directory (what the import state is keyed by), with `/`. */
	readonly key: string;
	readonly ext: SourceExtension;
}

const posix = (value: string) => value.split(path.sep).join("/");

const extensionOf = (file: string): SourceExtension | undefined => {
	const ext = path.extname(file).slice(1).toLowerCase();
	return (SOURCE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as SourceExtension) : undefined;
};

/**
 * Every `.md` and `.mdx` file under `target` (a folder or a single file), in path order. Folders that are never content (`node_modules`, `.git`, build output) and
 * folders whose name starts with a dot are not entered.
 */
export function scanSources(cwd: string, target: string): { root: string; files: SourceFile[] } {
	const abs = path.resolve(cwd, target);
	let stat: ReturnType<typeof statSync>;
	try {
		stat = statSync(abs);
	} catch {
		throw new Error(`cannot find ${target}`);
	}
	const root = stat.isDirectory() ? abs : path.dirname(abs);
	const files: SourceFile[] = [];
	const add = (file: string) => {
		const ext = extensionOf(file);
		if (!ext) return;
		const key = posix(path.relative(cwd, file));
		files.push({ abs: file, rel: posix(path.relative(root, file)), key: key.startsWith("..") ? file : key, ext });
	};
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) walk(full);
			} else if (entry.isFile()) add(full);
		}
	};
	if (stat.isDirectory()) walk(abs);
	else add(abs);
	return { root, files };
}

/** A source file with its text read. */
export interface ParsedSource extends SourceFile {
	readonly text: string;
	/** Hash of the text. */
	readonly hash: string;
	/** The front matter (empty when there is none). */
	readonly front: Record<string, unknown>;
	/** The text after the front matter. */
	readonly body: string;
	/** How many lines the front matter takes, to turn a position in the body into a line of the file. */
	readonly bodyLineOffset: number;
	/** Why the file could not be read (front matter that is not valid). */
	readonly error?: string;
}

export function readSource(file: SourceFile): ParsedSource {
	const text = readFileSync(file.abs, "utf8");
	const hash = createHash("sha256").update(text).digest("hex");
	const parsed = parseFile(text);
	if (!parsed.ok) {
		return {
			...file,
			text,
			hash,
			front: {},
			body: "",
			bodyLineOffset: 0,
			error: parsed.line ? `${parsed.message} (line ${parsed.line})` : parsed.message,
		};
	}
	const lines = (value: string) => value.replace(/\r\n/g, "\n").split("\n").length;
	return {
		...file,
		text,
		hash,
		front: parsed.data,
		body: parsed.body,
		bodyLineOffset: Math.max(0, lines(text) - lines(parsed.body)),
	};
}

/** What the path of a file says, apart from what its front matter says. */
export interface PathInfo {
	/** The folder the file belongs to: the first folder of its path, after the language folder and the folder of an `index` file are taken out. `.` for none. */
	readonly folder: string;
	/** The language in the file name (`hello.ko.mdx`), as the site writes the code. */
	readonly localeFromFilename?: string;
	/** The file name ends in what looks like a language (`hello.ko.mdx`) that the site does not have. The file is not imported: it would get a mangled address. */
	readonly unknownLocaleSuffix?: string;
	/** The language in a folder of the path (`ko/hello.mdx`). */
	readonly localeFromFolder?: string;
	/** The file name without extension and language (`index` files take the name of their folder). It is the address when the front matter has none. */
	readonly name: string;
	/** What the files of one post in several languages have in common: the same path without the language. */
	readonly groupKey: string;
	/** The file is the `index` of its folder, so the folder is the post. */
	readonly isIndex: boolean;
}

const INDEX_NAMES = new Set(["index", "_index"]);

/**
 * The key of a file's folder in the mapping file: the folder's path relative to the working directory (`content/posts`), `.` for the working directory itself.
 * It does not depend on which folder was scanned, so the same mapping serves `monti import content` and `monti import content/posts`.
 */
export function folderKeyOf(source: Pick<ParsedSource, "rel" | "key">, locales: readonly string[]): string {
	const { folder } = derivePath(source.rel, locales);
	const root = source.key.endsWith(source.rel) ? source.key.slice(0, source.key.length - source.rel.length) : "";
	return [root.replace(/\/+$/, ""), folder === "." ? "" : folder].filter(Boolean).join("/") || ".";
}

/** The key a folder had in the mapping files written before keys were paths from the working directory: relative to the scanned folder. */
export const legacyFolderKeyOf = (rel: string, locales: readonly string[]): string => derivePath(rel, locales).folder;

/** The site's language code a text names (`KO`, `pt-br`), or `undefined`. */
export function localeCode(value: string, locales: readonly string[]): string | undefined {
	const lower = value.toLowerCase().replace(/_/g, "-");
	return locales.find((code) => code.toLowerCase() === lower);
}

/** Reads the language, folder and name out of a path relative to the scanned folder. */
export function derivePath(rel: string, locales: readonly string[]): PathInfo {
	const segments = rel.split("/");
	const file = segments.pop() ?? rel;
	let stem = file.replace(/\.(md|mdx)$/i, "");
	let localeFromFilename: string | undefined;
	let unknownLocaleSuffix: string | undefined;
	const suffix = /^(.*)\.([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)$/.exec(stem);
	if (suffix) {
		const code = localeCode(suffix[2] ?? "", locales);
		if (code) {
			localeFromFilename = code;
			stem = suffix[1] ?? stem;
		} else if (isLanguageCode(suffix[2] ?? "")) {
			// Not imported, but its name is still the post's name without the language, never `helloko`.
			unknownLocaleSuffix = (suffix[2] ?? "").toLowerCase();
			stem = suffix[1] ?? stem;
		}
	}
	let localeFromFolder: string | undefined;
	const dirs: string[] = [];
	for (const segment of segments) {
		const code = localeCode(segment, locales);
		if (code && localeFromFolder === undefined) localeFromFolder = code;
		else dirs.push(segment);
	}
	let name = stem;
	const isIndex = INDEX_NAMES.has(stem.toLowerCase()) && dirs.length > 0;
	if (isIndex) name = dirs.pop() ?? stem;
	return {
		folder: dirs[0] ?? ".",
		...(localeFromFilename ? { localeFromFilename } : {}),
		...(unknownLocaleSuffix ? { unknownLocaleSuffix } : {}),
		...(localeFromFolder ? { localeFromFolder } : {}),
		name,
		groupKey: [...dirs, name].join("/"),
		isIndex,
	};
}
