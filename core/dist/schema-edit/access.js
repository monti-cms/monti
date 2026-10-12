import { accessSync, constants, readFileSync } from "node:fs";
import { productionLikeEnvironment } from "../adapters/auth/dev-bypass.js";
import { parseSchemaLiteral } from "../schema-file/literal.js";
/**
 * Whether the server runs in development (`next dev`). Read at call time. A development-mode process that looks deployed (a hosting platform's variables, a public
 * `AUTH_URL`) does not count, the same rule the login bypass follows: a staging server started with `NODE_ENV=development` must not rewrite its schema.
 */
export const isDevelopmentServer = (env = process.env) => env.NODE_ENV === "development" && productionLikeEnvironment(env) === undefined;
export function schemaEditAccess(cms) {
    const file = cms.schemaFile();
    if (!isDevelopmentServer())
        return { writable: false, reason: "production", ...(file ? { file } : {}) };
    if (!file)
        return { writable: false, reason: "no_schema_file" };
    try {
        accessSync(file, constants.W_OK);
    }
    catch {
        return { writable: false, reason: "not_writable", file };
    }
    let text;
    try {
        text = readFileSync(file, "utf8");
    }
    catch {
        return { writable: false, reason: "not_writable", file };
    }
    const literal = parseSchemaLiteral(text);
    if (!literal.ok)
        return { writable: false, reason: "has_code", file, detail: literal.message };
    return { writable: true, file };
}
/** The sentence the 403 answer carries for each reason. */
export const READ_ONLY_MESSAGE = {
    production: "The schema can only be edited on the development server (next dev); this server only reads monti.schema.ts",
    no_schema_file: "This site has no schema file to edit (its collections are written in code)",
    not_writable: "The schema file is not writable by the server process",
    has_code: "monti.schema.ts contains code, so the admin cannot rewrite it; edit the file instead",
};
