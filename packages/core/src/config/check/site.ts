import type { CmsConfig } from "../define";
import {
	HOST_PATTERN,
	isAdminPath,
	isHttpUrl,
	isTimeZone,
	LOCALE_CODE,
	LOCALE_PREFIX_MODES,
	PREVIEW_PARAM_NAME,
	UUID_PATTERN,
} from "../rules";
import { checkKnownKeys, type IssueList, pathOf } from "./issue";

/** The keys a site config has. A key outside the list is a typo or an option that does not exist. */
export const SITE_KEYS: readonly string[] = [
	"collections",
	"locales",
	"defaultLocale",
	"site",
	"timeZone",
	"seed",
	"admin",
	"editor",
	"blocks",
	"plugins",
	"codeBlock",
	"media",
];

/** A number with a unit (`720px`, `48rem`, `80%`), or a `calc`, `min`, `max` or `clamp` of such lengths. Nothing that could end the declaration (`;`, braces, quotes). */
const CSS_LENGTH =
	/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|ex|vw|vh|vmin|vmax|cm|mm|in|pt|pc|%)$|^(?:calc|min|max|clamp)\([\w\s.,%+*/()-]+\)$/;

/** The width steps of the editor: each has a non-empty unique label and a CSS length, and there is at least one when `widths` is set. */
function checkEditor(list: IssueList, editor: CmsConfig["editor"]): void {
	if (editor === undefined) return;
	checkKnownKeys(list, "editor", editor, ["widths"]);
	const widths = editor.widths;
	if (widths === undefined) return;
	if (!Array.isArray(widths) || widths.length === 0) {
		list.add("editor.widths", "empty", "needs at least one { label, width } step (leave it out for the default steps)");
		return;
	}
	const labels = new Set<string>();
	for (const [index, step] of widths.entries()) {
		const at = pathOf("editor", "widths", index);
		if (typeof step?.label !== "string" || !step.label.trim())
			list.add(pathOf(at, "label"), "empty", "must not be empty");
		else if (labels.has(step.label))
			list.add(pathOf(at, "label"), "duplicate", `"${step.label}" is used twice; labels must be unique`);
		else labels.add(step.label);
		if (typeof step?.width !== "string" || !CSS_LENGTH.test(step.width.trim())) {
			list.add(
				pathOf(at, "width"),
				"css-length",
				`"${String(step?.width)}" is not a CSS length; write a number with a unit such as "720px" or "48rem"`,
			);
		}
	}
}

function checkLocales(list: IssueList, config: CmsConfig): void {
	const codes = config.locales.map((locale) => locale.code);
	if (codes.length === 0) list.add("locales", "empty", "needs at least one locale");
	for (const [index, code] of codes.entries()) {
		const at = pathOf("locales", index, "code");
		// Locale codes go straight into URLs and DB defaults (migrations). Only BCP 47 shapes (`ko`, `en`, `pt-BR`, `zh-Hant`) are accepted.
		if (!LOCALE_CODE.test(code)) list.add(at, "locale-code", `"${code}" must look like "en", "pt-BR" or "zh-Hant"`);
		else if (codes.indexOf(code) !== index) list.add(at, "duplicate", `"${code}" is listed twice`);
	}
	if (!codes.includes(config.defaultLocale)) {
		list.add(
			"defaultLocale",
			"unknown-locale",
			`"${config.defaultLocale}" is not one of the locales (${codes.join(", ")})`,
		);
	}
}

function checkSiteOptions(list: IssueList, site: CmsConfig["site"]): void {
	if (site === undefined) return;
	if (site.url !== undefined && !isHttpUrl(site.url))
		list.add("site.url", "http-url", `"${site.url}" is not an http(s) URL`);
	for (const [index, alias] of (site.aliases ?? []).entries()) {
		if (!HOST_PATTERN.test(alias))
			list.add(pathOf("site", "aliases", index), "host", `"${alias}" is not a host name (like "www.example.com")`);
	}
	if (site.localePrefix !== undefined && !LOCALE_PREFIX_MODES.includes(site.localePrefix)) {
		list.add("site.localePrefix", "enum", `must be one of ${LOCALE_PREFIX_MODES.join(", ")}`);
	}
	const param = site.previewLocaleParam;
	if (param !== undefined && param !== false && !PREVIEW_PARAM_NAME.test(param)) {
		list.add("site.previewLocaleParam", "query-name", `"${param}" is not a query name`);
	}
}

function checkAdmin(list: IssueList, admin: CmsConfig["admin"]): void {
	if (admin === undefined) return;
	if (admin.path !== undefined && !isAdminPath(admin.path)) {
		list.add("admin.path", "admin-path", `"${admin.path}" must be a path like "/admin" (not "/" and not under "/api")`);
	}
	if (admin.locale !== undefined) {
		try {
			new Intl.DateTimeFormat(admin.locale);
		} catch {
			list.add("admin.locale", "locale", `"${admin.locale}" is not a valid locale`);
		}
	}
}

function checkSeed(list: IssueList, seed: CmsConfig["seed"]): void {
	const ids = new Set<string>();
	for (const [index, template] of (seed?.templates ?? []).entries()) {
		const at = pathOf("seed", "templates", index);
		if (!UUID_PATTERN.test(template.id)) list.add(pathOf(at, "id"), "uuid", `"${template.id}" must be a UUID`);
		else if (ids.has(template.id.toLowerCase()))
			list.add(pathOf(at, "id"), "duplicate", `"${template.id}" is used twice`);
		ids.add(template.id.toLowerCase());
		const asDocument = template.doc !== undefined;
		const asText = template.body !== undefined || template.format !== undefined;
		if (
			asDocument === asText ||
			(asText && (typeof template.body !== "string" || typeof template.format !== "string"))
		) {
			list.add(at, "template-body", "needs either `doc` or both `body` and `format`");
		}
	}
}

/** The site-wide settings: top-level keys, locales, site and admin options, time zone, the editor and the seed. */
export function checkSite(list: IssueList, config: CmsConfig, alsoKnown: readonly string[] = []): void {
	checkKnownKeys(list, "", config, [...SITE_KEYS, ...alsoKnown]);
	checkLocales(list, config);
	checkSiteOptions(list, config.site);
	checkAdmin(list, config.admin);
	if (config.timeZone !== undefined && !isTimeZone(config.timeZone)) {
		list.add("timeZone", "time-zone", `"${config.timeZone}" is not an IANA time zone`);
	}
	checkEditor(list, config.editor);
	checkSeed(list, config.seed);
}
