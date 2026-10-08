import { mdxContentHash, mdxSearchText } from "./mdx-body.js";
const DEFAULT_BATCH_SIZE = 200;
/** What one body rewrite did. Bodies that are skipped are left as they are and are named in the log. */
const rewritten = (bodies, mdx, where, log) => {
    const result = bodies.insertSoftBreaks(mdx);
    if (result.status === "changed")
        return result.text;
    if (result.status === "skipped") {
        log(`[monti] soft line endings left as they are in ${where}: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
    }
    return mdx;
};
/**
 * Makes the soft line endings of stored bodies explicit (`<br />`), because the public page no longer turns a single newline into a line break
 * (see `insertSoftBreaks`). Covers the working and published bodies, the source a translation was last confirmed against (`translation.baseSource`,
 * which the translation screen compares with the source, so it must read the same way), and the body templates.
 *
 * The same pass recomputes `content_hash` and `search_text` of every body. `version`, `updated_at` and the entry itself are not touched, and a body
 * that does not parse is left as it is (and logged). Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function migrateSoftBreaks(client, qSchema, options) {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const { bodies, site } = options;
    const log = options.log ?? ((message) => console.warn(message));
    let last;
    for (;;) {
        const res = await client.query(`SELECT entry_id, state, metadata, mdx, schema_version, translation FROM "${qSchema}".entry_bodies
			 WHERE ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`, [last?.entry_id ?? null, last?.state ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const next = res.rows.map((row) => {
            const where = `entry_bodies ${row.entry_id}/${row.state}`;
            const mdx = rewritten(bodies, row.mdx, where, log);
            const base = row.translation?.baseSource;
            const baseSource = typeof base === "string" ? rewritten(bodies, base, `${where} (translation base source)`, log) : undefined;
            return {
                mdx,
                contentHash: mdxContentHash(bodies, row.metadata, mdx),
                searchText: mdxSearchText(site, bodies, mdx),
                translation: baseSource !== undefined && baseSource !== base ? JSON.stringify({ ...row.translation, baseSource }) : null,
            };
        });
        await client.query(`UPDATE "${qSchema}".entry_bodies AS b SET
				mdx = v.mdx, content_hash = v.content_hash, search_text = v.search_text,
				translation = COALESCE(v.translation::jsonb, b.translation)
			 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS mdx,
			              unnest($4::text[]) AS content_hash, unnest($5::text[]) AS search_text, unnest($6::text[]) AS translation) AS v
			 WHERE b.entry_id = v.entry_id AND b.state = v.state`, [
            res.rows.map((row) => row.entry_id),
            res.rows.map((row) => row.state),
            next.map((row) => row.mdx),
            next.map((row) => row.contentHash),
            next.map((row) => row.searchText),
            next.map((row) => row.translation),
        ]);
        last = res.rows[res.rows.length - 1];
        if (res.rows.length < batchSize)
            break;
    }
    let lastTemplate;
    for (;;) {
        const res = await client.query(`SELECT id, mdx FROM "${qSchema}".body_templates WHERE mdx IS NOT NULL AND ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [lastTemplate ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        for (const row of res.rows) {
            const mdx = rewritten(bodies, row.mdx, `body_templates ${row.id}`, log);
            if (mdx !== row.mdx)
                await client.query(`UPDATE "${qSchema}".body_templates SET mdx = $1 WHERE id = $2`, [mdx, row.id]);
        }
        lastTemplate = res.rows[res.rows.length - 1]?.id;
        if (res.rows.length < batchSize)
            break;
    }
}
