import { documentText, SEARCH_TEXT } from "../../../core/body-text.js";
import { computeContentHash } from "../../../core/content-hash.js";
import { readStoredDocument, UNPARSED_NODE } from "../../../doc/stored-document.js";
import { readDoc } from "./rows.js";
import { hasDirectiveBlock, kindOfState } from "./unreadable.js";
const DEFAULT_BATCH_SIZE = 200;
/** The MDX text an `unparsed` document holds, or `undefined` when the document is anything else (a body that was read, or text in another format). */
const unparsedSource = (value) => {
    const doc = readStoredDocument(value);
    const only = doc && doc.content.length === 1 ? doc.content[0] : undefined;
    if (only?.type !== UNPARSED_NODE)
        return undefined;
    const { source, format } = (only.attrs ?? {});
    return typeof source === "string" && (format === undefined || format === "mdx") ? source : undefined;
};
/**
 * Reads the bodies and templates that are kept as an `unparsed` document again, with the format and syntax extensions of the config as they are now. It is for the
 * bodies a migration kept as source because the site could not read them then: after the config changed (for example the directive syntax was turned on) they read.
 * A body that reads now gets its document (soft line endings made explicit as step `0012` does, block ids kept), `content_hash` and `search_text`; one that still does not
 * stays as it is. `version`, `updated_at` and the entry are not touched, and running it again changes only what has become readable since.
 * Rows are read in key order, `batchSize` at a time. Runs inside the caller's transaction; links by id are resolved afterwards by `migrateLinkEntryIds`.
 */
export async function reconvertUnparsedBodies(client, qSchema, options) {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const { bodies, site } = options;
    let converted = 0;
    let remaining = 0;
    /** The document of the text, or why it still does not read. */
    const read = (source, previous) => {
        const soft = bodies.insertSoftBreaks(source);
        const text = soft.status === "changed" ? soft.text : source;
        const body = bodies.read(text, { previous });
        return body.doc
            ? { doc: body.doc }
            : {
                reason: soft.status === "skipped" ? soft.reason : undefined,
                detail: soft.status === "skipped" ? soft.detail : undefined,
            };
    };
    let last;
    for (;;) {
        const res = await client.query(`SELECT entry_id AS id, state, metadata, doc FROM "${qSchema}".entry_bodies
			 WHERE doc->'content'->0->>'type' = '${UNPARSED_NODE}' AND jsonb_array_length(doc->'content') = 1
			   AND ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`, [last?.id ?? null, last?.state ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const next = [];
        for (const row of res.rows) {
            const source = unparsedSource(row.doc);
            if (source === undefined)
                continue;
            const result = read(source, readDoc(row.doc));
            if (result.doc) {
                next.push({
                    id: row.id,
                    state: row.state,
                    doc: JSON.stringify(result.doc),
                    hash: computeContentHash(row.metadata, result.doc),
                    search: documentText(site, result.doc, SEARCH_TEXT),
                });
                continue;
            }
            remaining += 1;
            options.onUnreadable?.({
                where: `entry_bodies ${row.id}/${row.state}`,
                kind: kindOfState(row.state),
                ...(result.reason === undefined ? {} : { reason: result.reason }),
                ...(result.detail === undefined ? {} : { detail: result.detail }),
                hasDirective: hasDirectiveBlock(source),
            });
        }
        if (next.length > 0) {
            await client.query(`UPDATE "${qSchema}".entry_bodies AS b SET doc = v.doc::jsonb, content_hash = v.content_hash, search_text = v.search_text
				 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS doc,
				              unnest($4::text[]) AS content_hash, unnest($5::text[]) AS search_text) AS v
				 WHERE b.entry_id = v.entry_id AND b.state = v.state`, [
                next.map((row) => row.id),
                next.map((row) => row.state),
                next.map((row) => row.doc),
                next.map((row) => row.hash),
                next.map((row) => row.search),
            ]);
            converted += next.length;
        }
        const tail = res.rows[res.rows.length - 1];
        last = tail ? { id: tail.id, state: tail.state } : undefined;
        if (res.rows.length < batchSize)
            break;
    }
    let lastTemplate;
    for (;;) {
        const res = await client.query(`SELECT id, NULL AS state, NULL AS metadata, doc FROM "${qSchema}".body_templates
			 WHERE doc->'content'->0->>'type' = '${UNPARSED_NODE}' AND jsonb_array_length(doc->'content') = 1
			   AND ($1::uuid IS NULL OR id > $1::uuid)
			 ORDER BY id LIMIT $2`, [lastTemplate ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const next = [];
        for (const row of res.rows) {
            const source = unparsedSource(row.doc);
            if (source === undefined)
                continue;
            const result = read(source, readDoc(row.doc));
            if (result.doc) {
                next.push({ id: row.id, doc: JSON.stringify(result.doc) });
                continue;
            }
            remaining += 1;
            options.onUnreadable?.({
                where: `body_templates ${row.id}`,
                kind: "template",
                ...(result.reason === undefined ? {} : { reason: result.reason }),
                ...(result.detail === undefined ? {} : { detail: result.detail }),
                hasDirective: hasDirectiveBlock(source),
            });
        }
        if (next.length > 0) {
            await client.query(`UPDATE "${qSchema}".body_templates AS t SET doc = v.doc::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS doc) AS v
				 WHERE t.id = v.id`, [next.map((row) => row.id), next.map((row) => row.doc)]);
            converted += next.length;
        }
        lastTemplate = res.rows[res.rows.length - 1]?.id;
        if (res.rows.length < batchSize)
            break;
    }
    return { converted, remaining };
}
