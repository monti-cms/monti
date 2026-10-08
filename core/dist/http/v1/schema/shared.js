import { READ_ONLY_MESSAGE, schemaEditAccess } from "../../../schema-edit/index.js";
import { HttpError } from "../error-handler.js";
import { readJsonBody } from "../handler.js";
/** Throws the 403 of a server that may not write the schema file. */
export function assertSchemaWritable(cms) {
    const access = schemaEditAccess(cms);
    if (!access.writable) {
        throw new HttpError(403, "schema_read_only", READ_ONLY_MESSAGE[access.reason], undefined, {
            reason: access.reason,
        });
    }
}
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The body of a check or a save: `{ schema, transforms?, renames? }`. */
export async function readEditBody(request) {
    const body = await readJsonBody(request);
    if (!isRecord(body) || !isRecord(body.schema)) {
        throw new HttpError(400, "invalid_input", "The request body needs a `schema` object");
    }
    for (const key of ["transforms", "renames"]) {
        if (body[key] !== undefined && !Array.isArray(body[key])) {
            throw new HttpError(400, "invalid_input", `\`${key}\` must be a list`);
        }
    }
    return body;
}
