/**
 * What the front matter keys of a post usually mean: the one table `monti init` (to shape the starter schema) and `monti import` (to guess the mapping) read.
 * To change how a key is understood, edit a row. A key that is in no row is never guessed: import reports it as not mapped and leaves it out (unless the
 * collection has a field of exactly that name). Keys are compared in lower case.
 */

export type KeyRole =
	| "title"
	| "slug"
	| "publishedAt"
	| "draft"
	| "published"
	| "state"
	| "summary"
	| "locale"
	| "tag"
	| "category"
	| "series"
	| "filenameLocale";

export interface KeyRow {
	readonly role: KeyRole;
	readonly keys: readonly string[];
	readonly note: string;
}

export const KEY_TABLE: readonly KeyRow[] = [
	{ role: "title", keys: ["title"], note: "the title field of the collection" },
	{ role: "slug", keys: ["slug"], note: "the address of the entry; without it the address is made from the file name" },
	{
		role: "publishedAt",
		keys: ["date", "pubDate", "publishDate", "publishedDate", "publishedAt", "datePublished"],
		note: "the publish date. lastmod, updatedDate and modified are not the publish date and are left out",
	},
	{ role: "draft", keys: ["draft"], note: "true keeps the entry a draft (only when every value is true or false)" },
	{
		role: "published",
		keys: ["published"],
		note: "false keeps the entry a draft; a date is taken as the publish date",
	},
	{
		role: "state",
		keys: ["publish", "status"],
		note: "publish state the CMS keeps itself: init makes no field for it",
	},
	{
		role: "summary",
		keys: ["description", "summary", "excerpt", "abstract"],
		note: "the field with the summary role",
	},
	{
		role: "locale",
		keys: ["lang", "locale", "language"],
		note: "the language, when every value is a language of the site",
	},
	{
		role: "tag",
		keys: ["tag", "tags", "keyword", "keywords", "topic", "topics"],
		note: "a relation to the tag collection",
	},
	{ role: "category", keys: ["category", "categories"], note: "a relation to the category collection" },
	{ role: "series", keys: ["series"], note: "a relation to the series collection (init makes none)" },
	{
		role: "filenameLocale",
		keys: ["<name>.<lang>.md", "<name>.<lang>.mdx"],
		note: "the language in the file name (hello.ko.mdx is the ko translation of hello.mdx)",
	},
];

/** The keys of the given roles, in lower case. */
export const keysOf = (...roles: KeyRole[]): ReadonlySet<string> =>
	new Set(
		KEY_TABLE.filter((row) => roles.includes(row.role)).flatMap((row) => row.keys.map((key) => key.toLowerCase())),
	);

/** Keys that hold the publish date: the schema gets no field for them. */
export const DATE_KEYS = keysOf("publishedAt");
/** Keys that hold the short description of a post. */
export const SUMMARY_KEYS = keysOf("summary");
/** Keys that hold the language of a post. */
export const LOCALE_KEYS = keysOf("locale");
/** Keys the CMS keeps itself (publish state), so no field is made for them. */
export const CMS_STATE_KEYS = keysOf("draft", "published", "state");

/** Keys that hold terms and so become relations to entries of another collection. The value is the collection the key most likely means. */
export const RELATION_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
	KEY_TABLE.filter((row) => row.role === "tag" || row.role === "category" || row.role === "series").flatMap((row) =>
		row.keys.map((key) => [key.toLowerCase(), row.role]),
	),
);
