import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import type { AdminValues } from "../schema/admin-values";
import { type BlockKit, checkDoc } from "./blocks";
import type { Doc } from "./doc";

type Db = Kysely<Database> | Transaction<Database>;

/** A collection's editor allowance (doc 01's admin values): which blocks, marks and heading levels its editor offers. */
export async function editorOf(db: Db, collection: string): Promise<AdminValues["editor"]> {
	const row = await db
		.selectFrom("collection_admin_values")
		.select("values")
		.where("collection", "=", collection)
		.executeTakeFirst();
	return row?.values.editor;
}

/** Refuses a body that does not pass `checkDoc`, naming the first problem. */
export function assertDoc(
	doc: unknown,
	kit: BlockKit,
	editor: AdminValues["editor"],
	previous: Doc | null,
): asserts doc is Doc {
	const problems = checkDoc(doc, kit, editor, previous);
	if (problems.length === 0) return;
	const [first] = problems;
	throw new CheckError({
		key: `body.${first.code}`,
		values: {
			count: problems.length,
			...(first.block ? { block: first.block } : {}),
			...(first.detail ? { detail: first.detail } : {}),
		},
	});
}
