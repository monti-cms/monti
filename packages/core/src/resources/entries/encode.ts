import type { CollectionSchema } from "../../engine/types";
import { dataColumns } from "../schema/columns";
import { type ConditionalValue, isMany, targetOf, valuesOf } from "./slots";
import type { Row } from "./tables";
import type { EntryData } from "./types";

/** 저장할 모양: `<collection>_data`의 본문·필드 열과 `<collection>_rels` 행(키 열 제외). */
export interface Encoded {
	columns: Row;
	rels: Row[];
}

/**
 * `data`를 저장할 모양으로 바꾼다. 스키마가 정하는 열을 모두 담고 값이 없는 열은 null로 채워, 저장하면 작업본이 통째로
 * 바뀐다. 다건 참조는 순서대로 `position`을 매긴 `_rels` 행이 된다.
 */
export function encodeData(collection: CollectionSchema, data: EntryData): Encoded {
	const columns: Row = Object.fromEntries(dataColumns(collection).map((column) => [column.name, null]));
	const rels: Row[] = [];
	for (const [key, field] of Object.entries(collection.fields)) {
		if (field.type === "conditional") columns[key] = (data.fields[key] as ConditionalValue | undefined)?.option ?? null;
	}
	for (const { slot, value } of valuesOf(collection, data.fields)) {
		if (!isMany(slot.field)) columns[slot.column] = value;
		else {
			const column = `${targetOf(slot.field)}_id`;
			rels.push(...(value as string[]).map((id, position) => ({ path: slot.path, position, [column]: id })));
		}
	}
	if (collection.body === true) columns.body = data.body === undefined ? null : JSON.stringify(data.body);
	return { columns, rels };
}
