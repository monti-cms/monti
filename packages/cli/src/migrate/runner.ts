import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	coreMigrations,
	type Database,
	type Migration,
	type MontiConfig,
	migrate,
	migrateMonti,
	type Plugin,
	type Schema,
	snapshotOf,
	specOf,
} from "@monti-cms/core";
import { type ControlledTransaction, type Kysely, sql } from "kysely";
import { CliError } from "../parse/error";
import { listMigrationFiles } from "./files";

/** 사용자 프로젝트의 `.sql` 마이그레이션을 `migrations` 테이블에 기록하는 출처. */
const projectSource = "project";

/** core의 마이그레이션 출처. `migrateMonti`가 core의 단계를 기록하는 이름과 같다. */
const coreSource = "@monti-cms/core";

/** 부팅이 불러온 프로젝트: 설정·스키마 파일의 `default` export와 두 파일의 절대 경로. `startMonti`에 그대로 넘긴다. */
export interface LoadedProject {
	config: MontiConfig;
	schema: Schema;
	configFile: string;
	schemaFile: string;
}

/** `runMigrations`에 넘기는 것. `dir`은 프로젝트의 마이그레이션 폴더다. */
interface RunOptions {
	db: Kysely<Database>;
	project: LoadedProject;
	dir: string;
	dryRun?: boolean;
}

/** `getMigrationStatus`에 넘기는 것. */
interface StatusOptions {
	db: Kysely<Database>;
	dir: string;
}

/** 프로젝트 `.sql` 파일 하나가 적용됐는지. */
interface MigrationStatus {
	name: string;
	applied: boolean;
}

/** 출처(`migrations.source`)와 그 출처에서 실행할 단계들. */
type SourceSteps = readonly [string, readonly Migration[]];

/**
 * 운영 DB에 마이그레이션을 적용한다: `migrateMonti`로 스키마를 검사하고 core·플러그인 단계를 실행한 뒤, `dir`의 `.sql` 파일
 * 가운데 아직 적용하지 않은 것을 이름순으로 `"project"` 출처로 실행하고 그 파일 이름을 돌려준다. 실패한 파일은 롤백하고
 * 오류를 던지며, 앞 파일은 남고 뒤 파일은 실행하지 않는다. `dryRun`이면 같은 단계를 한 트랜잭션에서 실행해 보고 되돌린다.
 * 개발 서버 설정(`config.dev: true`)이면 DB를 건드리지 않고 실행 오류다.
 */
export async function runMigrations(options: RunOptions): Promise<string[]> {
	if (options.project.config.dev === true) {
		throw new CliError(1, "개발 서버 설정(dev: true)으로는 운영 마이그레이션을 적용할 수 없다");
	}
	return options.dryRun === true ? tryMigrations(options) : applyMigrations(options);
}

/** `dir`의 `.sql` 파일마다 `"project"` 출처로 적용됐는지를 이름순으로 돌려준다. DB는 읽기만 한다. */
export async function getMigrationStatus({ db, dir }: StatusOptions): Promise<MigrationStatus[]> {
	const ran = await ranNames(db, projectSource);
	return (await listMigrationFiles(dir)).map((name) => ({ name, applied: ran.has(name) }));
}

/**
 * `migrateMonti`로 내장 단계를 적용한 뒤 아직 적용하지 않은 `.sql` 파일을 core의 `migrate`로 실행하고, 이 호출이 실제로 적용한
 * 파일 이름을 돌려준다. 파일은 DB를 바꾸기 전에, 아직 적용하지 않은 것만 읽는다(`readPendingSqlSteps`). 그사이 다른 실행이
 * 적용한 파일은 core의 `migrate`가 잠금 안에서 건너뛰므로, 두 실행이 겹쳐도 파일은 한 번만 적용되고 각 호출은 자신이 적용한
 * 파일만 돌려준다.
 */
async function applyMigrations({ db, project, dir }: RunOptions): Promise<string[]> {
	const files = await readPendingSqlSteps(db, dir);
	await migrateMonti({ db, schema: project.schema, config: project.config });
	const applied: string[] = [];
	await migrate(
		db,
		projectSource,
		files.map((step) => recordingTo(applied, step)),
	);
	return applied;
}

/** `step`을 실행하고, 실행이 끝나면 그 이름을 `applied`에 더하는 단계. */
function recordingTo(applied: string[], step: Migration): Migration {
	async function up(db: Kysely<unknown>): Promise<void> {
		await step.up(db);
		applied.push(step.name);
	}
	return { name: step.name, up };
}

/**
 * 시험 실행: `migrateMonti`가 하듯 스키마(`BAD_REQUEST`)와 플러그인 작업 경로 충돌(`CONFLICT`)을, 그리고 아직 적용하지 않은
 * `.sql` 파일 읽기를 DB를 바꾸기 전에 마친 뒤, 한 트랜잭션에서 `migrations` 테이블을 준비하고 아직 실행하지 않은 core·플러그인 단계와 `.sql`
 * 파일을 실제 적용과 같은 순서로 실행·기록해 보고, 성공하든 실패하든 되돌린다. 실행해 본 `.sql` 파일 이름을 돌려준다.
 */
async function tryMigrations({ db, project, dir }: RunOptions): Promise<string[]> {
	const plugins = project.config.plugins ?? [];
	snapshotOf(project.schema);
	specOf(plugins);
	const files = await readPendingSqlSteps(db, dir);
	const tx = await db.startTransaction().execute();
	try {
		await ensureHistory(tx);
		const [projectSteps] = await pendingSteps(tx, [[projectSource, files]]);
		const sources = [...(await pendingSteps(tx, builtInSources(plugins))), projectSteps];
		for (const [source, steps] of sources) {
			for (const step of steps) await runRecorded(tx, source, step);
		}
		return projectSteps[1].map((step) => step.name);
	} finally {
		await rollbackQuietly(tx);
	}
}

/** 시험 실행 트랜잭션에 core의 `migrate`가 쓰는 것과 같은 이력 테이블(`migrations`)을 없을 때만 만든다. */
async function ensureHistory(tx: Kysely<Database>): Promise<void> {
	await tx.schema
		.createTable("migrations")
		.ifNotExists()
		.addColumn("source", "text", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.addPrimaryKeyConstraint("migrations_pkey", ["source", "name"])
		.execute();
}

/** 시험 실행 트랜잭션에서 단계 하나를 실행하고, core의 `migrate`처럼 같은 트랜잭션에 `(source, name)`을 기록한다. */
async function runRecorded(tx: Kysely<Database>, source: string, step: Migration): Promise<void> {
	await step.up(tx);
	await sql`insert into migrations (source, name) values (${source}, ${step.name})`.execute(tx);
}

/**
 * 시험 실행 트랜잭션을 되돌린다. 되돌리기가 실패해도(끊긴 연결 등) 앞서 난 SQL 오류를 가리지 않도록 그 실패는 던지지 않는다.
 * 그때도 Kysely는 연결을 돌려주고, 끝나지 않은 트랜잭션은 `withDb`가 연결을 닫을 때 서버가 되돌린다.
 */
async function rollbackQuietly(tx: ControlledTransaction<Database>): Promise<void> {
	try {
		await tx.rollback().execute();
	} catch {
		// 남는 변경이 없으므로(위 설명) 되돌리기 실패는 무시한다.
	}
}

/** 내장 단계의 출처별 목록: core의 단계(`"@monti-cms/core"` 출처), 그다음 플러그인마다 그 단계(플러그인 `name` 출처). */
function builtInSources(plugins: readonly Plugin[]): SourceSteps[] {
	return [[coreSource, coreMigrations], ...plugins.map(pluginSource)];
}

/** 출처마다 그 출처로 `migrations`에 아직 기록되지 않은 단계만 남긴 목록. */
async function pendingSteps(db: Kysely<Database>, sources: readonly SourceSteps[]): Promise<SourceSteps[]> {
	const pending: SourceSteps[] = [];
	for (const [source, steps] of sources) {
		const ran = await ranNames(db, source);
		pending.push([source, steps.filter((step) => !ran.has(step.name))]);
	}
	return pending;
}

/** 플러그인의 마이그레이션 출처(플러그인 `name`)와 단계. */
function pluginSource(plugin: Plugin): SourceSteps {
	return [plugin.name, plugin.migrations ?? []];
}

/**
 * `dir`의 `.sql` 파일 가운데 `"project"` 출처로 아직 적용하지 않은 것만 읽어 이름순으로 실행 단계로 만든다. `migrations`
 * 테이블이 아직 없으면(아무것도 적용하지 않은 DB) 모든 파일이 대상이다. DB를 바꾸기 전에 부른다. 이미 적용한 파일은 다시
 * 실행하지 않으므로 읽지 않는다.
 */
async function readPendingSqlSteps(db: Kysely<Database>, dir: string): Promise<Migration[]> {
	const ran = await ranNames(db, projectSource);
	const pending = (await listMigrationFiles(dir)).filter((name) => !ran.has(name));
	return Promise.all(pending.map(async (name) => sqlStep(name, await readFile(path.join(dir, name), "utf8"))));
}

/** 이름이 `name`이고, `text`의 SQL을 바인딩 없이 그대로(여러 문장이어도 한 번에) 실행하는 단계. */
function sqlStep(name: string, text: string): Migration {
	async function up(db: Kysely<unknown>): Promise<void> {
		await sql.raw(text).execute(db);
	}
	return { name, up };
}

/** `source` 출처로 `migrations`에 기록된 단계 이름. 테이블이 아직 없으면(아무것도 적용하지 않은 DB) 만들지 않고 비어 있다. */
async function ranNames(db: Kysely<Database>, source: string): Promise<Set<string>> {
	const { rows } = await sql<{ found: boolean }>`select to_regclass('migrations') is not null as found`.execute(db);
	if (!rows[0].found) return new Set();
	const ran = await sql<{ name: string }>`select name from migrations where source = ${source}`.execute(db);
	return new Set(ran.rows.map((row) => row.name));
}
