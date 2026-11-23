import { type QueryExecutorProvider, sql } from "kysely";

/**
 * 스키마·설정 변경의 트랜잭션 잠금. 컬렉션 테이블을 맞추는 일(`schema.update`, `migrateMonti`)과 스키마·설정 파일을 바꾸는
 * 쓰기가 이 잠금을 잡고 하나씩 차례로 실행된다. 트랜잭션이 끝나면 풀린다. 같은 트랜잭션에서 다시 잡아도 기다리지 않는다.
 */
export async function lockSchemaChanges(db: QueryExecutorProvider): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtextextended('monti:schema', 0))`.execute(db);
}

/**
 * `scope`(컬렉션 키 또는 `"media"`)의 트랜잭션 잠금. 그 `scope`의 폴더 구조를 바꾸거나 폴더에 항목을 넣고 옮기는 쓰기, 휴지통에서
 * 꺼내거나 영구 삭제하는 쓰기, 그 컬렉션의 글을 쓰는(슬러그를 정하는) 쓰기가 잡고 하나씩 차례로 실행되어, 서로의 커밋 전
 * 상태로 판정하지 않는다. 글 행 잠금보다 먼저 잡는다. 트랜잭션이 끝나면 풀린다. 같은 트랜잭션에서 다시 잡아도 기다리지 않는다.
 */
export async function lockFolderScope(db: QueryExecutorProvider, scope: string): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtextextended(${`monti:folders:${scope}`}, 0))`.execute(db);
}
