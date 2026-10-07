import type { Pool } from "pg";
import type { ContentStore } from "../../core/store/ports";
import type { Site } from "../../site";
import { createDb, dbOn } from "./db/kysely";
import { type ContentStoreHooks, type StoreContext, validateSchemaName } from "./store/context";
import { createEntryOps } from "./store/entries";
import { createEventOps } from "./store/events";
import { createFolderOps } from "./store/folders";
import { createLifecycleOps } from "./store/lifecycle";
import { createListOps } from "./store/list";
import { createMediaOps } from "./store/media";
import { createPreferenceOps } from "./store/preferences";
import { createPublicReadOps } from "./store/public-read";
import { createPublishing } from "./store/publish";
import { createSchemaChangeOps } from "./store/schema-change";
import { createTemplateOps } from "./store/templates";
import { createTransferOps } from "./store/transfer";

/**
 * PostgreSQL implementation of the core `ContentStore` port (`core/store/ports.ts`). Reads and atomic changes for content, folders, relations, media metadata,
 * settings, and the event outbox. The driver and SQL live only in the modules under `store/`; the rules (slug addresses, translations, publish and lifecycle transitions) come from `core/domain/`.
 */

export type { ContentStoreHooks } from "./store/context";
export { migrateContentStore } from "./store/schema";

export function createContentStore(
	pool: Pool,
	options: { site: Site; schema?: string } & ContentStoreHooks,
): ContentStore {
	const qSchema = validateSchemaName(options?.schema);
	// One Kysely instance per store, on the pool the adapter owns; `db(tx)` is the same schema on the client of a transaction.
	const poolDb = createDb(pool, qSchema);
	const ctx: StoreContext = {
		pool,
		site: options.site,
		qSchema,
		db: (tx) => (tx ? dbOn(tx, qSchema) : poolDb),
		hooks: { beforePublishCommit: options?.beforePublishCommit },
	};
	const publishing = createPublishing(ctx);

	const store: ContentStore = {
		...createEntryOps(ctx, publishing),
		...createLifecycleOps(ctx, publishing),
		...createListOps(ctx),
		...createFolderOps(ctx),
		...createPublicReadOps(ctx),
		...createPreferenceOps(ctx),
		...createTransferOps(ctx),
		...createMediaOps(ctx),
		...createTemplateOps(ctx),
		...createSchemaChangeOps(ctx),
		...createEventOps(ctx),
	};
	return store;
}
