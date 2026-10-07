import { z } from "zod";
import { isAdminPath, isHomeHref, isHttpUrl, isTimeZone, LOCALE_CODE, LOCALE_PREFIX_MODES } from "../config/rules";
import { CORE_BODY_BLOCKS, CORE_BODY_MARKS, HEADING_LEVELS } from "../schema/allowed";
import type { SchemaFile } from "./types";

/**
 * The runtime check of the schema file, written with zod. The JSON Schema editors read (`schema.json`) is generated from it too, so the file's format has one
 * definition. Objects are strict: a key the format does not have is an error (this is how the retired `workflow` option and a misspelt option are caught).
 *
 * Only the shape and the rules that name one value are checked here. Rules between collections (a relation to a collection that exists, one URL pattern per
 * collection, layout names) are checked by `defineConfig`, which every schema goes through.
 */

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
	hidden: flag.optional().describe("Stored and validated, but no input is drawn."),
	role: text
		.optional()
		.describe(
			"The meaning of the field: `summary`, `title` (the entry's title: a text field, not inside a conditional field), or a role a plugin reads. Unique per collection.",
		),
	tab: text.optional().describe("Tab of the edit screen the field is drawn in."),
};

const textField = z.strictObject({
	kind: z.literal("text"),
	...base,
	fillFromBody: z
		.union([flag, z.strictObject({ maxLength: count.optional() })])
		.optional()
		.describe("Filled from the start of the body when empty at publish. `true` is 160 characters."),
	multiline: flag.optional(),
	rows: count.optional().describe("Initial rows of a multiline input."),
	max: count.optional().describe("Maximum number of characters."),
	placeholder: text.optional(),
});

const slugField = z.strictObject({
	kind: z.literal("slug"),
	...base,
	from: text.optional().describe("The text field the address is made from (usually `title`)."),
	placeholder: text.optional(),
});

const relationField = z.strictObject({
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
const optionsHaveDefault = (field: { options: Record<string, string>; defaultValue: string }, ctx: z.RefinementCtx) => {
	if (!Object.hasOwn(field.options, field.defaultValue)) {
		ctx.addIssue({
			code: "custom",
			path: ["defaultValue"],
			message: `"${field.defaultValue}" is not one of the options (${Object.keys(field.options).join(", ")})`,
		});
	}
};
const selectField = z.strictObject(selectShape).superRefine(optionsHaveDefault);

const mediaField = z.strictObject({
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

const conditionalField = z
	.strictObject({
		kind: z.literal("conditional"),
		label: text,
		description: text.optional(),
		localized: base.localized,
		input: base.input,
		inputOptions: base.inputOptions,
		hidden: base.hidden,
		role: base.role,
		tab: base.tab,
		discriminant: selectField.describe("The select that decides which fields show."),
		values: z.record(text, z.record(text, valueField)).describe("Option value -> the fields shown for it."),
	})
	.superRefine((field, ctx) => {
		for (const option of Object.keys(field.values)) {
			if (!Object.hasOwn(field.discriminant.options, option)) {
				ctx.addIssue({
					code: "custom",
					path: ["values", option],
					message: `"${option}" is not an option of the discriminant (${Object.keys(field.discriminant.options).join(", ")})`,
				});
			}
		}
	});

const backlinkField = z.strictObject({
	kind: z.literal("backlink"),
	label: text,
	description: text.optional(),
	input: base.input,
	inputOptions: base.inputOptions,
	hidden: base.hidden,
	role: base.role,
	tab: base.tab,
	from: text.describe("The other collection that has the relation field."),
	via: text.describe("The many relation field of that collection that points here."),
	createInline: flag.optional(),
	placeholder: text.optional(),
});

const viewField = z.strictObject({
	kind: z.literal("view"),
	view: text.describe("Name of a view registered by an admin plugin (kebab-case)."),
	label: text.optional(),
	description: text.optional(),
	hidden: flag.optional(),
	tab: text.optional(),
});

const FIELD_KINDS = "text, slug, relation, select, media, conditional, backlink or view";
const field = z.discriminatedUnion(
	"kind",
	[textField, slugField, relationField, selectField, mediaField, conditionalField, backlinkField, viewField],
	{ error: `a field needs a "kind" of ${FIELD_KINDS}` },
);

const layoutGroup = z.strictObject({
	group: text.optional().describe("Group title. Without it the fields are drawn continuously."),
	fields: z.array(text),
	collapsed: flag.optional(),
	tab: text.optional(),
});

const bodyAllowed = z
	.strictObject({
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
	})
	.describe(
		"What the body allows. The editor offers only these, and every save and publish warns about stored content that is not listed (it is kept as it is and never rejected).",
	);

const collection = z.strictObject({
	label: text,
	kind: z.enum(["document", "item"], { error: 'a collection needs a "kind" of document or item' }),
	body: z
		.union([flag, bodyAllowed])
		.optional()
		.describe(
			"Whether entries have a body (default: documents do, items do not), or an object that limits the blocks, marks and heading levels the body allows.",
		),
	fields: z
		.record(text, field)
		.describe(
			"Field name -> definition. One text field is the title: the one with role `title`, or, when none has it, the one named `title`.",
		),
	path: text.optional().describe("Public address shape with `:slug` once, e.g. `/posts/:slug`."),
	icon: text.optional().describe("Admin sidebar icon name (lucide)."),
	layout: z.array(layoutGroup).optional().describe("Layout of the properties panel."),
	list: z
		.strictObject({ columns: z.array(text) })
		.optional()
		.describe("Columns of the admin list."),
});

const locale = z.strictObject({
	code: text.regex(LOCALE_CODE, { error: 'must look like "en", "pt-BR" or "zh-Hant"' }),
	name: text.describe("The language's name written in that language."),
	label: text.optional().describe("Name shown in the admin. Falls back to `name`."),
});

const site = z.strictObject({
	url: text
		.refine(isHttpUrl, { error: "must be an http(s) URL" })
		.optional()
		.describe("Public site URL. It differs per environment, so it is usually set in code."),
	aliases: z.array(text).optional().describe("Other host names of the same site."),
	name: text.optional(),
	previewPath: text.optional().describe("Start of the draft preview URL."),
	previewLocaleParam: z
		.union([text.regex(/^[A-Za-z][\w-]*$/, { error: "must be a query name" }), z.literal(false)])
		.optional(),
	localePrefix: z.enum(LOCALE_PREFIX_MODES as [string, ...string[]]).optional(),
	home: text.refine(isHomeHref, { error: 'must be a path ("/") or an http(s) URL' }).optional(),
});

const admin = z.strictObject({
	path: text.refine(isAdminPath, { error: 'must be a path like "/admin" (not "/" and not under "/api")' }).optional(),
	locale: text
		.refine(
			(value) => {
				try {
					new Intl.DateTimeFormat(value);
					return true;
				} catch {
					return false;
				}
			},
			{ error: "is not a valid locale" },
		)
		.optional(),
	messages: z.record(text, z.record(text, text)).optional().describe("Admin text overrides: namespace -> key -> text."),
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storedDocument = z.looseObject({ type: z.literal("doc"), version: z.number(), content: z.array(z.unknown()) });
const seedTemplate = z.union(
	[
		z.strictObject({ id: text.regex(UUID, { error: "must be a UUID" }), name: text, doc: storedDocument }),
		z.strictObject({ id: text.regex(UUID, { error: "must be a UUID" }), name: text, body: text, format: text }),
	],
	{ error: "a template needs either `doc` (a stored document) or both `body` and `format`" },
);

const migrationBase = {
	id: text.min(1).describe("Name of the transform, for good: it is recorded when it ran, so it runs once."),
	note: text.optional().describe("Why, for people reading the file."),
	collection: text.describe("Collection of the schema after the change."),
};

const migration = z.discriminatedUnion(
	"op",
	[
		z.strictObject({
			...migrationBase,
			op: z.literal("renameField"),
			from: text.describe("The field name stored values are under now."),
			to: text.describe("The new field name (a field of the schema)."),
		}),
		z.strictObject({
			...migrationBase,
			op: z.literal("mapOption"),
			field: text,
			from: text.describe("The select value that is no longer an option."),
			to: text.describe("The option it becomes."),
		}),
		z.strictObject({
			...migrationBase,
			op: z.literal("dropField"),
			field: text.describe("A field the schema no longer has. Its stored values are deleted."),
		}),
		z.strictObject({
			...migrationBase,
			op: z.literal("setDefault"),
			field: text,
			value: text.describe(
				"Stored in entries that have no value for the field (a text field, or an option of a select).",
			),
		}),
	],
	{ error: 'a migration needs an "op" of renameField, mapOption, dropField or setDefault' },
);

/** The schema file. Exported for the JSON Schema build; use `parseSchemaFile` to read one. */
export const schemaFileShape = z
	.strictObject({
		$schema: text.optional().describe("Link to this schema, for editor autocomplete."),
		schemaVersion: z
			.number()
			.int()
			.min(1)
			.optional()
			.describe(
				"Version of the schema (1 if left out). `monti schema:apply` raises it when the schema changes; entries record the version they were written or transformed under.",
			),
		collections: z
			.record(text, collection)
			.describe("Collection name -> definition. The name is a stored value, so do not change it in production."),
		migrations: z
			.array(migration)
			.optional()
			.describe(
				"Data transforms `monti schema:apply` runs once each, in order (rename a field, map a removed select option, drop a field, set a default). Applied ones stay as history.",
			),
		locales: z
			.array(locale)
			.min(1, { error: "needs at least one locale" })
			.describe("Content locales, in the order the admin shows them."),
		defaultLocale: text.describe("Default locale. Public URLs get no prefix for it."),
		timeZone: text
			.refine(isTimeZone, { error: "is not an IANA time zone" })
			.optional()
			.describe("IANA time zone for dates and times. UTC if unset."),
		site: site.optional(),
		admin: admin.optional(),
		seed: z
			.strictObject({ templates: z.array(seedTemplate).optional() })
			.optional()
			.describe("Data to seed a new store with."),
	})
	.superRefine((file, ctx) => {
		if (Object.keys(file.collections).length === 0) {
			ctx.addIssue({ code: "custom", path: ["collections"], message: "needs at least one collection" });
		}
		const ids = new Set<string>();
		for (const [index, item] of (file.migrations ?? []).entries()) {
			if (ids.has(item.id)) {
				ctx.addIssue({ code: "custom", path: ["migrations", index, "id"], message: `"${item.id}" is used twice` });
			}
			ids.add(item.id);
		}
		const codes = file.locales.map((item) => item.code);
		for (const [index, code] of codes.entries()) {
			if (codes.indexOf(code) !== index) {
				ctx.addIssue({ code: "custom", path: ["locales", index, "code"], message: `"${code}" is listed twice` });
			}
		}
		if (!codes.includes(file.defaultLocale)) {
			ctx.addIssue({
				code: "custom",
				path: ["defaultLocale"],
				message: `"${file.defaultLocale}" is not one of the locales (${codes.join(", ")})`,
			});
		}
	});

/** A problem in a schema file, with the JSON path of the value. */
export interface SchemaIssue {
	/** Path from the root, e.g. `collections.post.fields.title.kind` or `locales[1].code`. Empty for the root. */
	readonly path: string;
	readonly message: string;
}

/** A schema file that is not valid. `message` lists every problem with its JSON path. */
export class SchemaFileError extends Error {
	readonly issues: readonly SchemaIssue[];
	readonly source: string;
	constructor(source: string, issues: readonly SchemaIssue[]) {
		super(
			`${source} is not a valid schema file:\n${issues.map((issue) => `  ${issue.path || "(root)"}: ${issue.message}`).join("\n")}`,
		);
		this.name = "SchemaFileError";
		this.source = source;
		this.issues = issues;
	}
}

const IDENTIFIER = /^[A-Za-z_$][\w$-]*$/;
const formatPath = (path: readonly PropertyKey[]): string =>
	path.reduce<string>((out, key) => {
		if (typeof key === "number") return `${out}[${key}]`;
		const name = String(key);
		if (IDENTIFIER.test(name)) return out ? `${out}.${name}` : name;
		return `${out}[${JSON.stringify(name)}]`;
	}, "");

/**
 * Checks a schema file's content (already parsed from JSON) and returns a copy of it. Throws a {@link SchemaFileError} naming the JSON path of every problem.
 * `source` is what error messages call the file (its path).
 */
export function parseSchemaFile(input: unknown, source = "monti.schema.json"): SchemaFile {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new SchemaFileError(source, [{ path: "", message: "must be a JSON object" }]);
	}
	const result = schemaFileShape.safeParse(input);
	if (result.success) return result.data as unknown as SchemaFile;
	throw new SchemaFileError(
		source,
		result.error.issues.flatMap((issue) =>
			issue.code === "unrecognized_keys"
				? issue.keys.map((key) => ({
						path: formatPath([...issue.path, key]),
						message: "is not part of the schema format",
					}))
				: [{ path: formatPath(issue.path), message: issue.message }],
		),
	);
}
