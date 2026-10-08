import type { BodyAllowed } from "./allowed";
import type { BacklinkField, Field, SlugField, ValueField, ValueOf } from "./fields";
import { valueFieldsOf } from "./walk";

/**
 * Collection kind.
 *
 * - `document`: you write a body and it is split into a draft and a published version. It goes public with an explicit publish (e.g. posts).
 * - `item`: saving in a small form applies straight to the current (public) value. There is no publish, archive or translation copy (e.g. tags).
 */
export type CollectionKind = "document" | "item";

/** System columns of the list. They are values of the content itself, not fields. */
export const SYSTEM_LIST_COLUMNS = ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"] as const;
export type SystemListColumn = (typeof SYSTEM_LIST_COLUMNS)[number];

/**
 * Checks whether a name can be used by the list columns (`list.columns`). Only system columns, stored field names (including fields dependent on a conditional field),
 * address field names, and `slug` when an address field exists are allowed. It is an error if the name is unknown, the field is not stored (view or reverse relation),
 * or the same name is written twice. Called by `defineSite`.
 */
export function validateListColumns(
	collection: string,
	schema: Pick<CollectionSchema, "fields"> & { readonly list?: { readonly columns: readonly string[] } },
): void {
	const columns = schema.list?.columns;
	if (columns === undefined) return;
	if (!Array.isArray(columns))
		throw new Error(`cms.config: ${collection}.list.columns must be an array of column names`);
	const stored = new Set(valueFieldsOf(schema).map((field) => field.name));
	const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
	const system = new Set<string>(SYSTEM_LIST_COLUMNS);
	const seen = new Set<string>();
	for (const column of columns) {
		const at = `cms.config: ${collection}.list.columns`;
		if (typeof column !== "string") throw new Error(`${at} must be an array of column names`);
		const field = Object.hasOwn(schema.fields, column) ? schema.fields[column] : undefined;
		const known =
			system.has(column) ||
			stored.has(column) ||
			slugFields.some(([name]) => name === column) ||
			(column === "slug" && slugFields.length > 0);
		if (!known) {
			if (field)
				throw new Error(`${at} "${column}" is a ${field.kind} field that is not stored, so it cannot be a column`);
			throw new Error(
				`${at} has unknown column "${column}"; use a field name of ${collection} or one of: ${SYSTEM_LIST_COLUMNS.join(", ")}`,
			);
		}
		if (seen.has(column)) throw new Error(`${at} lists "${column}" twice`);
		seen.add(column);
	}
}

export interface LayoutGroup<Name extends string = string> {
	/** Group title in the properties panel. If absent, it is drawn continuously without a title. */
	readonly group?: string;
	readonly fields: readonly Name[];
	/** Collapsed at first. */
	readonly collapsed?: boolean;
	/**
	 * Tab name in which this group is drawn in the edit screen's properties area. Groups with the same name gather in one tab; if absent, it is drawn in the default tab (`속성`).
	 */
	readonly tab?: string;
}

export interface CollectionSchema<
	Fields extends Readonly<Record<string, Field>> = Readonly<Record<string, Field>>,
	Kind extends CollectionKind = CollectionKind,
> {
	readonly label: string;
	/** Collection kind (`document`, `item`). */
	readonly kind: Kind;
	/** Whether it has a body (MDX). If absent, only `document` collections have a body. */
	readonly body: boolean;
	/**
	 * The blocks, marks and heading levels the body allows (the object form of `body`: `body: { blocks: [...], marks: [...], headings: [...] }`).
	 * Absent: everything is allowed. A body that already holds something not listed keeps it (see `schema/allowed.ts`).
	 */
	readonly allowed?: BodyAllowed;
	/**
	 * Field name → definition. A `title` text field (`fields.text`) is required (`defineSite` checks it). The list, search,
	 * relation picker, body links and the edit screen's title box use this field.
	 */
	readonly fields: Fields;
	/**
	 * Public address shape (e.g. `/posts/:slug`). `:slug` must appear exactly once. Used to recognize internal links in the body (pre-publish check) and
	 * when the editor creates links. If absent, this collection cannot be pointed to by body links.
	 */
	readonly path?: string;
	/**
	 * Admin sidebar icon name (lucide, e.g. `file-text`, `notebook-pen`, `tag`, `shapes`, `layers`, `folder`, `image`).
	 * If absent or unknown, it is the default icon for the kind.
	 */
	readonly icon?: string;
	/**
	 * Properties panel layout. Fields not listed are drawn after the last group in declaration order. If absent, they are drawn in field declaration order,
	 * and fields that have their own `tab` gather in that tab.
	 */
	readonly layout?: readonly LayoutGroup[];
	/**
	 * List. If absent, the default columns: for documents, title, status, language (when there are two or more languages), category field (a relation pointing to an item collection),
	 * modified date and published date; for items, title, address, language, status and modified date.
	 */
	readonly list?: {
		/**
		 * Columns the list shows and their order. Field names or system columns. Unknown names are reported as errors by `defineSite`.
		 * Text (`text`), select (`select`) and relation fields are drawn as default cells, and an admin extension (`listCells`) can change the cell look.
		 */
		readonly columns: readonly string[];
	};
}

/** Value `defineCollection` accepts (without the kind). Types check that names in layout and list columns are real fields. */
type CollectionInput<Fields extends Readonly<Record<string, Field>>> = Omit<
	CollectionSchema<Fields>,
	"kind" | "body" | "allowed" | "layout" | "list" | "path"
> & {
	path?: `/${string}:slug${string}`;
	/** `true`/`false`, or the object form that limits the blocks, marks and heading levels the body allows. */
	body?: boolean | BodyAllowed;
	layout?: readonly LayoutGroup<Extract<keyof Fields, string>>[];
	list?: { columns: readonly (Extract<keyof Fields, string> | SystemListColumn)[] };
};

/** Defines a collection. Types check that names in layout and list columns are real fields. */
export function defineCollection<
	const Fields extends Readonly<Record<string, Field>>,
	const Kind extends CollectionKind,
>(schema: CollectionInput<Fields> & { kind: Kind }): CollectionSchema<Fields, Kind>;
export function defineCollection(
	schema: CollectionInput<Readonly<Record<string, Field>>> & { kind?: CollectionKind },
): CollectionSchema {
	return normalizeCollection(schema);
}

/**
 * Normalizes a collection definition: checks the kind and fills the body default (only `document` has a body).
 * Called by `defineCollection` and `defineSite` (an already normalized definition stays as is).
 * The retired `workflow` option (`"publish"` / `"record"`) is rejected with the `kind` to use instead.
 */
export function normalizeCollection(
	schema: Omit<CollectionSchema, "kind" | "body" | "allowed"> & {
		readonly kind?: CollectionKind;
		readonly body?: boolean | BodyAllowed;
		readonly allowed?: BodyAllowed;
	},
): CollectionSchema {
	const { kind } = schema;
	if ("workflow" in schema) {
		const workflow = (schema as { readonly workflow?: unknown }).workflow;
		const replacement = workflow === "record" ? "item" : workflow === "publish" ? "document" : undefined;
		throw new Error(
			`cms.config: collection "${schema.label}" uses \`workflow\`, which was removed; use \`kind\`${replacement ? ` (kind: "${replacement}" instead of workflow: "${workflow}")` : ' ("document" or "item")'}`,
		);
	}
	if (kind !== "document" && kind !== "item") {
		throw new Error(`cms.config: collection "${schema.label}" needs kind "document" or "item"`);
	}
	const { body, ...rest } = schema;
	if (body !== null && typeof body === "object") {
		if (Array.isArray(body)) {
			throw new Error(`cms.config: collection "${schema.label}" needs \`body\` to be true, false or an object`);
		}
		// The object form means the collection has a body, and limits it.
		return { ...rest, kind, body: true, allowed: body };
	}
	return { ...rest, kind, body: body ?? kind === "document" };
}

type Stored<Fields> = {
	[K in keyof Fields as Fields[K] extends SlugField | BacklinkField ? never : K]: Fields[K];
};

/** Flattens fields dependent on a conditional field to the top level (same as the storage format). */
type Nested<Fields> = {
	[K in keyof Fields]: Fields[K] extends { readonly kind: "conditional"; readonly values: infer V }
		? V[keyof V] extends infer Group
			? Group extends Readonly<Record<string, ValueField>>
				? Group
				: never
			: never
		: never;
}[keyof Fields];

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;

type FieldValue<F> = F extends { readonly kind: "conditional"; readonly discriminant: infer D }
	? ValueOf<D>
	: ValueOf<F>;

/**
 * Metadata type built from a collection definition. A draft may be empty, so every key is optional.
 */
export type MetadataOf<S extends CollectionSchema> = {
	-readonly [K in keyof Stored<S["fields"]>]?: FieldValue<S["fields"][K]>;
} & {
	-readonly [K in keyof UnionToIntersection<Nested<S["fields"]>>]?: ValueOf<
		UnionToIntersection<Nested<S["fields"]>>[K]
	>;
};

type RequiredKeys<Fields> = {
	[K in keyof Stored<Fields>]: Stored<Fields>[K] extends { readonly required: true } ? K : never;
}[keyof Stored<Fields>];

/**
 * Metadata type of a published entry, built from a collection definition. Publishing needs every `required` field, so those keys are not optional here
 * (`post.metadata.title` is a `string`); the rest are optional as in {@link MetadataOf}, and so are the fields that depend on a conditional field.
 */
export type PublishedMetadataOf<S extends CollectionSchema> = {
	-readonly [K in RequiredKeys<S["fields"]>]: FieldValue<S["fields"][K]>;
} & {
	-readonly [K in Exclude<keyof Stored<S["fields"]>, RequiredKeys<S["fields"]>>]?: FieldValue<S["fields"][K]>;
} & {
	-readonly [K in keyof UnionToIntersection<Nested<S["fields"]>>]?: ValueOf<
		UnionToIntersection<Nested<S["fields"]>>[K]
	>;
};
