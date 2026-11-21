import type { QueryExecutorProvider } from "kysely";
import type { Schema } from "../../engine/types";
import { createCollectionTables, dropCollectionTables, fixedDataColumns, fixedRelsColumns } from "./collection-tables";
import { dataColumns, relsColumns } from "./columns";
import { collectionsInDatabase } from "./database-catalog";
import { syncColumns } from "./sync-columns";

/**
 * DB의 컬렉션별 테이블(`<collection>`, `<collection>_data`, `<collection>_rels`)을 `schema`에 맞춘다. 사라진 컬렉션의
 * 테이블을 지우고, 새 컬렉션의 테이블을 모두 만든 뒤에 열을 맞춘다: 관계 필드의 외래 키가 다른 컬렉션 테이블을 가리킬
 * 수 있어야 하기 때문이다.
 */
export async function syncSchemaTables(db: QueryExecutorProvider, schema: Schema): Promise<void> {
	const keys = Object.keys(schema.collections);
	const existing = await collectionsInDatabase(db);
	for (const key of existing) if (!keys.includes(key)) await dropCollectionTables(db, key);
	for (const key of keys) if (!existing.includes(key)) await createCollectionTables(db, key);
	for (const [key, collection] of Object.entries(schema.collections)) {
		await syncColumns(db, `${key}_data`, dataColumns(collection), fixedDataColumns);
		await syncColumns(db, `${key}_rels`, relsColumns(collection), fixedRelsColumns);
	}
}
