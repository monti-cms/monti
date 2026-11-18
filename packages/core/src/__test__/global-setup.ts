import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { TEST_SERVER_URL } from "./database";

/** Fails the run at once, with one clear message, when the test Postgres server cannot be reached. */
export default async function globalSetup(): Promise<void> {
	const server = new Kysely<unknown>({
		dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: TEST_SERVER_URL, max: 1 }) }),
	});
	try {
		await sql`select 1`.execute(server);
	} catch (error) {
		throw new Error(`The core's tests need a running Postgres at ${TEST_SERVER_URL} (set TEST_DATABASE_URL)`, {
			cause: error,
		});
	} finally {
		await server.destroy();
	}
}
