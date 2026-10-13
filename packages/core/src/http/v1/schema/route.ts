import { readSchemaScreen, saveSchemaEdit } from "../../../schema-edit";
import { CmsError } from "../error-handler";
import { adminRoute, ok } from "../handler";
import { assertSchemaWritable, readEditBody } from "./shared";

/**
 * The schema settings API. `GET` reads the schema file (and works everywhere: a production server only reads it). `PUT` saves an edit and `POST .../preview` checks one;
 * both write routes answer **403 `schema_read_only`** unless the server runs in development and the file can be written, whatever the screen shows. Admin only like every
 * route.
 */

export const GET = adminRoute(async ({ cms }) => ok(await readSchemaScreen(cms)));

export const PUT = adminRoute(async ({ request, cms }) => {
	assertSchemaWritable(cms);
	const body = await readEditBody(request);
	if (typeof body.baseHash !== "string") {
		throw new CmsError("`baseHash` (the hash of the file the edit started from) is required", "invalid_input");
	}
	const result = await saveSchemaEdit(cms, { ...body, baseHash: body.baseHash });
	if (result.saved) return ok(result);
	switch (result.reason) {
		case "conflict":
			throw new CmsError("The schema file changed since you opened it; reload it and edit again", "schema_conflict");
		case "invalid":
			throw new CmsError("The schema does not check", "invalid_schema", undefined, undefined, result.issues);
		case "problems":
			throw new CmsError(
				"A data transform does not fit the new schema",
				"invalid_transforms",
				undefined,
				undefined,
				result.problems,
			);
		case "apply_failed":
			throw new CmsError(
				`The file was saved, but applying it to the database failed: ${result.message}`,
				"schema_apply_failed",
				undefined,
				{ fileWritten: true, hash: result.hash },
			);
		case "unchanged":
			return ok(result);
	}
});
