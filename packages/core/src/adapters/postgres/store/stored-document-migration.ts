import type { PoolClient } from "pg";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { extractVisibleText } from "./rows";

const DEFAULT_BATCH_SIZE = 200;

export interface StoredDocumentMigrationOptions {
	readonly batchSize?: number;
	/** Called for each body that gets no document and is left as it is. Default: `console.warn`. */
	readonly log?: (message: string) => void;
}

interface BodyRow {
	entry_id: string;
	state: string;
	metadata: JsonValue;
	mdx: string;
	schema_version: number;
	translation: { version?: number; baseSource?: unknown } | null;
}

/**
 * Gives every stored body its document (`doc`) and writes its MDX from it with the site's syntax (see `bodyFromMdx`). Covers the working and published
 * bodies, the source a translation was last confirmed against (`translation.baseSource`, which the translation screen compares with the source,
 * so it must be written the same way), and the body templates.
 *
 * The same pass recomputes `content_hash` and `search_text` of every body, because the MDX may have been rewritten. `version`, `updated_at` and the
 * entry itself are not touched. A body that gets no document (it does not parse, has front matter, or would not read back the same) is left as it is
 * and logged. Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function migrateStoredDocuments(
	client: PoolClient,
	qSchema: string,
	options: StoredDocumentMigrationOptions = {},
): Promise<void> {
	const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
	const log = options.log ?? ((message: string) => console.warn(message));

	const withoutDocument = (where: string) =>
		log(
			`[monti] no stored document for ${where}: it does not parse, has front matter, or would not read back the same; left as it is`,
		);

	let last: { entry_id: string; state: string } | undefined;
	for (;;) {
		const res = await client.query<BodyRow>(
			`SELECT entry_id, state, metadata, mdx, schema_version, translation FROM "${qSchema}".entry_bodies
			 WHERE ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`,
			[last?.entry_id ?? null, last?.state ?? null, batchSize],
		);
		if (res.rows.length === 0) break;

		const next = res.rows.map((row) => {
			const body = bodyFromMdx(row.mdx);
			if (body.doc === null) withoutDocument(`entry_bodies ${row.entry_id}/${row.state}`);
			const base = row.translation?.baseSource;
			const baseSource = typeof base === "string" ? bodyFromMdx(base).mdx : undefined;
			return {
				mdx: body.mdx,
				doc: body.doc === null ? null : JSON.stringify(body.doc),
				contentHash: computeContentHash(row.metadata, body.mdx, row.schema_version),
				searchText: extractVisibleText(body.mdx),
				translation:
					baseSource !== undefined && baseSource !== base ? JSON.stringify({ ...row.translation, baseSource }) : null,
			};
		});
		await client.query(
			`UPDATE "${qSchema}".entry_bodies AS b SET
				mdx = v.mdx, doc = v.doc::jsonb, content_hash = v.content_hash, search_text = v.search_text,
				translation = COALESCE(v.translation::jsonb, b.translation)
			 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS mdx, unnest($4::text[]) AS doc,
			              unnest($5::text[]) AS content_hash, unnest($6::text[]) AS search_text, unnest($7::text[]) AS translation) AS v
			 WHERE b.entry_id = v.entry_id AND b.state = v.state`,
			[
				res.rows.map((row) => row.entry_id),
				res.rows.map((row) => row.state),
				next.map((row) => row.mdx),
				next.map((row) => row.doc),
				next.map((row) => row.contentHash),
				next.map((row) => row.searchText),
				next.map((row) => row.translation),
			],
		);
		last = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) break;
	}

	let lastTemplate: string | undefined;
	for (;;) {
		const res = await client.query<{ id: string; mdx: string }>(
			`SELECT id, mdx FROM "${qSchema}".body_templates WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`,
			[lastTemplate ?? null, batchSize],
		);
		if (res.rows.length === 0) break;

		const next = res.rows.map((row) => {
			const body = bodyFromMdx(row.mdx);
			if (body.doc === null) withoutDocument(`body_templates ${row.id}`);
			return { mdx: body.mdx, doc: body.doc === null ? null : JSON.stringify(body.doc) };
		});
		await client.query(
			`UPDATE "${qSchema}".body_templates AS t SET mdx = v.mdx, doc = v.doc::jsonb
			 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS mdx, unnest($3::text[]) AS doc) AS v
			 WHERE t.id = v.id`,
			[res.rows.map((row) => row.id), next.map((row) => row.mdx), next.map((row) => row.doc)],
		);
		lastTemplate = res.rows[res.rows.length - 1]?.id;
		if (res.rows.length < batchSize) break;
	}
}
