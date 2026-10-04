"use client";

import type { ComponentType } from "react";
import type { CmsAdminComponents, ListCellProps } from "../admin-components";
import { fieldColumnOf } from "./list-columns";
import { FittingTags } from "./shared/fitting-tags";

const EMPTY = <span className="text-cms-muted-foreground">—</span>;

/**
 * 컬럼의 칸 컴포넌트를 관리자 확장(`listCells`)에서 찾는다. 컬럼 이름이 먼저고, 없으면 필드의 `input` 이름이다.
 * 없으면 `undefined`(기본 칸을 그린다).
 */
export function customListCell(
	listCells: CmsAdminComponents["listCells"],
	collection: string,
	column: string,
): ComponentType<ListCellProps> | undefined {
	if (!listCells) return undefined;
	if (Object.hasOwn(listCells, column)) return listCells[column];
	const input = fieldColumnOf(collection, column)?.field.input;
	return input !== undefined && Object.hasOwn(listCells, input) ? listCells[input] : undefined;
}

/**
 * 필드 컬럼의 기본 칸. 관계는 이름(여러 개면 칩), 선택은 선택지 이름표, 글자·미디어는 저장된 글이다.
 * 값이 없으면 `—`이다. 날짜는 시스템 컬럼(수정일·만든 날·발행일)이 따로 그린다.
 */
export function DefaultFieldCell({ collection, column, entry }: ListCellProps) {
	const stored = fieldColumnOf(collection, column);
	if (!stored) return EMPTY;
	const { field } = stored;
	if (field.kind === "relation") {
		const values = (entry.relations[column] ?? []).flatMap(({ id, title }) => (title ? [{ id, title }] : []));
		if (!values.length) return EMPTY;
		return field.many ? <FittingTags tags={values} /> : values[0]?.title;
	}
	const value = entry.values[column];
	if (!value) return EMPTY;
	if (field.kind === "select") return Object.hasOwn(field.options, value) ? field.options[value] : value;
	if (field.kind === "media") return <span className="font-mono text-cms-muted-foreground text-xs">{value}</span>;
	return value;
}
