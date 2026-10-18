import type { SchemaFile } from "./types.js";
/**
 * Defines the schema of a site (`monti.schema.ts`): a typed identity. It returns what it is given, and keeps the literal types of the collection, field and locale names
 * (a `const` generic), so `defineConfig({ schema })` knows the site's collections, the shape of each collection's metadata and its locale codes with nothing written
 * by hand. A wrong `kind` or a wrong option value is a type error here.
 *
 * ```ts
 * // monti.schema.ts
 * import { defineSchema } from "@monti-cms/core";
 *
 * export default defineSchema({
 * 	locales: [{ code: "en", name: "English" }],
 * 	defaultLocale: "en",
 * 	collections: { post: { label: "Post", kind: "document", fields: { title: { kind: "text", label: "Title" } } } },
 * });
 * ```
 *
 * The admin's schema settings screen rewrites this file when it is a pure literal: the `defineSchema` import and `export default defineSchema({ ... })`, with only
 * data inside (no imports, identifiers, spreads or calls).
 */
export declare function defineSchema<const Schema extends SchemaFile>(schema: Schema): Schema;
