import { isDeepStrictEqual } from "node:util";
import type { Pool, PoolClient } from "pg";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import { type Body, bodyFromDocument, bodyFromMdx, type StoredDocument } from "../../../mdx/stored-document";
import { validateSchemaName, withTransaction } from "./context";
import { extractVisibleText, readDoc } from "./rows";

const DEFAULT_BATCH_SIZE = 200;

/**
 * The site's own way of writing a body: from its stored document when it has one, otherwise from its MDX (which gives it a document when it parses).
 * `undefined` when there is no document to write from.
 */
const deriveWithSiteSyntax = (mdx: string, doc: StoredDocument | null): Body | undefined => {
	const body = doc ? bodyFromDocument(doc) : bodyFromMdx(mdx);
	return body.doc ? body : undefined;
};

/**
 * What happens to one stored body. `unparsed`: there is no document to write from (the MDX does not parse, has front matter, or would not read back the same).
 * `hash`: writing it would change its content hash.
 */
export type RewriteOutcome =
	| { readonly status: "changed"; readonly mdx: string; readonly doc: StoredDocument }
	| { readonly status: "unchanged" }
	| { readonly status: "skipped"; readonly reason: "unparsed" | "hash" };

/**
 * Re-derives one body from its document: the new MDX is written from the stored document with the site's syntax. A body with no document gets one when its MDX parses.
 * The result is only offered when it keeps the content hash (the parsed body and metadata are what the hash covers), so a rewrite
 * is a change of spelling and never of content: a body whose hash would change is skipped, however it came about.
 * `write` replaces the derivation with another serializer of the MDX (the site's by default; tests pass another to prove the guard).
 */
export const rewriteBody = (
	mdx: string,
	doc: StoredDocument | null,
	metadata: JsonValue,
	schemaVersion: number,
	write?: (mdx: string) => string | undefined,
): RewriteOutcome => {
	let body: Body | undefined;
	try {
		const written = write ? write(mdx) : undefined;
		body = write ? (written === undefined ? undefined : bodyFromMdx(written)) : deriveWithSiteSyntax(mdx, doc);
	} catch {
		return { status: "skipped", reason: "unparsed" };
	}
	if (body === undefined || body.doc === null) return { status: "skipped", reason: "unparsed" };
	if (body.mdx === mdx && isDeepStrictEqual(body.doc, doc)) return { status: "unchanged" };
	if (computeContentHash(metadata, body.mdx, schemaVersion) !== computeContentHash(metadata, mdx, schemaVersion)) {
		return { status: "skipped", reason: "hash" };
	}
	return { status: "changed", mdx: body.mdx, doc: body.doc };
};

export interface RewriteItem {
	readonly kind: "entry" | "template";
	/** `collection/slug (locale) state` for a body, `template "name"` for a template. */
	readonly label: string;
	readonly outcome: RewriteOutcome["status"];
	readonly reason?: "unparsed" | "hash";
}

export interface RewriteReport {
	readonly applied: boolean;
	readonly items: readonly RewriteItem[];
	readonly changed: number;
	readonly unchanged: number;
	readonly skipped: number;
}

export interface RewriteOptions {
	/** Write the changes. Without it nothing is written and the report says what would change. */
	readonly apply?: boolean;
	readonly schema?: string;
	readonly batchSize?: number;
	/** The serializer (the site's by default). */
	readonly write?: (mdx: string) => string | undefined;
}

interface BodyRow {
	entry_id: string;
	state: "working" | "published";
	metadata: JsonValue;
	mdx: string;
	doc: unknown;
	schema_version: number;
	collection: string;
	locale: string;
	slug: string | null;
}

interface Pending {
	readonly item: RewriteItem;
	readonly write?: (client: PoolClient) => Promise<unknown>;
}

/**
 * Rewrites every stored body (working and published bodies of entries, and body templates) from its document with the site's configured syntax, so the stored
 * text is one notation (a body that has no document yet gets one if its MDX parses). It changes the text and the document only: the content hash is unchanged by
 * design (it covers the parsed body), so `version`, `updated_at` and the hash are not touched, and a body whose hash would change, or that has no document
 * to write from, is skipped and reported. Without `apply` nothing is written.
 * The writes of one run are one transaction. Rows are read in key order, `batchSize` at a time.
 */
export async function rewriteContent(pool: Pool, options: RewriteOptions = {}): Promise<RewriteReport> {
	const qSchema = validateSchemaName(options.schema);
	const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
	const pending: Pending[] = [];

	let last: { entry_id: string; state: string } | undefined;
	for (;;) {
		const res = await pool.query<BodyRow>(
			`SELECT b.entry_id, b.state, b.metadata, b.mdx, b.doc, b.schema_version, e.collection, e.locale,
			        CASE WHEN b.state = 'published'
			             THEN (SELECT a.slug FROM "${qSchema}".content_addresses a WHERE a.entry_id = e.id AND a.type = 'current' LIMIT 1)
			             ELSE e.working_slug END AS slug
			 FROM "${qSchema}".entry_bodies b JOIN "${qSchema}".entries e ON e.id = b.entry_id
			 WHERE ($1::uuid IS NULL OR (b.entry_id, b.state) > ($1::uuid, $2::text))
			 ORDER BY b.entry_id, b.state LIMIT $3`,
			[last?.entry_id ?? null, last?.state ?? null, batchSize],
		);
		for (const row of res.rows) {
			const outcome = rewriteBody(row.mdx, readDoc(row.doc), row.metadata, row.schema_version, options.write);
			const item: RewriteItem = {
				kind: "entry",
				label: `${row.collection}/${row.slug ?? row.entry_id} (${row.locale}) ${row.state}`,
				outcome: outcome.status,
				...(outcome.status === "skipped" ? { reason: outcome.reason } : {}),
			};
			pending.push({
				item,
				...(outcome.status === "changed"
					? {
							write: (client) =>
								client.query(
									`UPDATE "${qSchema}".entry_bodies SET mdx = $1, doc = $2, search_text = $3 WHERE entry_id = $4 AND state = $5`,
									[outcome.mdx, JSON.stringify(outcome.doc), extractVisibleText(outcome.mdx), row.entry_id, row.state],
								),
						}
					: {}),
			});
		}
		last = res.rows[res.rows.length - 1];
		if (res.rows.length < batchSize) break;
	}

	let lastTemplate: string | undefined;
	for (;;) {
		const res = await pool.query<{ id: string; name: string; mdx: string; doc: unknown }>(
			`SELECT id, name, mdx, doc FROM "${qSchema}".body_templates WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2`,
			[lastTemplate ?? null, batchSize],
		);
		for (const row of res.rows) {
			const outcome = rewriteBody(row.mdx, readDoc(row.doc), {}, 1, options.write);
			pending.push({
				item: {
					kind: "template",
					label: `template "${row.name}"`,
					outcome: outcome.status,
					...(outcome.status === "skipped" ? { reason: outcome.reason } : {}),
				},
				...(outcome.status === "changed"
					? {
							write: (client) =>
								client.query(`UPDATE "${qSchema}".body_templates SET mdx = $1, doc = $2 WHERE id = $3`, [
									outcome.mdx,
									JSON.stringify(outcome.doc),
									row.id,
								]),
						}
					: {}),
			});
		}
		lastTemplate = res.rows[res.rows.length - 1]?.id;
		if (res.rows.length < batchSize) break;
	}

	if (options.apply) {
		await withTransaction(pool, async (client) => {
			for (const entry of pending) await entry.write?.(client);
		});
	}

	const items = pending.map((entry) => entry.item).sort((left, right) => left.label.localeCompare(right.label));
	const count = (status: RewriteOutcome["status"]) => items.filter((item) => item.outcome === status).length;
	return {
		applied: options.apply === true,
		items,
		changed: count("changed"),
		unchanged: count("unchanged"),
		skipped: count("skipped"),
	};
}

const REASON_TEXT = { unparsed: "does not parse", hash: "the content hash would change" } as const;

/** One line per body (`collection/slug (locale) state: changed|unchanged|skipped (reason)`) and a summary line. */
export function formatRewriteReport(report: RewriteReport): string[] {
	const lines = report.items.map((item) =>
		item.outcome === "skipped" && item.reason
			? `${item.label}: skipped (${REASON_TEXT[item.reason]})`
			: `${item.label}: ${item.outcome}`,
	);
	const summary = `${report.changed} changed, ${report.unchanged} unchanged, ${report.skipped} skipped`;
	lines.push(
		report.applied ? `${summary}. Written.` : `${summary}. Dry run: nothing was written (pass --apply to write).`,
	);
	return lines;
}
