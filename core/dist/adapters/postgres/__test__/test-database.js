import { randomBytes } from "node:crypto";
import { Pool } from "pg";
let rootPool;
export async function createIsolatedTestPool() {
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
export async function dropIsolatedTestPool(pool, schemaName) {
    await pool.end();
    if (rootPool) {
        await rootPool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
}
export async function closeGlobalPool() {
    if (rootPool) {
        await rootPool.end();
        rootPool = undefined;
    }
}
