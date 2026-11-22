import { castExpression } from "./column-cast";
import type { ColumnSpec } from "./columns";

function addColumn(table: string, column: ColumnSpec): string {
	const { references } = column;
	const foreignKey =
		references === undefined ? "" : ` references "${references.table}"(id) on delete ${references.onDelete}`;
	return `alter table "${table}" add column "${column.name}" ${column.type}${foreignKey}`;
}

function dropColumn(table: string, name: string): string {
	return `alter table "${table}" drop column "${name}"`;
}

/** 열의 종류를 바꾸는 문장. 기존 값은 `castExpression`의 규칙대로 옮기거나 비운다. */
function changeType(table: string, from: string, column: ColumnSpec): string {
	const using = castExpression(column.name, from, column.type);
	return `alter table "${table}" alter column "${column.name}" type ${column.type} using ${using}`;
}

/** 열 하나를 `prev`에서 `next` 모양으로 맞추는 문장들. 참조 대상이 바뀌면 외래 키째 열을 다시 만든다. */
function columnChange(table: string, prev: ColumnSpec | undefined, next: ColumnSpec): string[] {
	if (prev === undefined) return [addColumn(table, next)];
	if (prev.references?.table !== next.references?.table) return [dropColumn(table, next.name), addColumn(table, next)];
	if (prev.type !== next.type) return [changeType(table, prev.type, next)];
	return [];
}

/** 테이블의 열을 `prev`에서 `next`로 맞추는 문장들: 사라진 열을 먼저 지우고, 새 열은 더하고, 종류가 다른 열은 바꾼다. */
export function columnDiff(table: string, prev: ColumnSpec[], next: ColumnSpec[]): string[] {
	const nextNames = new Set(next.map((column) => column.name));
	const prevByName = new Map(prev.map((column) => [column.name, column]));
	const dropped = prev.filter((column) => !nextNames.has(column.name));
	return [
		...dropped.map((column) => dropColumn(table, column.name)),
		...next.flatMap((column) => columnChange(table, prevByName.get(column.name), column)),
	];
}
