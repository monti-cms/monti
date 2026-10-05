import { randomUUID } from "node:crypto";
import { bodyFromMdx, type StoredDocument } from "../../../mdx/stored-document";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, isUniqueViolation } from "./errors";
import { mapTemplateRow, readDoc, TEMPLATE_COLUMNS, type TemplateRow } from "./rows";
import type { BodyTemplate } from "./types";

const mapTemplateError = (err: unknown) =>
	isUniqueViolation(err, ["body_templates_name_idx", "body_templates_pkey"])
		? new CmsError("Template name already exists", "conflict")
		: err;

/**
 * A template body as it is stored: written from its document when it parses (normalized), as given otherwise.
 * Its blocks keep the ids of `previous`, the body it replaces, where they pair up.
 */
const storedTemplateBody = (mdx: string, previous?: StoredDocument | null) => {
	const { mdx: written, doc } = bodyFromMdx(mdx, undefined, { previous });
	return { mdx: written, doc: doc === null ? null : JSON.stringify(doc) };
};

/**
 * Body templates. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export function createTemplateOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

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

		createTemplate: async (data: { name: string; mdx: string }): Promise<BodyTemplate> => {
			const name = (data.name || "").trim();
			if (!name) throw new CmsError("Template name is required", "invalid_input");
			const body = storedTemplateBody(typeof data.mdx === "string" ? data.mdx : "");
			try {
				const res = await pool.query<TemplateRow>(
					`INSERT INTO "${qSchema}".body_templates (id, name, mdx, doc, version, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, 1, $5, $5)
					 RETURNING ${TEMPLATE_COLUMNS}`,
					[randomUUID(), name, body.mdx, body.doc, new Date()],
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
			mdx?: string;
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
					const body =
						params.mdx === undefined
							? { mdx: cur.mdx, doc: cur.doc === null ? null : JSON.stringify(cur.doc) }
							: storedTemplateBody(params.mdx, readDoc(cur.doc));
					const res = await client.query<TemplateRow>(
						`UPDATE "${qSchema}".body_templates
						 SET name = $1, mdx = $2, doc = $3, version = $4, updated_at = $5
						 WHERE id = $6
						 RETURNING ${TEMPLATE_COLUMNS}`,
						[name, body.mdx, body.doc, cur.version + 1, new Date(), params.id],
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
