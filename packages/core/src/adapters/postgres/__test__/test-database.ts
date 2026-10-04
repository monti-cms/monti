import { randomBytes } from "node:crypto";
import { Pool } from "pg";

let rootPool: Pool | undefined;

export async function createIsolatedTestPool(): Promise<{ pool: Pool; schemaName: string }> {
	const url = process.env.CMS_TEST_DATABASE_URL;
	if (!url) {
		throw new Error("CMS_TEST_DATABASE_URL is not set. Never use CMS_DATABASE_URL for tests.");
	}

	if (!rootPool) {
		rootPool = new Pool({ connectionString: url });
	}

	const schemaName = `cms_test_${randomBytes(4).toString("hex")}`;
	await rootPool.query(`CREATE SCHEMA "${schemaName}"`);

	const pool = new Pool({ connectionString: url, max: 5 });

	return { pool, schemaName };
}

export async function dropIsolatedTestPool(pool: Pool, schemaName: string): Promise<void> {
	await pool.end();
	if (rootPool) {
		await rootPool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
	}
}

export async function closeGlobalPool(): Promise<void> {
	if (rootPool) {
		await rootPool.end();
		rootPool = undefined;
	}
}
