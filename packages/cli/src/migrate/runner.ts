import { readFile, realpath } from "node:fs/promises";
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

/** 트랜잭션을 끝내는 문장의 첫 낱말(소문자). `COMMIT WORK`·`COMMIT AND CHAIN`처럼 뒤에 무엇이 붙어도 첫 낱말로 가린다. */
const transactionEnds = new Set(["commit", "rollback", "end", "abort"]);

/** 달러 인용(`$$`·`$tag$`)을 여는 태그. 태그는 숫자로 시작할 수 없어 `$1` 같은 매개변수와 구별된다. */
const dollarTag = /\$(?:[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*)?\$/y;

/** PostgreSQL이 공백으로 보는 글자. */
const sqlSpace = /[ \t\n\r\f\v]/;

/** 줄 주석을 끝내는 줄 끝 글자. */
const lineEnd = /[\n\r]/g;

/** 식별자·키워드를 이루는 글자. PostgreSQL처럼 첫 글자가 아니면 `$`도 이어 쓸 수 있다. */
const wordStart = /[A-Za-z0-9_\u0080-\uffff]/;
const wordPart = /[\w$\u0080-\uffff]/;

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
 * 파일 이름을 돌려준다. 파일 검사는 DB를 바꾸기 전에, 아직 적용하지 않은 파일만 한다(`readPendingSqlSteps`). 그사이 다른 실행이
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
 * `.sql` 파일을 DB를 바꾸기 전에 검사한 뒤, 한 트랜잭션에서 `migrations` 테이블을 준비하고 아직 실행하지 않은 core·플러그인 단계와 `.sql`
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
 * 테이블이 아직 없으면(아무것도 적용하지 않은 DB) 모든 파일이 대상이다. DB를 바꾸기 전에 부르며, 실행하면 안 되는 파일이
 * 하나라도 있으면 실행 오류로 거절한다(`readSqlStep`). 이미 적용한 파일은 다시 실행하지 않으므로 읽지도 검사하지도 않는다.
 */
async function readPendingSqlSteps(db: Kysely<Database>, dir: string): Promise<Migration[]> {
	const ran = await ranNames(db, projectSource);
	const pending = (await listMigrationFiles(dir)).filter((name) => !ran.has(name));
	return Promise.all(pending.map((name) => readSqlStep(dir, name)));
}

/**
 * `dir`의 `.sql` 파일 `name`을 실제 경로로 읽어 단계로 만든다. 실제 경로가 `dir` 밖인 파일(바깥을 가리키는 심볼릭 링크)과
 * 트랜잭션을 끝내는 문장(`endsTransaction`)이 든 파일은 실행 오류다. 그런 문장은 단계의 트랜잭션을 먼저 끝내, 실패한 파일을
 * 되돌리지 못하게 하고 시험 실행의 변경도 실제로 남긴다.
 */
async function readSqlStep(dir: string, name: string): Promise<Migration> {
	const [root, file] = await Promise.all([realpath(dir), realpath(path.join(dir, name))]);
	if (!file.startsWith(`${root}${path.sep}`)) {
		throw new CliError(1, `마이그레이션 폴더 밖을 가리키는 파일은 실행할 수 없다: ${name}`);
	}
	const text = await readFile(file, "utf8");
	if (endsTransaction(text)) {
		throw new CliError(1, `트랜잭션을 끝내는 문장(COMMIT·ROLLBACK·END·ABORT)이 든 파일은 실행할 수 없다: ${name}`);
	}
	return sqlStep(name, text);
}

/** `text`의 SQL 문장 가운데 첫 낱말이 트랜잭션을 끝내는 것(`transactionEnds`)이 있는지. 대소문자는 가리지 않는다. */
function endsTransaction(text: string): boolean {
	return statementHeads(text).some((head) => transactionEnds.has(head));
}

/**
 * `text`를 `;`로 나눈 문장마다 그 첫 토큰(소문자). 공백과 주석은 건너뛰고, 문자열·인용 식별자·달러 인용은 통째로 한 토큰이라
 * 그 안의 `;`나 낱말은 문장을 나누거나 첫 낱말이 되지 않는다. 마지막 `;` 뒤에 남은 문장도 센다.
 */
function statementHeads(text: string): string[] {
	const heads: string[] = [];
	let head: string | undefined;
	let index = 0;
	while (index < text.length) {
		const next = skipIgnored(text, index);
		if (next !== index) {
			index = next;
		} else if (text[index] === ";") {
			heads.push(head ?? "");
			head = undefined;
			index += 1;
		} else {
			const end = tokenEnd(text, index);
			head ??= text.slice(index, end).toLowerCase();
			index = end;
		}
	}
	heads.push(head ?? "");
	return heads;
}

/**
 * `start`의 공백 한 글자나 주석(`--`로 여는 줄 주석, `/*`로 여는 블록 주석) 하나 뒤의 위치. 둘 다 아니면 `start` 그대로다. 공백과
 * 줄 끝은 PostgreSQL이 보는 것만 센다: 줄 주석은 `\n`이나 `\r`에서 끝나고, `NBSP` 같은 ASCII 밖 글자는 공백이 아니라 낱말이다.
 */
function skipIgnored(text: string, start: number): number {
	if (sqlSpace.test(text[start])) return start + 1;
	if (text.startsWith("--", start)) {
		lineEnd.lastIndex = start;
		return lineEnd.exec(text) === null ? text.length : lineEnd.lastIndex;
	}
	if (text.startsWith("/*", start)) return skipBlockComment(text, start);
	return start;
}

/** `start`에서 여는 블록 주석이 끝난 뒤의 위치. PostgreSQL처럼 안에 연 블록 주석도 닫혀야 끝난다. 닫히지 않으면 글 끝이다. */
function skipBlockComment(text: string, start: number): number {
	let depth = 0;
	let index = start;
	while (index < text.length) {
		if (text.startsWith("/*", index)) {
			depth += 1;
			index += 2;
		} else if (text.startsWith("*/", index)) {
			depth -= 1;
			index += 2;
			if (depth === 0) return index;
		} else {
			index += 1;
		}
	}
	return text.length;
}

/**
 * `start`에서 시작하는 토큰 하나가 끝난 뒤의 위치: 작은따옴표 문자열(`E'...'`이면 `\` 이스케이프도), 큰따옴표 식별자, 달러
 * 인용, 낱말, 그 밖의 한 글자.
 */
function tokenEnd(text: string, start: number): number {
	const char = text[start];
	if (char === "'" || char === '"') return skipQuoted(text, start, false);
	if (char === "$") return skipDollarQuoted(text, start);
	if (!wordStart.test(char)) return start + 1;
	let end = start + 1;
	while (end < text.length && wordPart.test(text[end])) end += 1;
	const escaped = end === start + 1 && (char === "e" || char === "E") && text[end] === "'";
	return escaped ? skipQuoted(text, end, true) : end;
}

/**
 * `start`의 따옴표로 연 문자열·식별자가 끝난 뒤의 위치. 같은 따옴표 두 개는 그 따옴표 한 글자이고, `backslash`이면
 * (`E'...'`) `\` 뒤의 한 글자도 그 글자 그대로다. 닫히지 않으면 글 끝이다.
 */
function skipQuoted(text: string, start: number, backslash: boolean): number {
	const quote = text[start];
	let index = start + 1;
	while (index < text.length) {
		const char = text[index];
		if (backslash && char === "\\") index += 2;
		else if (char !== quote) index += 1;
		else if (text[index + 1] === quote) index += 2;
		else return index + 1;
	}
	return text.length;
}

/** `start`의 `$`로 연 달러 인용이 같은 태그로 닫힌 뒤의 위치. 태그가 아니면(`$1` 등) `$` 한 글자 뒤, 닫히지 않으면 글 끝이다. */
function skipDollarQuoted(text: string, start: number): number {
	dollarTag.lastIndex = start;
	const tag = dollarTag.exec(text)?.[0];
	if (tag === undefined) return start + 1;
	const close = text.indexOf(tag, start + tag.length);
	return close < 0 ? text.length : close + tag.length;
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
