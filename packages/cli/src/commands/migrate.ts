import { withDb } from "../boot/connect";
import { loadEnv } from "../boot/env";
import { generateMigration } from "../migrate/files";
import { getMigrationStatus, runMigrations } from "../migrate/runner";
import type { ParsedArgs } from "../parse/args";
import { CliError, CliUsageError } from "../parse/error";
import { writeJson } from "./output";
import { loadProject, migrationsDir } from "./project";
import type { CliIo, Command } from "./types";

/** `monti migrate` 뒤에 오는 하위 명령. */
const migrateCommands = new Map<string | undefined, Command>([
	["generate", generate],
	["up", up],
	["status", status],
]);

/** `monti migrate <generate|up|status>`. 하위 명령이 없거나 그 밖의 것이면 사용법 오류다. */
export async function runMigrate(parsed: ParsedArgs, io: CliIo): Promise<void> {
	const command = migrateCommands.get(parsed.positionals[1]);
	if (command === undefined) throw new CliUsageError("migrate 뒤에는 generate, up, status 가운데 하나를 써야 한다");
	await command(parsed, io);
}

/**
 * `migrate generate [name] [--dry-run]`: DB 없이 `_snapshot.json`과 스키마의 차이로 SQL 파일을 만들고 `{ filename, sql }`을
 * 쓴다. `--dry-run`이면 파일을 쓰지 않고 `{ sql }`만 쓴다. 바뀐 것이 없으면 `null`을 쓰고 `stderr`에 알린다.
 */
async function generate(parsed: ParsedArgs, io: CliIo): Promise<void> {
	const { schema } = await loadProject(parsed, io);
	const dir = migrationsDir(parsed, io);
	const generated = await generateMigration({ dir, schema, name: parsed.positionals[2], dryRun: parsed.dryRun });
	if (generated === null) io.stderr("변경 사항이 없다\n");
	writeJson(io, parsed.dryRun && generated !== null ? { sql: generated.sql } : generated);
}

/**
 * `migrate up [--dry-run]`: 아직 적용하지 않은 내장·프로젝트 마이그레이션을 적용하고(`--dry-run`이면 실행해 본 뒤 되돌리고) 그
 * `.sql` 파일 이름을 쓴다. 실행 직전에 대상 DB를 `stderr`에 알린다. 개발 서버 설정이면 DB에 연결하기 전에 거절한다.
 */
async function up(parsed: ParsedArgs, io: CliIo): Promise<void> {
	const env = loadEnv(io.cwd, io.env);
	const project = await loadProject(parsed, io);
	if (project.config.dev === true) {
		throw new CliError(1, "개발 서버 설정(dev: true)으로는 운영 마이그레이션을 적용할 수 없다");
	}
	const dir = migrationsDir(parsed, io);
	const applied = await withDb(env, (db) => {
		io.stderr(`대상 DB: ${databaseLabel(String(env.DATABASE_URL))}\n`);
		return runMigrations({ db, project, dir, dryRun: parsed.dryRun });
	});
	writeJson(io, applied);
}

/** `migrate status`: DB를 바꾸지 않고 마이그레이션 폴더의 `.sql` 파일마다 적용됐는지를 쓴다. `--dry-run`은 사용법 오류다. */
async function status(parsed: ParsedArgs, io: CliIo): Promise<void> {
	if (parsed.dryRun) throw new CliUsageError("migrate status에는 --dry-run을 쓸 수 없다");
	const env = loadEnv(io.cwd, io.env);
	const dir = migrationsDir(parsed, io);
	writeJson(io, await withDb(env, (db) => getMigrationStatus({ db, dir })));
}

/** 연결 문자열이 가리키는 DB: 사용자와 비밀번호를 뺀 `호스트/DB 이름`(호스트에 포트 포함). 호스트가 없으면 DB 이름만이다. */
function databaseLabel(databaseUrl: string): string {
	const url = new URL(databaseUrl);
	const database = url.pathname.slice(1);
	return url.host === "" ? database : `${url.host}/${database}`;
}
