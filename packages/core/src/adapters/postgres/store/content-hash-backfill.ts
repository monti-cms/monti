import type { PoolClient } from "pg";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";

const DEFAULT_BATCH_SIZE = 200;

interface BodyKey {
	entry_id: string;
	state: string;
}

interface BodyHashInput extends BodyKey {
	metadata: JsonValue;
	mdx: string;
	schema_version: number;
}

/**
 * Recomputes `content_hash` of every stored body (working and published) with the current hash rule (`computeContentHash`).
 * Only the hash column changes: the body, its dates and the entry version stay as they are.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function recomputeContentHashes(
	client: PoolClient,
	qSchema: string,
	options?: { batchSize?: number },
): Promise<void> {
	const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
	let last: BodyKey | undefined;
	for (;;) {
		const res = await client.query<BodyHashInput>(
			`SELECT entry_id, state, metadata, mdx, schema_version FROM "${qSchema}".entry_bodies
			 WHERE ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`,
			[last?.entry_id ?? null, last?.state ?? null, batchSize],
		);
		if (res.rows.length === 0) return;
		await client.query(
			`UPDATE "${qSchema}".entry_bodies AS b SET content_hash = v.content_hash
			 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS content_hash) AS v
			 WHERE b.entry_id = v.entry_id AND b.state = v.state`,
			[
				res.rows.map((row) => row.entry_id),
				res.rows.map((row) => row.state),
				res.rows.map((row) => computeContentHash(row.metadata, row.mdx, row.schema_version)),
			],
		);
		last = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) return;
	}
}
