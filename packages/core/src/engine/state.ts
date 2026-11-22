import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types";
import { writeConfigName } from "./config-file";
import { MontiError } from "./errors";
import { writeSchemaFile } from "./schema-file";
import type { MontiConfig, MontiState, ReadContext, Schema, Stage, WriteContext } from "./types";

/** The shared schema and config: reads see them, and each transaction changes a stage of its own. */
export function createState(initial: MontiState) {
	const shared = { ...initial };
	function readContext(db: Kysely<Database>): ReadContext {
		return { db, schema: shared.schema, config: shared.config, storage: shared.config?.storage };
	}
	function stage(): Stage {
		return stageOf(shared);
	}
	return { readContext, stage };
}

function stageOf(shared: MontiState): Stage {
	const copy = { schema: shared.schema, config: shared.config };
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
