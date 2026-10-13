import { previewSchemaEdit } from "../../../../schema-edit";
import { adminRoute, ok } from "../../handler";
import { assertSchemaWritable, readEditBody } from "../shared";

/** Checks an edit of the schema file without writing anything: the diff, the entries each change touches and the transforms to pick. 403 outside development like a save. */
export const POST = adminRoute(async ({ request, cms }) => {
	assertSchemaWritable(cms);
	return ok(await previewSchemaEdit(cms, await readEditBody(request)));
});
