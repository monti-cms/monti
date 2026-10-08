import { previewSchemaEdit } from "../../../../schema-edit/index.js";
import { adminRoute, json } from "../../handler.js";
import { assertSchemaWritable, readEditBody } from "../shared.js";
/** Checks an edit of the schema file without writing anything: the diff, the entries each change touches and the transforms to pick. 403 outside development like a save. */
export const POST = adminRoute(async ({ request, cms }) => {
    assertSchemaWritable(cms);
    return json(await previewSchemaEdit(cms, await readEditBody(request)));
});
