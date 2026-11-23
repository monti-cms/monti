import { type QueryExecutorProvider, sql } from "kysely";

/**
 * 스키마·설정 변경의 트랜잭션 잠금. 컬렉션 테이블을 맞추는 일(`schema.update`, `migrateMonti`)과 스키마·설정 파일을 바꾸는
 * 쓰기가 이 잠금을 잡고 하나씩 차례로 실행된다. 트랜잭션이 끝나면 풀린다. 같은 트랜잭션에서 다시 잡아도 기다리지 않는다.
 */
export async function lockSchemaChanges(db: QueryExecutorProvider): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtextextended('monti:schema', 0))`.execute(db);
}

/**
 * `scope`의 폴더 구조를 바꾸는 쓰기(`folders.create`, `folders.update`, `trash.move`, `trash.restore`)의 트랜잭션 잠금. 같은 `scope`의 이런 쓰기는 하나씩 차례로
 * 실행되어, 순환 이동이나 휴지통 폴더 아래로의 이동을 서로의 커밋 전 상태로 판정하지 않는다. 트랜잭션이 끝나면 풀린다.
 */
export async function lockFolderScope(db: QueryExecutorProvider, scope: string): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtextextended(${`monti:folders:${scope}`}, 0))`.execute(db);
}
