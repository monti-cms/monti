import { randomUUID } from "node:crypto";
import { withTransaction } from "./context.js";
import { CmsError, isUniqueViolation } from "./errors.js";
import { mapTemplateRow, TEMPLATE_COLUMNS } from "./rows.js";
const mapTemplateError = (err) => isUniqueViolation(err, ["body_templates_name_idx", "body_templates_pkey"])
    ? new CmsError("Template name already exists", "conflict")
    : err;
/**
 * Body templates. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export function createTemplateOps(ctx) {
    const { pool, qSchema } = ctx;
    return {
        listTemplates: async () => {
            const res = await pool.query(`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates ORDER BY created_at ASC`);
            return res.rows.map(mapTemplateRow);
        },
        getTemplate: async (id) => {
            const res = await pool.query(`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates WHERE id = $1`, [id]);
            if (!res.rows[0])
                throw new CmsError("Template not found", "not_found");
            return mapTemplateRow(res.rows[0]);
        },
        createTemplate: async (data) => {
            const name = (data.name || "").trim();
            if (!name)
                throw new CmsError("Template name is required", "invalid_input");
            try {
                const res = await pool.query(`INSERT INTO "${qSchema}".body_templates (id, name, mdx, version, created_at, updated_at)
					 VALUES ($1, $2, $3, 1, $4, $4)
					 RETURNING ${TEMPLATE_COLUMNS}`, [randomUUID(), name, typeof data.mdx === "string" ? data.mdx : "", new Date()]);
                return mapTemplateRow(res.rows[0]);
            }
            catch (err) {
                throw mapTemplateError(err);
            }
        },
        updateTemplate: async (params) => withTransaction(pool, async (client) => {
            const curRes = await client.query(`SELECT ${TEMPLATE_COLUMNS} FROM "${qSchema}".body_templates WHERE id = $1 FOR UPDATE`, [params.id]);
            const cur = curRes.rows[0];
            if (!cur)
                throw new CmsError("Template not found", "not_found");
            if (cur.version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", cur.version);
            const name = params.name !== undefined ? params.name.trim() : cur.name;
            if (!name)
                throw new CmsError("Template name cannot be empty", "invalid_input");
            const res = await client.query(`UPDATE "${qSchema}".body_templates
						 SET name = $1, mdx = $2, version = $3, updated_at = $4
						 WHERE id = $5
						 RETURNING ${TEMPLATE_COLUMNS}`, [name, params.mdx ?? cur.mdx, cur.version + 1, new Date(), params.id]);
            return mapTemplateRow(res.rows[0]);
        }, { mapError: mapTemplateError }),
        deleteTemplate: async (params) => withTransaction(pool, async (client) => {
            const curRes = await client.query(`SELECT version FROM "${qSchema}".body_templates WHERE id = $1 FOR UPDATE`, [params.id]);
            const cur = curRes.rows[0];
            if (!cur)
                throw new CmsError("Template not found", "not_found");
            if (cur.version !== params.expectedVersion)
                throw new CmsError("Conflict", "conflict", cur.version);
            await client.query(`DELETE FROM "${qSchema}".body_templates WHERE id = $1`, [params.id]);
        }),
    };
}
