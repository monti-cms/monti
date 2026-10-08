import type { Cms } from "../cms/index.js";
/**
 * Whether the settings screen may write the schema file of an instance. The decision is the server's: a production server never writes the file (it runs the schema
 * it was built with), and a development server writes it only when the file is there and can be written. The write routes of the admin API answer 403 otherwise,
 * whatever the screen shows.
 */
/** Why the screen is read-only. */
export type SchemaReadOnlyReason = 
/** The server does not run in development (`NODE_ENV` is not `development`), or its environment looks like a deployed server. */
"production"
/** The instance's config has no schema file (it is written in code only), or the file cannot be found. */
 | "no_schema_file"
/** The file exists but this process cannot write it. */
 | "not_writable";
export type SchemaEditAccess = {
    readonly writable: true;
    readonly file: string;
} | {
    readonly writable: false;
    readonly reason: SchemaReadOnlyReason;
    readonly file?: string;
};
/**
 * Whether the server runs in development (`next dev`). Read at call time. A development-mode process that looks deployed (a hosting platform's variables, a public
 * `AUTH_URL`) does not count, the same rule the login bypass follows: a staging server started with `NODE_ENV=development` must not rewrite its schema.
 */
export declare const isDevelopmentServer: (env?: Readonly<Record<string, string | undefined>>) => boolean;
export declare function schemaEditAccess(cms: Pick<Cms, "schemaFile">): SchemaEditAccess;
/** The sentence the 403 answer carries for each reason. */
export declare const READ_ONLY_MESSAGE: Record<SchemaReadOnlyReason, string>;
