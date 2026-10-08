import { createHash } from "node:crypto";
import { slugify } from "../../core/slug";
import type { FormatRegistry } from "../../format/registry";
import type { CmsFormat } from "../../format/types";
import type { Site } from "../../site";
import {
	type FieldTarget,
	fieldOfTarget,
	type ImportMapping,
	LOCALE_SOURCES,
	reservedOf,
	TARGET_DRAFT,
	TARGET_LOCALE,
	TARGET_PUBLISHED,
	TARGET_PUBLISHED_AT,
	TARGET_SKIP,
	TARGET_SLUG,
} from "./mapping";
import { derivePath, folderKeyOf, localeCode, type ParsedSource, type PathInfo, type SourceExtension } from "./source";

/**
 * The plan of an import: for every file, the collection, language, address, field values and publish state its path, front matter and the mapping say, and the
 * problems found on the way. Nothing here touches the database.
 */

export type NoticeKind =
	| "parse_error"
	| "front_matter"
	| "no_format"
	| "no_collection"
	| "unknown_locale"
	| "no_source"
	| "duplicate_slug"
	| "unknown_field"
	| "missing_required"
	| "invalid_value"
	| "link"
	| "image"
	| "relation"
	| "date"
	| "translation"
	| "publish";

export interface Notice {
	readonly kind: NoticeKind;
	readonly message: string;
}

export interface RelationUse {
	readonly key: string;
	readonly field: string;
	readonly to: string;
	readonly many: boolean;
	readonly create: boolean;
	readonly values: readonly string[];
}

export interface MediaUse {
	readonly key: string;
	readonly field: string;
	readonly value: string;
}

export interface FilePlan {
	readonly source: ParsedSource;
	readonly path: PathInfo;
	readonly folder: string;
	/** `undefined`: the file is not imported (`skip` says why). */
	readonly collection: string | undefined;
	readonly format: string | undefined;
	readonly locale: string;
	slug: string;
	/** The front matter gave the address (a translation without one takes the address of its source). */
	slugGiven: boolean;
	/** Field values that are text (or a list of text). Relations and media are in their own lists. */
	readonly values: Record<string, string | string[]>;
	readonly relations: RelationUse[];
	readonly mediaFields: MediaUse[];
	readonly draft: boolean;
	readonly publishedAt: Date | undefined;
	/** Front matter keys that go nowhere. */
	readonly skippedKeys: string[];
	/** Changes when the file or what decides how it is read changes. */
	readonly hash: string;
	/** Problems that keep the file from being imported. */
	readonly errors: Notice[];
	readonly warnings: Notice[];
	/** Why the file is left out without it being a problem (its folder is not imported). */
	skip?: string;
}

export interface PlanOptions {
	readonly site: Site;
	readonly mapping: ImportMapping;
	readonly formats: FormatRegistry;
	/** `--format`: the format of every file. */
	readonly format?: string;
}

/** The format that reads a file extension. `.md` is read by the MDX format when no format claims it. */
export function formatForExtension(
	formats: FormatRegistry,
	ext: SourceExtension,
	mapping: ImportMapping,
	forced: string | undefined,
): CmsFormat | undefined {
	const importable = formats.list().filter((format) => typeof format.import === "function");
	const named = forced ?? mapping.formats?.[ext];
	if (named) return importable.find((format) => format.name === named);
	return (
		importable.find((format) => format.extension.toLowerCase() === ext) ??
		(ext === "md" ? importable.find((format) => format.extension.toLowerCase() === "mdx") : undefined)
	);
}

const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const asText = (value: unknown): string | undefined => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
};

const asList = (value: unknown): string[] =>
	(Array.isArray(value) ? value : [value]).flatMap((item) => {
		const text = asText(item);
		return text === undefined || text.trim() === "" ? [] : [text.trim()];
	});

/** The address a name or a front matter value stands for. */
export function slugOf(raw: string, fromFrontMatter: boolean): string {
	if (fromFrontMatter) {
		const last =
			raw
				.trim()
				.replace(/^\/+|\/+$/g, "")
				.split("/")
				.pop() ?? "";
		if (/^[\p{L}\p{N}_-]+$/u.test(last)) return last.normalize("NFC");
		return slugify(last);
	}
	return slugify(raw);
}

/** The mapping of a folder as one string, for the hash of the files in it. */
const mappingKey = (folder: ImportMapping["folders"][string], mapping: ImportMapping, format: string | undefined) =>
	JSON.stringify([folder, mapping.locale?.from ?? [], format ?? null]);

/** Plans every file. */
export function planFiles(sources: readonly ParsedSource[], options: PlanOptions): FilePlan[] {
	const { site } = options;
	const plans = sources.map((source) => planFile(source, options));
	for (const plan of plans) {
		if (!plan.collection || plan.skip || plan.slugGiven || plan.locale === site.DEFAULT_LOCALE) continue;
		const source = plans.find(
			(other) =>
				other !== plan &&
				other.errors.length === 0 &&
				other.locale === site.DEFAULT_LOCALE &&
				groupId(other) === groupId(plan),
		);
		if (source) plan.slug = source.slug;
	}
	markDuplicates(site, plans);
	markMissingSources(site, plans);
	return plans;
}

function planFile(source: ParsedSource, options: PlanOptions): FilePlan {
	const { site, mapping } = options;
	const path = derivePath(source.rel, site.LOCALES);
	const folderKey = folderKeyOf(source, site.LOCALES);
	const folder = mapping.folders[folderKey];
	const format = formatForExtension(options.formats, source.ext, mapping, options.format);
	const errors: Notice[] = [];
	const warnings: Notice[] = [];
	const plan: FilePlan = {
		source,
		path,
		folder: folderKey,
		collection: folder?.collection ?? undefined,
		format: format?.name,
		locale: site.DEFAULT_LOCALE,
		slug: slugOf(path.name, false),
		slugGiven: false,
		values: {},
		relations: [],
		mediaFields: [],
		draft: false,
		publishedAt: undefined,
		skippedKeys: [],
		hash: createHash("sha256")
			.update(source.hash)
			.update(mappingKey(folder ?? { collection: null, fields: {} }, mapping, format?.name))
			.digest("hex"),
		errors,
		warnings,
	};

	if (path.unknownLocaleSuffix) {
		// `hello.ko.mdx` with no `ko` language: importing it would make a second, unrelated post with a mangled address (`helloko`).
		warnings.push({
			kind: "unknown_locale",
			message: `the file name ends in ".${path.unknownLocaleSuffix}", but ${path.unknownLocaleSuffix} is not one of the site's languages (${site.LOCALES.join(", ")}), so the file is skipped. To import it as a translation, add ${path.unknownLocaleSuffix} to "locales" in monti.schema.json first`,
		});
		return Object.assign(plan, {
			skip: `its language ".${path.unknownLocaleSuffix}" is not one of the site's languages (${site.LOCALES.join(", ")})`,
		});
	}
	if (source.error) {
		errors.push({ kind: "front_matter", message: source.error });
		return plan;
	}
	if (!folder || folder.collection === null) {
		return Object.assign(plan, { skip: "its folder is not imported" });
	}
	const collection = folder.collection;
	if (!format) {
		errors.push({
			kind: "no_format",
			message: `no format reads .${source.ext} files; add the MDX plugin to monti.config.ts (plugins: [mdx()] from @monti-cms/mdx)`,
		});
		return plan;
	}

	const fieldsByName = new Map(site.storedFields(collection).map((stored) => [stored.name, stored.field]));
	const entries = Object.entries(source.front);

	// Language: the sources in the mapping's order, the first that has an answer wins.
	const localeKey = entries.find(([key]) => {
		const target = folder.fields[key];
		return target !== undefined && reservedOf(target) === TARGET_LOCALE;
	});
	const sourcesOfLocale = mapping.locale?.from ?? [...LOCALE_SOURCES];
	let locale: string | undefined;
	for (const from of sourcesOfLocale) {
		if (from === "frontMatter" && localeKey) {
			const given = asText(firstOf(localeKey[1]));
			if (given === undefined) continue;
			locale = localeCode(given, site.LOCALES);
			if (!locale) {
				errors.push({
					kind: "unknown_locale",
					message: `the language "${given}" is not one of the site's languages (${site.LOCALES.join(", ")})`,
				});
				return plan;
			}
		} else if (from === "filename") locale = path.localeFromFilename;
		else if (from === "folder") locale = path.localeFromFolder;
		if (locale) break;
	}
	Object.assign(plan, { locale: locale ?? site.DEFAULT_LOCALE });
	if (plan.locale !== site.DEFAULT_LOCALE && site.isItemCollection(collection)) {
		errors.push({
			kind: "translation",
			message: `${collection} entries have one address in every language; only ${site.DEFAULT_LOCALE} files can be imported into it`,
		});
	}

	const localized = (name: string) => Boolean(fieldsByName.get(name)?.localized);
	let draft = false;
	let givenSlug: string | undefined;

	for (const [key, raw] of entries) {
		const target: FieldTarget | undefined = folder.fields[key];
		if (target === undefined) {
			plan.skippedKeys.push(key);
			warnings.push({ kind: "unknown_field", message: `"${key}" is not in the mapping, so it is skipped` });
			continue;
		}
		const reserved = reservedOf(target);
		if (reserved === TARGET_SKIP) {
			plan.skippedKeys.push(key);
			warnings.push({ kind: "unknown_field", message: `"${key}" has no field in ${collection}, so it is skipped` });
			continue;
		}
		if (reserved === TARGET_LOCALE) continue;
		if (reserved === TARGET_SLUG) {
			const text = asText(firstOf(raw));
			if (text?.trim()) givenSlug = slugOf(text, true);
			continue;
		}
		if (reserved === TARGET_PUBLISHED_AT) {
			const text = asText(firstOf(raw));
			const date = text ? new Date(text) : undefined;
			if (date && !Number.isNaN(date.getTime())) Object.assign(plan, { publishedAt: date });
			else
				warnings.push({
					kind: "date",
					message: `"${key}" (${String(raw)}) is not a date, so the publish date is the import time`,
				});
			continue;
		}
		if (reserved === TARGET_DRAFT) {
			if (raw === true || raw === "true") draft = true;
			continue;
		}
		if (reserved === TARGET_PUBLISHED) {
			if (raw === false || raw === "false") draft = true;
			continue;
		}
		if (reserved) {
			plan.skippedKeys.push(key);
			continue;
		}

		const named = fieldOfTarget(target);
		if (!named) continue;
		const field = fieldsByName.get(named.field);
		if (!field) {
			warnings.push({
				kind: "unknown_field",
				message: `"${key}" goes to the field "${named.field}", which ${collection} does not have`,
			});
			plan.skippedKeys.push(key);
			continue;
		}
		if (plan.locale !== site.DEFAULT_LOCALE && !localized(named.field)) {
			// A translation shares the fields that are not per language with its source.
			continue;
		}
		if (field.kind === "relation") {
			const values = asList(raw);
			if (values.length > 0) {
				plan.relations.push({
					key,
					field: named.field,
					to: field.to,
					many: field.many === true,
					create: named.create ?? site.isItemCollection(field.to),
					values: field.many === true ? values : values.slice(0, 1),
				});
				if (field.many !== true && values.length > 1) {
					warnings.push({
						kind: "relation",
						message: `"${key}" has ${values.length} values but ${named.field} takes one; the first is used`,
					});
				}
			}
		} else if (field.kind === "media") {
			const text = asText(firstOf(raw));
			if (text?.trim()) plan.mediaFields.push({ key, field: named.field, value: text.trim() });
		} else if (field.kind === "select") {
			const text = asText(firstOf(raw));
			const options = Object.entries(field.options);
			const hit = options.find(
				([value, label]) =>
					text !== undefined &&
					(value.toLowerCase() === text.toLowerCase() || String(label).toLowerCase() === text.toLowerCase()),
			);
			if (hit) plan.values[named.field] = hit[0];
			else
				warnings.push({
					kind: "invalid_value",
					message: `"${key}" is ${JSON.stringify(raw)}, which is not an option of ${named.field} (${options.map(([value]) => value).join(", ")}); it is skipped`,
				});
		} else {
			const text = Array.isArray(raw) ? asList(raw).join(", ") : asText(raw);
			if (text === undefined) {
				warnings.push({ kind: "invalid_value", message: `"${key}" is not text, so it is skipped` });
				continue;
			}
			plan.values[named.field] = text;
		}
	}

	Object.assign(plan, { draft, slug: givenSlug ?? plan.slug, slugGiven: givenSlug !== undefined });
	if (!plan.slug)
		errors.push({
			kind: "front_matter",
			message: "no address can be made from the file name; add `slug` to the front matter",
		});

	// What the collection requires and the file does not have. A draft saves anyway; publishing is blocked until it is filled in.
	const missing: string[] = [];
	for (const [name, field] of fieldsByName) {
		if (!("required" in field) || field.required !== true) continue;
		if (plan.locale !== site.DEFAULT_LOCALE && !localized(name)) continue;
		const filled =
			Boolean(plan.values[name]) ||
			plan.relations.some((use) => use.field === name) ||
			plan.mediaFields.some((use) => use.field === name);
		if (!filled) missing.push(name);
	}
	if (missing.length > 0) {
		warnings.push({
			kind: "missing_required",
			message: `missing required ${missing.length === 1 ? "field" : "fields"}: ${missing.join(", ")} (the entry imports as a draft and cannot be published until ${missing.length === 1 ? "it is" : "they are"} filled in)`,
		});
	}
	return plan;
}

/** Two files for one address: the first keeps it. */
function markDuplicates(site: Site, plans: readonly FilePlan[]): void {
	const seen = new Map<string, FilePlan>();
	for (const plan of plans) {
		if (!plan.collection || plan.errors.length > 0 || plan.skip) continue;
		const id = `${plan.collection}\u0000${plan.locale}\u0000${plan.slug}`;
		const first = seen.get(id);
		if (first) {
			plan.errors.push({
				kind: "duplicate_slug",
				message: `${plan.collection} already has "${plan.slug}" in ${plan.locale} from ${first.source.rel}; give one of the files a different slug`,
			});
		} else seen.set(id, plan);
	}
	void site;
}

/** A translation needs its file in the default language (the source of the group). */
function markMissingSources(site: Site, plans: readonly FilePlan[]): void {
	const groups = new Map<string, FilePlan[]>();
	for (const plan of plans) {
		if (!plan.collection || plan.errors.length > 0 || plan.skip) continue;
		const id = groupId(plan);
		groups.set(id, [...(groups.get(id) ?? []), plan]);
	}
	for (const members of groups.values()) {
		if (members.some((plan) => plan.locale === site.DEFAULT_LOCALE)) continue;
		for (const plan of members) {
			plan.errors.push({
				kind: "no_source",
				message: `it is a ${plan.locale} file and no ${site.DEFAULT_LOCALE} file of the same post was found (a translation is made from the ${site.DEFAULT_LOCALE} entry)`,
			});
		}
	}
}

/** The files of one post in several languages share this. */
export const groupId = (plan: Pick<FilePlan, "collection" | "path">): string =>
	`${plan.collection}\u0000${plan.path.groupKey}`;
