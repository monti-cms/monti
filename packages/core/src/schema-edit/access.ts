import { accessSync, constants } from "node:fs";
import type { Cms } from "../cms";

/**
 * Whether the settings screen may write the schema file of an instance. The decision is the server's: a production server never writes the file (it runs the schema
 * it was built with), and a development server writes it only when the file is there and can be written. The write routes of the admin API answer 403 otherwise,
 * whatever the screen shows.
 */

/** Why the screen is read-only. */
export type SchemaReadOnlyReason =
	/** The server does not run in development (`NODE_ENV` is not `development`). */
	| "production"
	/** The instance's config has no schema file (it is written in code only), or the file cannot be found. */
	| "no_schema_file"
	/** The file exists but this process cannot write it. */
	| "not_writable";

export type SchemaEditAccess =
	| { readonly writable: true; readonly file: string }
	| { readonly writable: false; readonly reason: SchemaReadOnlyReason; readonly file?: string };

/** Whether the server runs in development (`next dev`). Read at call time. */
export const isDevelopmentServer = (): boolean => process.env.NODE_ENV === "development";

export function schemaEditAccess(cms: Pick<Cms, "schemaFile">): SchemaEditAccess {
	const file = cms.schemaFile();
	if (!isDevelopmentServer()) return { writable: false, reason: "production", ...(file ? { file } : {}) };
	if (!file) return { writable: false, reason: "no_schema_file" };
	try {
		accessSync(file, constants.W_OK);
	} catch {
		return { writable: false, reason: "not_writable", file };
	}
	return { writable: true, file };
}

/** The sentence the 403 answer carries for each reason. */
export const READ_ONLY_MESSAGE: Record<SchemaReadOnlyReason, string> = {
	production:
		"The schema can only be edited on the development server (next dev); this server only reads monti.schema.json",
	no_schema_file: "This site has no schema file to edit (its collections are written in code)",
	not_writable: "The schema file is not writable by the server process",
};
