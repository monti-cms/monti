import { readSchemaScreen, saveSchemaEdit } from "../../../schema-edit/index.js";
import { HttpError } from "../error-handler.js";
import { adminRoute, json } from "../handler.js";
import { assertSchemaWritable, readEditBody } from "./shared.js";
/**
 * The schema settings API. `GET` reads the schema file (and works everywhere: a production server only reads it). `PUT` saves an edit and `POST .../preview` checks one;
 * both write routes answer **403 `schema_read_only`** unless the server runs in development and the file can be written, whatever the screen shows. Admin only like every
 * route.
 */
export const GET = adminRoute(async ({ cms }) => json(await readSchemaScreen(cms)));
export const PUT = adminRoute(async ({ request, cms }) => {
    assertSchemaWritable(cms);
    const body = await readEditBody(request);
    if (typeof body.baseHash !== "string") {
        throw new HttpError(400, "invalid_input", "`baseHash` (the hash of the file the edit started from) is required");
    }
    const result = await saveSchemaEdit(cms, { ...body, baseHash: body.baseHash });
    if (result.saved)
        return json(result);
    switch (result.reason) {
        case "conflict":
            throw new HttpError(409, "schema_conflict", "The schema file changed since you opened it; reload it and edit again");
        case "invalid":
            throw new HttpError(400, "invalid_schema", "The schema does not check", result.issues);
        case "problems":
            throw new HttpError(422, "invalid_transforms", "A data transform does not fit the new schema", result.problems);
        case "apply_failed":
            throw new HttpError(500, "schema_apply_failed", `The file was saved, but applying it to the database failed: ${result.message}`, undefined, {
                fileWritten: true,
                hash: result.hash,
            });
        case "unchanged":
            return json(result);
    }
});
