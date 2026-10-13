import { CONFIG_SOURCE, type Issue, pathOf, SCHEMA_SOURCE_NAME, throwIssues } from "../config/check/issue";
import type { SiteConfig } from "../config/define";
import { parseSchemaFile } from "./format";

/** The layers under the code config: what it is laid over (the environment's site URL, say). */
export interface ConfigDefaults {
	readonly site?: SiteConfig;
	/** Keys the caller reads itself (the server options), so a misspelt one is suggested the right name. */
	readonly alsoKnown?: readonly string[];
}

/** What `defineSite` takes next to `schema`: the code part of the config (anything the config has, except what the file owns). */
type CodeConfig = { readonly schema: unknown } & { readonly [key: string]: unknown };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The keys of `over` that are set (not `undefined`) laid over `base`: `site: { url: process.env.X || undefined }` keeps the file's `url`. */
export const overlay = <T extends object>(base: T | undefined, over: unknown): T | undefined => {
	if (over === undefined) return base;
	if (!isRecord(over)) return over as T;
	const set = Object.fromEntries(Object.entries(over).filter(([, value]) => value !== undefined));
	return { ...base, ...set } as T;
};

/** A config written in code only, with the lowest layer under its `site`. */
export const layerSite = (config: Record<string, unknown>, defaults: ConfigDefaults): Record<string, unknown> => {
	const site = overlay(defaults.site, config.site);
	return site === undefined ? config : { ...config, site };
};

/**
 * Merges the schema file into the code part of a config, and returns the config `defineSite` checks like any other. The rule is that code adds to the file
 * and may override its environment-specific settings, but never silently replaces its data:
 *
 * - `collections`: the file's collections and the code's, side by side. The same name in both is an error.
 * - `locales`, `defaultLocale` and `schemaVersion`: only in the file (setting them in code too is an error).
 * - `site` and `admin`: key by key, the code's value wins. A key set to `undefined` in code leaves the file's value.
 * - `timeZone`: the code's value wins.
 * - `seed.templates`: the file's templates, then the code's.
 * - everything else (`plugins`, `blocks`, `codeBlock`, `media`): from code, the file has none of it.
 */
export function resolveSchemaConfig(config: CodeConfig, defaults: ConfigDefaults = {}): Record<string, unknown> {
	const { schema: option, ...code } = config;
	const file = parseSchemaFile(option, SCHEMA_SOURCE_NAME);
	const source = SCHEMA_SOURCE_NAME;

	const issues: Issue[] = [];
	for (const key of ["locales", "defaultLocale", "schemaVersion"] as const) {
		if (code[key] !== undefined) {
			issues.push({
				path: key,
				code: "set-twice",
				message: `is set in the config and in ${source}; keep it in the schema file (a site's locales, default locale and schema version have one place)`,
			});
		}
	}
	const codeCollections = isRecord(code.collections) ? code.collections : {};
	for (const name of Object.keys(codeCollections)) {
		if (Object.hasOwn(file.collections, name)) {
			issues.push({
				path: pathOf("collections", name),
				code: "set-twice",
				message: `is defined in ${source} and in the config; define it in one place`,
			});
		}
	}
	throwIssues(CONFIG_SOURCE, issues);
	const codeSeed = isRecord(code.seed) ? code.seed : undefined;
	const templates = [
		...(file.seed?.templates ?? []),
		...(Array.isArray(codeSeed?.templates) ? codeSeed.templates : []),
	];

	const merged: Record<string, unknown> = {
		...code,
		collections: { ...file.collections, ...codeCollections },
		locales: file.locales,
		defaultLocale: file.defaultLocale,
	};
	if (file.schemaVersion !== undefined) merged.schemaVersion = file.schemaVersion;
	const timeZone = code.timeZone ?? file.timeZone;
	if (timeZone !== undefined) merged.timeZone = timeZone;
	const site = overlay(overlay(defaults.site, file.site), code.site);
	if (site) merged.site = site;
	const admin = overlay(file.admin, code.admin);
	if (admin) merged.admin = admin;
	if (templates.length > 0 || file.seed || codeSeed) merged.seed = { ...file.seed, ...codeSeed, templates };
	return merged;
}
