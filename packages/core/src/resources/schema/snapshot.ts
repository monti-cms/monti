import { validSchema } from "../../engine/schema-file";
import type { CollectionSchema, Schema } from "../../engine/types";
import { type ColumnSpec, dataColumns, relsColumns } from "./columns";

/** 컬렉션 하나에서 스키마가 열을 정하는 두 테이블(`<collection>_data`, `<collection>_rels`)의 열. 고정 열은 담지 않는다. */
export interface CollectionSnapshot {
	data: ColumnSpec[];
	rels: ColumnSpec[];
}

/** 스키마가 DB에 만드는 컬렉션 테이블의 모양. JSON으로 저장해 두었다가 다음 스키마와 비교할 수 있다. */
export interface SchemaSnapshot {
	collections: Record<string, CollectionSnapshot>;
}

function collectionSnapshot([key, collection]: [string, CollectionSchema]): [string, CollectionSnapshot] {
	return [key, { data: dataColumns(collection), rels: relsColumns(collection) }];
}

/** 스키마를 검사한 뒤 그 스키마가 만드는 컬렉션 테이블의 스냅샷을 만든다. 올바르지 않은 스키마는 `BAD_REQUEST`로 거절한다. */
export function snapshotOf(schema: Schema): SchemaSnapshot {
	const { collections } = validSchema(schema);
	return { collections: Object.fromEntries(Object.entries(collections).map(collectionSnapshot)) };
}
