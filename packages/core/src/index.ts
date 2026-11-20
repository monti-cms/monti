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
import { session } from "./resources/session/session";
import { templates } from "./resources/templates/templates";
import { translationStatus } from "./resources/translation-status/translation-status";
import { trash } from "./resources/trash/trash";

// The public entry: what the apps (`next`, `cli`), the plugins and the packages that handle the body use.
export type {
	ApiKeysTable,
	Database,
	EntriesTable,
	EntryLocalesTable,
	EntryPublishedTable,
	FoldersTable,
	LooseFilesTable,
	MediaTable,
	MediaUsesTable,
	Migration,
	MontiAdminTable,
	MontiSessionTable,
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

/** What the app hands `startMonti`: the database, and the schema and config it loaded from the two files. */
export interface StartOptions extends MontiState {
	db: Kysely<Database>;
}

/** The core's resource tree; `keys.check` uses the key services the plugins register. */
function coreResources(plugins: Plugin[]) {
	const keys = createKeys(keyServicesOf(plugins));
	return { entries, translationStatus, templates, folders, media, trash, schema, config, keys, session, admin };
}

/**
 * Starts the core: checks the schema, assembles the engine with the core resources and `config.plugins`, then runs the
 * core migrations and each plugin's in `config.plugins` order. Nothing touches the database before the schema and the
 * plugin paths are found valid.
 */
export async function startMonti(options: StartOptions): Promise<Monti<ReturnType<typeof coreResources>>> {
	const { db, schemaFile, configFile } = options;
	const plugins = options.config.plugins ?? [];
	const state = { schema: validSchema(options.schema), config: options.config, schemaFile, configFile };
	const monti = createMonti(db, coreResources(plugins), plugins, state);
	await migrateAll(db, plugins);
	return monti;
}

function validSchema(value: Schema): Schema {
	const result = schemaShape.safeParse(value);
	if (!result.success) {
		throw new MontiError("BAD_REQUEST", `The schema is invalid: ${z.prettifyError(result.error)}`, result.error.issues);
	}
	return result.data;
}

/** The core's steps under `"core"`, then each plugin's under its `name`. */
async function migrateAll(db: Kysely<Database>, plugins: Plugin[]): Promise<void> {
	await migrate(db, "core", [initial]);
	for (const plugin of plugins) {
		if (plugin.migrations !== undefined) await migrate(db, plugin.name, plugin.migrations);
	}
}
