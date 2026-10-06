import type { Pool, PoolClient } from "pg";
import { cmsConfig } from "../../../config/resolved";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { migrateBlockIds } from "./block-id-migration";
import { migrateCodeAnnotations } from "./code-annotation-migration";
import { recomputeContentHashes } from "./content-hash-backfill";
import { validateSchemaName, withTransaction } from "./context";
import { migrateSoftBreaks } from "./soft-break-migration";
import { migrateStoredDocuments } from "./stored-document-migration";

/** One migration step. Once its name is recorded in `cms_migrations`, it does not run again. */
interface MigrationStep {
	readonly name: string;
	readonly run: (client: PoolClient, qSchema: string) => Promise<unknown>;
}

/**
 * Core migration steps (in numbered order). A store that already exists runs every step once: all steps give the same result when re-run
 * (IF NOT EXISTS; moving legacy rows does nothing when there are no rows to move), so it is safe even for stores with no step record.
 * Add new changes at the end under a new name (before `seed_initial_body_templates`, which must stay last: it seeds a new store once, after the steps
 * above have shaped it, and stores that already seeded skip it whatever its position). Do not edit existing steps (they do not run again on stores that already ran them).
 */
const STEPS: readonly MigrationStep[] = [
	{
		name: "0001_tables",
		/** Base tables for relation references, media, and slugs */
		run: (client, qSchema) =>
			client.query(`
			CREATE TABLE IF NOT EXISTS "${qSchema}".entries (
				id UUID PRIMARY KEY,
				collection TEXT NOT NULL,
				version INTEGER NOT NULL,
				created_at TIMESTAMPTZ NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL,
				first_published_at TIMESTAMPTZ,
				last_published_at TIMESTAMPTZ,
				published_at TIMESTAMPTZ,
				working_slug TEXT
			);

			CREATE TABLE IF NOT EXISTS "${qSchema}".entry_bodies (
				entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
				state TEXT NOT NULL CHECK (state IN ('working', 'published')),
				metadata JSONB NOT NULL,
				mdx TEXT NOT NULL,
				schema_version INTEGER NOT NULL,
				content_hash TEXT NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL,
				PRIMARY KEY (entry_id, state)
			);

			CREATE TABLE IF NOT EXISTS "${qSchema}".content_addresses (
				collection TEXT NOT NULL,
				slug TEXT NOT NULL,
				entry_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL,
				type TEXT NOT NULL CHECK (type IN ('reservation', 'current', 'alias', 'deleted')),
				PRIMARY KEY (collection, slug)
			);

			CREATE TABLE IF NOT EXISTS "${qSchema}".media_assets (
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
				ready_at TIMESTAMPTZ
			);

			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting'));
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT '';
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS mime_type TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS byte_size BIGINT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS staging_key TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

			CREATE TABLE IF NOT EXISTS "${qSchema}".entry_references (
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
		`),
	},
	{
		name: "0002_reference_kinds",
		/** Narrow relation reference kinds to entry and media (moves legacy category and tag rows) */
		run: (client, qSchema) =>
			client.query(`
			-- Reference kinds were reduced to entry and media. Move leftover category/tag rows from older stores into entry rows.
			-- Old rows (category/tag) and entry rows with the same entry, state and target are merged into one row: occurrences are
			-- appended after the entry row's, only those not present yet, and the row is stale if any of them is stale (same as reading them as entry).
			WITH legacy AS (
				SELECT r.entry_id, r.state, r.target_id,
					COALESCE(jsonb_agg(o.value ORDER BY r.kind, o.ordinality) FILTER (WHERE o.value IS NOT NULL), '[]'::jsonb) AS occurrences,
					bool_or(r.is_stale) AS is_stale
				FROM "${qSchema}".entry_references r
				LEFT JOIN LATERAL jsonb_array_elements(r.occurrences) WITH ORDINALITY AS o(value, ordinality) ON TRUE
				WHERE r.kind IN ('category', 'tag')
				GROUP BY r.entry_id, r.state, r.target_id
			)
			INSERT INTO "${qSchema}".entry_references AS d
				(entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			SELECT entry_id, state, 'entry', target_id, target_id, NULL, is_stale, occurrences FROM legacy
			ON CONFLICT (entry_id, state, kind, target_id) DO UPDATE SET
				is_stale = d.is_stale OR EXCLUDED.is_stale,
				occurrences = d.occurrences || COALESCE(
					(SELECT jsonb_agg(x.value ORDER BY x.ordinality)
					 FROM jsonb_array_elements(EXCLUDED.occurrences) WITH ORDINALITY AS x(value, ordinality)
					 WHERE NOT d.occurrences @> jsonb_build_array(x.value)),
					'[]'::jsonb
				);
			DELETE FROM "${qSchema}".entry_references WHERE kind IN ('category', 'tag');
			-- With the old rows gone, narrow the kind constraint to entry and media. The old constraint (its name can differ per store) is found by definition and dropped.
			DO $$
			DECLARE
				old_constraint record;
				target regclass := to_regclass(format('%I.entry_references', '${qSchema}'));
			BEGIN
				FOR old_constraint IN
					SELECT conname FROM pg_constraint
					WHERE conrelid = target AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%category%'
				LOOP
					EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target, old_constraint.conname);
				END LOOP;
				IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = target AND conname = 'entry_references_kind_check') THEN
					ALTER TABLE "${qSchema}".entry_references
						ADD CONSTRAINT entry_references_kind_check CHECK (kind IN ('entry', 'media'));
				END IF;
				IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = target AND conname = 'entry_references_target_check') THEN
					ALTER TABLE "${qSchema}".entry_references ADD CONSTRAINT entry_references_target_check CHECK (
						(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
						(kind = 'entry' AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
					);
				END IF;
			END $$;
		`),
	},
	{
		name: "0003_folders_status",
		/** Folders and entry status */
		run: (client, qSchema) =>
			client.query(`
			CREATE TABLE IF NOT EXISTS "${qSchema}".folders (
				id UUID PRIMARY KEY,
				collection TEXT NOT NULL,
				parent_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION,
				name TEXT NOT NULL,
				position INTEGER NOT NULL,
				version INTEGER NOT NULL DEFAULT 1
			);

			ALTER TABLE "${qSchema}".folders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

			CREATE UNIQUE INDEX IF NOT EXISTS folders_sibling_name_idx ON "${qSchema}".folders(
				collection,
				name,
				COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
			);

			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION;

			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'trashed'));
		`),
	},
	{
		name: "0004_address_entry_link",
		/** Keep slug records from pointing at deleted entries (deletion records) */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".content_addresses ALTER COLUMN entry_id DROP NOT NULL;
			ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT IF EXISTS content_addresses_entry_id_fkey;
			ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL;
		`),
	},
	{
		name: "0005_body_search_translation",
		/** Body search text and translation units */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
			-- Translation screen: translation units of a translated entry (source fragment, translation). NULL for the source.
			ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS translation JSONB;
		`),
	},
	{
		name: "0006_preferences_templates",
		/** Admin settings and body templates (merges legacy per-collection templates) */
		run: (client, qSchema) =>
			client.query(`
			CREATE TABLE IF NOT EXISTS "${qSchema}".user_preferences (
				user_id TEXT PRIMARY KEY,
				preferences JSONB NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL
			);

			CREATE TABLE IF NOT EXISTS "${qSchema}".body_templates (
				id UUID PRIMARY KEY,
				name TEXT NOT NULL,
				mdx TEXT NOT NULL,
				version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL
			);

			DROP INDEX IF EXISTS "${qSchema}".body_templates_collection_name_idx;
			-- If old memos and posts share a name, rename only one of them so both the body and the ID are preserved.
			WITH ranked AS (
				SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS position
				FROM "${qSchema}".body_templates
			)
			UPDATE "${qSchema}".body_templates AS template
			SET name = left(template.name, 50) || ' (merged ' || template.id::text || ')'
			FROM ranked WHERE template.id = ranked.id AND ranked.position > 1;
			ALTER TABLE "${qSchema}".body_templates DROP COLUMN IF EXISTS for_collection;
			CREATE UNIQUE INDEX IF NOT EXISTS body_templates_name_idx
			ON "${qSchema}".body_templates (lower(name));
		`),
	},
	{
		name: "0007_trashed_at",
		/** Time moved to trash */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;
			UPDATE "${qSchema}".entries SET trashed_at = updated_at WHERE status = 'trashed' AND trashed_at IS NULL;
		`),
	},
	{
		name: "0008_media_details",
		/** Media default alt text and original file */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS default_alt TEXT NOT NULL DEFAULT '';
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS default_caption TEXT NOT NULL DEFAULT '';
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_staging_key TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_storage_key TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_mime_type TEXT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_byte_size BIGINT;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_width INTEGER;
			ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS original_height INTEGER;
			CREATE INDEX IF NOT EXISTS media_assets_pending_idx ON "${qSchema}".media_assets(created_at) WHERE status IN ('pending', 'failed');
		`),
	},
	{
		name: "0009_locales",
		/** Multilingual: per-language documents, translation groups, per-language slugs */
		run: (client, qSchema) =>
			client.query(`
			-- Multilingual: one document per language + translation group. The group ID is the source's ID; the source itself is NULL.
			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT '${DEFAULT_LOCALE}';
			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS translation_group_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE NO ACTION;
			CREATE UNIQUE INDEX IF NOT EXISTS entries_translation_locale_key
			ON "${qSchema}".entries ((COALESCE(translation_group_id, id)), locale);
			ALTER TABLE "${qSchema}".content_addresses ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT '${DEFAULT_LOCALE}';
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.key_column_usage
					WHERE table_schema = '${qSchema}' AND table_name = 'content_addresses'
					  AND constraint_name = 'content_addresses_pkey' AND column_name = 'locale'
				) THEN
					ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT content_addresses_pkey;
					ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_pkey PRIMARY KEY (collection, locale, slug);
				END IF;
			END $$;
		`),
	},
	{
		name: "0010_content_hash_v2",
		/** Content hashes now cover the parsed body instead of the MDX string (`cms-snapshot-v2`). Recomputes every stored hash. */
		run: (client, qSchema) => recomputeContentHashes(client, qSchema),
	},
	{
		name: "0011_line_break_hashes",
		/**
		 * A line break is one document node (`hardBreak`) whichever way it was written, and a line of only `<br />` is an empty paragraph, so the parsed
		 * body of some stored bodies changed. Recomputes every stored hash so that "unpublished changes" keeps meaning what it meant.
		 */
		run: (client, qSchema) => recomputeContentHashes(client, qSchema),
	},
	{
		name: "0012_soft_line_endings",
		/**
		 * The public page no longer turns a single newline inside a paragraph into a line break (CommonMark: it is a space). Bodies written while it did keep their
		 * look by getting a `<br />` at each such line ending (working and published bodies, translation base sources, templates). Also recomputes
		 * `content_hash` and `search_text` of every body. A body that does not parse is left as it is and logged.
		 */
		run: (client, qSchema) => migrateSoftBreaks(client, qSchema),
	},
	{
		name: "0013_stored_documents",
		/**
		 * The parsed body is now the source of a body: `doc` holds it (the stored document, see `StoredDocument`) and `mdx` is written from it. Adds the column to
		 * bodies and templates, then gives every body its document, rewrites its MDX from it and recomputes `content_hash` and `search_text`
		 * (and the base source of a translation). A body that does not parse is left as it is, without a document, and logged.
		 */
		run: async (client, qSchema) => {
			await client.query(`
				ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS doc JSONB;
				ALTER TABLE "${qSchema}".body_templates ADD COLUMN IF NOT EXISTS doc JSONB;
			`);
			await migrateStoredDocuments(client, qSchema);
		},
	},
	{
		name: "0014_block_ids",
		/**
		 * Every block of a stored document now has an id (unique within the document, not written to MDX, not part of the content hash). Gives the blocks of every
		 * working and published body and of every template theirs. A published body shares ids with the working body for the blocks they have in common. Only `doc`
		 * changes: not `mdx`, `content_hash`, `search_text`, `version` or `updated_at`.
		 */
		run: (client, qSchema) => migrateBlockIds(client, qSchema),
	},
	{
		name: "0015_code_annotations",
		/**
		 * A code block of a stored document now holds its code and its annotations as data (document version 2) instead of the fence text with annotation comments.
		 * Lifts every working and published body, the stored document of a translation's base source and every template, and writes their MDX from it, so the
		 * annotation comments of a code fence are in the form Monti writes them. Also recomputes `content_hash` and `search_text`. Block ids, `version` and
		 * `updated_at` are kept. A body whose document cannot be read is left as it is and logged.
		 */
		run: (client, qSchema) => migrateCodeAnnotations(client, qSchema),
	},
	{
		name: "0016_plugin_documents",
		/** The documents of the plugin storage (`PluginStorage`): one row per plugin, collection and key. */
		run: (client, qSchema) =>
			client.query(`
			CREATE TABLE IF NOT EXISTS "${qSchema}".plugin_documents (
				plugin TEXT NOT NULL,
				collection TEXT NOT NULL,
				key TEXT NOT NULL,
				value JSONB NOT NULL,
				version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (plugin, collection, key)
			)
		`),
	},
	{
		// The name matches the legacy one-off record. Stores that already seeded do not seed again, and deleted templates are not revived.
		name: "seed_initial_body_templates",
		/** Seeds the site config's initial body templates into a new store, once. */
		run: async (client, qSchema) => {
			for (const t of cmsConfig.seed?.templates ?? []) {
				// Seeded as it is stored: written from the document when the template parses.
				const body = bodyFromMdx(t.mdx);
				await client.query(
					`INSERT INTO "${qSchema}".body_templates (id, name, mdx, doc, version, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
					 ON CONFLICT DO NOTHING`,
					[t.id, t.name, body.mdx, body.doc === null ? null : JSON.stringify(body.doc)],
				);
			}
		},
	},
];

/** List of step names (for tests and docs). */
export const CONTENT_STORE_MIGRATIONS: readonly string[] = STEPS.map((step) => step.name);

/** Takes a transaction lock so migrations on the same schema do not run concurrently. */
const lockMigrations = (client: PoolClient, qSchema: string) =>
	client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cms_migrate:${qSchema}`]);

/** Creates the schema and the step record table (after taking the lock). */
async function prepare(client: PoolClient, qSchema: string): Promise<void> {
	await lockMigrations(client, qSchema);
	await client.query(`CREATE SCHEMA IF NOT EXISTS "${qSchema}"`);
	await client.query(`
		CREATE TABLE IF NOT EXISTS "${qSchema}".cms_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);
}

/**
 * Creates the schema or brings it up to date. Creates the schema if missing (the `schema` option), then runs only the steps that have not run yet, in numbered order.
 * It is one transaction, so a mid-way failure changes nothing, and concurrent runs on the same schema go one at a time.
 */
export async function migrateContentStore(pool: Pool, options?: { schema?: string }): Promise<void> {
	const qSchema = validateSchemaName(options?.schema);
	await withTransaction(pool, async (client) => {
		await prepare(client, qSchema);
		const applied = new Set(
			(await client.query<{ name: string }>(`SELECT name FROM "${qSchema}".cms_migrations`)).rows.map(
				(row) => row.name,
			),
		);
		for (const step of STEPS) {
			if (applied.has(step.name)) continue;
			await step.run(client, qSchema);
			await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [step.name]);
		}
	});
}

/**
 * Run-once job (for example, a plugin moving legacy data). Calls `run` and records the name only when the name is not in `cms_migrations`.
 * It runs inside a transaction holding the same lock as the core migrations, so concurrent calls still run it once. A failure does not record the name.
 * Prefix the name with the plugin name so it never collides across the store (for example `ai:move-old-settings`).
 * @returns whether it ran this time
 */
export async function runOnce(
	pool: Pool,
	options: { schema?: string },
	name: string,
	run: (client: PoolClient) => Promise<void>,
): Promise<boolean> {
	const qSchema = validateSchemaName(options.schema);
	return withTransaction(pool, async (client) => {
		await prepare(client, qSchema);
		const done = await client.query(`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = $1`, [name]);
		if (done.rows.length > 0) return false;
		await run(client);
		await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [name]);
		return true;
	});
}
