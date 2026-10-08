import { isDeepStrictEqual } from "node:util";
import { mdxContentHash, mdxSearchText } from "./mdx-body.js";
import { readDoc } from "./rows.js";
const DEFAULT_BATCH_SIZE = 200;
/**
 * The body of a stored document written with the current form (a code block as its code and annotations, see `stored-code-block.ts`), its block ids kept.
 * A body without a document, or one that cannot be lifted, stays as it is; the latter is logged.
 */
const rewritten = (bodies, mdx, stored, where, log) => {
    if (stored === null || stored === undefined)
        return { mdx, doc: null };
    const doc = readDoc(stored);
    const body = doc && bodies.write(doc, { previous: doc });
    if (!body?.doc) {
        log(`[monti] code annotations left as they are in ${where}: its stored document cannot be read or would not read back the same`);
        return { mdx, doc: null };
    }
    return { mdx: body.text, doc: { stored: JSON.parse(JSON.stringify(body.doc)) } };
};
/**
 * The translation state with its base source written the way the source is now: when it has a stored document (`baseDoc`) that document is lifted and the
 * source is the MDX written from it; a base source alone (no document) is written from its own parse, as `0013_stored_documents` did.
 * Returns `null` when nothing changes.
 */
const translationAfter = (bodies, row, where, log) => {
    const state = row.translation;
    if (!state || typeof state.baseSource !== "string")
        return null;
    if (state.baseDoc !== null && state.baseDoc !== undefined) {
        const base = rewritten(bodies, state.baseSource, state.baseDoc, `${where} (translation base)`, log);
        if (!base.doc)
            return null;
        return isDeepStrictEqual(base.doc.stored, state.baseDoc) && base.mdx === state.baseSource
            ? null
            : { ...state, baseSource: base.mdx, baseDoc: base.doc.stored };
    }
    const baseSource = bodies.read(state.baseSource).text;
    return baseSource === state.baseSource ? null : { ...state, baseSource };
};
/**
 * Moves the stored documents to the form of a code block that holds its code and its annotations as data (document version 2), and writes the MDX from
 * them, so the annotation comments of a code fence are written the way Monti writes them (`// @line plus` is `// @line plus {0-0}`, rules that apply to the
 * whole code come first). Covers working and published bodies, the stored document of the source a translation was last confirmed against
 * (`translation.baseDoc`, with `translation.baseSource` written from it, so the translation screen still compares like with like) and body templates.
 *
 * `content_hash` and `search_text` of every body are recomputed, because the hash covers the stored form and the search text no longer holds annotation
 * comments. Block ids are kept; `version`, `updated_at` and the entry itself are not touched. A body whose document cannot be read is left as it is and logged.
 * Running it again changes nothing, and rows that would not change are not written.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function migrateCodeAnnotations(client, qSchema, options) {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const { bodies, site } = options;
    const log = options.log ?? ((message) => console.warn(message));
    let last;
    for (;;) {
        const res = await client.query(`SELECT entry_id, state, metadata, mdx, doc, schema_version, content_hash, search_text, translation FROM "${qSchema}".entry_bodies
			 WHERE ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`, [last?.entry_id ?? null, last?.state ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const changed = res.rows.flatMap((row) => {
            const where = `entry_bodies ${row.entry_id}/${row.state}`;
            const body = rewritten(bodies, row.mdx, row.doc, where, log);
            const contentHash = mdxContentHash(bodies, row.metadata, body.mdx);
            const searchText = mdxSearchText(site, bodies, body.mdx);
            const translation = translationAfter(bodies, row, where, log);
            const docChanged = body.doc !== null && !isDeepStrictEqual(body.doc.stored, row.doc);
            if (!docChanged &&
                body.mdx === row.mdx &&
                contentHash === row.content_hash &&
                searchText === row.search_text &&
                translation === null) {
                return [];
            }
            return [
                {
                    entryId: row.entry_id,
                    state: row.state,
                    mdx: body.mdx,
                    doc: docChanged ? JSON.stringify(body.doc?.stored) : null,
                    contentHash,
                    searchText,
                    translation: translation && JSON.stringify(translation),
                },
            ];
        });
        if (changed.length > 0) {
            await client.query(`UPDATE "${qSchema}".entry_bodies AS b SET
					mdx = v.mdx, doc = COALESCE(v.doc::jsonb, b.doc), content_hash = v.content_hash, search_text = v.search_text,
					translation = COALESCE(v.translation::jsonb, b.translation)
				 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS mdx, unnest($4::text[]) AS doc,
				              unnest($5::text[]) AS content_hash, unnest($6::text[]) AS search_text, unnest($7::text[]) AS translation) AS v
				 WHERE b.entry_id = v.entry_id AND b.state = v.state`, [
                changed.map((row) => row.entryId),
                changed.map((row) => row.state),
                changed.map((row) => row.mdx),
                changed.map((row) => row.doc),
                changed.map((row) => row.contentHash),
                changed.map((row) => row.searchText),
                changed.map((row) => row.translation),
            ]);
        }
        last = res.rows[res.rows.length - 1];
        if (res.rows.length < batchSize)
            break;
    }
    let lastTemplate;
    for (;;) {
        const res = await client.query(`SELECT id, mdx, doc FROM "${qSchema}".body_templates WHERE mdx IS NOT NULL AND ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [lastTemplate ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const changed = res.rows.flatMap((row) => {
            const body = rewritten(bodies, row.mdx, row.doc, `body_templates ${row.id}`, log);
            const docChanged = body.doc !== null && !isDeepStrictEqual(body.doc.stored, row.doc);
            if (!docChanged && body.mdx === row.mdx)
                return [];
            return [{ id: row.id, mdx: body.mdx, doc: docChanged ? JSON.stringify(body.doc?.stored) : null }];
        });
        if (changed.length > 0) {
            await client.query(`UPDATE "${qSchema}".body_templates AS t SET mdx = v.mdx, doc = COALESCE(v.doc::jsonb, t.doc)
				 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS mdx, unnest($3::text[]) AS doc) AS v
				 WHERE t.id = v.id`, [changed.map((row) => row.id), changed.map((row) => row.mdx), changed.map((row) => row.doc)]);
        }
        lastTemplate = res.rows[res.rows.length - 1]?.id;
        if (res.rows.length < batchSize)
            break;
    }
}
