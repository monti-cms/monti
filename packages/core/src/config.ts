import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DevProof } from "./auth/dev-bypass";
import type { AuthSettings } from "./auth/operations";
import type { AnyBlockDefinition, MarkDefinition } from "./body/blocks";
import type { Database } from "./db/schema";
import type { Receiver } from "./engine/deliveries";
import { createMonti, type Monti, type Plugin } from "./monti";
import type { Schema } from "./schema/define";
import { schemaFilesAt } from "./schema/files";

/** `monti.config.ts`: how a site runs Monti. The schema itself is `monti.schema.ts`, imported here. */
export type MontiConfig = {
	schema: Schema;
	/** The Postgres address. */
	database: string | undefined;
	plugins?: Plugin[];
	/** The site's body blocks and marks: the same definitions the site renders with. */
	blocks?: AnyBlockDefinition[];
	marks?: MarkDefinition[];
	/** Webhooks and other places events go after a write. */
	receivers?: Receiver[];
	/**
	 * Whether this is the dev server, where structure values (the schema file) can be changed. Left out, it is the dev server unless `NODE_ENV` is
	 * `production`. On the live site structure is locked.
	 */
	dev?: boolean;
	/**
	 * How the admin signs in: `{ password: true }`, `{ github: { clientId, clientSecret, admin } }`, or both (`monti init` writes it). On the dev
	 * server a request from this machine gets in without signing in; `devBypass: false` turns that off (doc 16).
	 */
	auth?: Partial<AuthSettings>;
	/** Signs preview links. Left out, `MONTI_SECRET`. */
	secret?: string;
	/** How a browser proves it runs on this machine, for the dev server's sign-in bypass. An adapter sets it (`@monti-cms/next`). */
	devProof?: DevProof | null;
};

export function defineConfig(config: MontiConfig): MontiConfig {
	return config;
}

/**
 * Opens the site's Monti: the database pool, and on the dev server the schema files under `root`. `reuse.db` is a pool already open (a dev server
 * that reads a changed config again keeps its connections).
 */
export function openMonti(
	config: MontiConfig,
	root: string,
	reuse: {
		db?: Kysely<Database>;
		/**
		 * The host's way to keep work going after a response is sent (a serverless function's `waitUntil`, Next's `after`). Monti hands it the sends
		 * it does not make a caller wait for, as work to start: the host starts it where it holds work open (`waitUntil: (work) =>
		 * context.waitUntil(work())`; Next: `after(work)`). Without it a host that ends with the response may cut a send off before its result is
		 * written.
		 */
		waitUntil?: (work: () => Promise<unknown>) => void;
	} = {},
): Monti {
	if (!config.database) throw new Error("monti.config.ts has no database address (set DATABASE_URL).");
	const dev = config.dev ?? process.env.NODE_ENV !== "production";
	if (!dev && config.auth?.devBypass === true)
		console.warn("Monti: auth.devBypass is for the dev server only; the live site signs in as always.");
	return createMonti({
		db:
			reuse.db ??
			new Kysely<Database>({
				dialect: new PostgresDialect({ pool: new Pool({ connectionString: config.database }) }),
			}),
		schema: config.schema,
		files: dev ? schemaFilesAt(root) : null,
		plugins: config.plugins,
		blocks: config.blocks,
		auth: config.auth,
		devProof: dev ? config.devProof : null,
		marks: config.marks,
		receivers: config.receivers,
		waitUntil: reuse.waitUntil,
		// Blank is none (and falls through to the environment); a set secret is used byte for byte, spaces included: what was signed and sealed with
		// it opens with exactly it.
		secret:
			[config.secret, process.env.MONTI_SECRET].find((secret) => secret !== undefined && secret.trim() !== "") ?? null,
	});
}
