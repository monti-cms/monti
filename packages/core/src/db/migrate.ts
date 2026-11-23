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

/** 이름이 같은 단계가 둘 이상 있으면 아무것도 실행하기 전에 거절한다. */
function rejectDuplicates(migrations: readonly Migration[]): void {
	const names = migrations.map((migration) => migration.name);
	const duplicate = names.find((name, index) => names.indexOf(name) !== index);
	if (duplicate !== undefined) throw new Error(`마이그레이션 단계 이름 "${duplicate}"이 중복된다`);
}

/** 모든 출처의 마이그레이션이 같이 쓰는 세션 잠금 키: 동시에 실행된 `migrate`는 하나씩 차례로 실행된다. */
const MIGRATE_LOCK = sql`hashtextextended('monti:migrate', 0)`;

/** 연결 하나를 잡아 세션 잠금을 건 채로 `run`을 실행한다. 잠금은 그 연결에서만 풀 수 있어 모든 일을 그 연결에서 한다. */
async function locked<DB>(db: Kysely<DB>, run: (conn: Kysely<DB>) => Promise<void>): Promise<void> {
	await db.connection().execute(async (conn) => {
		await sql`select pg_advisory_lock(${MIGRATE_LOCK})`.execute(conn);
		try {
			await run(conn);
		} finally {
			await sql`select pg_advisory_unlock(${MIGRATE_LOCK})`.execute(conn);
		}
	});
}

/**
 * 출처 `source`(예: 코어의 `"@monti-cms/core"`, 플러그인 이름)의 단계를 배열 순서대로 한 번씩 실행한다. `migrations`에
 * 그 출처로 이미 기록된 단계는 건너뛴다. 실패한 단계는 롤백하고 오류를 던지며, 앞 단계는 남고 뒤 단계는 실행하지 않는다.
 * 이름이 같은 단계가 들어 있으면 실행 전에 거절하고, 동시에 실행된 `migrate`는 잠금으로 차례를 지켜 단계마다 한 번만 실행한다.
 */
export async function migrate<DB>(db: Kysely<DB>, source: string, migrations: readonly Migration[]): Promise<void> {
	rejectDuplicates(migrations);
	await locked(db, async (conn) => {
		await ensureHistory(conn);
		const ran = await ranNames(conn, source);
		for (const migration of migrations) {
			if (ran.has(migration.name)) continue;
			await runStep(conn, source, migration);
		}
	});
}
