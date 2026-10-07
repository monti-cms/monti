import type { Cms } from "../../../cms";
import { READ_ONLY_MESSAGE, schemaEditAccess } from "../../../schema-edit";
import { HttpError } from "../error-handler";
import { readJsonBody } from "../handler";

/** Throws the 403 of a server that may not write the schema file. */
export function assertSchemaWritable(cms: Pick<Cms, "schemaFile">): void {
	const access = schemaEditAccess(cms);
	if (!access.writable) {
		throw new HttpError(403, "schema_read_only", READ_ONLY_MESSAGE[access.reason], undefined, {
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
		throw new HttpError(400, "invalid_input", "The request body needs a `schema` object");
	}
	for (const key of ["transforms", "renames"] as const) {
		if (body[key] !== undefined && !Array.isArray(body[key])) {
			throw new HttpError(400, "invalid_input", `\`${key}\` must be a list`);
		}
	}
	return body as { schema: Record<string, unknown>; transforms?: never[]; renames?: never[]; baseHash?: unknown };
}
