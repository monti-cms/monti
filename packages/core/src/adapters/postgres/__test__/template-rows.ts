import type { Pool } from "pg";
import { migrateContentStore } from "../content-store";

/**
 * The `mdx` column of a body template. Templates are documents now and nothing writes the column, but the migrations of earlier versions still read and write it
 * (they must keep working on a store that is not migrated yet), so their tests set it by hand and read it back with this.
 */
export const templateMdx = async (pool: Pool, schemaName: string, id: string): Promise<string | null> =>
	(await pool.query<{ mdx: string | null }>(`SELECT mdx FROM "${schemaName}".body_templates WHERE id = $1`, [id]))
		.rows[0]?.mdx ?? null;

/**
 * A template written by this version has no text, and the steps of earlier versions read it. A store that old has no such template, so a test that runs those
 * steps first removes them (the ones the seed puts into a new store, for example).
 */
export const dropTextlessTemplates = async (pool: Pool, schemaName: string): Promise<void> => {
	try {
		await pool.query(`DELETE FROM "${schemaName}".body_templates WHERE mdx IS NULL`);
	} catch (error) {
		// A store that is not created yet has no templates.
		if ((error as { code?: string }).code !== "42P01") throw error;
	}
};

/** `migrateContentStore` for a test that then runs the steps of earlier versions over the store (see `dropTextlessTemplates`). */
export const migrateForEarlierSteps = async (pool: Pool, schemaName: string): Promise<void> => {
	await dropTextlessTemplates(pool, schemaName);
	await migrateContentStore(pool, { schema: schemaName });
	await dropTextlessTemplates(pool, schemaName);
};
