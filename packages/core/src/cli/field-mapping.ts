import { defaultCollectionPath } from "../core/plural";
import { CMS_STATE_KEYS, DATE_KEYS, LOCALE_KEYS, RELATION_KEYS, SUMMARY_KEYS } from "./front-matter-keys";
import type { ContentFolder, FrontMatterKey } from "./init-detect";

/** How the front matter of the posts an app already has becomes the fields of the starter schema (`monti init`). */

const sentenceCase = (key: string): string => {
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The field names the starter collection always has. */
const STARTER_FIELDS = new Set(["title", "slug"]);
const IMAGE_KEYS = ["image", "cover", "coverimage", "thumbnail", "heroimage", "ogimage", "banner", "featuredimage"];

/** A key from front matter as a field name: kept as it is when it is one word of letters and digits, else camel-cased. `undefined` if nothing usable is left. */
export function fieldNameOf(key: string): string | undefined {
	if (/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return key;
	const words = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
	if (words.length === 0 || !/^[A-Za-z]/.test(words[0] ?? "")) return undefined;
	return words.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join("");
}

type SchemaField = Record<string, unknown>;

/** What the starter schema holds, and what was decided on the way (for the init report). */
export interface StarterSchema {
	/** `post` first, then the collections its relations point to. */
	readonly collections: Record<string, { readonly fields: Record<string, SchemaField> } & Record<string, unknown>>;
	/** Plain-words lines about front matter keys that got a relation, or that need no field. */
	readonly notes: string[];
}

const itemCollection = (label: string, icon: string, multiLocale: boolean) => ({
	label,
	// small entries that posts point to (see "item" in the collection docs)
	kind: "item",
	icon,
	fields: {
		title: { kind: "text", label: "Name", required: true, ...(multiLocale ? { localized: true } : {}), max: 200 },
		slug: { kind: "slug", label: "Address", required: true, from: "title" },
	} as Record<string, SchemaField>,
});

/**
 * The collections of the starter schema: `post` with the fields every blog has, then (when a content folder was found) one field per front matter key, read by the
 * table in `front-matter-keys.ts`:
 *
 * - `date` and the other publish date keys get no field: the entry has its own publish date.
 * - `description`, `summary`, `excerpt` and the like become the field with the `summary` role.
 * - `tags` (also `keywords`, `topics`) become the collection `tag` and a relation `tagIds`. `category` becomes `category` and `categoryId`, and `categories` (a list)
 *   `categoryIds`.
 * - `draft`, `published` and the language keys are the CMS's own and get no field.
 */
export function starterCollections(keys: readonly FrontMatterKey[], multiLocale: boolean): StarterSchema {
	const localized = multiLocale ? { localized: true } : {};
	const fields: Record<string, SchemaField> = {
		// the title field is named `title` (the label is up to you)
		title: { kind: "text", label: "Title", required: true, ...localized, max: 200 },
		slug: {
			kind: "slug",
			label: "Slug",
			required: true,
			...(multiLocale ? { localized: "inherit" } : {}),
			from: "title",
		},
	};
	const notes: string[] = [];
	const relationKeys = new Map<string, string>();
	let summaryName: string | undefined;
	const extra: Record<string, SchemaField> = {};
	for (const key of keys.slice(0, 16)) {
		const name = fieldNameOf(key.name);
		const lower = key.name.toLowerCase();
		if (!name || STARTER_FIELDS.has(name) || STARTER_FIELDS.has(lower) || CMS_STATE_KEYS.has(lower) || name in extra)
			continue;
		if (DATE_KEYS.has(lower)) {
			notes.push(
				`"${key.name}" is the publish date of an entry, so it has no field of its own (import fills the date).`,
			);
			continue;
		}
		if (LOCALE_KEYS.has(lower)) continue;
		const target = RELATION_KEYS[lower];
		if (target === "tag" || target === "category") {
			if (relationKeys.has(target)) {
				notes.push(
					`"${key.name}" also means ${target}, which "${relationKeys.get(target)}" already fills, so import skips it.`,
				);
				continue;
			}
			const many = target === "tag" || key.type === "list";
			relationKeys.set(target, key.name);
			extra[`${target}${many ? "Ids" : "Id"}`] = {
				kind: "relation",
				label: target === "tag" ? "Tags" : many ? "Categories" : "Category",
				to: target,
				...(many ? { many: true } : {}),
				createInline: true,
			};
			continue;
		}
		if (summaryName === undefined && SUMMARY_KEYS.has(lower)) {
			summaryName = name;
			extra[name] = {
				kind: "text",
				label: sentenceCase(key.name),
				role: "summary",
				multiline: true,
				fillFromBody: true,
				...localized,
			};
		} else if (IMAGE_KEYS.includes(lower) && key.type === "string") {
			extra[name] = { kind: "media", label: sentenceCase(key.name), accept: "image" };
		} else {
			const note =
				key.type === "list"
					? "A list in your front matter; kept as text (one value per line) until you model it"
					: key.type === "date"
						? "A date in your front matter; kept as text (YYYY-MM-DD)"
						: undefined;
			extra[name] = { kind: "text", label: sentenceCase(key.name), ...(note ? { description: note } : {}) };
		}
	}
	if (summaryName === undefined) {
		fields.summary = {
			kind: "text",
			label: "Summary",
			role: "summary",
			multiline: true,
			fillFromBody: true,
			...localized,
		};
	}
	const collections: StarterSchema["collections"] = { post: { fields: { ...fields, ...extra } } };
	if (relationKeys.has("tag")) collections.tag = itemCollection("Tag", "tag", multiLocale);
	if (relationKeys.has("category")) collections.category = itemCollection("Category", "shapes", multiLocale);
	for (const [target, key] of relationKeys) {
		notes.push(`"${key}" becomes the ${target} collection and a relation field on post.`);
	}
	return { collections, notes };
}

/** The public address shape for a content folder: its last folder name (`content/blog` -> `/blog/:slug`), else `/posts/:slug`. */
export function pathFor(folder: ContentFolder | undefined): string {
	const last = folder?.dir.split("/").at(-1) ?? "";
	return /^[A-Za-z][\w-]*$/.test(last) && !["content", "data", "src", "_posts"].includes(last)
		? `/${last}/:slug`
		: defaultCollectionPath("post");
}
