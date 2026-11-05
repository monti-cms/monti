import { PGlite } from "@electric-sql/pglite";
import {
	createAdminApi,
	createMonti,
	type Database,
	type Monti,
	type MontiOptions,
	migrateContent,
	migrateToLatest,
	type Schema,
} from "@monti-cms/core";
import { Kysely, PostgresDialect } from "kysely";
import type { Transport } from "../src/operations/transport";

/** Kysely on PGlite: one connection, so a query waits for the one before it (a transaction holds it until it ends). */
function pgliteDialect(pg: PGlite) {
	let queue = Promise.resolve();
	return new PostgresDialect({
		pool: {
			connect: async () => {
				let release = () => {};
				const previous = queue;
				queue = new Promise<void>((resolve) => {
					release = resolve;
				});
				await previous;
				return {
					query: async (sql: string, parameters: readonly unknown[]) => {
						const result = await pg.query(sql, parameters as unknown[]);
						return {
							rows: result.rows,
							rowCount: result.affectedRows ?? result.rows.length,
							command: sql.trim().split(/\s+/)[0]?.toUpperCase(),
						};
					},
					release,
				};
			},
			end: async () => {},
		} as never,
	});
}

export type StorySite = { monti: Monti; transport: Transport; db: Kysely<Database> };

/**
 * A whole site in the browser for a story (build.md rule 6): Postgres on PGlite, the core's real operations and the real admin API, so a story runs
 * what the admin runs. `setup` puts the story's data in through operations; `signedIn` starts the story with the admin's session.
 */
export async function storySite({
	schema,
	setup,
	signedIn = false,
	...options
}: Partial<MontiOptions> & {
	schema: Schema;
	setup?: (monti: Monti) => Promise<void>;
	signedIn?: boolean;
}): Promise<StorySite> {
	const db = new Kysely<Database>({ dialect: pgliteDialect(new PGlite()) });
	await migrateToLatest(db);
	await migrateContent(db, schema, []);
	const monti = createMonti({ db, schema, files: null, ...options });
	await setup?.(monti);
	const api = createAdminApi(monti);
	let token: string | null = null;
	const transport: Transport = async (name, input, options = {}) => {
		const answer = await api.call(name, { input, ...options }, token);
		if (answer.session !== undefined) token = answer.session?.token ?? null;
		return { status: answer.status, body: JSON.parse(JSON.stringify(answer.body)) };
	};
	if (signedIn) {
		const made = await transport("auth.createFirstAdmin", {
			email: "me@example.dev",
			password: "story password",
			confirm: "story password",
		});
		if (made.status !== 200) await transport("auth.signIn", { email: "me@example.dev", password: "story password" });
	}
	return { monti, transport, db };
}
