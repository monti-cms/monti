import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types";
import { writeConfigName } from "./config-file";
import { MontiError } from "./errors";
import { writeSchemaFile } from "./schema-file";
import type { MontiConfig, MontiState, ReadContext, Schema, Stage, StorageAdapter, WriteContext } from "./types";

/** 공유하는 스키마와 설정: 읽기는 이것을 보고, 트랜잭션마다 자기 단계(stage)에서 바꾼다. */
export function createState(initial: MontiState) {
	const shared = { ...initial };
	function readContext(db: Kysely<Database>): ReadContext {
		return { db, schema: shared.schema, config: shared.config, storage: shared.config?.storage };
	}
	/** 트랜잭션 하나의 단계. `dryRun`이면 그 단계의 저장소는 되돌릴 수 없는 티켓 발급과 삭제를 거절한다. */
	function stage(dryRun = false): Stage {
		return stageOf(shared, dryRun);
	}
	return { readContext, stage };
}

function stageOf(shared: MontiState, dryRun: boolean): Stage {
	const copy = { schema: shared.schema, config: dryRun ? dryRunConfig(shared.config) : shared.config };
	const effects: (() => Promise<void>)[] = [];
	function setSchema(schema: Schema): void {
		allowChanges(copy.config);
		copy.schema = schema;
		effects.push(async () => {
			await writeSchemaFile(shared.schemaFile, schema);
			shared.schema = schema;
		});
	}
	function setConfig(config: Pick<MontiConfig, "name">): void {
		allowChanges(copy.config);
		const changed = { ...copy.config, name: config.name };
		copy.config = changed;
		effects.push(async () => {
			await writeConfigName(shared.configFile, changed.name);
			shared.config = changed;
		});
	}
	function context(db: Transaction<Database>): WriteContext {
		return { db, schema: copy.schema, config: copy.config, storage: copy.config?.storage, setSchema, setConfig };
	}
	async function commit(): Promise<void> {
		for (const effect of effects) await effect();
	}
	return { context, commit };
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
