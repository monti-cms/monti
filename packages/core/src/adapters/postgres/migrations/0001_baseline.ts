import type { MigrationUp } from "./types";

/**
 * The whole schema of a new store. Pre-release databases that were built from the earlier numbered steps are not upgraded (see `database_outdated`):
 * from here on, a change to the schema is a new file with the next number.
 */
export const up: MigrationUp = (client, qSchema, { site }) =>
	client.query(`
		CREATE TABLE "${qSchema}".folders (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			parent_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION,
			name TEXT NOT NULL,
			position INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		);
		CREATE UNIQUE INDEX folders_sibling_name_idx ON "${qSchema}".folders(
			collection,
			name,
			COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
		);

		CREATE TABLE "${qSchema}".entries (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			version INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			first_published_at TIMESTAMPTZ,
			last_published_at TIMESTAMPTZ,
			published_at TIMESTAMPTZ,
			working_slug TEXT,
			folder_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION,
			status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'trashed')),
			trashed_at TIMESTAMPTZ,
			-- Multilingual: one document per language + translation group. The group ID is the source's ID; the source itself is NULL.
			-- The locale default is the site's default locale.
			locale TEXT NOT NULL DEFAULT '${site.DEFAULT_LOCALE}',
			translation_group_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE NO ACTION,
			-- Who made the latest change that raised the version, and when. Both stay empty for an entry no change has been recorded for.
			changed_by TEXT,
			changed_at TIMESTAMPTZ
		);
		CREATE UNIQUE INDEX entries_translation_locale_key
		ON "${qSchema}".entries ((COALESCE(translation_group_id, id)), locale);

		-- The document of a body (\`doc\`, a stored document) is its only source.
		CREATE TABLE "${qSchema}".entry_bodies (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			metadata JSONB NOT NULL,
			schema_version INTEGER NOT NULL,
			content_hash TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			search_text TEXT NOT NULL DEFAULT '',
			-- Translation screen: translation units of a translated entry (source fragment, translation). NULL for the source.
			translation JSONB,
			doc JSONB,
			PRIMARY KEY (entry_id, state)
		);

		CREATE TABLE "${qSchema}".content_addresses (
			collection TEXT NOT NULL,
			slug TEXT NOT NULL,
			entry_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL,
			type TEXT NOT NULL CHECK (type IN ('reservation', 'current', 'alias', 'deleted')),
			locale TEXT NOT NULL DEFAULT '${site.DEFAULT_LOCALE}',
			PRIMARY KEY (collection, locale, slug)
		);

		CREATE TABLE "${qSchema}".media_assets (
			id UUID PRIMARY KEY,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
			filename TEXT NOT NULL DEFAULT '',
			mime_type TEXT,
			byte_size BIGINT,
			width INTEGER,
			height INTEGER,
			staging_key TEXT,
			storage_key TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ready_at TIMESTAMPTZ,
			default_alt TEXT NOT NULL DEFAULT '',
			default_caption TEXT NOT NULL DEFAULT '',
			original_staging_key TEXT,
			original_storage_key TEXT,
			original_mime_type TEXT,
			original_byte_size BIGINT,
			original_width INTEGER,
			original_height INTEGER
		);
		CREATE INDEX media_assets_pending_idx ON "${qSchema}".media_assets(created_at) WHERE status IN ('pending', 'failed');

		CREATE TABLE "${qSchema}".entry_references (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			kind TEXT NOT NULL CONSTRAINT entry_references_kind_check CHECK (kind IN ('entry', 'media')),
			target_id UUID NOT NULL,
			target_entry_id UUID REFERENCES "${qSchema}".entries(id),
			target_media_id UUID REFERENCES "${qSchema}".media_assets(id),
			is_stale BOOLEAN NOT NULL,
			occurrences JSONB NOT NULL,
			UNIQUE (entry_id, state, kind, target_id),
			CONSTRAINT entry_references_target_check CHECK (
				(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
				(kind = 'entry' AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
			)
		);

		-- Admin settings.
		CREATE TABLE "${qSchema}".user_preferences (
			user_id TEXT PRIMARY KEY,
			preferences JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);

		-- Body templates: \`doc\` is the document of the template.
		CREATE TABLE "${qSchema}".body_templates (
			id UUID PRIMARY KEY,
			name TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			doc JSONB
		);
		CREATE UNIQUE INDEX body_templates_name_idx ON "${qSchema}".body_templates (lower(name));

		-- The documents of the plugin storage (\`PluginStorage\`): one row per plugin, collection and key.
		CREATE TABLE "${qSchema}".plugin_documents (
			plugin TEXT NOT NULL,
			collection TEXT NOT NULL,
			key TEXT NOT NULL,
			value JSONB NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (plugin, collection, key)
		);

		-- The schema last applied to the store (\`monti schema:apply\`): one row holding its version and its data model as JSON.
		CREATE TABLE "${qSchema}".schema_state (
			id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
			schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
			schema JSONB NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		-- The event outbox. \`cms_events\` holds one row per committed change of an entry, written in the transaction of the change (\`seq\` is the order). It has no
		-- foreign key to \`entries\`: the event of a deletion outlives the entry. \`cms_event_deliveries\` holds the delivery state of each event for each subscriber.
		CREATE TABLE "${qSchema}".cms_events (
			seq BIGSERIAL PRIMARY KEY,
			id UUID NOT NULL UNIQUE,
			kind TEXT NOT NULL,
			entry_id UUID NOT NULL,
			collection TEXT NOT NULL,
			locale TEXT NOT NULL,
			content_hash TEXT,
			version INTEGER NOT NULL,
			payload JSONB NOT NULL,
			occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
		);
		CREATE INDEX cms_events_entry_idx ON "${qSchema}".cms_events (entry_id, seq);
		CREATE INDEX cms_events_occurred_idx ON "${qSchema}".cms_events (occurred_at);

		CREATE TABLE "${qSchema}".cms_event_deliveries (
			event_id UUID NOT NULL REFERENCES "${qSchema}".cms_events(id) ON DELETE CASCADE,
			subscriber TEXT NOT NULL,
			state TEXT NOT NULL CHECK (state IN ('pending', 'delivering', 'delivered', 'failed', 'dead', 'dismissed')),
			attempts INTEGER NOT NULL DEFAULT 0,
			last_error TEXT,
			last_attempt_at TIMESTAMPTZ,
			next_attempt_at TIMESTAMPTZ,
			locked_until TIMESTAMPTZ,
			delivered_at TIMESTAMPTZ,
			-- \`event.once\`: when the work of the subscriber for this event was done. It goes with the delivery when the event is pruned.
			once_at TIMESTAMPTZ,
			PRIMARY KEY (event_id, subscriber)
		);
		CREATE INDEX cms_event_deliveries_state_idx ON "${qSchema}".cms_event_deliveries (state, subscriber);
	`);
