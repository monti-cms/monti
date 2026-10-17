import { READ_ONLY_MESSAGE, schemaEditAccess } from "../../../schema-edit/index.js";
import { CmsError } from "../error-handler.js";
import { readJsonBody } from "../handler.js";
/** Throws the 403 of a server that may not write the schema file. */
export function assertSchemaWritable(cms) {
    const access = schemaEditAccess(cms);
    if (!access.writable) {
        throw new CmsError(READ_ONLY_MESSAGE[access.reason], "schema_read_only", {
            details: { reason: access.reason },
            notice: { key: `schema.read_only.${access.reason}` },
        });
    }
}
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The body of a check or a save: `{ schema, transforms?, renames? }`. */
export async function readEditBody(request) {
    const body = await readJsonBody(request);
    if (!isRecord(body) || !isRecord(body.schema)) {
        throw new CmsError("The request body needs a `schema` object", "invalid_input");
    }
    for (const key of ["transforms", "renames", "acknowledged"]) {
        if (body[key] !== undefined && !Array.isArray(body[key])) {
            throw new CmsError(`\`${key}\` must be a list`, "invalid_input");
        }
    }
    if (Array.isArray(body.acknowledged) && !body.acknowledged.every((key) => typeof key === "string")) {
        throw new CmsError("`acknowledged` must be a list of impact keys", "invalid_input");
    }
    return body;
}
