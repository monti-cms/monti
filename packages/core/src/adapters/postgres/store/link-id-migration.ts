import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { checkDocument } from "../../../core/body-check";
import { computeContentHash } from "../../../core/content-hash";
import { linkAddressKey, withEntryLinks } from "../../../core/link-ids";
import { parseInternalLink } from "../../../core/links";
import type { JsonValue } from "../../../core/types";
import { mapLinkAttrs } from "../../../mdx/entry-links";
import { documentToMdx, type StoredDocument } from "../../../mdx/stored-document";
import { readDoc } from "./rows";

const DEFAULT_BATCH_SIZE = 200;

export interface LinkEntryIdMigrationOptions {
	readonly batchSize?: number;
	/** Called once per body that holds an internal-looking link nothing resolves, and once at the end with the totals. Default: `console.warn`. */
	readonly log?: (message: string) => void;
}

export interface LinkEntryIdMigrationReport {
	/** Links turned into links by entry id. */
	readonly converted: number;
	/** Internal-looking links no address resolves; they stay as they are. */
	readonly unresolved: number;
}

interface BodyRow {
	entry_id: string;
	state: "working" | "published";
	metadata: JsonValue;
	mdx: string;
	doc: unknown;
	schema_version: number;
	content_hash: string;
	translation: { baseDoc?: unknown } | null;
}

interface ReferenceRow {
	target_id: string;
	is_stale: boolean;
	occurrences: unknown;
}

/** Whether an occurrence is one of a link in the body (the current shape, or the one rows had before bodies were checked as documents). */
const isBodyOccurrence = (occurrence: unknown): boolean => {
	const type = (occurrence as { type?: unknown } | null)?.type;
	return type === "body" || type === "mdx";
};

/**
 * The document with its internal links turned into links by id (`addresses`: `linkAddressKey` → translation group id), and how many links changed and
 * how many looked internal but resolve to nothing. The document comes back at the current version.
 */
const converted = (
	doc: StoredDocument,
	addresses: ReadonlyMap<string, string>,
): { readonly doc: StoredDocument; readonly converted: number; readonly unresolved: number } => {
	let count = 0;
	let unresolved = 0;
	mapLinkAttrs(doc.content, (attrs) => {
		const target = typeof attrs.href === "string" ? parseInternalLink(attrs.href) : null;
		if (!target) return undefined;
		if (addresses.has(linkAddressKey(target))) count += 1;
		else unresolved += 1;
		return undefined;
	});
	return { doc: withEntryLinks(doc, addresses), converted: count, unresolved };
};

/**
 * Moves the links of every stored document from the address they were written with (`href`) to the id of the entry they point to (`entryId`, the
 * translation group id; document version 3). Covers the working and published bodies, the document a translation was last confirmed against
 * (`translation.baseDoc`) and the body templates. An address is looked up in `content_addresses` (default language; current, former and reserved addresses
 * all name an entry), so a link written before a rename still finds its entry. A link that looks internal but resolves to nothing stays as it is and is
 * logged (publishing reports it as `unresolved_internal_link`); nothing here fails because of such a link, so the data of an existing store always migrates.
 *
 * `content_hash` of every body is recomputed (the document, with its version, is what is hashed) and `mdx` is written from the new document, working and
 * published bodies together so "unpublished changes" keeps meaning what it meant. `version`, `updated_at` and block ids are not touched. Also rebuilds the
 * body references: every link by id is a reference to its entry (`kind: 'entry'`, occurrence `{type:"body", blockId}`), replacing the body occurrences
 * a reference had (those of relation fields stay). Running it again changes nothing; rows that would not change are not written.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export async function migrateLinkEntryIds(
	client: PoolClient,
	qSchema: string,
	options: LinkEntryIdMigrationOptions = {},
): Promise<LinkEntryIdMigrationReport> {
	const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
	const log = options.log ?? ((message: string) => console.warn(message));

	const addressRows = await client.query<{ collection: string; slug: string; locale: string; entry_id: string }>(
		`SELECT a.collection, a.slug, a.locale, COALESCE(e.translation_group_id, e.id) AS entry_id
		 FROM "${qSchema}".content_addresses a
		 JOIN "${qSchema}".entries e ON e.id = a.entry_id
		 WHERE a.type IN ('current', 'alias', 'reservation')`,
	);
	const addresses = new Map(addressRows.rows.map((row) => [linkAddressKey(row), row.entry_id]));
	let totalConverted = 0;
	let totalUnresolved = 0;

	/** The references of the body links of a document, rebuilt for one stored body. A body that cannot be trusted keeps what it has. */
	const rebuildReferences = async (entryId: string, state: BodyRow["state"], doc: StoredDocument) => {
		const check = checkDocument(doc);
		if (check.incomplete) return;
		const targets = [...new Set(check.entryLinks.map((link) => link.entryId))];
		const existingTargets = targets.length
			? new Set(
					(
						await client.query<{ id: string }>(`SELECT id FROM "${qSchema}".entries WHERE id = ANY($1::uuid[])`, [
							targets,
						])
					).rows.map((row) => row.id),
				)
			: new Set<string>();
		const current = (
			await client.query<ReferenceRow>(
				`SELECT target_id, is_stale, occurrences FROM "${qSchema}".entry_references
				 WHERE entry_id = $1 AND state = $2 AND kind = 'entry'`,
				[entryId, state],
			)
		).rows;

		const next = new Map<string, { isStale: boolean; occurrences: unknown[] }>();
		for (const row of current) {
			const kept = (Array.isArray(row.occurrences) ? row.occurrences : []).filter((item) => !isBodyOccurrence(item));
			if (kept.length > 0) next.set(row.target_id, { isStale: row.is_stale, occurrences: kept });
		}
		for (const link of check.entryLinks) {
			if (!existingTargets.has(link.entryId)) continue;
			const entry = next.get(link.entryId) ?? { isStale: false, occurrences: [] };
			entry.occurrences.push({
				type: "body",
				...(link.position.blockId === undefined ? {} : { blockId: link.position.blockId }),
			});
			next.set(link.entryId, entry);
		}

		const same =
			next.size === current.length &&
			current.every((row) => {
				const found = next.get(row.target_id);
				return (
					found !== undefined && found.isStale === row.is_stale && isDeepStrictEqual(found.occurrences, row.occurrences)
				);
			});
		if (same) return;
		await client.query(
			`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = $2 AND kind = 'entry'`,
			[entryId, state],
		);
		for (const [targetId, entry] of next) {
			await client.query(
				`INSERT INTO "${qSchema}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
				 VALUES ($1, $2, 'entry', $3, $3, NULL, $4, $5)`,
				[entryId, state, targetId, entry.isStale, JSON.stringify(entry.occurrences)],
			);
		}
	};

	let last: { entry_id: string; state: string } | undefined;
	for (;;) {
		const res = await client.query<BodyRow>(
			`SELECT entry_id, state, metadata, mdx, doc, schema_version, content_hash, translation FROM "${qSchema}".entry_bodies
			 WHERE ($1::uuid IS NULL OR (entry_id, state) > ($1::uuid, $2::text))
			 ORDER BY entry_id, state LIMIT $3`,
			[last?.entry_id ?? null, last?.state ?? null, batchSize],
		);
		if (res.rows.length === 0) break;

		const changed: {
			entryId: string;
			state: string;
			mdx: string;
			doc: string;
			contentHash: string;
			translation: string | null;
		}[] = [];
		for (const row of res.rows) {
			const where = `entry_bodies ${row.entry_id}/${row.state}`;
			const doc = readDoc(row.doc);
			if (!doc) {
				log(`[monti] links left as they are in ${where}: its stored document cannot be read`);
				continue;
			}
			const result = converted(doc, addresses);
			totalConverted += result.converted;
			totalUnresolved += result.unresolved;
			if (result.unresolved > 0) {
				log(
					`[monti] ${result.unresolved} internal link(s) in ${where} point to an address no entry holds; left as they are`,
				);
			}

			let translation: string | null = null;
			const baseDoc = readDoc(row.translation?.baseDoc);
			if (row.translation && baseDoc) {
				const base = converted(baseDoc, addresses);
				totalConverted += base.converted;
				if (!isDeepStrictEqual(base.doc, row.translation.baseDoc)) {
					translation = JSON.stringify({ ...row.translation, baseDoc: base.doc });
				}
			}

			const contentHash = computeContentHash(row.metadata, result.doc, row.schema_version);
			const docChanged = !isDeepStrictEqual(JSON.parse(JSON.stringify(result.doc)), row.doc);
			if (docChanged || contentHash !== row.content_hash || translation !== null) {
				changed.push({
					entryId: row.entry_id,
					state: row.state,
					mdx: docChanged ? documentToMdx(result.doc) : row.mdx,
					doc: JSON.stringify(result.doc),
					contentHash,
					translation,
				});
			}
			await rebuildReferences(row.entry_id, row.state, result.doc);
		}
		if (changed.length > 0) {
			await client.query(
				`UPDATE "${qSchema}".entry_bodies AS b SET
					mdx = v.mdx, doc = v.doc::jsonb, content_hash = v.content_hash, translation = COALESCE(v.translation::jsonb, b.translation)
				 FROM (SELECT unnest($1::uuid[]) AS entry_id, unnest($2::text[]) AS state, unnest($3::text[]) AS mdx, unnest($4::text[]) AS doc,
				              unnest($5::text[]) AS content_hash, unnest($6::text[]) AS translation) AS v
				 WHERE b.entry_id = v.entry_id AND b.state = v.state`,
				[
					changed.map((row) => row.entryId),
					changed.map((row) => row.state),
					changed.map((row) => row.mdx),
					changed.map((row) => row.doc),
					changed.map((row) => row.contentHash),
					changed.map((row) => row.translation),
				],
			);
		}
		last = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) break;
	}

	let lastTemplate: string | undefined;
	for (;;) {
		const res = await client.query<{ id: string; mdx: string; doc: unknown }>(
			`SELECT id, mdx, doc FROM "${qSchema}".body_templates WHERE mdx IS NOT NULL AND ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`,
			[lastTemplate ?? null, batchSize],
		);
		if (res.rows.length === 0) break;
		const changed: { id: string; mdx: string; doc: string }[] = [];
		for (const row of res.rows) {
			const doc = readDoc(row.doc);
			if (!doc) {
				log(`[monti] links left as they are in body_templates ${row.id}: its stored document cannot be read`);
				continue;
			}
			const result = converted(doc, addresses);
			totalConverted += result.converted;
			totalUnresolved += result.unresolved;
			if (result.unresolved > 0) {
				log(
					`[monti] ${result.unresolved} internal link(s) in body_templates ${row.id} point to an address no entry holds; left as they are`,
				);
			}
			if (!isDeepStrictEqual(JSON.parse(JSON.stringify(result.doc)), row.doc)) {
				changed.push({ id: row.id, mdx: documentToMdx(result.doc), doc: JSON.stringify(result.doc) });
			}
		}
		if (changed.length > 0) {
			await client.query(
				`UPDATE "${qSchema}".body_templates AS t SET mdx = v.mdx, doc = v.doc::jsonb
				 FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS mdx, unnest($3::text[]) AS doc) AS v
				 WHERE t.id = v.id`,
				[changed.map((row) => row.id), changed.map((row) => row.mdx), changed.map((row) => row.doc)],
			);
		}
		lastTemplate = res.rows[res.rows.length - 1]?.id;
		if (res.rows.length < batchSize) break;
	}

	if (totalConverted + totalUnresolved > 0)
		log(`[monti] link ids: ${totalConverted} link(s) now point to an entry by id, ${totalUnresolved} left as they are`);
	return { converted: totalConverted, unresolved: totalUnresolved };
}
