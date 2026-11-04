import type { Schema } from "./schema/define";
import type { SchemaFiles } from "./schema/files";

/** What operations know about the site they run in. */
export type Site = {
	/** The schema the site runs with: `monti.schema.ts` as last applied. */
	schema(): Schema;
	/** Replaces it after `schema.apply` wrote the file, until the host reloads the file itself. */
	setSchema(schema: Schema): void;
	/** The way to `monti.schema.ts` and the change files: only on the dev server; `null` on the live site, where structure values are locked. */
	files: SchemaFiles | null;
};

export function createSite(schema: Schema, files: SchemaFiles | null): Site {
	let current = schema;
	return {
		schema: () => current,
		setSchema: (next) => {
			current = next;
		},
		files,
	};
}
