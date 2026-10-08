import { readStoredDocument, unparsedDocument } from "../../../doc/stored-document.js";
const DEFAULT_BATCH_SIZE = 200;
/**
 * A body template is a document, like an entry body: `doc` is its only source and `mdx` is no longer written. A template that has no readable document
 * (its MDX did not parse, so migration 0017 or an earlier write left none, or the column holds something that is not a stored document) becomes the
 * document of one `unparsed` node that holds its MDX as it was, so the template shows as it is in the editor. `mdx` stays in the column for the
 * rows that have it (nothing reads it any more) and the column stops being required, so new templates are written without it.
 * Nothing here fails because of a template: the data of an existing store always migrates. Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time. Runs inside the caller's transaction.
 */
export async function migrateTemplatesToDocuments(client, qSchema, options = {}) {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const log = options.log ?? ((message) => console.warn(message));
    await client.query(`ALTER TABLE "${qSchema}".body_templates ALTER COLUMN mdx DROP NOT NULL`);
    const unparsed = [];
    let last;
    for (;;) {
        const res = await client.query(`SELECT id, mdx, doc FROM "${qSchema}".body_templates WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [last ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const missing = res.rows.filter((row) => !readStoredDocument(row.doc));
        if (missing.length > 0) {
            for (const row of missing)
                unparsed.push(row.id);
            await client.query(`UPDATE "${qSchema}".body_templates AS t SET doc = v.doc::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS doc) AS v
				 WHERE t.id = v.id`, [missing.map((row) => row.id), missing.map((row) => JSON.stringify(unparsedDocument(row.mdx ?? "")))]);
        }
        last = res.rows[res.rows.length - 1]?.id;
        if (res.rows.length < batchSize)
            break;
    }
    if (unparsed.length > 0) {
        log(`[monti] ${unparsed.length} body templates have no document and are kept as unparsed: ${unparsed.join(", ")}`);
    }
    return { unparsed };
}
