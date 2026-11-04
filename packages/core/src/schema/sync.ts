import type { Monti } from "../monti";
import { readSchemaState } from "./apply";
import { planSchema, type SchemaChange, schemaHash } from "./plan";

export type SyncResult =
	| { status: "same" | "fresh" }
	/** The live site runs a schema the database has not followed: run `monti db:migrate`. */
	| { status: "migrate" }
	/** A hand edit that touches stored values: the admin shows "the file changed · review" and a person chooses. */
	| { status: "review"; changes: SchemaChange[] }
	| { status: "applied"; changeId: string };

/**
 * On the dev server, catches up with a schema file a developer edited by hand. An edit that touches no stored value gets its change file and is
 * applied at once (one line at start-up); one that does (a field gone and another new: a rename, or a remove and an add?) waits for the review.
 */
export async function syncSchemaFile(monti: Monti): Promise<SyncResult> {
	const state = await readSchemaState(monti.db);
	const schema = monti.site.schema();
	if (!state) return { status: "fresh" };
	if (state.hash === schemaHash(schema)) return { status: "same" };
	if (!monti.site.files) return { status: "migrate" };
	const changes = await planSchema(monti.db, state.schema, schema);
	if (changes.some((change) => change.choices)) return { status: "review", changes };
	const result = (await monti.run("schema.apply", { draft: schema }, { actor: "cli" })) as {
		output: { changeId: string };
	};
	return { status: "applied", changeId: result.output.changeId };
}
