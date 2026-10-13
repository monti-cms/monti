import type { Cms } from "../../../cms";
import { READ_ONLY_MESSAGE, schemaEditAccess } from "../../../schema-edit";
import { CmsError } from "../error-handler";
import { readJsonBody } from "../handler";

/** Throws the 403 of a server that may not write the schema file. */
export function assertSchemaWritable(cms: Pick<Cms, "schemaFile">): void {
	const access = schemaEditAccess(cms);
	if (!access.writable) {
		throw new CmsError(READ_ONLY_MESSAGE[access.reason], "schema_read_only", undefined, {
			reason: access.reason,
		});
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The body of a check or a save: `{ schema, transforms?, renames? }`. */
export async function readEditBody(request: Request) {
	const body = await readJsonBody(request);
	if (!isRecord(body) || !isRecord(body.schema)) {
		throw new CmsError("The request body needs a `schema` object", "invalid_input");
	}
	for (const key of ["transforms", "renames"] as const) {
		if (body[key] !== undefined && !Array.isArray(body[key])) {
			throw new CmsError(`\`${key}\` must be a list`, "invalid_input");
		}
	}
	return body as { schema: Record<string, unknown>; transforms?: never[]; renames?: never[]; baseHash?: unknown };
}
