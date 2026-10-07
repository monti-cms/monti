/**
 * What the front matter keys of a post usually mean. `monti init` uses it to shape the starter schema, `monti import` uses it to guess the mapping, and
 * both read this one list, so a key that init makes a field for is a key that import fills (and a key import would send to the publish date gets no field).
 * Keys are compared in lower case.
 */

/** Keys that hold the publish date. They map to the publish date of the entry (`@publishedAt`), so the schema gets no field for them. */
export const DATE_KEYS: ReadonlySet<string> = new Set([
	"date",
	"pubdate",
	"publishdate",
	"publisheddate",
	"publishedat",
	"datepublished",
]);

/** Keys that hold the short description of a post. They map to the field with the `summary` role. */
export const SUMMARY_KEYS: ReadonlySet<string> = new Set([
	"description",
	"summary",
	"excerpt",
	"abstract",
	"subtitle",
	"intro",
]);

/** Keys that hold the language of a post. */
export const LOCALE_KEYS: ReadonlySet<string> = new Set(["lang", "locale", "language"]);

/** Keys the CMS keeps itself (publish state), so no field is made for them. */
export const CMS_STATE_KEYS: ReadonlySet<string> = new Set(["draft", "published", "publish", "status"]);

/**
 * Keys that hold terms (tags, categories) and so become relations to entries of another collection. The value is the collection the key most likely means.
 */
export const RELATION_KEYS: Readonly<Record<string, string>> = {
	tag: "tag",
	tags: "tag",
	keyword: "tag",
	keywords: "tag",
	topic: "tag",
	topics: "tag",
	category: "category",
	categories: "category",
	series: "series",
};

/** The collections `monti init` makes for the relation keys it finds (not `series`: a series needs its own design). */
export const INIT_RELATION_COLLECTIONS = ["tag", "category"] as const;
