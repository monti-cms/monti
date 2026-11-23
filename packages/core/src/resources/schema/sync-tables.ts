import { type QueryExecutorProvider, sql } from "kysely";
import { lockSchemaChanges } from "../../db/locks";
import type { Schema } from "../../engine/types";
import { snapshotInDatabase } from "./database-catalog";
import { planSchemaDiff } from "./schema-diff";

/**
 * DB의 컬렉션별 테이블(`<collection>`, `<collection>_data`, `<collection>_rels`)을 `schema`에 맞춘다. DB에 있는 테이블의
 * 스냅샷과 `schema`의 차이를 마이그레이션 CLI와 같은 `planSchemaDiff`로 계획해 그 문장들을 차례로 실행한다. 동시에 맞추는
 * 트랜잭션은 잠금으로 하나씩 차례를 지켜, 앞선 쪽이 커밋한 테이블을 보고 계획한다.
 */
export async function syncSchemaTables(db: QueryExecutorProvider, schema: Schema): Promise<void> {
	await lockSchemaChanges(db);
	for (const statement of planSchemaDiff(await snapshotInDatabase(db), schema)) await sql.raw(statement).execute(db);
}
