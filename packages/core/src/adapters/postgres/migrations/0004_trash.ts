import type { MigrationUp } from "./types";

/**
 * The trash for folders and media files. The time something was discarded is named `deleted_at`: the entries' column (`trashed_at` in the baseline) is renamed,
 * and folders and media files get it. A discarded folder or file keeps its row and carries that time; the folders and
 * files discarded with one folder carry the same time, so a restore finds what came with it. Folders hold no status: a folder is live when `deleted_at` is empty.
 *
 * The sibling name rule only covers live folders, so a discarded folder never blocks a new one with its name.
 */
export const up: MigrationUp = (client, qSchema) =>
	client.query(`
		ALTER TABLE "${qSchema}".entries RENAME COLUMN trashed_at TO deleted_at;
		ALTER TABLE "${qSchema}".folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
		DROP INDEX IF EXISTS "${qSchema}".folders_sibling_name_idx;
		CREATE UNIQUE INDEX folders_sibling_name_idx ON "${qSchema}".folders(
			collection,
			name,
			COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
		) WHERE deleted_at IS NULL;
		CREATE INDEX folders_trashed_idx ON "${qSchema}".folders(deleted_at) WHERE deleted_at IS NOT NULL;

		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
		ALTER TABLE "${qSchema}".media_assets DROP CONSTRAINT IF EXISTS media_assets_status_check;
		ALTER TABLE "${qSchema}".media_assets ADD CONSTRAINT media_assets_status_check
			CHECK (status IN ('pending', 'ready', 'failed', 'deleting', 'trashed'));
		CREATE INDEX media_assets_trashed_idx ON "${qSchema}".media_assets(deleted_at) WHERE status = 'trashed';

		CREATE INDEX IF NOT EXISTS entries_trashed_idx ON "${qSchema}".entries(deleted_at) WHERE status = 'trashed';
	`);
