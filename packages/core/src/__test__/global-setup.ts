import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	interface ProvidedContext {
		testRun: string;
	}
}

/**
 * One prefix for the test schemas of this run, dropped together when the run ends. A file that dropped its own schema while another file's migrator
 * was reading the schema list made that migration fail; other runs sharing the database keep their own prefix.
 */
export default function setup(project: TestProject) {
	const run = `test_${randomBytes(4).toString("hex")}_`;
	project.provide("testRun", run);
	return async () => {
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) return;
		const pool = new Pool({ connectionString: url, max: 1 });
		const { rows } = await pool.query<{ name: string }>(
			"select nspname as name from pg_namespace where starts_with(nspname, $1)",
			[run],
		);
		for (const { name } of rows) await pool.query(`drop schema "${name}" cascade`);
		await pool.end();
	};
}
