import type { CollectionSchema } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { type ConditionalValue, isMany, type Slot, slotsOf, targetOf } from "./slots";
import type { Row } from "./tables";
import type { EntryData } from "./types";

/** 저장된 한 언어·상태: `<collection>_data` 행과 그 `<collection>_rels` 행들(`position` 순). */
export interface Stored {
	row: Row;
	rels: Row[];
}

/** 참조 대상 `id`가 `table`에서 살아 있는지. 휴지통 대상은 발행본 조회 결과에서 빈칸이 된다. */
export type IsActive = (table: string, id: string) => boolean;

/** 거르지 않고 모든 참조를 살려 두는 판정. */
export function everyTarget(): boolean {
	return true;
}

function kept(slot: Slot, id: unknown, isActive: IsActive): boolean {
	const table = targetOf(slot.field);
	return table === undefined || isActive(table, id as string);
}

/**
 * 자리 하나의 저장된 값. 비었거나 살아 있지 않은 참조만 남으면 undefined. 관계 대상(`to`)을 바꾸기 전에 저장된 `_rels`
 * 행은 새 대상 열이 비어 있으므로(`null`) 값에 넣지 않는다.
 */
function storedValue(slot: Slot, stored: Stored, isActive: IsActive): unknown {
	if (isMany(slot.field)) {
		const column = `${targetOf(slot.field)}_id`;
		const ids = stored.rels
			.filter((rel) => rel.path === slot.path)
			.map((rel) => rel[column])
			.filter((id) => id !== null && kept(slot, id, isActive));
		return ids.length > 0 ? ids : undefined;
	}
	const value = stored.row[slot.column];
	if (value === null || !kept(slot, value, isActive)) return undefined;
	return value instanceof Date ? value.toISOString() : value;
}

/** 선택된 분기마다 `{ option, fields: {} }`를 담은 필드 값. 하위 필드 값은 `decodeData`가 채운다. */
function chosenOptions(collection: CollectionSchema, row: Row): Row {
	const fields: Row = {};
	for (const [key, field] of Object.entries(collection.fields)) {
		const option = row[key];
		if (field.type === "conditional" && typeof option === "string") fields[key] = { option, fields: {} };
	}
	return fields;
}

/** 저장된 행들을 `{ fields, body? }`로 되돌린다. 값이 없는 필드와 `body`는 키를 넣지 않는다. */
export function decodeData(collection: CollectionSchema, stored: Stored, isActive: IsActive): EntryData {
	const fields = chosenOptions(collection, stored.row);
	for (const slot of slotsOf(collection)) {
		const value = storedValue(slot, stored, isActive);
		if (value === undefined) continue;
		// 고르지 않은 분기의 하위 열은 늘 비어 있으므로, 값이 있는 하위 열은 `chosenOptions`가 담은 분기의 것이다.
		if (slot.sub === undefined) fields[slot.key] = value;
		else (fields[slot.key] as ConditionalValue).fields[slot.sub] = value;
	}
	const body = stored.row.body;
	return body === null || body === undefined ? { fields } : { fields, body: body as Doc };
}
