import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { planSchemaDiff, type Schema, type SchemaSnapshot, snapshotOf } from "@monti-cms/core";

/** 직전 생성 시점의 컬렉션 테이블 스냅샷(core의 `snapshotOf` 결과)을 담는 파일. */
const snapshotFile = "_snapshot.json";

/** 같은 폴더에서 두 생성이 동시에 스냅샷을 읽지 못하게 직렬화하는 잠금 파일. */
const lockFile = "_snapshot.lock";

/** 이름을 생략했을 때 파일 이름에 쓰는 이름. */
const defaultName = "schema_update";

/** `generateMigration`에 넘기는 것. */
interface GenerateOptions {
	dir: string;
	schema: Schema;
	name?: string;
	dryRun?: boolean;
}

/** 만든(`dryRun`이면 만들) 마이그레이션 파일. */
interface GeneratedMigration {
	filename: string;
	sql: string;
}

/**
 * `dir`의 `_snapshot.json`(없으면 빈 스냅샷)과 `schema`의 차이를 core의 `planSchemaDiff`로 SQL로 만들어 다음 4자리 번호의
 * `.sql` 파일로 쓰고, `_snapshot.json`을 `schema`의 스냅샷으로 바꾼다. 바뀐 것이 없으면 아무것도 쓰지 않고 `null`이다.
 * `dryRun`이면 폴더와 파일을 쓰지 않고 만들 파일 이름과 SQL만 돌려준다. 올바르지 않은 스키마는 core가 `BAD_REQUEST`로
 * 거절한다.
 */
export async function generateMigration(options: GenerateOptions): Promise<GeneratedMigration | null> {
	const snapshot = snapshotOf(options.schema);
	if (options.dryRun === true) return planMigration(options);
	return withDirLock(options.dir, async () => {
		const planned = await planMigration(options);
		if (planned !== null) await writeMigration(options.dir, planned, snapshot);
		return planned;
	});
}

/** `dir`의 직전 스냅샷과 `options.schema`를 비교해 생성할 파일 이름과 SQL을 만든다. 변경이 없으면 `null`이다. */
async function planMigration(options: GenerateOptions): Promise<GeneratedMigration | null> {
	const statements = planSchemaDiff(await readSnapshot(options.dir), options.schema);
	if (statements.length === 0) return null;
	const filename = `${await nextNumber(options.dir)}_${slugOf(options.name ?? defaultName)}.sql`;
	return { filename, sql: statements.map((statement) => `${statement};\n`).join("\n") };
}

/** `dir`에 독점 잠금 파일을 잡아 스냅샷 읽기부터 교체까지 한 번에 한 실행만 진행하게 한다. */
async function withDirLock<T>(dir: string, run: () => Promise<T>): Promise<T> {
	await mkdir(dir, { recursive: true });
	const lock = path.join(dir, lockFile);
	const handle = await open(lock, "wx");
	try {
		return await run();
	} finally {
		await handle.close();
		await rm(lock, { force: true });
	}
}

/** `dir`의 `.sql` 마이그레이션 파일 이름을 오름차순으로 돌려준다. 폴더가 없으면 빈 배열이다. */
export async function listMigrationFiles(dir: string): Promise<string[]> {
	if (!existsSync(dir)) return [];
	return (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
}

/** `dir`의 `_snapshot.json`. 파일이 없으면(처음 만들 때) 컬렉션이 하나도 없는 스냅샷이다. */
async function readSnapshot(dir: string): Promise<SchemaSnapshot> {
	const file = path.join(dir, snapshotFile);
	if (!existsSync(file)) return { collections: {} };
	return JSON.parse(await readFile(file, "utf8"));
}

/**
 * 기존 `.sql` 파일의 가장 큰 번호 다음 번호를 4자리(`0001`)로 돌려준다. 번호로 시작하지 않는 파일(`manual.sql` 등)은 번호가
 * 없으므로(`NaN`) 세지 않는다.
 */
async function nextNumber(dir: string): Promise<string> {
	const numbers = (await listMigrationFiles(dir)).map((name) => Number.parseInt(name, 10)).filter(Number.isInteger);
	return String(Math.max(0, ...numbers) + 1).padStart(4, "0");
}

/** 파일 이름에 쓸 이름: 소문자로 바꾸고, 글자·숫자가 아닌 것(공백·특수문자)이 이어진 곳을 `_` 하나로 바꾼다. */
function slugOf(name: string): string {
	return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_");
}

/**
 * `.sql` 파일을 먼저 쓰고 `_snapshot.json`을 바꾼다. `.sql` 파일은 같은 이름의 파일이 이미 있으면 덮어쓰지 않고 실패한다.
 * 스냅샷은 이 실행만 쓰는 임시 파일에 다 쓴 뒤 이름을 바꿔(rename) 한 번에 교체하므로, 중간에 멈춰도 반쯤 쓰인 스냅샷이
 * 남지 않는다. 스냅샷을 바꾸지 못하면 임시 파일과 방금 쓴 `.sql` 파일을 지우고 그 오류를 던진다.
 */
async function writeMigration(dir: string, migration: GeneratedMigration, snapshot: SchemaSnapshot): Promise<void> {
	await mkdir(dir, { recursive: true });
	const sqlFile = path.join(dir, migration.filename);
	await writeFile(sqlFile, migration.sql, { flag: "wx" });
	const temporary = path.join(dir, `_snapshot.${process.pid}.${randomUUID()}.tmp`);
	try {
		await writeFile(temporary, `${JSON.stringify(snapshot, null, "\t")}\n`);
		await rename(temporary, path.join(dir, snapshotFile));
	} catch (error) {
		await Promise.allSettled([rm(temporary, { force: true }), rm(sqlFile, { force: true })]);
		throw error;
	}
}
