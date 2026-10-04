import type { Pool, PoolClient } from "pg";
import { cmsConfig } from "../../../config/resolved";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { validateSchemaName, withTransaction } from "./context";

/** 마이그레이션 단계 하나. 이름이 `cms_migrations`에 남으면 다시 돌지 않는다. */
interface MigrationStep {
	readonly name: string;
	readonly run: (client: PoolClient, qSchema: string) => Promise<unknown>;
}

/**
 * 본체 마이그레이션 단계(번호 순서대로). 이미 있는 저장소는 처음 한 번 모든 단계가 돈다: 단계는 모두 다시 돌아도 같은 결과라
 * (IF NOT EXISTS, 예전 행 옮기기는 옮길 행이 없으면 아무것도 안 한다) 단계 기록이 없던 저장소에서도 안전하다.
 * 새 변경은 맨 뒤에 새 이름으로 더한다. 이미 있는 단계를 고치지 않는다(이미 돈 저장소에서는 다시 돌지 않는다).
 */
const STEPS: readonly MigrationStep[] = [
	{
		name: "0001_tables",
		/** 관계 참조·미디어·주소의 기본 표 */
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
		/** 관계 참조 종류를 entry·media로 줄인다(예전 category·tag 행 옮기기) */
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
		/** 폴더와 글 상태 */
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
		/** 주소 기록이 지운 글을 가리키지 않게(삭제 기록) */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".content_addresses ALTER COLUMN entry_id DROP NOT NULL;
			ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT IF EXISTS content_addresses_entry_id_fkey;
			ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL;
		`),
	},
	{
		name: "0005_body_search_translation",
		/** 본문 검색 글자와 번역 단위 */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
			-- v3 translation screen: translation units of a translated entry (source fragment, translation). NULL for the source.
			ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS translation JSONB;
		`),
	},
	{
		name: "0006_preferences_templates",
		/** 관리자 설정과 본문 템플릿(예전 컬렉션별 템플릿 합치기) */
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
		/** 휴지통에 넣은 시각 */
		run: (client, qSchema) =>
			client.query(`
			ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;
			UPDATE "${qSchema}".entries SET trashed_at = updated_at WHERE status = 'trashed' AND trashed_at IS NULL;
		`),
	},
	{
		name: "0008_media_details",
		/** 미디어 기본 대체 글·원본 파일 */
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
		/** 다국어: 언어별 문서·번역 묶음·언어별 주소 */
		run: (client, qSchema) =>
			client.query(`
			-- v2 B4 multilingual: one document per language + translation group. The group ID is the source's ID; the source itself is NULL.
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
		// 이름이 예전 일회성 기록과 같다. 이미 넣은 저장소는 다시 넣지 않고, 지운 템플릿을 되살리지 않는다.
		name: "seed_initial_body_templates",
		/** 사이트 설정의 초기 본문 템플릿을 새 저장소에 한 번만 넣는다. */
		run: async (client, qSchema) => {
			for (const t of cmsConfig.seed?.templates ?? []) {
				await client.query(
					`INSERT INTO "${qSchema}".body_templates (id, name, mdx, version, created_at, updated_at)
					 VALUES ($1, $2, $3, 1, NOW(), NOW())
					 ON CONFLICT DO NOTHING`,
					[t.id, t.name, t.mdx],
				);
			}
		},
	},
];

/** 단계 이름 목록(테스트·문서용). */
export const CONTENT_STORE_MIGRATIONS: readonly string[] = STEPS.map((step) => step.name);

/** 같은 스키마의 마이그레이션이 동시에 돌지 않게 트랜잭션 잠금을 건다. */
const lockMigrations = (client: PoolClient, qSchema: string) =>
	client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cms_migrate:${qSchema}`]);

/** 스키마와 단계 기록 표를 만든다(잠금을 건 뒤). */
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
 * 스키마를 만들거나 최신 모양으로 맞춘다. 스키마가 없으면 만들고(`schema` 설정), 아직 돌지 않은 단계만 번호 순서로 돈다.
 * 한 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않고, 같은 스키마에 동시에 돌려도 하나씩 돈다.
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
 * 한 번만 하는 일(플러그인의 예전 데이터 옮기기 등). 이름이 `cms_migrations`에 없을 때만 `run`을 부르고 이름을 남긴다.
 * 본체 마이그레이션과 같은 잠금을 건 트랜잭션 안이라 동시에 불러도 한 번만 돈다. 실패하면 이름을 남기지 않는다.
 * 이름은 저장소 전체에서 겹치지 않게 플러그인 이름을 앞에 붙인다(예: `ai:move-old-settings`).
 * @returns 이번에 돌았는가
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
