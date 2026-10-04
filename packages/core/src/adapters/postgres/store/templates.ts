import { randomUUID } from "node:crypto";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, isUniqueViolation } from "./errors";
import { mapTemplateRow, TEMPLATE_COLUMNS, type TemplateRow } from "./rows";
import type { BodyTemplate } from "./types";

const mapTemplateError = (err: unknown) =>
	isUniqueViolation(err, ["body_templates_name_idx", "body_templates_pkey"])
		? new CmsError("Template name already exists", "conflict")
		: err;

/**
 * §6.3 본문 템플릿. `새 글`에서 고르며, 바꿔도 이미 만든 글에는 영향이 없다.
 * 초기 템플릿은 사이트 설정(`seed.templates`)에서 마이그레이션이 한 번 넣는다.
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
			try {
				const res = await pool.query<TemplateRow>(
					`INSERT INTO "${qSchema}".body_templates (id, name, mdx, version, created_at, updated_at)
					 VALUES ($1, $2, $3, 1, $4, $4)
					 RETURNING ${TEMPLATE_COLUMNS}`,
					[randomUUID(), name, typeof data.mdx === "string" ? data.mdx : "", new Date()],
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

					const res = await client.query<TemplateRow>(
						`UPDATE "${qSchema}".body_templates
						 SET name = $1, mdx = $2, version = $3, updated_at = $4
						 WHERE id = $5
						 RETURNING ${TEMPLATE_COLUMNS}`,
						[name, params.mdx ?? cur.mdx, cur.version + 1, new Date(), params.id],
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
