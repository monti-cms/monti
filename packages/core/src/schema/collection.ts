import type { BodyAllowed } from "./allowed";
import type { BacklinkField, Field, SlugField, ValueField, ValueOf } from "./fields";

/**
 * Collection kind.
 *
 * - `document`: you write a body and it is split into a draft and a published version. It goes public with an explicit publish (e.g. posts).
 * - `item`: saving in a small form applies straight to the current (public) value. There is no publish, archive or translation copy (e.g. tags).
 */
export type CollectionKind = "document" | "item";

export interface LayoutGroup<Name extends string = string> {
	/** Group title in the properties panel. If absent, it is drawn continuously without a title. */
	readonly group?: string;
	readonly fields: readonly Name[];
	/** Collapsed at first. */
	readonly collapsed?: boolean;
	/**
	 * Tab name in which this group is drawn in the edit screen's properties area (1 to 20 characters). Groups with the same name gather in one tab; if absent, it is drawn in the default tab. Tabs live on groups only; the fields a plugin places in a tab of its own (the SEO fields) are not the layout's to list.
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
	 * Admin sidebar icon name (Carbon icon name, e.g. `document`, `notebook`, `tag`, `shapes`, `layers`, `folder`, `image`).
	 * If absent or unknown, it is the default icon for the kind.
	 */
	readonly icon?: string;
	/** Whether entries can be organized into virtual folders. If absent, the kind decides (`kindDefaults`): a document collection has them, an item collection not. */
	readonly folders?: boolean;
	/** Custom title for the default properties tab. If absent, the admin's translated default is used. */
	readonly defaultTab?: string;
	/**
	 * Properties panel layout. Fields not listed are drawn after the last group in declaration order. If absent, they are drawn in field declaration order.
	 * Plugins place their own fields in tabs of their own (`contributes.layout`); `panelGroupsOf` is the one place that works out the groups.
	 */
	readonly layout?: readonly LayoutGroup[];
}

/** Value `defineCollection` accepts (without the kind). Types check that names in layout are real fields. */
type CollectionInput<Fields extends Readonly<Record<string, Field>>> = Omit<
	CollectionSchema<Fields>,
	"kind" | "body" | "allowed" | "layout" | "path"
> & {
	path?: `/${string}:slug${string}`;
	/** `true`/`false`, or the object form that limits the blocks, marks and heading levels the body allows. */
	body?: boolean | BodyAllowed;
	layout?: readonly LayoutGroup<Extract<keyof Fields, string>>[];
};

/** Defines a collection. Types check that names in layout are real fields. */
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
 * What a collection's kind gives the options its definition leaves out: a document collection has a body and folders, an item collection neither.
 * The one place this default lives; the site, the schema file writer and the admin's schema editor all read it.
 */
export function kindDefaults(kind: CollectionKind | undefined): { readonly body: boolean; readonly folders: boolean } {
	const isDocument = kind === "document";
	return { body: isDocument, folders: isDocument };
}

/**
 * Normalizes a collection definition: fills the body default (only `document` has a body) and turns the object form of `body` into `body: true` and `allowed`.
 * Called by `defineCollection` and `defineSite` (an already normalized definition stays as is). It does not judge the definition: `defineSite` checks the normalized
 * collection, so a missing or unknown `kind`, a retired option and a malformed `body` are reported there, with their paths.
 */
export function normalizeCollection(
	schema: Omit<CollectionSchema, "kind" | "body" | "allowed"> & {
		readonly kind?: CollectionKind;
		readonly body?: boolean | BodyAllowed;
		readonly allowed?: BodyAllowed;
	},
): CollectionSchema {
	const { kind, body, ...rest } = schema;
	// The object form means the collection has a body, and limits it.
	if (body !== null && typeof body === "object" && !Array.isArray(body))
		return { ...rest, kind, body: true, allowed: body } as CollectionSchema;
	return { ...rest, kind, body: body ?? kindDefaults(kind).body } as CollectionSchema;
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
