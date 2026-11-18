import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { testServer } from "./database";

/** Fails the run at once, with one clear message, when the test Postgres server cannot be reached. */
export default async function globalSetup(): Promise<void> {
	const server = new Kysely<unknown>({
		dialect: new PostgresDialect({ pool: new pg.Pool({ ...testServer(), max: 1 }) }),
	});
	try {
		await sql`select 1`.execute(server);
	} catch (error) {
		throw new Error("The core's tests need a running Postgres: start one, or set TEST_DATABASE_URL to reach another", {
			cause: error,
		});
	} finally {
		await server.destroy();
	}
}
