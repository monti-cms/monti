import { z } from "zod";
import { ConfigError, type ConfigIssue, closestName, pathOf, SCHEMA_SOURCE_NAME } from "../config/check/issue";
import { LOCALE_PREFIX_MODES } from "../config/rules";
import { CORE_BODY_BLOCKS, CORE_BODY_MARKS, HEADING_LEVELS } from "../schema/allowed";
import type { SchemaFile } from "./types";

/**
 * The shape of the plain data of a site: collections, locales, site and admin settings, seed templates. It is written with zod and says only what a value is: its
 * type, the options an enum has, the keys an object may hold. Objects are strict, so a key the format does not have (a misspelt option, a retired one) is an error that
 * names the closest key. The rules about what a value means (a default option that exists, a time zone that exists, a relation to a collection that exists) are in
 * `config/check/`, which `defineSite` runs for every source, so the file, the code and the admin's forms are held to the same rules.
 */

/** An object whose keys are all known: an unknown key is reported with the keys it could have been (read back by {@link shapeIssues}). */
const KNOWN_KEYS_MARK = "\u0000known:";
const strict = <T extends z.ZodRawShape>(shape: T) =>
	z.strictObject(shape, {
		error: (issue) =>
			issue.code === "unrecognized_keys" ? `${KNOWN_KEYS_MARK}${JSON.stringify(Object.keys(shape))}` : undefined,
	});

const text = z.string();
const flag = z.boolean();
const count = z.number().int().min(1);

/** Properties every input field has. */
const base = {
	label: text.describe("Name shown next to the input."),
	description: text.optional().describe("Help text below the input."),
	required: z
		.literal(true, { error: "only `true` exists (a field is required to publish a document or to save an item)" })
		.optional()
		.describe("The field must not be empty. Documents check it when publishing, items when saving."),
	localized: z
		.union([flag, z.literal("inherit")])
		.optional()
		.describe(
			"`true`: each language has its own value. `inherit`: starts as the source language's value. Unset: shared.",
		),
	input: text.optional().describe("Name of a registered input to use instead of the default one."),
	inputOptions: z
		.record(text, z.union([text, z.number(), flag]))
		.optional()
		.describe("Settings for the input."),
	role: text
		.optional()
		.describe(
			"The meaning of the field: `summary`, `title` (the entry's title: a text field, not inside a conditional field), or a role a plugin reads. Unique per collection.",
		),
};

const textField = strict({
	kind: z.literal("text"),
	...base,
	fillFromBody: z
		.union([flag, strict({ maxLength: count.optional() })])
		.optional()
		.describe("Filled from the start of the body when empty at publish. `true` is 160 characters."),
	multiline: flag.optional(),
	rows: count.optional().describe("Initial rows of a multiline input."),
	max: count.optional().describe("Maximum number of characters."),
	placeholder: text.optional(),
});

const slugField = strict({
	kind: z.literal("slug"),
	...base,
	from: text.optional().describe("The text field the address is made from (usually `title`)."),
	placeholder: text.optional(),
});

const relationField = strict({
	kind: z.literal("relation"),
	...base,
	to: text.describe("The collection the relation points to."),
	many: flag.optional(),
	createInline: flag.optional().describe("Create a missing target next to the input."),
	publishedOnly: flag.optional().describe("Only published targets can be picked."),
	allowUnpublished: flag.optional().describe("Unpublished targets do not block publishing."),
	ordered: flag.optional().describe("The user decides the order of several targets."),
	placeholder: text.optional(),
});

const selectShape = {
	kind: z.literal("select"),
	...base,
	options: z.record(text, text).describe("Value -> label, in display order."),
	defaultValue: text,
};
const selectField = strict(selectShape);

const mediaField = strict({
	kind: z.literal("media"),
	...base,
	accept: z.enum(["image", "file"]).optional().describe("`image` (default) or any `file`."),
	placeholder: text.optional(),
});

/** Fields that store one value: the only fields a conditional field can show. */
const VALUE_KINDS = "text, relation, select or media";
const valueField = z.discriminatedUnion("kind", [textField, relationField, selectField, mediaField], {
	error: `a dependent field must be a ${VALUE_KINDS} field`,
});

const conditionalField = strict({
	kind: z.literal("conditional"),
	label: text,
	description: text.optional(),
	localized: base.localized,
	input: base.input,
	inputOptions: base.inputOptions,
	role: base.role,
	discriminant: selectField.describe("The select that decides which fields show."),
	values: z.record(text, z.record(text, valueField)).describe("Option value -> the fields shown for it."),
});

const backlinkField = strict({
	kind: z.literal("backlink"),
	label: text,
	description: text.optional(),
	input: base.input,
	inputOptions: base.inputOptions,
	role: base.role,
	from: text.describe("The other collection that has the relation field."),
	via: text.describe("The many relation field of that collection that points here."),
	createInline: flag.optional(),
	placeholder: text.optional(),
});

const viewField = strict({
	kind: z.literal("view"),
	view: text.describe("Name of a view registered by an admin plugin (kebab-case)."),
	label: text.optional(),
	description: text.optional(),
});

const FIELD_KINDS = "text, slug, relation, select, media, conditional, backlink or view";
const field = z.discriminatedUnion(
	"kind",
	[textField, slugField, relationField, selectField, mediaField, conditionalField, backlinkField, viewField],
	{ error: `a field needs a "kind" of ${FIELD_KINDS}` },
);

const layoutGroup = strict({
	group: text.optional().describe("Group title. Without it the fields are drawn continuously."),
	fields: z.array(text),
	collapsed: flag.optional(),
	tab: text.optional(),
});

const bodyAllowed = strict({
	blocks: z
		.array(text)
		.optional()
		.describe(
			`Allowed blocks: core blocks (${CORE_BODY_BLOCKS.join(", ")}) and blocks of block extensions or the site config by block name (callout, tabs, ...). Paragraphs and lists are always allowed. Left out: all blocks.`,
		),
	marks: z
		.array(text)
		.optional()
		.describe(
			`Allowed marks: ${CORE_BODY_MARKS.join(", ")}, and text styles of block extensions or the site config by block name (tooltip, color, ...). Left out: all marks.`,
		),
	headings: z
		.array(z.literal([...HEADING_LEVELS]))
		.optional()
		.describe("Allowed heading levels (1 to 6). The editor offers levels 2 to 4. Left out: all levels."),
}).describe(
	"What the body allows. The editor offers only these, and every save and publish warns about stored content that is not listed (it is kept as it is and never rejected).",
);

/** What a collection has in the file and in code, apart from its body. */
const collectionShape = {
	label: text,
	kind: z.enum(["document", "item"], { error: 'a collection needs a "kind" of document or item' }),
	fields: z
		.record(text, field)
		.describe(
			"Field name -> definition. One text field is the title: the one with role `title`, or, when none has it, the one named `title`.",
		),
	path: text.optional().describe("Public address shape with `:slug` once, e.g. `/posts/:slug`."),
	icon: text.optional().describe("Admin sidebar icon name (Carbon)."),
	folders: flag.optional().describe("Whether entries can be organized into virtual folders."),
	defaultTab: text.optional().describe("Custom title for the default properties tab."),
	layout: z.array(layoutGroup).optional().describe("Layout of the properties panel."),
};

/** A collection as the file writes it: `body` is a flag or the object that limits it. */
const fileCollection = strict({
	...collectionShape,
	body: z
		.union([flag, bodyAllowed])
		.optional()
		.describe(
			"Whether entries have a body (default: documents do, items do not), or an object that limits the blocks, marks and heading levels the body allows.",
		),
});

/** A collection as `defineSite` holds it once normalized: `body` is a flag and the limits are `allowed`. */
const normalizedCollection = strict({ ...collectionShape, body: flag, allowed: bodyAllowed.optional() });

const locale = strict({
	code: text,
	name: text.describe("The language's name written in that language."),
	label: text.optional().describe("Name shown in the admin. Falls back to `name`."),
});

const site = strict({
	url: text.optional().describe("Public site URL. It differs per environment, so it is usually set in code."),
	aliases: z.array(text).optional().describe("Other host names of the same site."),
	name: text.optional(),
	previewPath: text.optional().describe("Start of the draft preview URL."),
	previewLocaleParam: z.union([text, z.literal(false)]).optional(),
	localePrefix: z.enum(LOCALE_PREFIX_MODES as [string, ...string[]]).optional(),
});

/** Admin settings. A text override is a string in the file; code may also give a function of the placeholders. */
const adminShape = (message: z.ZodType) => ({
	path: text.optional(),
	locale: text.optional(),
	messages: z
		.record(text, z.record(text, message))
		.optional()
		.describe("Admin text overrides: namespace -> key -> text."),
	templates: z
		.boolean()
		.optional()
		.describe(
			"false hides body templates in the admin: the editor's template menu, the sidebar link and the Templates screen.",
		),
	translations: z
		.boolean()
		.optional()
		.describe(
			"false hides the translation UI in the admin (language tabs, locale column and filter). A site with one locale hides it anyway.",
		),
});
const admin = strict(adminShape(text));
const adminOfCode = strict(
	adminShape(z.union([text, z.custom<(...args: never[]) => string>((value) => typeof value === "function")])),
);

const storedDocument = z.looseObject({ type: z.literal("doc"), version: z.number(), content: z.array(z.unknown()) });
const seedTemplate = z.union(
	[strict({ id: text, name: text, doc: storedDocument }), strict({ id: text, name: text, body: text, format: text })],
	{ error: "a template needs either `doc` (a stored document) or both `body` and `format`" },
);

const migrationId = {
	id: text.min(1).describe("Name of the transform, for good: it is recorded when it ran, so it runs once."),
	note: text.optional().describe("Why, for people reading the file."),
};
const migrationBase = {
	...migrationId,
	collection: text.describe("Collection of the schema after the change."),
};

const migration = z.discriminatedUnion(
	"op",
	[
		strict({
			...migrationBase,
			op: z.literal("renameField"),
			from: text.describe("The field name stored values are under now."),
			to: text.describe("The new field name (a field of the schema)."),
		}),
		strict({
			...migrationBase,
			op: z.literal("mapOption"),
			field: text,
			from: text.describe("The select value that is no longer an option."),
			to: text.describe("The option it becomes."),
		}),
		strict({
			...migrationBase,
			op: z.literal("dropField"),
			field: text.describe("A field the schema no longer has. Its stored values are deleted."),
		}),
		strict({
			...migrationBase,
			collection: text.describe("A collection the schema no longer has. Every entry it held is deleted."),
			op: z.literal("dropCollection"),
		}),
		strict({
			...migrationId,
			op: z.literal("trashLocale"),
			locale: text.describe(
				"A language the schema no longer lists. Its live translations, in every collection, move to the trash.",
			),
		}),
		strict({
			...migrationBase,
			op: z.literal("setDefault"),
			field: text,
			value: text.describe(
				"Stored in entries that have no value for the field (a text field, or an option of a select).",
			),
		}),
	],
	{
		error: 'a migration needs an "op" of renameField, mapOption, dropField, dropCollection, trashLocale or setDefault',
	},
);

/** The keys of the plain data both the schema file and the code config hold (the file adds `migrations`). */
const plainShape = {
	locales: z.array(locale).describe("Content locales, in the order the admin shows them."),
	defaultLocale: text.describe("Default locale. Public URLs get no prefix for it."),
	timeZone: text.optional().describe("IANA time zone for dates and times. UTC if unset."),
	site: site.optional(),
	seed: strict({ templates: z.array(seedTemplate).optional() })
		.optional()
		.describe("Data to seed a new store with."),
};

/** The schema file. */
const schemaFileShape = strict({
	...plainShape,
	collections: z
		.record(text, fileCollection)
		.describe("Collection name -> definition. The name is a stored value, so do not change it in production."),
	migrations: z
		.array(migration)
		.optional()
		.describe(
			"Data transforms `monti schema:apply` runs once each, in order (rename a field, map a removed select option, drop a field, set a default, trash the translations of a removed language). Applied ones stay as history.",
		),
	admin: admin.optional(),
});

/** The plain data of a merged config, as `defineSite` holds it (collections normalized). The other keys (plugins, blocks, ...) are the rules' to check. */
const configShape = z.looseObject({
	...plainShape,
	collections: z.record(text, normalizedCollection),
	admin: adminOfCode.optional(),
});

const unknownKeyIssue = (path: readonly PropertyKey[], key: string, message: string): ConfigIssue => {
	const known = message.startsWith(KNOWN_KEYS_MARK)
		? (JSON.parse(message.slice(KNOWN_KEYS_MARK.length)) as string[])
		: [];
	const near = closestName(key, known);
	return {
		path: pathOf("", ...path, key),
		code: "unknown-key",
		message: near
			? `is not an option; did you mean "${near}"?`
			: `is not an option${known.length ? ` (known: ${known.join(", ")})` : ""}`,
	};
};

const typeMessage = (message: string): string => {
	const match = /expected (\w+), received (\w+)/.exec(message);
	if (!match) return message;
	return match[2] === "undefined"
		? "is required"
		: `must be ${match[1] === "object" ? "an object" : `a ${match[1]}`} (got ${match[2]})`;
};

/** Runs a shape over a value and returns what is wrong with it, as issues. */
function shapeIssues(shape: z.ZodType, input: unknown): ConfigIssue[] {
	const result = shape.safeParse(input);
	if (result.success) return [];
	return result.error.issues.flatMap((issue): ConfigIssue[] => {
		if (issue.code === "unrecognized_keys")
			return issue.keys.map((key) => unknownKeyIssue(issue.path, key, issue.message));
		const code =
			issue.code === "invalid_type"
				? issue.message.includes("received undefined")
					? "required"
					: "type"
				: issue.code === "invalid_value"
					? "enum"
					: issue.code === "too_small" || issue.code === "too_big"
						? "range"
						: "shape";
		return [
			{
				path: pathOf("", ...issue.path),
				code,
				message: code === "required" || code === "type" ? typeMessage(issue.message) : issue.message,
			},
		];
	});
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The shape problems of the plain data of a merged config (collections must already be normalized). */
export const configShapeIssues = (config: unknown): ConfigIssue[] =>
	// A normalized collection keeps the body's limits in `allowed`; the place a person wrote them is `body`.
	shapeIssues(configShape, config).map((issue) => ({
		...issue,
		path: issue.path.replace(/^(collections(?:\.[\w-]+|\["[^"]+"\]))\.allowed/, "$1.body"),
	}));

/** The migration ids are unique: an id is recorded when the transform ran, so two with one id would run once. */
function migrationIssues(file: SchemaFile): ConfigIssue[] {
	const ids = new Set<string>();
	const issues: ConfigIssue[] = [];
	for (const [index, item] of (file.migrations ?? []).entries()) {
		if (ids.has(item.id))
			issues.push({
				path: pathOf("migrations", index, "id"),
				code: "duplicate",
				message: `"${item.id}" is used twice`,
			});
		ids.add(item.id);
	}
	return issues;
}

/**
 * Checks a schema file's content (the object `defineSchema` was given) and returns a copy of it. Throws a {@link ConfigError} naming the path of every problem in its shape.
 * What the values mean is checked by `defineSite`, which every schema goes through. `source` is what error messages call the file (its path).
 */
export function parseSchemaFile(input: unknown, source = SCHEMA_SOURCE_NAME): SchemaFile {
	if (!isRecord(input)) throw new ConfigError(source, [{ path: "", code: "type", message: "must be an object" }]);
	const issues = shapeIssues(schemaFileShape, input);
	if (issues.length === 0) issues.push(...migrationIssues(input as unknown as SchemaFile));
	if (issues.length > 0) throw new ConfigError(source, issues);
	return schemaFileShape.parse(input) as unknown as SchemaFile;
}
