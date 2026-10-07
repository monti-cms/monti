import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CmsConfig } from "../config/define";
import { parseSchemaFile } from "../schema-file/format";
import type { SchemaFile } from "../schema-file/types";
import { createSite } from "../site";
import { generateSchemaTypes, SCHEMA_FILE_CANDIDATES, SCHEMA_LINK } from "./schema-types";

/**
 * Where a site keeps its config, in the order `monti schema:extract` looks for it: `monti.config.ts` (a config whose data is still written in code), then the
 * site config file of the earlier setup (`cms.config.ts`, a default export of `defineSite` from `@monti-cms/core`).
 */
export const CONFIG_FILE_CANDIDATES = [
	"monti.config.ts",
	"src/monti.config.ts",
	"cms.config.ts",
	"src/cms.config.ts",
] as const;

/** What stays in the config file, because it needs code (or differs per environment). */
export interface StaysInCode {
	/** The part of the config (`plugins`, `blocks`, `site.url`, ...). */
	readonly what: string;
	/** Why, and what is in it. */
	readonly detail: string;
}

export interface ExtractedSchema {
	readonly schema: SchemaFile;
	readonly stays: readonly StaysInCode[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON paths of the functions inside a value (what a JSON file cannot hold). */
function functionPaths(value: unknown, at: string): string[] {
	if (typeof value === "function") return [at];
	if (Array.isArray(value)) return value.flatMap((item, index) => functionPaths(item, `${at}[${index}]`));
	if (isRecord(value))
		return Object.entries(value).flatMap(([key, item]) => functionPaths(item, at ? `${at}.${key}` : key));
	return [];
}

/**
 * Takes the plain-data part of a config: collections (with the labels the admin shows, in the admin language), locales, default locale, time zone, site settings
 * (except `url`, which differs per environment), admin path, language and text overrides, and seed templates. Everything that needs code is left out and listed in `stays`.
 * A plugin's fields are already in the collections (`seoFields()` made them), so they are data like the rest; the plugin itself stays in code.
 */
export function extractSchemaData(config: CmsConfig, options: { readonly locale?: string } = {}): ExtractedSchema {
	const stays: StaysInCode[] = [];
	// The site resolves the labels (they can be getters that follow the admin language) the way the admin shows them, or in the language asked for.
	const resolved = createSite(
		options.locale ? { ...config, admin: { ...config.admin, locale: options.locale } } : config,
	).snapshot();

	const collections = Object.fromEntries(
		Object.entries(resolved.collections).map(([name, collection]) => {
			const { body, allowed, ...rest } = collection;
			// The object form of `body` carries the allowed blocks and marks (and means the collection has a body).
			if (allowed) return [name, { ...rest, body: allowed }];
			// The default is left out: documents have a body, items do not.
			return [name, body === (collection.kind === "document") ? rest : { ...rest, body }];
		}),
	);
	const lost = functionPaths(config.collections, "collections");
	if (lost.length > 0) {
		stays.push({
			what: "collection options that are functions",
			detail: `${lost.join(", ")} (a JSON file cannot hold a function; the value is left out of the schema)`,
		});
	}

	const { url: _url, ...site } = (config.site ?? {}) as Record<string, unknown>;
	if (config.site && "url" in config.site) {
		stays.push({
			what: "site.url",
			detail:
				"differs per environment, so it is read from the SITE_URL environment variable (`site.url` in code overrides it)",
		});
	}

	let admin: SchemaFile["admin"];
	if (config.admin) {
		const { messages, ...rest } = config.admin;
		const strings: Record<string, Record<string, string>> = {};
		const functions: string[] = [];
		for (const [namespace, dict] of Object.entries(messages ?? {})) {
			for (const [key, value] of Object.entries(dict)) {
				if (typeof value === "string") strings[namespace] = { ...strings[namespace], [key]: value };
				else functions.push(`${namespace}.${key}`);
			}
		}
		if (functions.length > 0) {
			stays.push({ what: "admin.messages", detail: `${functions.join(", ")} (text built by a function needs code)` });
		}
		admin = { ...rest, ...(Object.keys(strings).length > 0 ? { messages: strings } : {}) };
	}

	if (config.plugins?.length) {
		stays.push({
			what: "plugins",
			detail: `${config.plugins.map((plugin) => plugin.name).join(", ")} (code; the fields they add to collections are in the schema)`,
		});
	}
	if (config.blocks?.length) {
		stays.push({
			what: "blocks",
			detail: `${config.blocks.map((block) => block.name).join(", ")} (block components are code)`,
		});
	}
	if (config.codeBlock)
		stays.push({ what: "codeBlock", detail: "line effects and themes can hold labels and functions" });
	if (config.media) stays.push({ what: "media", detail: "upload limits and formats" });

	const schema = {
		// The first version of the file: `monti schema:apply` raises it when the schema changes.
		schemaVersion: config.schemaVersion ?? 1,
		collections,
		locales: config.locales,
		defaultLocale: config.defaultLocale,
		...(config.timeZone !== undefined ? { timeZone: config.timeZone } : {}),
		...(Object.keys(site).length > 0 ? { site } : {}),
		...(admin && Object.keys(admin).length > 0 ? { admin } : {}),
		...(config.seed?.templates?.length ? { seed: { templates: config.seed.templates } } : {}),
	};
	// JSON drops `undefined`; reading it back through the format check also proves the result is a valid schema file.
	return { schema: parseSchemaFile(JSON.parse(JSON.stringify(schema))), stays };
}

/** The text of a schema file: the link to the JSON Schema first, then the data, indented with tabs. */
export const schemaFileText = (schema: SchemaFile, link = SCHEMA_LINK): string =>
	`${JSON.stringify({ $schema: link, ...schema }, null, "\t")}\n`;

export interface ExtractOptions {
	readonly cwd: string;
	/** Config file to read (relative to `cwd`). Default: `monti.config.ts`, then `cms.config.ts` (each also under `src/`). */
	readonly config?: string;
	/** Schema file to write (relative to `cwd`). Default: `monti.schema.json` next to the config file. */
	readonly out?: string;
	/** Replace the schema file if it exists. */
	readonly overwrite?: boolean;
	/** Also write the declaration file (default true). */
	readonly types?: boolean;
	/** Language the labels that plugins provide in the admin language (the SEO fields) are written in. Default: the admin language of the site. */
	readonly locale?: string;
	/** Loads the config module (absolute path). Default: `import()`, which runs TypeScript through tsx when the `monti` command registered it. Tests pass their own. */
	readonly load?: (
		file: string,
	) => Promise<{ readonly default?: unknown; readonly config?: unknown; readonly cms?: unknown }>;
}

export interface ExtractReport {
	readonly config: string;
	/** The schema file written, relative to `cwd`. */
	readonly schema: string;
	/** The declaration file written, relative to `cwd`. */
	readonly types?: string;
	readonly collections: number;
	readonly locales: number;
	readonly templates: number;
	readonly stays: readonly StaysInCode[];
}

/**
 * `monti schema:extract`: loads the site's config file (TypeScript is read by tsx, which `bin/monti.mjs` registers), writes its data part to `monti.schema.json`
 * and the types of that file, and reports what stays in code. It reads the site config as the default export (`defineSite` of `@monti-cms/core`) or, for
 * `monti.config.ts`, from the `cms` it exports. It never changes the config file; the report shows how to load the schema from it.
 */
export async function extractSchema(options: ExtractOptions): Promise<ExtractReport> {
	const { cwd } = options;
	const configFile =
		options.config ?? CONFIG_FILE_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!configFile || !existsSync(path.resolve(cwd, configFile))) {
		throw new Error(
			configFile
				? `config file not found: ${configFile}`
				: `cannot find ${CONFIG_FILE_CANDIDATES[0]}; pass --config <path>`,
		);
	}
	const out = options.out ?? path.join(path.dirname(configFile), SCHEMA_FILE_CANDIDATES[0]).split(path.sep).join("/");
	if (existsSync(path.resolve(cwd, out)) && !options.overwrite) {
		throw new Error(`${out} already exists; pass --overwrite to replace it`);
	}

	const file = path.resolve(cwd, configFile);
	const loaded = await (options.load ?? ((target) => import(pathToFileURL(target).href)))(file);
	const cms = loaded.cms as { readonly site?: { readonly config?: unknown } } | undefined;
	const config = (cms?.site?.config ?? loaded.default ?? loaded.config) as CmsConfig | undefined;
	if (!config || !isRecord(config.collections) || !Array.isArray(config.locales)) {
		throw new Error(
			`${configFile} must export the site config (\`export default defineSite({ ... })\`) or the CMS instance (\`export const cms = defineConfig({ ... })\`)`,
		);
	}
	const { schema, stays } = extractSchemaData(config, { locale: options.locale });

	const target = path.resolve(cwd, out);
	const link = path.relative(path.dirname(target), path.join(cwd, SCHEMA_LINK)).split(path.sep).join("/");
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, schemaFileText(schema, link.startsWith(".") ? link : `./${link}`));
	const types = options.types === false ? undefined : generateSchemaTypes({ cwd, schema: out }).out;
	return {
		config: configFile,
		schema: out,
		...(types ? { types } : {}),
		collections: Object.keys(schema.collections).length,
		locales: schema.locales.length,
		templates: schema.seed?.templates?.length ?? 0,
		stays,
	};
}

/** Turns the report into human-readable text, ending with the slim config to put in the config file. */
export function formatExtractReport(report: ExtractReport): string {
	const relative = path.posix.relative(path.posix.dirname(report.config), report.schema);
	const schemaImport = relative.startsWith(".") ? relative : `./${relative}`;
	const plugins = report.stays.some((item) => item.what === "plugins");
	const lines = [
		`Wrote ${report.schema} (${report.collections} collections, ${report.locales} locales, ${report.templates} seed templates).`,
		...(report.types
			? [`Wrote ${report.types} (the types of the schema; run \`monti schema:types --watch\` while you edit it).`]
			: []),
		"",
		report.stays.length > 0 ? `Stays in code (${report.config}):` : `Nothing needs to stay in code (${report.config}).`,
		...report.stays.map((item) => `  - ${item.what}: ${item.detail}`),
		"",
		`${report.config} is unchanged. To use the schema, replace its collections, locales, default locale, time zone, seed and admin path with the file:`,
		"",
		`  import schema from "${schemaImport}";`,
		report.config.endsWith("monti.config.ts") ? "  export const cms = defineConfig({" : "  export default defineSite({",
		"    schema,",
		...(plugins ? ["    plugins: [/* the plugins above */],"] : []),
		...report.stays.flatMap((item) => {
			if (item.what === "site.url") return ["    // site.url: set the SITE_URL environment variable"];
			return item.what === "blocks" || item.what === "codeBlock" || item.what === "media"
				? [`    ${item.what}: /* as before */,`]
				: [];
		}),
		...(report.config.endsWith("monti.config.ts") ? ["    /* database, auth and the rest as before */"] : []),
		"  });",
	];
	return lines.join("\n");
}
