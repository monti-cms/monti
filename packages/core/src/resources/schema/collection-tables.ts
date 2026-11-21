import { type QueryExecutorProvider, sql } from "kysely";
import { collectionMarker } from "./database-catalog";

/** 스키마와 상관없이 늘 있는 `<collection>_rels` 열. */
export const fixedRelsColumns = ["entry_id", "locale", "status", "path", "position"] as const;

async function createEntryTable(db: QueryExecutorProvider, key: string): Promise<void> {
	await sql`
		create table ${sql.id(key)} (
			id uuid primary key,
			source_locale text not null,
			folder_id uuid references folders(id),
			trashed_at timestamptz
		)
	`.execute(db);
	await sql`comment on table ${sql.id(key)} is ${sql.lit(collectionMarker)}`.execute(db);
}

async function createDataTable(db: QueryExecutorProvider, key: string): Promise<void> {
	await sql`
		create table ${sql.id(`${key}_data`)} (
			entry_id uuid not null references ${sql.id(key)}(id) on delete cascade,
			locale text not null,
			status text not null,
			slug text,
			published_at timestamptz,
			translation_seen jsonb not null default '{}'::jsonb,
			primary key (entry_id, locale, status)
		)
	`.execute(db);
}

async function createRelsTable(db: QueryExecutorProvider, key: string): Promise<void> {
	await sql`
		create table ${sql.id(`${key}_rels`)} (
			entry_id uuid not null,
			locale text not null,
			status text not null,
			path text not null,
			position integer not null,
			primary key (entry_id, locale, status, path, position),
			foreign key (entry_id, locale, status)
				references ${sql.id(`${key}_data`)}(entry_id, locale, status) on delete cascade
		)
	`.execute(db);
}

/** 컬렉션의 세 테이블을 기본 열만 가진 채로 만든다. 스키마가 정하는 열은 `syncColumns`가 맞춘다. */
export async function createCollectionTables(db: QueryExecutorProvider, key: string): Promise<void> {
	await createEntryTable(db, key);
	await createDataTable(db, key);
	await createRelsTable(db, key);
}

/** 컬렉션의 세 테이블을 지운다. 다른 컬렉션에서 이 컬렉션을 가리키던 외래 키도 함께 지워진다. */
export async function dropCollectionTables(db: QueryExecutorProvider, key: string): Promise<void> {
	await sql`drop table ${sql.id(`${key}_rels`)}, ${sql.id(`${key}_data`)}, ${sql.id(key)} cascade`.execute(db);
}
