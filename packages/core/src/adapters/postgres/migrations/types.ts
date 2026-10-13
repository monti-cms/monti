import type { PoolClient } from "pg";
import type { FormatRegistry } from "../../../format/registry";
import type { Site } from "../../../site";

/** What a migration step or job may need besides the database. */
export interface MigrationContext {
	/** The site the store is migrated for: its default locale and seed templates. */
	readonly site: Site;
	/** The formats of the instance. Seed templates written as text are read with them. */
	readonly formats: FormatRegistry;
}

/** The body of one migration file: changes the schema from the previous step's state. */
export type MigrationUp = (client: PoolClient, qSchema: string, context: MigrationContext) => Promise<unknown>;
