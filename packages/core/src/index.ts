import type { Kysely } from "kysely";
import { migrate } from "./db/migrate";
import { initial } from "./db/migrations/0001-initial";
import type { Database, Migration } from "./db/types";
import { createMonti } from "./engine/engine";
import { checkPluginNames, keyServicesOf, withPlugins } from "./engine/plugins";
import { validSchema } from "./engine/schema-file";
import { specsOf } from "./engine/spec";
import type {
	Monti as EngineMonti,
	MontiConfig as EngineMontiConfig,
	MontiState as EngineMontiState,
	Plugin as EnginePlugin,
	OperationSpec,
	ResourceTree,
} from "./engine/types";
import { admin } from "./resources/admin/admin";
import { config } from "./resources/config/config";
import { entries } from "./resources/entries/entries";
import { folders } from "./resources/folders/folders";
import { createKeys } from "./resources/keys/keys";
import { media } from "./resources/media/media";
import { schema } from "./resources/schema/schema";
import { syncSchemaTables } from "./resources/schema/sync-tables";
import { session } from "./resources/session/session";
import { templates } from "./resources/templates/templates";
import { translationStatus } from "./resources/translation-status/translation-status";
import { trash } from "./resources/trash/trash";

// 공개 출구: 앱(`next`, `cli`), 플러그인, 본문을 다루는 패키지가 쓰는 것.
export { migrate } from "./db/migrate";
export type {
	AdminTable,
	ApiKeysTable,
	Database,
	FoldersTable,
	LooseFilesTable,
	MediaTable,
	MediaUsesTable,
	Migration,
	SessionTable,
	TemplatesTable,
} from "./db/types";
export { MontiError } from "./engine/errors";
export { defineRead, defineWrite } from "./engine/operation";
export type {
	CollectionSchema,
	ErrorCode,
	FieldSchema,
	KeyServiceDefinition,
	MontiEvent,
	OperationSpec,
	ReadContext,
	ReadOperation,
	Schema,
	StorageAdapter,
	ValueFieldSchema,
	WriteContext,
	WriteOperation,
} from "./engine/types";
export {
	type RemoveLooseFilesFailure,
	type RemoveLooseFilesResult,
	removeLooseFiles,
} from "./resources/media/loose-files";
export { planSchemaDiff } from "./resources/schema/schema-diff";
export type { SchemaSnapshot } from "./resources/schema/snapshot";
export { snapshotOf } from "./resources/schema/snapshot";
export type { Block, BlockDefinition, Doc, DocIssue, MarkDefinition, ValidateDocOptions } from "./rich-text/types";
export { validateDoc } from "./rich-text/validate-doc";

/**
 * core의 리소스 트리(`resources`)와 `keys`가 내놓는 `withStoredKey`. `keys`는 플러그인이 등록한 키 서비스와 암호화
 * 비밀값을 쓴다.
 */
function coreParts<R extends ResourceTree>(plugins: EnginePlugin<R>[], secret: string | undefined) {
	const { resource: keys, withStoredKey } = createKeys(keyServicesOf(plugins), secret);
	const resources = {
		entries,
		translationStatus,
		templates,
		folders,
		media,
		trash,
		schema,
		config,
		keys,
		session,
		admin,
	};
	return { resources, withStoredKey };
}

type CoreResources = ReturnType<typeof coreParts>["resources"];

/** 저장된 키를 가리키는 것: 그 `id`와, 호출자가 기대하는 서비스. */
interface StoredKeyRef {
	id: string;
	service: string;
}

/** 서버 코드만 쓰는 메서드: Operation이 아니어서 명세(`monti.spec()`)에도 플러그인의 `ctx.monti`에도 없다. */
interface ServerMethods {
	/**
	 * 저장된 키 `key.id`의 복호화한 비밀값을 `use`에 넘기고 `use`의 결과를 돌려준다. 암호화 비밀값(`secret`)이 없거나 저장된
	 * 서비스가 `key.service`와 다르면 `BAD_REQUEST`, 그 `id`의 키가 없으면 `NOT_FOUND`다. `use`가 던진 오류는 그대로 나가므로
	 * 그 오류에 비밀값을 담지 않는 것은 `use`의 몫이다.
	 */
	withStoredKey<T>(key: StoredKeyRef, use: (apiKey: string) => Promise<T>): Promise<T>;
}

/**
 * 엔진 타입: 플러그인의 `onEvent`가 받는 것이고, `startMonti`는 여기에 서버 전용 메서드를 더해 돌려준다. 제네릭 `R`을 주면
 * 커스텀 리소스 트리에도 쓸 수 있다.
 */
export type Monti<R extends ResourceTree = CoreResources> = EngineMonti<R>;

/** 서버 플러그인 타입. `onEvent`의 `ctx.monti`는 기본적으로 코어 리소스 전체(`Monti`)를 안다. */
export type Plugin<R extends ResourceTree = CoreResources> = EnginePlugin<R>;

/** 사이트 설정(`monti.config.ts`) 타입. */
export type MontiConfig<R extends ResourceTree = CoreResources> = EngineMontiConfig<R>;

/** 앱이 `startMonti`에 넘기는 것: DB와, 두 파일에서 불러온 스키마와 설정, 선택 암호화 비밀값. */
export interface StartOptions extends EngineMontiState<CoreResources> {
	db: Kysely<Database>;
	/** `keys` 리소스가 저장하는 키를 암호화하는 비밀값. 설정(`config`)에 두지 않고 `keys` 리소스에만 넘긴다. */
	secret?: string;
}

/** 앱이 `migrateMonti`에 넘기는 것: DB와, 앱이 불러온 스키마와 설정. */
export type MigrateOptions = Pick<StartOptions, "db" | "schema" | "config">;

/**
 * core를 조립한다: 스키마를 검사하고, core 리소스와 `config.plugins`(`keys`에는 암호화 비밀값 `secret`)로 엔진을 만든다.
 * 돌려주는 것은 엔진에 `withStoredKey`를 더한 새 객체라, 플러그인의 `onEvent`가 받는 엔진에는 `withStoredKey`가 없다.
 * DB는 건드리지 않는다. 테이블은 먼저 `migrateMonti`로 준비한다.
 */
export function startMonti(options: StartOptions): Monti & ServerMethods {
	const { db, schemaFile, configFile } = options;
	const plugins = options.config.plugins ?? [];
	const state = { schema: validSchema(options.schema), config: options.config, schemaFile, configFile };
	const parts = coreParts(plugins, options.secret);
	const monti = createMonti(db, parts.resources, plugins, state);
	function withStoredKey<T>(key: StoredKeyRef, use: (apiKey: string) => Promise<T>): Promise<T> {
		return parts.withStoredKey(db, key, use);
	}
	return { ...monti, withStoredKey };
}

/**
 * DB를 준비한다: 스키마를 검사하고, core 마이그레이션과 각 플러그인의 마이그레이션을 `config.plugins` 순서로 실행한다.
 * 개발 서버(`config.dev: true`)이면 스키마의 컬렉션 테이블을 DB에 맞춘다. 스키마와 플러그인 이름이 올바르다고 확인되기
 * 전에는 DB를 건드리지 않는다.
 */
export async function migrateMonti(options: MigrateOptions): Promise<void> {
	const { db } = options;
	const plugins = options.config.plugins ?? [];
	const checked = validSchema(options.schema);
	checkPluginNames(plugins);
	await migrateAll(db, plugins);
	if (options.config.dev === true) await db.transaction().execute((tx) => syncSchemaTables(tx, checked));
}

/**
 * DB 없이 core 리소스와 `plugins`의 Operation을 모은 명세를 돌려준다. 같은 플러그인으로 시작한 `monti.spec()`과 같다.
 * 경로가 겹치는 플러그인 Operation은 `startMonti`처럼 `CONFLICT`로 거절한다.
 */
export function specOf(plugins: Plugin[] = []): OperationSpec[] {
	return specsOf(withPlugins(coreParts(plugins, undefined).resources, plugins));
}

/** core에 들어 있는 마이그레이션 단계들, 실행 순서대로. `migrateMonti`는 이것을 `"@monti-cms/core"` 출처로 실행한다. */
export const coreMigrations: readonly Migration[] = [initial];

/** core의 단계를 `"@monti-cms/core"` 출처로, 그다음 각 플러그인의 단계를 그 `name` 출처로 실행한다. */
async function migrateAll(db: Kysely<Database>, plugins: Plugin[]): Promise<void> {
	await migrate(db, "@monti-cms/core", coreMigrations);
	for (const plugin of plugins) {
		if (plugin.migrations !== undefined) await migrate(db, plugin.name, plugin.migrations);
	}
}
