import type { MigrationUp } from "./types";

/**
 * Adds virtual folder support to media assets.
 */
export const up: MigrationUp = (client, qSchema) =>
	client.query(`
		ALTER TABLE "${qSchema}".media_assets
		ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION;
		CREATE INDEX IF NOT EXISTS media_assets_folder_id_idx ON "${qSchema}".media_assets(folder_id);
	`);
