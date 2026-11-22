/** 컬렉션 기본 테이블에 다는 주석. 이 주석이 있는 테이블만 컬렉션 테이블로 보고 동기화한다. */
export const collectionMarker = "monti:collection";

/** 스키마와 상관없이 늘 있는 `<collection>_rels` 열. */
export const fixedRelsColumns = ["entry_id", "locale", "status", "path", "position"] as const;

function entryTable(key: string): string {
	return `create table "${key}" (
		id uuid primary key,
		source_locale text not null,
		folder_id uuid references folders(id),
		trashed_at timestamptz
	)`;
}

function dataTable(key: string): string {
	return `create table "${key}_data" (
		entry_id uuid not null references "${key}"(id) on delete cascade,
		locale text not null,
		status text not null,
		slug text,
		published_at timestamptz,
		translation_seen jsonb not null default '{}'::jsonb,
		primary key (entry_id, locale, status)
	)`;
}

function relsTable(key: string): string {
	return `create table "${key}_rels" (
		entry_id uuid not null,
		locale text not null,
		status text not null,
		path text not null,
		position integer not null,
		primary key (entry_id, locale, status, path, position),
		foreign key (entry_id, locale, status)
			references "${key}_data"(entry_id, locale, status) on delete cascade
	)`;
}

/**
 * 컬렉션의 세 테이블을 기본 열만 가진 채로 만들고 기본 테이블에 컬렉션 주석을 다는 문장들. 스키마가 정하는 열은
 * `columnDiff`의 문장이 더한다.
 */
export function createStatements(key: string): string[] {
	return [entryTable(key), `comment on table "${key}" is '${collectionMarker}'`, dataTable(key), relsTable(key)];
}

/** 컬렉션의 세 테이블을 지우는 문장. 다른 컬렉션에서 이 컬렉션을 가리키던 외래 키도 함께 지워진다. */
export function dropStatement(key: string): string {
	return `drop table "${key}_rels", "${key}_data", "${key}" cascade`;
}
