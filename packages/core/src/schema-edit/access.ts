import { accessSync, constants, readFileSync } from "node:fs";
import { productionLikeEnvironment } from "../adapters/auth/dev-bypass";
import type { Cms } from "../cms";
import { parseSchemaLiteral } from "../schema-file/literal";

/**
 * Whether the settings screen may write the schema file of an instance. The decision is the server's: a production server never writes the file (it runs the schema
 * it was built with), and a development server writes it only when the file is there, can be written, and is a pure literal (the `defineSchema` import and
 * `export default defineSchema({ ... })` with data only). A file that has code is never rewritten. The write routes of the admin API answer 403 otherwise,
 * whatever the screen shows.
 */

/** Why the screen is read-only. */
export type SchemaReadOnlyReason =
	/** The server does not run in development (`NODE_ENV` is not `development`), or its environment looks like a deployed server. */
	| "production"
	/** The instance's config has no schema file (it is written in code only), or the file cannot be found. */
	| "no_schema_file"
	/** The file exists but this process cannot write it. */
	| "not_writable"
	/** The file has code in it (an import, a spread, a call, a variable), so the admin cannot rewrite it without losing that code. */
	| "has_code";

export type SchemaEditAccess =
	| { readonly writable: true; readonly file: string }
	| {
			readonly writable: false;
			readonly reason: SchemaReadOnlyReason;
			readonly file?: string;
			/** For `has_code`: what in the file is code, with its line. */
			readonly detail?: string;
	  };

/**
 * Whether the server runs in development (`next dev`). Read at call time. A development-mode process that looks deployed (a hosting platform's variables, a public
 * `AUTH_URL`) does not count, the same rule the login bypass follows: a staging server started with `NODE_ENV=development` must not rewrite its schema.
 */
export const isDevelopmentServer = (env: Readonly<Record<string, string | undefined>> = process.env): boolean =>
	env.NODE_ENV === "development" && productionLikeEnvironment(env) === undefined;

export function schemaEditAccess(cms: Pick<Cms, "schemaFile">): SchemaEditAccess {
	const file = cms.schemaFile();
	if (!isDevelopmentServer()) return { writable: false, reason: "production", ...(file ? { file } : {}) };
	if (!file) return { writable: false, reason: "no_schema_file" };
	try {
		accessSync(file, constants.W_OK);
	} catch {
		return { writable: false, reason: "not_writable", file };
	}
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		return { writable: false, reason: "not_writable", file };
	}
	const literal = parseSchemaLiteral(text);
	if (!literal.ok) return { writable: false, reason: "has_code", file, detail: literal.message };
	return { writable: true, file };
}

/** The sentence the 403 answer carries for each reason. */
export const READ_ONLY_MESSAGE: Record<SchemaReadOnlyReason, string> = {
	production:
		"The schema can only be edited on the development server (next dev); this server only reads monti.schema.ts",
	no_schema_file: "This site has no schema file to edit (its collections are written in code)",
	not_writable: "The schema file is not writable by the server process",
	has_code: "monti.schema.ts contains code, so the admin cannot rewrite it; edit the file instead",
};
