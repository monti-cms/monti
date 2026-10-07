import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * The mapping of `monti import`: which folder of the source goes to which collection, and which front matter key goes to which field. It is guessed on the first run,
 * confirmed by the person, and saved as `monti.import.json`, so the next run asks nothing.
 *
 * A front matter key maps to a field of the collection (`"summary"`), to a relation field with the choice to create missing targets
 * (`{ "field": "tagIds", "create": true }`), or to one of the reserved targets below.
 */

/** The publish date of the entry. */
export const TARGET_PUBLISHED_AT = "@publishedAt";
/** The address of the entry. Without it the address is made from the file name. */
export const TARGET_SLUG = "@slug";
/** The language of the entry. */
export const TARGET_LOCALE = "@locale";
/** A true value keeps the entry a draft. */
export const TARGET_DRAFT = "@draft";
/** A false value keeps the entry a draft (`published: false`). */
export const TARGET_PUBLISHED = "@published";
/** The key is not imported. */
export const TARGET_SKIP = "@skip";

export const RESERVED_TARGETS = [
	TARGET_PUBLISHED_AT,
	TARGET_SLUG,
	TARGET_LOCALE,
	TARGET_DRAFT,
	TARGET_PUBLISHED,
	TARGET_SKIP,
] as const;

export const MAPPING_FILE = "monti.import.json";

/** Where the language of a file comes from, in order of precedence. */
export const LOCALE_SOURCES = ["frontMatter", "filename", "folder"] as const;
export type LocaleSource = (typeof LOCALE_SOURCES)[number];

export type FieldTarget = string | { readonly field: string; readonly create?: boolean };

export interface FolderMapping {
	/** The collection the folder goes to. `null`: the folder is not imported. */
	collection: string | null;
	/** Front matter key → target. */
	fields: Record<string, FieldTarget>;
}

export interface ImportMapping {
	version: 1;
	/** File extension (`mdx`) → format name, for a project whose formats are not found by extension. */
	formats?: Record<string, string>;
	/** Where the language of a file comes from. Default: every source that shows up in the files. */
	locale?: { from: LocaleSource[] };
	/** The folder `/images/a.png` in a body is looked up in (relative to the working directory). */
	publicDir?: string;
	/** Source folder (relative to the scanned path; `.` for the files directly in it) → what it becomes. */
	folders: Record<string, FolderMapping>;
}

const target = z.union([
	z.string().min(1),
	z.object({ field: z.string().min(1), create: z.boolean().optional() }).strict(),
]);

const mappingSchema = z
	.object({
		version: z.literal(1),
		formats: z.record(z.string(), z.string()).optional(),
		locale: z
			.object({ from: z.array(z.enum(LOCALE_SOURCES)) })
			.strict()
			.optional(),
		publicDir: z.string().optional(),
		folders: z.record(
			z.string(),
			z.object({ collection: z.string().nullable(), fields: z.record(z.string(), target) }).strict(),
		),
	})
	.strict();

/** Reads a mapping. Throws an error that names what is wrong. */
export function parseMapping(value: unknown, where: string): ImportMapping {
	const parsed = mappingSchema.safeParse(value);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		throw new Error(
			`${where} is not a valid import mapping: ${first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "unreadable"}`,
		);
	}
	return parsed.data as ImportMapping;
}

/** The saved mapping, or `undefined` when the file does not exist. */
export function loadMapping(file: string): ImportMapping | undefined {
	if (!existsSync(file)) return undefined;
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(
			`${path.basename(file)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	return parseMapping(value, path.basename(file));
}

export function saveMapping(file: string, mapping: ImportMapping): void {
	writeFileSync(file, `${JSON.stringify(mapping, null, "\t")}\n`);
}

/** The field a target names (and its `create` choice), `undefined` for a reserved target. */
export function fieldOfTarget(value: FieldTarget): { field: string; create: boolean | undefined } | undefined {
	const field = typeof value === "string" ? value : value.field;
	if (field.startsWith("@")) return undefined;
	return { field, create: typeof value === "string" ? undefined : value.create };
}

/** The reserved target (`@publishedAt`) a value names, or `undefined`. */
export function reservedOf(value: FieldTarget): (typeof RESERVED_TARGETS)[number] | undefined {
	const field = typeof value === "string" ? value : value.field;
	return (RESERVED_TARGETS as readonly string[]).includes(field)
		? (field as (typeof RESERVED_TARGETS)[number])
		: undefined;
}
