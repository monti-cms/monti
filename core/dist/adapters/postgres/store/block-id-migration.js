import { isDeepStrictEqual } from "node:util";
import { assignBlockIds, forEachBlock, withoutBlockIds } from "../../../doc/block-ids.js";
import { readDoc } from "./rows.js";
const DEFAULT_BATCH_SIZE = 200;
const withContent = (doc, content) => ({
    content,
    type: "doc",
    version: doc.version,
});
/**
 * The content of a published body with ids: a block that pairs with a block of the working body takes that block's id, so the two share ids the way a
 * publish makes them. A block that only the published body has keeps the id it already has, so that a second run draws no new ones.
 */
const publishedContent = (published, working) => {
    if (!working)
        return assignBlockIds(published.content);
    const own = [];
    forEachBlock(published.content, (node) => own.push(node.id));
    const workingIds = new Set();
    forEachBlock(working.content, (node) => node.id !== undefined && workingIds.add(node.id));
    const next = assignBlockIds(withoutBlockIds(published.content), [working.content]);
    const blocks = [];
    forEachBlock(next, (node) => blocks.push(node));
    const taken = new Set(blocks.flatMap((node) => (node.id !== undefined && workingIds.has(node.id) ? [node.id] : [])));
    // `next` is a fresh copy, so an unpaired block (one that drew a new id) can take its old id back in place.
    blocks.forEach((node, index) => {
        const id = own[index];
        if (id === undefined || taken.has(id) || (node.id !== undefined && workingIds.has(node.id)))
            return;
        taken.add(id);
        node.id = id;
    });
    // Should an old id equal one drawn for another block, the first block with an id keeps it and the other gets a new one.
    return assignBlockIds(next);
};
/**
 * Gives every block of every stored document an id (see `block-ids.ts`): working and published bodies and body templates. Only `doc` changes; `mdx`,
 * `content_hash`, `search_text`, `version` and `updated_at` are not touched, because ids are not part of what a body says. A block keeps the id it has;
 * a block of a published body that pairs with a block of the entry's working body takes that block's id, so the two share ids the way a publish makes them.
 * Running it again changes nothing, and rows that would not change are not written.
 * Entries are read in key order, `batchSize` at a time, both bodies of an entry in the same batch. Runs inside the caller's transaction.
 */
export async function migrateBlockIds(client, qSchema, options = {}) {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const written = (doc, content) => {
        const next = withContent(doc, content);
        return isDeepStrictEqual(next, doc) ? null : JSON.stringify(next);
    };
    let last;
    for (;;) {
        const res = await client.query(`WITH page AS (
				SELECT DISTINCT entry_id FROM "${qSchema}".entry_bodies
				WHERE ($1::uuid IS NULL OR entry_id > $1::uuid) ORDER BY entry_id LIMIT $2
			 )
			 SELECT b.entry_id, b.state, b.doc FROM "${qSchema}".entry_bodies AS b JOIN page USING (entry_id)
			 ORDER BY b.entry_id, b.state`, [last ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const byEntry = new Map();
        for (const row of res.rows) {
            const bodies = byEntry.get(row.entry_id) ?? {};
            bodies[row.state === "published" ? "published" : "working"] = readDoc(row.doc);
            byEntry.set(row.entry_id, bodies);
        }
        const changed = [];
        for (const [entryId, { working, published }] of byEntry) {
            const workingContent = working ? assignBlockIds(working.content) : null;
            if (working && workingContent) {
                const doc = written(working, workingContent);
                if (doc)
                    changed.push({ entryId, state: "working", doc });
            }
            if (published) {
                const doc = written(published, publishedContent(published, working && workingContent ? withContent(working, workingContent) : null));
                if (doc)
                    changed.push({ entryId, state: "published", doc });
            }
        }
        if (changed.length > 0) {
            await client.query(`UPDATE "${qSchema}".entry_bodies AS b SET doc = v.doc::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS doc) AS v
				 WHERE b.entry_id = v.entry_id AND b.state = v.state`, [changed.map((row) => row.entryId), changed.map((row) => row.state), changed.map((row) => row.doc)]);
        }
        last = res.rows[res.rows.length - 1]?.entry_id;
        if (byEntry.size < batchSize)
            break;
    }
    let lastTemplate;
    for (;;) {
        const res = await client.query(`SELECT id, doc FROM "${qSchema}".body_templates WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`, [lastTemplate ?? null, batchSize]);
        if (res.rows.length === 0)
            break;
        const changed = [];
        for (const row of res.rows) {
            const doc = readDoc(row.doc);
            const next = doc && written(doc, assignBlockIds(doc.content));
            if (doc && next)
                changed.push({ id: row.id, doc: next });
        }
        if (changed.length > 0) {
            await client.query(`UPDATE "${qSchema}".body_templates AS t SET doc = v.doc::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS doc) AS v
				 WHERE t.id = v.id`, [changed.map((row) => row.id), changed.map((row) => row.doc)]);
        }
        lastTemplate = res.rows[res.rows.length - 1]?.id;
        if (res.rows.length < batchSize)
            break;
    }
}
