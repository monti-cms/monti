import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "./config-paths";
import { SCHEMA_FILE_CANDIDATES } from "./schema-types";

/**
 * The blog theme (`monti add blog-theme`) is a set of pages, so it must agree with the schema it reads: the collection, the address the posts live at, and the names
 * of the summary, tags and author fields. This reads `monti.schema.json` and works out those values, so `monti init` and `monti add blog-theme` write a
 * `theme.config.ts` and route folders that match the schema as it is, and the links the schema's `path` produces land on pages that exist.
 */

export interface BlogThemeSettings {
	/** The collection of the posts. */
	readonly collection: string;
	/** Where the list page is mounted, from the `path` of the collection (`/posts/:slug` -> `/posts`). */
	readonly routeBase: string;
	/** The field with the `summary` role, if the collection has one. */
	readonly excerptField?: string;
	/** The relation field that holds many tags or topics, if any. */
	readonly topicsField?: string;
	/** The relation field that points to one author, if any. */
	readonly authorField?: string;
	/** Where the values come from, as one line for the report (`monti.schema.json: collection post at /posts ...`). */
	readonly summary: string;
	/** Things the person should do or know (the path has a shape the theme cannot serve, no schema file, ...). */
	readonly notes: readonly string[];
}

/** What the theme uses when there is no schema to read: the values `theme.config.ts` ships with. */
export const DEFAULT_BLOG_THEME_ROUTE_BASE = "/blog";

interface SchemaField {
	readonly kind?: unknown;
	readonly role?: unknown;
	readonly to?: unknown;
	readonly many?: unknown;
}

interface SchemaCollection {
	readonly kind?: unknown;
	readonly path?: unknown;
	readonly fields?: Record<string, SchemaField>;
}

/** The address part before `/:slug`: `/blog/:slug` -> `/blog`. `undefined` when the path has another shape (no slug at the end, or a parameter in front of it). */
export function routeBaseOf(pathPattern: string): string | undefined {
	const match = /^((?:\/[A-Za-z0-9_-]+)+)\/:slug\/?$/.exec(pathPattern);
	return match?.[1];
}

const TAG_TARGETS = new Set(["tag", "tags", "topic", "topics"]);
const AUTHOR_TARGETS = /^(author|authors|writer|writers|person|people|user|users)$/i;

/** The collection the theme shows: `post` when it is a document collection, else the first document collection that has a `path`, else the first document collection. */
function chooseCollection(collections: Record<string, SchemaCollection>): string | undefined {
	const documents = Object.entries(collections).filter(([, collection]) => collection.kind === "document");
	if (collections.post?.kind === "document") return "post";
	return (documents.find(([, collection]) => typeof collection.path === "string") ?? documents[0])?.[0];
}

/** Reads the schema file of the app in `cwd` (`monti.schema.json`, also under `src/`). `undefined` when there is none, or it cannot be read. */
export function readSchemaJson(
	cwd: string,
): { readonly file: string; readonly schema: Record<string, unknown> } | undefined {
	const file = SCHEMA_FILE_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!file) return undefined;
	try {
		const schema = parseJsonc(readFileSync(path.join(cwd, file), "utf8"));
		return schema && typeof schema === "object" ? { file, schema: schema as Record<string, unknown> } : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The settings of the blog theme for the schema of the app in `cwd`. Without a readable schema, or without a document collection, the theme's own defaults stay and the
 * notes say so.
 */
export function blogThemeSettings(cwd: string): BlogThemeSettings {
	const read = readSchemaJson(cwd);
	const fallback = (why: string): BlogThemeSettings => ({
		collection: "post",
		routeBase: DEFAULT_BLOG_THEME_ROUTE_BASE,
		summary: `${why}, so the theme keeps its defaults (collection post at ${DEFAULT_BLOG_THEME_ROUTE_BASE})`,
		notes: [`${why}. Set collection, routeBase and the field names in theme.config.ts to match your schema.`],
	});
	if (!read) return fallback("No monti.schema.json was found");
	const collections = (read.schema.collections ?? {}) as Record<string, SchemaCollection>;
	const collection = chooseCollection(collections);
	if (!collection) return fallback(`${read.file} has no document collection`);

	const definition = collections[collection] as SchemaCollection;
	const notes: string[] = [];
	let routeBase = DEFAULT_BLOG_THEME_ROUTE_BASE;
	const pathPattern = typeof definition.path === "string" ? definition.path : undefined;
	const derived = pathPattern === undefined ? undefined : routeBaseOf(pathPattern);
	if (derived) routeBase = derived;
	else {
		notes.push(
			pathPattern === undefined
				? `The collection "${collection}" has no path, so the theme serves its posts at ${routeBase}. Set "path": "${routeBase}/:slug" in ${read.file} so the links in bodies point there.`
				: `The path "${pathPattern}" of the collection "${collection}" is not of the form /<folder>/:slug that the theme serves, so the theme uses ${routeBase}. Change the path to "${routeBase}/:slug" in ${read.file}, or move the theme pages.`,
		);
	}

	const entries = Object.entries(definition.fields ?? {});
	const excerptField = entries.find(([, field]) => field.kind === "text" && field.role === "summary")?.[0];
	const relations = entries.filter(([, field]) => field.kind === "relation");
	const topicsField = (relations.find(
		([, field]) => field.many === true && typeof field.to === "string" && TAG_TARGETS.has(field.to),
	) ?? relations.find(([name, field]) => field.many === true && /tag|topic/i.test(name)))?.[0];
	const authorField = (relations.find(
		([, field]) => field.many !== true && typeof field.to === "string" && AUTHOR_TARGETS.test(field.to),
	) ?? relations.find(([name, field]) => field.many !== true && /author|writer/i.test(name)))?.[0];

	const parts = [
		`collection ${collection} at ${routeBase}`,
		excerptField ? `summary ${excerptField}` : "no summary field",
		topicsField ? `tags ${topicsField}` : "no tags field",
		authorField ? `author ${authorField}` : "no author field",
	];
	return {
		collection,
		routeBase,
		excerptField,
		topicsField,
		authorField,
		summary: `${read.file}: ${parts.join(", ")}`,
		notes,
	};
}

const quoted = (value: string | undefined) => (value === undefined ? "undefined" : JSON.stringify(value));

/**
 * `theme.config.ts` of the registry with the values of {@link BlogThemeSettings} in the lines of the `blogTheme` object. A line that is not there (the person
 * changed the file, or the registry did) is left as it is.
 */
export function applyBlogThemeSettings(source: string, settings: BlogThemeSettings): string {
	const line = (name: string, value: string) => (text: string) =>
		text.replace(new RegExp(`^(\\t${name}: )[^\\n]*(,)$`, "m"), `$1${value}$2`);
	return [
		line("collection", quoted(settings.collection)),
		line("routeBase", quoted(settings.routeBase)),
		line("authorField", quoted(settings.authorField)),
		line("topicsField", quoted(settings.topicsField)),
		line("excerptField", quoted(settings.excerptField)),
	].reduce((text, apply) => apply(text), source);
}
