import type { MigrationUp } from "./types";

/**
 * Drops the schema version: the schema is identified by the applied schema JSON in `schema_state`, never by a number, so the number on every entry body and on the
 * recorded schema was only a label.
 */
export const up: MigrationUp = (client, qSchema) =>
	client.query(`
		ALTER TABLE "${qSchema}".entry_bodies DROP COLUMN IF EXISTS schema_version;
		ALTER TABLE "${qSchema}".schema_state DROP COLUMN IF EXISTS schema_version;
	`);
