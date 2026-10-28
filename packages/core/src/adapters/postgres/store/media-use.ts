import { sql } from "kysely";
import type { Db } from "../db/kysely";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * The media files among `ids` that are in use: an entry (in the trash or not) refers to them from a field or a body, or the text of a body or a template
 * still names them. A file in use is not moved to the trash.
 *
 * The reference index answers for every body that was saved with it. Besides it, the stored text is searched for the ids that are left: an unparsed draft, a
 * value saved before its field was tracked, and the templates (which keep no index) name a file without being in the index. That is one scan of the bodies and templates
 * for all ids, not one per id.
 */
export async function mediaInUse(db: Db, qSchema: string, ids: readonly string[]): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const referenced = await db
		.selectFrom("entry_references")
		.select("target_media_id")
		.distinct()
		.where("kind", "=", "media")
		.where("target_media_id", "=", sql<string>`any(${[...ids]}::uuid[])`)
		.execute();
	const used = new Set(referenced.flatMap((row) => (row.target_media_id ? [row.target_media_id] : [])));
	const rest = new Set(ids.filter((id) => !used.has(id)));
	if (rest.size === 0) return used;
	const mentioned = await sql<{ id: string }>`
		select distinct lower(m[1]) as id from (
			select b.metadata::text || ' ' || coalesce(b.doc::text, '') as text from ${sql.id(qSchema, "entry_bodies")} b
			union all
			select coalesce(t.doc::text, '') from ${sql.id(qSchema, "body_templates")} t
		) bodies, regexp_matches(bodies.text, ${`(${UUID})`}, 'gi') as m`.execute(db);
	for (const { id } of mentioned.rows) if (rest.has(id)) used.add(id);
	return used;
}
