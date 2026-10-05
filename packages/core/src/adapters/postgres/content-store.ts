import type { Pool } from "pg";
import { type AfterCommit, withAfterCommit } from "./store/after-commit";
import { type ContentStoreHooks, type StoreContext, validateSchemaName } from "./store/context";
import { createEntryOps } from "./store/entries";
import { createFolderOps } from "./store/folders";
import { createLifecycleOps } from "./store/lifecycle";
import { createListOps } from "./store/list";
import { createMediaOps } from "./store/media";
import { createPreferenceOps } from "./store/preferences";
import { createPublicReadOps } from "./store/public-read";
import { createPublishing } from "./store/publish";
import { createTemplateOps } from "./store/templates";
import { createTransferOps } from "./store/transfer";

/**
 * PostgreSQL `ContentStore`. Reads and atomic changes for content, folders, relations, media metadata, and settings.
 * The driver and SQL live only in the modules under `store/`. Business rules (snapshots, publish validation) come from `core/`.
 */

export type { AfterCommit, ContentChange, ContentChangeKind } from "./store/after-commit";
export type { ContentStoreHooks } from "./store/context";
export { CmsError } from "./store/errors";
export type { FolderRow } from "./store/rows";
export { extractVisibleText, normalizeMetadata } from "./store/rows";
export { migrateContentStore } from "./store/schema";
export * from "./store/types";

export function createContentStore(
	pool: Pool,
	options?: { schema?: string; afterCommit?: AfterCommit } & ContentStoreHooks,
) {
	const ctx: StoreContext = {
		pool,
		qSchema: validateSchemaName(options?.schema),
		hooks: { beforePublishCommit: options?.beforePublishCommit },
	};
	const publishing = createPublishing(ctx);

	const store = {
		...createEntryOps(ctx, publishing),
		...createLifecycleOps(ctx, publishing),
		...createListOps(ctx),
		...createFolderOps(ctx),
		...createPublicReadOps(ctx),
		...createPreferenceOps(ctx),
		...createTransferOps(ctx),
		...createMediaOps(ctx),
		...createTemplateOps(ctx),
	};
	return options?.afterCommit ? withAfterCommit(store, options.afterCommit) : store;
}

export type ContentStore = ReturnType<typeof createContentStore>;
