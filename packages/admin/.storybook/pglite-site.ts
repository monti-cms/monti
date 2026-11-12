import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import {
	createAdminApi,
	createMonti,
	type Database,
	type Monti,
	type MontiOptions,
	memoryStorage,
	migrateContent,
	migrateToLatest,
	type Schema,
	type Storage,
} from "@monti-cms/core";
import { Kysely, PostgresDialect } from "kysely";
import type { Transport, Uploader } from "../src/operations/transport";

/** The Postgres of the story on the page. */
let open: PGlite | null = null;

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
						// A story that has ended can still have a file on its way: nobody waits for that answer, and it never comes.
						const result = await pg.query(sql, parameters as unknown[]).catch((error: unknown) => {
							if (pg !== open) return new Promise<never>(() => {});
							throw error;
						});
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

export type StorySite = {
	monti: Monti;
	transport: Transport;
	uploader: Uploader;
	db: Kysely<Database>;
	/** Where its files are: in memory, with addresses the page can load. `null` for a site with no storage. */
	storage: Storage | null;
};

/**
 * A whole site in the browser for a story (build.md rule 6): Postgres on PGlite, the core's real operations and the real admin API, so a story runs
 * what the admin runs. `setup` puts the story's data in through operations; `signedIn` starts the story with the admin's session.
 */
export async function storySite({
	schema,
	setup,
	signedIn = false,
	storage = memoryStorage(),
	plugins = [],
	...options
}: Partial<MontiOptions> & {
	schema: Schema;
	setup?: (monti: Monti, storage: Storage | null) => Promise<void>;
	/** `"bypass"`: nobody signed in; the dev server let this machine in (doc 16). */
	signedIn?: boolean | "bypass";
	storage?: Storage | null;
}): Promise<StorySite> {
	// One story shows at a time, and a Postgres left open holds its memory until the page goes: the last story's goes first (T116).
	const last = open;
	open = null;
	await last?.close().catch(() => {});
	// Search uses trigram indexes (doc 06), as on the live site's Postgres.
	open = new PGlite({ extensions: { pg_trgm } });
	const db = new Kysely<Database>({ dialect: pgliteDialect(open) });
	await migrateToLatest(db);
	await migrateContent(db, schema, []);
	const monti = createMonti({
		db,
		schema,
		files: null,
		plugins: storage ? [...plugins, { name: "story-files", storage }] : plugins,
		...options,
	});
	await setup?.(monti, storage);
	const api = createAdminApi(monti);
	let token: string | null = null;
	const transport: Transport = async (name, input, options = {}) => {
		const answer = await api.call(name, { input, ...options }, token, signedIn === "bypass");
		if (answer.session !== undefined) token = answer.session?.token ?? null;
		return { status: answer.status, body: JSON.parse(JSON.stringify(answer.body)) };
	};
	// The byte route with the session this page holds. A story's bar moves as a real upload's does.
	const uploader: Uploader = async (file, { name, onProgress }) => {
		onProgress?.(50);
		const answer = await api.upload(new Uint8Array(await file.arrayBuffer()), name, token, signedIn === "bypass");
		onProgress?.(100);
		return { status: answer.status, body: JSON.parse(JSON.stringify(answer.body)) };
	};
	if (signedIn === "bypass") token = (await api.letIn()).token;
	else if (signedIn) {
		const made = await transport("auth.createFirstAdmin", {
			email: "me@example.dev",
			password: "story password",
			confirm: "story password",
		});
		if (made.status !== 200) await transport("auth.signIn", { email: "me@example.dev", password: "story password" });
	}
	return { monti, transport, uploader, db, storage };
}

/**
 * Starts a screen story where it says, as a fresh visit: stories run one after another in one page, so the address a story moved to (`#/templates/…`)
 * and what the admin keeps in this browser (the last screen, unsaved drafts) would open the next story somewhere else. Call it first in a loader.
 */
export function startAt(hash = "#/") {
	for (const key of Object.keys(localStorage))
		if (key === "monti.lastScreen" || key.startsWith("monti.draft.")) localStorage.removeItem(key);
	window.history.replaceState(null, "", hash);
}
