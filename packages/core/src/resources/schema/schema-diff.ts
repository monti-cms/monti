import type { Schema } from "../../engine/types";
import { createStatements, dropStatement } from "./collection-tables";
import { columnDiff } from "./column-diff";
import { type CollectionSnapshot, type SchemaSnapshot, snapshotOf } from "./snapshot";

/** 스냅샷에 없던 컬렉션: 테이블을 막 만들어 스키마가 정하는 열이 아직 없다. */
const noColumns: CollectionSnapshot = { data: [], rels: [] };

function collectionDiff(key: string, prev: CollectionSnapshot, next: CollectionSnapshot): string[] {
	return [...columnDiff(`${key}_data`, prev.data, next.data), ...columnDiff(`${key}_rels`, prev.rels, next.rels)];
}

/**
 * `prev` 스냅샷대로 만들어진 DB를 `next` 스키마에 맞추는 PostgreSQL DDL 문장들. 사라진 컬렉션의 테이블을 먼저 지우고,
 * 새 컬렉션의 테이블을 모두 만든 뒤에 열을 맞춘다: 관계 필드의 외래 키가 다른 컬렉션 테이블을 가리킬 수 있어야 하기
 * 때문이다. 개발 서버의 스키마 동기화와 마이그레이션 CLI가 이 규칙을 함께 쓴다. 바뀐 것이 없으면 빈 배열이다.
 */
export function planSchemaDiff(prev: SchemaSnapshot, next: Schema): string[] {
	const before = new Map(Object.entries(prev.collections));
	const after = new Map(Object.entries(snapshotOf(next).collections));
	const dropped = [...before.keys()].filter((key) => !after.has(key));
	const created = [...after.keys()].filter((key) => !before.has(key));
	return [
		...dropped.map(dropStatement),
		...created.flatMap(createStatements),
		...[...after].flatMap(([key, tables]) => collectionDiff(key, before.get(key) ?? noColumns, tables)),
	];
}
