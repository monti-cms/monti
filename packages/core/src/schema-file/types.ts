import type { LocaleConfig, SeedConfig, SiteConfig } from "../config/define";
import type { CollectionSchema } from "../schema/collection";

/**
 * The schema file (`monti.schema.json`): the plain-data part of a site config. Types of its parts are the config's own (`CollectionSchema`, `Field`,
 * `LocaleConfig`, ...), so a collection written in the file and one written with `defineCollection` are the same thing. The runtime check is in `format.ts`,
 * and `schema.json` (the JSON Schema editors read) is generated from it.
 */

/** A collection as the file writes it: like `CollectionSchema`, and `body` is left out when it is the default (documents have a body, items do not). */
export type SchemaCollection = Omit<CollectionSchema, "body"> & { readonly body?: boolean };

/** Admin settings the file can hold. Text overrides are strings only (a function needs code). */
export interface SchemaAdmin {
	readonly path?: string;
	readonly locale?: string;
	readonly messages?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** The parsed schema file. */
export interface SchemaFile {
	/** Link to the JSON Schema, for editor autocomplete and validation (`./node_modules/@monti-cms/core/schema.json`). Not read by the CMS. */
	readonly $schema?: string;
	/** Collection name -> definition. The name is a stored value, so do not change it in production. */
	readonly collections: Readonly<Record<string, SchemaCollection>>;
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

/** The part of the file that decides the types of a site: collections, locales and the default locale. This is what `monti schema:types` writes out. */
export interface SchemaTypes {
	readonly collections: Readonly<Record<string, SchemaCollection>>;
	readonly locales: readonly LocaleConfig[];
	readonly defaultLocale: string;
}

/**
 * What `defineConfig({ schema })` accepts as the file's content: loosely typed on purpose. A JSON file imported by TypeScript has wide types (`kind: string`),
 * which never match the strict `SchemaFile`. The strict check happens at runtime; the strict types come from the generated file (`MontiRegister`).
 */
export interface SchemaInput {
	readonly $schema?: string;
	readonly collections: Readonly<Record<string, unknown>>;
	readonly locales: readonly { readonly code: string }[];
	readonly defaultLocale: string;
}

/**
 * Where `monti schema:types` records the types of the site's schema file (`monti-env.d.ts`): it merges `{ schema: ... }` into this interface. The file's content is
 * a type only, so nothing is imported at runtime. Without a generated file the interface is empty and a site's collection and locale names are plain strings.
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled by the generated declaration file
export interface MontiRegister {}

/** The types the generated file registered, or `never` if there is none. */
export type RegisteredSchema = MontiRegister extends { readonly schema: infer Schema extends SchemaTypes }
	? Schema
	: never;

/**
 * The strict types of the file passed to `defineConfig`. A schema written in code with literal types (an inline object, a generated type) is used as it is.
 * A JSON file imported by TypeScript has wide types, so the types come from the generated file; with none, names are plain strings.
 */
export type ResolvedSchema<Schema extends SchemaInput> = Schema extends SchemaTypes
	? Schema
	: [RegisteredSchema] extends [never]
		? SchemaTypes
		: RegisteredSchema;

/** The collections of the file, each with the `body` flag `defineConfig` fills in. */
export type SchemaCollectionsOf<Schema extends SchemaInput> = {
	readonly [Name in keyof ResolvedSchema<Schema>["collections"]]: ResolvedSchema<Schema>["collections"][Name] & {
		readonly body: boolean;
	};
};

/** Union of the locale codes of the file. */
export type SchemaLocalesOf<Schema extends SchemaInput> = ResolvedSchema<Schema>["locales"][number]["code"];
