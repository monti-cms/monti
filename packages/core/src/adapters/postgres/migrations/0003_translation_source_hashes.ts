import type { PoolClient } from "pg";
import { documentKeyHash, translationBaseHash } from "../../../core/translation/state-hash";
import { readBodyDoc, readTranslation } from "../store/rows";
import type { MigrationUp } from "./types";

const BATCH = 200;

/**
 * Fills the two hashes the list's translation filter compares for every body that has none: the hash of the body's own document, and for a translation
 * the hash of the source document it was confirmed against. New and changed bodies get theirs when they are written.
 */
export async function fillDocumentHashes(client: PoolClient, qSchema: string): Promise<number> {
	let filled = 0;
	for (;;) {
		const { rows } = await client.query<{ entry_id: string; state: string; doc: unknown; translation: unknown }>(
			`SELECT entry_id, state, doc, translation FROM "${qSchema}".entry_bodies WHERE doc_key_hash IS NULL LIMIT ${BATCH}`,
		);
		if (rows.length === 0) return filled;
		for (const row of rows) {
			await client.query(
				`UPDATE "${qSchema}".entry_bodies SET doc_key_hash = $3, translation_base_hash = $4 WHERE entry_id = $1 AND state = $2`,
				[
					row.entry_id,
					row.state,
					documentKeyHash(readBodyDoc(row.doc)),
					translationBaseHash(readTranslation(row.translation)),
				],
			);
		}
		filled += rows.length;
	}
}

/**
 * Adds the hash of every body's document and of a translation's confirmed source, so the list can tell which translations are behind their source in SQL
 * without reading any document.
 */
export const up: MigrationUp = async (client, qSchema) => {
	await client.query(`
		ALTER TABLE "${qSchema}".entry_bodies
		ADD COLUMN IF NOT EXISTS doc_key_hash TEXT,
		ADD COLUMN IF NOT EXISTS translation_base_hash TEXT;
	`);
	await fillDocumentHashes(client, qSchema);
};
