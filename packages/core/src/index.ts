import type { Kysely } from "kysely";
import { z } from "zod";
import { migrate } from "./db/migrate";
import { initial } from "./db/migrations/0001-initial";
import type { Database } from "./db/types";
import { createMonti } from "./engine/engine";
import { MontiError } from "./engine/errors";
import { keyServicesOf } from "./engine/plugins";
import { schemaShape } from "./engine/schema-file";
import type { Monti, MontiState, Plugin, Schema } from "./engine/types";
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
	Monti,
	MontiConfig,
	MontiEvent,
	OperationSpec,
	Plugin,
	ReadContext,
	ReadOperation,
	Schema,
	StorageAdapter,
	ValueFieldSchema,
	WriteContext,
	WriteOperation,
} from "./engine/types";
export { removeLooseFiles } from "./resources/media/loose-files";
export type { Block, BlockDefinition, Doc, DocIssue, MarkDefinition, ValidateDocOptions } from "./rich-text/types";
export { validateDoc } from "./rich-text/validate-doc";

/** 앱이 `startMonti`에 넘기는 것: DB와, 두 파일에서 불러온 스키마와 설정, 선택 암호화 비밀값. */
export interface StartOptions extends MontiState {
	db: Kysely<Database>;
	/** `keys` 리소스가 저장하는 키를 암호화하는 비밀값. 설정(`config`)에 두지 않고 `keys` 리소스에만 넘긴다. */
	secret?: string;
}

/** core의 리소스 트리. `keys`는 플러그인이 등록한 키 서비스와 암호화 비밀값을 쓴다. */
function coreResources(plugins: Plugin[], secret: string | undefined) {
	const keys = createKeys(keyServicesOf(plugins), secret);
	return { entries, translationStatus, templates, folders, media, trash, schema, config, keys, session, admin };
}

/**
 * core를 시작한다: 스키마를 검사하고, core 리소스와 `config.plugins`(`keys`에는 암호화 비밀값 `secret`)로 엔진을 조립한 뒤, core 마이그레이션과 각 플러그인의
 * 마이그레이션을 `config.plugins` 순서로 실행한다. 개발 서버(`config.dev: true`)이면 스키마의 컬렉션 테이블을 DB에
 * 맞춘다. 스키마가 올바르다고 확인되기 전에는 DB를 건드리지 않는다.
 */
export async function startMonti(options: StartOptions): Promise<Monti<ReturnType<typeof coreResources>>> {
	const { db, schemaFile, configFile } = options;
	const plugins = options.config.plugins ?? [];
	const state = { schema: validSchema(options.schema), config: options.config, schemaFile, configFile };
	const monti = createMonti(db, coreResources(plugins, options.secret), plugins, state);
	await migrateAll(db, plugins);
	if (options.config.dev === true) await db.transaction().execute((tx) => syncSchemaTables(tx, state.schema));
	return monti;
}

function validSchema(value: Schema): Schema {
	const result = schemaShape.safeParse(value);
	if (!result.success) {
		throw new MontiError(
			"BAD_REQUEST",
			`스키마가 올바르지 않다: ${z.prettifyError(result.error)}`,
			result.error.issues,
		);
	}
	return result.data;
}

/** core의 단계를 `"core"` 범위로, 그다음 각 플러그인의 단계를 그 `name` 범위로 실행한다. */
async function migrateAll(db: Kysely<Database>, plugins: Plugin[]): Promise<void> {
	await migrate(db, "core", [initial]);
	for (const plugin of plugins) {
		if (plugin.migrations !== undefined) await migrate(db, plugin.name, plugin.migrations);
	}
}
