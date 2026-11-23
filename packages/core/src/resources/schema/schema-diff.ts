import { MontiError } from "../../engine/errors";
import { isCollectionKey, MAX_IDENTIFIER_BYTES } from "../../engine/schema-file";
import type { Schema } from "../../engine/types";
import { createStatements, dropStatement } from "./collection-tables";
import { columnDiff } from "./column-diff";
import { type CollectionSnapshot, type SchemaSnapshot, snapshotOf } from "./snapshot";

/** 스냅샷에 없던 컬렉션: 테이블을 막 만들어 스키마가 정하는 열이 아직 없다. */
const noColumns: CollectionSnapshot = { data: [], rels: [] };

/** 이전 스냅샷에서 SQL 문장에 들어가는 이름들: 컬렉션 키, 그 키로 만든 테이블 이름, 열 이름. */
function namesOf(prev: SchemaSnapshot): string[] {
	return Object.entries(prev.collections).flatMap(([key, { data, rels }]) => [
		key,
		`${key}_data`,
		`${key}_rels`,
		...[...data, ...rels].map((column) => column.name),
	]);
}

/** 큰따옴표로 감싸 SQL에 넣어도 되는 이름인지: 비어 있지 않고, 큰따옴표·점이 없고, 식별자 한도 안이다. */
function isAllowedName(name: string): boolean {
	return name !== "" && !name.includes('"') && !name.includes(".") && Buffer.byteLength(name) <= MAX_IDENTIFIER_BYTES;
}

/**
 * 이전 스냅샷이 SQL에 넣어도 되는 이름만 가졌는지: 모든 이름이 허용되고, 컬렉션 키가 코어 고정 테이블이나 `_data`·`_rels`로
 * 끝나는 이름이 아니다. 고친 스냅샷으로 `drop table "admin"` 같은 문장을 만들지 않기 위해서다.
 */
function isAllowedSnapshot(prev: SchemaSnapshot): boolean {
	return namesOf(prev).every(isAllowedName) && Object.keys(prev.collections).every(isCollectionKey);
}

function collectionDiff(key: string, prev: CollectionSnapshot, next: CollectionSnapshot): string[] {
	return [...columnDiff(`${key}_data`, prev.data, next.data), ...columnDiff(`${key}_rels`, prev.rels, next.rels)];
}

/**
 * `prev` 스냅샷대로 만들어진 DB를 `next` 스키마에 맞추는 PostgreSQL DDL 문장들. 사라진 컬렉션의 테이블을 먼저 지우고,
 * 새 컬렉션의 테이블을 모두 만든 뒤에 열을 맞춘다: 관계 필드의 외래 키가 다른 컬렉션 테이블을 가리킬 수 있어야 하기
 * 때문이다. 개발 서버의 스키마 동기화와 마이그레이션 CLI가 이 규칙을 함께 쓴다. 바뀐 것이 없으면 빈 배열이다. 이전
 * 스냅샷의 이름이 SQL에 넣을 수 없거나 컬렉션 키로 쓸 수 없는 이름이면 `BAD_REQUEST`로 거절한다.
 */
export function planSchemaDiff(prev: SchemaSnapshot, next: Schema): string[] {
	if (!isAllowedSnapshot(prev)) {
		throw new MontiError("BAD_REQUEST", "이전 스냅샷에 SQL 식별자나 컬렉션 키로 쓸 수 없는 이름이 있다");
	}
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
