import { type QueryExecutorProvider, sql } from "kysely";
import type { ColumnSpec } from "./columns";
import { columnsInDatabase, type DatabaseColumn } from "./database-catalog";

async function addColumn(db: QueryExecutorProvider, table: string, column: ColumnSpec): Promise<void> {
	const { references } = column;
	const foreignKey =
		references === undefined
			? sql``
			: sql` references ${sql.id(references.table)}(id) on delete ${sql.raw(references.onDelete)}`;
	await sql`alter table ${sql.id(table)} add column ${sql.id(column.name)} ${sql.raw(column.type)}${foreignKey}`.execute(
		db,
	);
}

async function dropColumn(db: QueryExecutorProvider, table: string, name: string): Promise<void> {
	await sql`alter table ${sql.id(table)} drop column ${sql.id(name)}`.execute(db);
}

/** 글자를 거쳐 바꾼다: 직접 변환이 없는 종류 쌍(참거짓→숫자 등)도 바꿀 수 있다. */
async function changeType(db: QueryExecutorProvider, table: string, column: ColumnSpec): Promise<void> {
	const name = sql.id(column.name);
	const type = sql.raw(column.type);
	await sql`alter table ${sql.id(table)} alter column ${name} type ${type} using ${name}::text::${type}`.execute(db);
}

/** 열 하나를 바라는 모양으로 맞춘다. 참조 대상이 바뀌면 외래 키째 열을 다시 만든다. */
async function syncColumn(
	db: QueryExecutorProvider,
	table: string,
	wanted: ColumnSpec,
	current: DatabaseColumn | undefined,
): Promise<void> {
	if (current === undefined) return addColumn(db, table, wanted);
	if (current.references !== (wanted.references?.table ?? null)) {
		await dropColumn(db, table, wanted.name);
		return addColumn(db, table, wanted);
	}
	if (current.type !== wanted.type) await changeType(db, table, wanted);
}

/** 테이블의 열을 `wanted`에 맞춘다: 없으면 추가, 남으면 삭제, 종류가 다르면 변경. `fixed` 열은 건드리지 않는다. */
export async function syncColumns(
	db: QueryExecutorProvider,
	table: string,
	wanted: ColumnSpec[],
	fixed: readonly string[],
): Promise<void> {
	const existing = await columnsInDatabase(db, table);
	const wantedNames = new Set(wanted.map((column) => column.name));
	for (const column of existing) {
		if (!fixed.includes(column.name) && !wantedNames.has(column.name)) await dropColumn(db, table, column.name);
	}
	const byName = new Map(existing.map((column) => [column.name, column]));
	for (const column of wanted) await syncColumn(db, table, column, byName.get(column.name));
}
