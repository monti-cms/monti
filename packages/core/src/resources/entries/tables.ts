import type { Kysely } from "kysely";
import type { Database } from "../../db/types";

/** 이름으로 읽고 쓰는 테이블 한 행. 컬렉션별 테이블은 스키마가 정하므로 열을 타입으로 알 수 없다. */
export type Row = Record<string, unknown>;

/** 고정 테이블과 함께 컬렉션별 테이블(`<collection>`, `<collection>_data`, `<collection>_rels`)도 이름으로 쓰는 연결. */
export function tablesOf(db: Kysely<Database>): Kysely<Database & Record<string, Row>> {
	return db.withTables<Record<string, Row>>();
}
