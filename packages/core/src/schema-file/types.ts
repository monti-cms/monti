import type { LocaleConfig, SeedConfig, SiteConfig } from "../config/define";
import type { BodyAllowed } from "../schema/allowed";
import type { CollectionSchema } from "../schema/collection";

/**
 * The schema file (`monti.schema.ts`): the plain-data part of a site config. Types of its parts are the config's own (`CollectionSchema`, `Field`,
 * `LocaleConfig`, ...), so a collection written in the file and one written with `defineCollection` are the same thing. The runtime check is in `format.ts`.
 */

/**
 * A collection as the file writes it: like `CollectionSchema`, and `body` is left out when it is the default (documents have a body, items do not). The object
 * form of `body` limits the blocks, marks and heading levels the body allows (`CollectionSchema.allowed`).
 */
export type SchemaCollection = Omit<CollectionSchema, "body" | "allowed"> & { readonly body?: boolean | BodyAllowed };

/** Admin settings the file can hold. Text overrides are strings only (a function needs code). */
export interface SchemaAdmin {
	readonly path?: string;
	readonly locale?: string;
	readonly messages?: Readonly<Record<string, Readonly<Record<string, string>>>>;
	/** `false` hides body templates in the admin: the editor's template menu, the sidebar link and the Templates screen. */
	readonly templates?: boolean;
	/** `false` hides the translation UI in the admin (language tabs, locale column and filter). A site with one locale hides it anyway. */
	readonly translations?: boolean;
}

/**
 * A data transform recorded in the schema file (`migrations`): what `monti schema:apply` does to stored entries when the schema changed in a way the data does not follow by
 * itself. `id` names it for good: it is recorded in `cms_migrations` when it ran, so it runs once and an applied one stays in the list as history. Collection, field and option
 * names are the ones of the schema **after** the change (a dropped field is the one the schema no longer has).
 */
export type SchemaMigration = { readonly id: string; readonly note?: string } & (
	| {
			/** The value of `from` moves to `to` (the field was renamed). An entry that holds a value under `to` already keeps both (nothing is overwritten). */
			readonly op: "renameField";
			readonly collection: string;
			readonly from: string;
			readonly to: string;
	  }
	| {
			/** A select value that is no longer an option (`from`) becomes another option (`to`) of the field. */
			readonly op: "mapOption";
			readonly collection: string;
			readonly field: string;
			readonly from: string;
			readonly to: string;
	  }
	| {
			/** The stored values of a field the schema no longer has are deleted. The only transform that deletes data. */
			readonly op: "dropField";
			readonly collection: string;
			readonly field: string;
	  }
	| {
			/** An entry with no value for a text or select field (one that became required, say) gets `value`. */
			readonly op: "setDefault";
			readonly collection: string;
			readonly field: string;
			readonly value: string;
	  }
);

/** The parsed schema file. */
export interface SchemaFile {
	/**
	 * The version of the schema, a whole number from 1 (1 if left out). `monti schema:apply` raises it when the schema changes; entries record the version they
	 * were written or transformed under.
	 */
	readonly schemaVersion?: number;
	/** Collection name -> definition. The name is a stored value, so do not change it in production. */
	readonly collections: Readonly<Record<string, SchemaCollection>>;
	/** Data transforms `monti schema:apply` runs once each, in this order. Applied ones stay as history. */
	readonly migrations?: readonly SchemaMigration[];
	/** Content locales, in the order the admin shows them. */
	readonly locales: readonly LocaleConfig[];
	/** Default locale. Public URLs get no locale prefix for it. */
	readonly defaultLocale: string;
	/** Time zone (IANA) in which dates and times are entered and shown. */
	readonly timeZone?: string;
	/** Plain-data site settings (`site` of the config). */
	readonly site?: SiteConfig;
	/** Admin path, language and text overrides. */
	readonly admin?: SchemaAdmin;
	/** Data to seed a new store with: body templates as stored documents (or as text in a format). */
	readonly seed?: SeedConfig;
}

/** The part of the file that decides the types of a site: collections, locales and the default locale. */
export interface SchemaTypes {
	readonly collections: Readonly<Record<string, SchemaCollection>>;
	readonly locales: readonly LocaleConfig[];
	readonly defaultLocale: string;
}

/** A collection with the `body` flag `defineSite` fills in: `true` or `false`, also when the file writes the object form that limits the body. */
type WithBodyFlag<Collection> = 0 extends 1 & Collection
	? Collection
	: Omit<Collection, "body"> & { readonly body: boolean };

/** The collections of the schema, each with the `body` flag `defineSite` fills in. */
export type SchemaCollectionsOf<Schema extends SchemaTypes> = {
	readonly [Name in keyof Schema["collections"]]: WithBodyFlag<Schema["collections"][Name]>;
};

/** Union of the locale codes of the schema. */
export type SchemaLocalesOf<Schema extends SchemaTypes> = Schema["locales"][number]["code"];
