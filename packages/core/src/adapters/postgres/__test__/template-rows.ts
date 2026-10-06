import type { Pool } from "pg";

/**
 * The `mdx` column of a body template. Templates are documents now and nothing writes the column, but the migrations of earlier versions still read and write it
 * (they must keep working on a store that is not migrated yet), so their tests set it by hand and read it back with this.
 */
export const templateMdx = async (pool: Pool, schemaName: string, id: string): Promise<string | null> =>
	(await pool.query<{ mdx: string | null }>(`SELECT mdx FROM "${schemaName}".body_templates WHERE id = $1`, [id]))
		.rows[0]?.mdx ?? null;
