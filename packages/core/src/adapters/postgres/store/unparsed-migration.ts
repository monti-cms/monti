import type { PoolClient } from "pg";
import { computeContentHash } from "../../../core/content-hash";
import { parseTranslationState } from "../../../core/translation/state";
import type { JsonValue } from "../../../core/types";
import { unparsedDocument } from "../../../doc/stored-document";

const DEFAULT_BATCH_SIZE = 200;

export interface UnparsedMigrationOptions {
	readonly batchSize?: number;
	/** Called once per kind of finding with the ids involved. Default: `console.warn`. */
	readonly log?: (message: string) => void;
}

interface BodyRow {
	entry_id: string;
	state: string;
	metadata: JsonValue;
	mdx: string;
	schema_version: number;
}

/**
 * Every stored body is a document now. A body that had none (its MDX did not parse, had front matter, or would not read back the same)
 * becomes the document of one `unparsed` node that holds its MDX as it was: it shows as it is in the editor and `unparsed_body` blocks publishing it.
 * Covers the working and published bodies and the templates. `mdx` and `search_text` are kept; `content_hash` is recomputed (a document is hashed
 * as a document, and the text of an unparsed one under its own tag); `version` and `updated_at` are not touched.
 *
 * A published body or template that gets no document is a page that now reads as unparsed; none of them stops the migration (the owner's
 * data must always migrate), but they are logged by id so they can be fixed. Also lifts the translation state of every translation to version 4
 * (the document of the source it was confirmed against, no MDX text). Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function migrateUnparsedBodies(
	client: PoolClient,
	qSchema: string,
	options: UnparsedMigrationOptions = {},
): Promise<{ readonly drafts: number; readonly published: readonly string[]; readonly templates: readonly string[] }> {
	const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
	const log = options.log ?? ((message: string) => console.warn(message));
	let drafts = 0;
	const published: string[] = [];
	const templates: string[] = [];

	let last: { entry_id: string; state: string } | undefined;
	for (;;) {
		const res = await client.query<BodyRow>(
			`SELECT entry_id, state, metadata, mdx, schema_version FROM "${qSchema}".entry_bodies
			 WHERE doc IS NULL AND ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`,
			[last?.entry_id ?? null, last?.state ?? null, batchSize],
		);
		if (res.rows.length === 0) break;
		const next = res.rows.map((row) => {
			const doc = unparsedDocument(row.mdx);
			if (row.state === "published") published.push(row.entry_id);
			else drafts += 1;
			return { doc: JSON.stringify(doc), contentHash: computeContentHash(row.metadata, doc) };
		});
		await client.query(
			`UPDATE "${qSchema}".entry_bodies AS b SET doc = v.doc::jsonb, content_hash = v.content_hash
			 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS doc, unnest($4::text[]) AS content_hash) AS v
			 WHERE b.entry_id = v.entry_id AND b.state = v.state`,
			[
				res.rows.map((row) => row.entry_id),
				res.rows.map((row) => row.state),
				next.map((row) => row.doc),
				next.map((row) => row.contentHash),
			],
		);
		last = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) break;
	}

	let lastTemplate: string | undefined;
	for (;;) {
		const res = await client.query<{ id: string; mdx: string }>(
			`SELECT id, mdx FROM "${qSchema}".body_templates WHERE doc IS NULL AND ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`,
			[lastTemplate ?? null, batchSize],
		);
		if (res.rows.length === 0) break;
		for (const row of res.rows) templates.push(row.id);
		await client.query(
			`UPDATE "${qSchema}".body_templates AS t SET doc = v.doc::jsonb
			 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS doc) AS v
			 WHERE t.id = v.id`,
			[res.rows.map((row) => row.id), res.rows.map((row) => JSON.stringify(unparsedDocument(row.mdx)))],
		);
		lastTemplate = res.rows[res.rows.length - 1]?.id;
		if (res.rows.length < batchSize) break;
	}

	// Translation state: the source a translation was confirmed against is a document (`parseTranslationState` lifts older versions).
	let lastState: { entry_id: string; state: string } | undefined;
	for (;;) {
		const res = await client.query<{ entry_id: string; state: string; translation: unknown }>(
			`SELECT entry_id, state, translation FROM "${qSchema}".entry_bodies
			 WHERE translation IS NOT NULL AND (translation->>'version') IS DISTINCT FROM '4'
			   AND ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`,
			[lastState?.entry_id ?? null, lastState?.state ?? null, batchSize],
		);
		if (res.rows.length === 0) break;
		const lifted = res.rows.flatMap((row) => {
			const state = parseTranslationState(row.translation);
			return state ? [{ row, state: JSON.stringify(state) }] : [];
		});
		if (lifted.length > 0) {
			await client.query(
				`UPDATE "${qSchema}".entry_bodies AS b SET translation = v.translation::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS translation) AS v
				 WHERE b.entry_id = v.entry_id AND b.state = v.state`,
				[
					lifted.map((item) => item.row.entry_id),
					lifted.map((item) => item.row.state),
					lifted.map((item) => item.state),
				],
			);
		}
		lastState = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) break;
	}

	if (published.length > 0) {
		log(
			`[monti] ${published.length} published bodies have no document and are kept as unparsed (they read as unparsed until fixed): ${published.join(", ")}`,
		);
	}
	if (templates.length > 0) {
		log(
			`[monti] ${templates.length} body templates have no document and are kept as unparsed: ${templates.join(", ")}`,
		);
	}
	if (drafts > 0) log(`[monti] ${drafts} drafts have no document and are kept as unparsed`);
	return { drafts, published, templates };
}
