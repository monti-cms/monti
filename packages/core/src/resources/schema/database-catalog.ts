import { type QueryExecutorProvider, sql } from "kysely";
import { fixedDataColumns } from "../../engine/schema-file";
import { collectionMarker, fixedRelsColumns } from "./collection-tables";
import type { ColumnSpec } from "./columns";
import type { CollectionSnapshot, SchemaSnapshot } from "./snapshot";

/** 카탈로그에서 읽은 열 하나: `format_type` 표기의 타입과, 단일 열 외래 키가 없으면 `null`인 참조. */
interface CatalogColumn {
	name: string;
	type: string;
	references: NonNullable<ColumnSpec["references"]> | null;
}

/** 연결의 현재 스키마(`current_schema()`)에서 컬렉션 주석이 달린 테이블 이름들. */
export async function collectionsInDatabase(db: QueryExecutorProvider): Promise<string[]> {
	const { rows } = await sql<{ name: string }>`
		select c.relname as name
		from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = current_schema() and c.relkind = 'r' and obj_description(c.oid, 'pg_class') = ${collectionMarker}
	`.execute(db);
	return rows.map((row) => row.name);
}

function columnOf({ name, type, references }: CatalogColumn): ColumnSpec {
	return references === null ? { name, type } : { name, type, references };
}

/** 현재 스키마의 테이블 하나가 가진 열 중 `fixed`가 아닌 열들. */
async function columnsInDatabase(
	db: QueryExecutorProvider,
	table: string,
	fixed: readonly string[],
): Promise<ColumnSpec[]> {
	const { rows } = await sql<CatalogColumn>`
		select a.attname as name, format_type(a.atttypid, a.atttypmod) as type, fk.reference as "references"
		from pg_attribute a
		join pg_class c on c.oid = a.attrelid
		join pg_namespace n on n.oid = c.relnamespace
		left join lateral (
			select json_build_object(
				'table', t.relname,
				'onDelete', case k.confdeltype when 'c' then 'cascade' else 'set null' end
			) as reference
			from pg_constraint k join pg_class t on t.oid = k.confrelid
			where k.conrelid = c.oid and k.contype = 'f' and k.conkey = array[a.attnum]
		) fk on true
		where n.nspname = current_schema() and c.relname = ${table} and a.attnum > 0 and not a.attisdropped
	`.execute(db);
	return rows.filter((row) => !fixed.includes(row.name)).map(columnOf);
}

/** DB에 있는 컬렉션 테이블의 스냅샷: 컬렉션마다 `_data`·`_rels` 테이블에서 고정 열을 뺀 열들. */
export async function snapshotInDatabase(db: QueryExecutorProvider): Promise<SchemaSnapshot> {
	const collections: [string, CollectionSnapshot][] = [];
	for (const key of await collectionsInDatabase(db)) {
		const data = await columnsInDatabase(db, `${key}_data`, fixedDataColumns);
		collections.push([key, { data, rels: await columnsInDatabase(db, `${key}_rels`, fixedRelsColumns) }]);
	}
	return { collections: Object.fromEntries(collections) };
}
