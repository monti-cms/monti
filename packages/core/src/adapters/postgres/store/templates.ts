import { randomUUID } from "node:crypto";
import { MAX_DOC_BYTES } from "../../../core/limits";
import { CmsError } from "../../../core/store/errors";
import type { BodyTemplate } from "../../../core/store/types";
import { assignBlockIds } from "../../../doc/block-ids";
import {
	canonicalDocument,
	emptyStoredDocument,
	readStoredDocument,
	type StoredDocument,
} from "../../../doc/stored-document";
import type { Site } from "../../../site";
import { type StoreContext, withTransaction } from "./context";
import { isUniqueViolation } from "./errors";
import { mapTemplateRow, readDoc, TEMPLATE_COLUMNS, type TemplateRow } from "./rows";

const mapTemplateError = (err: unknown) =>
	isUniqueViolation(err, ["body_templates_name_idx", "body_templates_pkey"])
		? new CmsError("Template name already exists", "conflict")
		: err;

/**
 * A template body as it is stored: a stored document, checked for its shape and put in the canonical form every body is stored in. Its blocks keep the ids of
 * `previous`, the body it replaces, where they pair up, and the others get new ones. Anything else is `invalid_input`.
 */
const storedTemplateDoc = (site: Site, value: unknown, previous?: StoredDocument | null): string => {
	let size: number;
	try {
		size = Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
	} catch {
		throw new CmsError("Template body is not a stored document", "invalid_input");
	}
	if (size > MAX_DOC_BYTES) throw new CmsError("Template body is too large", "invalid_input");
	const read = readStoredDocument(value, site);
	if (!read) throw new CmsError("Template body is not a stored document", "invalid_input");
	const doc = canonicalDocument(site, read);
	return JSON.stringify({ ...doc, content: assignBlockIds(doc.content, [previous?.content]) });
};

/**
 * Body templates, stored as documents. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export function createTemplateOps(ctx: StoreContext) {
	const { pool, qSchema, site } = ctx;

	return {
		listTemplates: async (): Promise<BodyTemplate[]> => {
			const res = await pool.query<TemplateRow>(
				`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates ORDER BY created_at ASC`,
			);
			return res.rows.map(mapTemplateRow);
		},

		getTemplate: async (id: string): Promise<BodyTemplate> => {
			const res = await pool.query<TemplateRow>(
				`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates WHERE id = $1`,
				[id],
			);
			if (!res.rows[0]) throw new CmsError("Template not found", "not_found");
			return mapTemplateRow(res.rows[0]);
		},

		createTemplate: async (data: { name: string; doc?: unknown }): Promise<BodyTemplate> => {
			const name = (data.name || "").trim();
			if (!name) throw new CmsError("Template name is required", "invalid_input");
			const doc = storedTemplateDoc(site, data.doc === undefined ? emptyStoredDocument() : data.doc);
			try {
				const res = await pool.query<TemplateRow>(
					`INSERT INTO "${qSchema}".body_templates (id, name, doc, version, created_at, updated_at)
					 VALUES ($1, $2, $3, 1, $4, $4)
					 RETURNING ${TEMPLATE_COLUMNS}`,
					[randomUUID(), name, doc, new Date()],
				);
				return mapTemplateRow(res.rows[0] as TemplateRow);
			} catch (err) {
				throw mapTemplateError(err);
			}
		},

		updateTemplate: async (params: {
			id: string;
			expectedVersion: number;
			name?: string;
			doc?: unknown;
		}): Promise<BodyTemplate> =>
			withTransaction(
				pool,
				async (client) => {
					const curRes = await client.query<TemplateRow>(
						`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates WHERE id = $1 FOR UPDATE`,
						[params.id],
					);
					const cur = curRes.rows[0];
					if (!cur) throw new CmsError("Template not found", "not_found");
					if (cur.version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", cur.version);
					const name = params.name !== undefined ? params.name.trim() : cur.name;
					if (!name) throw new CmsError("Template name cannot be empty", "invalid_input");

					// A name-only update keeps the stored body as it is.
					const doc =
						params.doc === undefined
							? JSON.stringify(readDoc(cur.doc) ?? emptyStoredDocument())
							: storedTemplateDoc(site, params.doc, readDoc(cur.doc));
					const res = await client.query<TemplateRow>(
						`UPDATE "${qSchema}".body_templates
						 SET name = $1, doc = $2, version = $3, updated_at = $4
						 WHERE id = $5
						 RETURNING ${TEMPLATE_COLUMNS}`,
						[name, doc, cur.version + 1, new Date(), params.id],
					);
					return mapTemplateRow(res.rows[0] as TemplateRow);
				},
				{ mapError: mapTemplateError },
			),

		deleteTemplate: async (params: { id: string; expectedVersion: number }): Promise<void> =>
			withTransaction(pool, async (client) => {
				const curRes = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".body_templates WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				const cur = curRes.rows[0];
				if (!cur) throw new CmsError("Template not found", "not_found");
				if (cur.version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", cur.version);
				await client.query(`DELETE FROM "${qSchema}".body_templates WHERE id = $1`, [params.id]);
			}),
	};
}
