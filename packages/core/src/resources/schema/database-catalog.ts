import { type QueryExecutorProvider, sql } from "kysely";

/** 컬렉션 기본 테이블에 다는 주석. 이 주석이 있는 테이블만 컬렉션 테이블로 보고 동기화한다. */
export const collectionMarker = "monti:collection";

/** DB에 있는 열 하나: `format_type` 표기의 타입과 단일 열 외래 키가 가리키는 테이블. */
export interface DatabaseColumn {
	name: string;
	type: string;
	references: string | null;
}

/** `public` 스키마에서 컬렉션 주석이 달린 테이블 이름들. */
export async function collectionsInDatabase(db: QueryExecutorProvider): Promise<string[]> {
	const { rows } = await sql<{ name: string }>`
		select c.relname as name
		from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind = 'r' and obj_description(c.oid, 'pg_class') = ${collectionMarker}
	`.execute(db);
	return rows.map((row) => row.name);
}

/** `public` 스키마의 테이블 하나가 가진 열들. */
export async function columnsInDatabase(db: QueryExecutorProvider, table: string): Promise<DatabaseColumn[]> {
	const { rows } = await sql<DatabaseColumn>`
		select a.attname as name, format_type(a.atttypid, a.atttypmod) as type, fk.target as "references"
		from pg_attribute a
		join pg_class c on c.oid = a.attrelid
		join pg_namespace n on n.oid = c.relnamespace
		left join lateral (
			select t.relname as target from pg_constraint k join pg_class t on t.oid = k.confrelid
			where k.conrelid = c.oid and k.contype = 'f' and k.conkey = array[a.attnum]
		) fk on true
		where n.nspname = 'public' and c.relname = ${table} and a.attnum > 0 and not a.attisdropped
	`.execute(db);
	return rows;
}
