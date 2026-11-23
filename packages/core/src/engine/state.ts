import { readFile } from "node:fs/promises";
import type { Kysely, Transaction } from "kysely";
import { lockSchemaChanges } from "../db/locks";
import type { Database } from "../db/types";
import { configWithName } from "./config-file";
import { MontiError } from "./errors";
import { type FileChange, fileChanges } from "./file-swap";
import { schemaText } from "./schema-file";
import type { MontiConfig, MontiState, ReadContext, Schema, Stage, StorageAdapter, WriteContext } from "./types";

/** 차례를 기다려 받는 잠금: 받은 함수를 부르면 다음 차례로 넘어간다. */
type Acquire = () => Promise<() => void>;

/** 한 엔진 안의 차례 줄: 먼저 받은 쪽이 풀어야 다음 쪽이 받는다. */
function createQueue(): Acquire {
	let tail: Promise<void> = Promise.resolve();
	return function acquire() {
		let unlock = (): void => {};
		const turn = new Promise<void>((resolve) => {
			unlock = resolve;
		});
		const ready = tail.then(() => unlock);
		tail = tail.then(() => turn);
		return ready;
	};
}

/** 공유하는 스키마와 설정: 읽기는 이것을 보고, 트랜잭션마다 자기 단계(stage)에서 바꾼다. */
export function createState(initial: MontiState) {
	const shared = { ...initial };
	const acquire = createQueue();
	function readContext(db: Kysely<Database>): ReadContext {
		return { db, schema: shared.schema, config: shared.config, storage: shared.config?.storage };
	}
	/** 트랜잭션 하나의 단계. `dryRun`이면 그 단계의 저장소는 되돌릴 수 없는 티켓 발급과 삭제를 거절한다. */
	function stage(dryRun = false): Stage {
		return stageOf(shared, acquire, dryRun);
	}
	return { readContext, stage };
}

/**
 * 스키마·설정을 바꾸는 단계의 잠금. DB 잠금을 먼저 잡고 엔진의 차례 줄을 받는다: 앞 단계가 DB 잠금을 쥔 채 기다리면
 * PostgreSQL이 교착을 알아챈다. 차례는 커밋 뒤 파일 교체까지 쥐고 있다가 `release`에서 넘긴다. 같은 단계는 한 번만 받는다.
 */
function changeLock(acquire: Acquire) {
	let held: Promise<() => void> | undefined;
	async function hold(db: Transaction<Database>): Promise<void> {
		held ??= lockSchemaChanges(db).then(acquire);
		await held;
	}
	function release(): void {
		held?.then((unlock) => unlock(), ignore);
	}
	return { hold, release };
}

type ChangeLock = ReturnType<typeof changeLock>;

function ignore(): void {}

/** 스키마 파일의 변경: 새 스키마의 글자로 바꾸고 공유 스키마에 반영한다. */
function schemaChange(shared: MontiState, schema: Schema): FileChange {
	async function text(): Promise<string> {
		return schemaText(schema);
	}
	function apply(): void {
		shared.schema = schema;
	}
	return { file: shared.schemaFile, text, apply };
}

/** 설정 파일의 변경: 준비할 때 파일을 읽어 사이트 이름 자리만 바꾸고 공유 설정에 반영한다. */
function configChange(shared: MontiState, changed: MontiConfig): FileChange {
	async function text(): Promise<string> {
		return configWithName(await readFile(shared.configFile, "utf8"), changed.name);
	}
	function apply(): void {
		shared.config = changed;
	}
	return { file: shared.configFile, text, apply };
}

/** 단계가 고쳐 쓰는 사본과, 이 단계가 스키마를 이미 바꿨는지. */
interface StageCopy {
	schema: Schema;
	config: MontiConfig;
	schemaSet: boolean;
}

/**
 * 단계의 `setSchema`: 잠금을 잡은 뒤의 이전 스키마를 돌려준다. 이 단계가 아직 바꾸지 않았으면 단계를 만들 때 본 사본은
 * 앞선 단계의 커밋 전일 수 있으므로 공유 스키마를 본다. 받은 스키마는 사본으로 담아, 호출자가 고쳐도 엔진이 바뀌지 않는다.
 */
function schemaSetter(shared: MontiState, copy: StageCopy, files: ReturnType<typeof fileChanges>, lock: ChangeLock) {
	return async function setSchema(db: Transaction<Database>, schema: Schema): Promise<Schema> {
		allowChanges(copy.config);
		await lock.hold(db);
		const previous = copy.schemaSet ? copy.schema : shared.schema;
		const stored = structuredClone(schema);
		Object.assign(copy, { schema: stored, schemaSet: true });
		files.add(schemaChange(shared, stored));
		return previous;
	};
}

function stageOf(shared: MontiState, acquire: Acquire, dryRun: boolean): Stage {
	const config = dryRun ? dryRunConfig(shared.config) : shared.config;
	const copy: StageCopy = { schema: shared.schema, config, schemaSet: false };
	const files = fileChanges();
	const lock = changeLock(acquire);
	const setSchema = schemaSetter(shared, copy, files, lock);
	async function setConfig(db: Transaction<Database>, changed: Pick<MontiConfig, "name">): Promise<void> {
		allowChanges(copy.config);
		await lock.hold(db);
		copy.config = { ...copy.config, name: changed.name };
		files.add(configChange(shared, copy.config));
	}
	function context(db: Transaction<Database>): WriteContext {
		const changes: Pick<WriteContext, "setSchema" | "setConfig"> = {
			setSchema: setSchema.bind(null, db),
			setConfig: setConfig.bind(null, db),
		};
		return { db, schema: copy.schema, config: copy.config, storage: copy.config?.storage, ...changes };
	}
	/** 임시 파일을 지우다 실패해도 차례는 넘긴다: 넘기지 않으면 엔진의 다음 스키마·설정 변경이 영영 기다린다. */
	async function release(): Promise<void> {
		try {
			await files.discard();
		} finally {
			lock.release();
		}
	}
	return { context, prepare: files.prepare, commit: files.commit, release };
}

/** Only a dev server changes the schema and the config. */
function allowChanges(config: MontiConfig): void {
	if (config.dev !== true) throw new MontiError("FORBIDDEN", "Only a dev server changes the schema and the config");
}

/** `dryRun`의 설정: 저장소가 있으면 `ctx.storage`와 `ctx.config.storage`가 같은 `dryRun` 저장소를 본다. */
function dryRunConfig(config: MontiConfig): MontiConfig {
	if (config?.storage === undefined) return config;
	return { ...config, storage: dryRunStorage(config.storage) };
}

/**
 * 롤백되는 `dryRun`에서 쓰는 저장소: 파일을 읽는 `stat`·`url`은 원래 저장소에 맡기고, DB 롤백으로 되돌릴 수 없는 티켓
 * 발급(`ticket`)과 삭제(`remove`)는 거절한다. 클래스 어댑터의 `this`가 유지되도록 메서드를 원래 저장소에서 부른다.
 */
function dryRunStorage(storage: StorageAdapter): StorageAdapter {
	async function ticket(): Promise<never> {
		throw new MontiError("BAD_REQUEST", "dryRun에서는 업로드 티켓을 발급할 수 없다");
	}
	function stat(key: string): ReturnType<StorageAdapter["stat"]> {
		return storage.stat(key);
	}
	function url(key: string): string {
		return storage.url(key);
	}
	async function remove(): Promise<never> {
		throw new MontiError("BAD_REQUEST", "dryRun에서는 파일을 삭제할 수 없다");
	}
	return { ticket, stat, url, remove };
}
