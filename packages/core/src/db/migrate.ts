import { type Kysely, sql, type Transaction } from "kysely";
import type { Migration } from "./types";

/** 실행한 모든 단계의 `(source, name)`을 담는 이력 테이블을 없을 때만 만든다. */
async function ensureHistory<DB>(db: Kysely<DB>): Promise<void> {
	await db.schema
		.createTable("migrations")
		.ifNotExists()
		.addColumn("source", "text", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.addPrimaryKeyConstraint("migrations_pkey", ["source", "name"])
		.execute();
}

/** `source`에서 이미 실행된 단계의 이름들. */
async function ranNames<DB>(db: Kysely<DB>, source: string): Promise<Set<string>> {
	const { rows } = await sql<{ name: string }>`select name from migrations where source = ${source}`.execute(db);
	return new Set(rows.map((row) => row.name));
}

/** 단계 하나를 실행하고 같은 트랜잭션에서 기록한다. 실패한 단계는 변경도 기록도 남기지 않는다. */
async function runStep<DB>(db: Kysely<DB>, source: string, migration: Migration): Promise<void> {
	await db.transaction().execute(async (trx: Transaction<DB>) => {
		await migration.up(trx);
		await sql`insert into migrations (source, name) values (${source}, ${migration.name})`.execute(trx);
	});
}

/**
 * 출처 `source`(예: 코어의 `"@monti-cms/core"`, 플러그인 이름)의 단계를 배열 순서대로 한 번씩 실행한다. `migrations`에
 * 그 출처로 이미 기록된 단계는 건너뛴다. 실패한 단계는 롤백하고 오류를 던지며, 앞 단계는 남고 뒤 단계는 실행하지 않는다.
 */
export async function migrate<DB>(db: Kysely<DB>, source: string, migrations: readonly Migration[]): Promise<void> {
	await ensureHistory(db);
	const ran = await ranNames(db, source);
	for (const migration of migrations) {
		if (ran.has(migration.name)) continue;
		await runStep(db, source, migration);
	}
}
