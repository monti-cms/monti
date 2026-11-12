import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
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
	/** How the admin signs in: `{ password: true }`, `{ github: { clientId, clientSecret, admin } }`, or both (`monti init` writes it). */
	auth?: Partial<AuthSettings>;
	/** Signs preview links. Left out, `MONTI_SECRET`. */
	secret?: string;
};

export function defineConfig(config: MontiConfig): MontiConfig {
	return config;
}

/** Opens the site's Monti: the database pool, and on the dev server the schema files under `root`. */
export function openMonti(config: MontiConfig, root: string): Monti {
	if (!config.database) throw new Error("monti.config.ts has no database address (set DATABASE_URL).");
	const dev = config.dev ?? process.env.NODE_ENV !== "production";
	return createMonti({
		db: new Kysely<Database>({
			dialect: new PostgresDialect({ pool: new Pool({ connectionString: config.database }) }),
		}),
		schema: config.schema,
		files: dev ? schemaFilesAt(root) : null,
		plugins: config.plugins,
		blocks: config.blocks,
		auth: config.auth,
		marks: config.marks,
		receivers: config.receivers,
		secret: config.secret?.trim() || process.env.MONTI_SECRET || null,
	});
}
