import type { Pool } from "pg";
import { type AfterCommit, withAfterCommit } from "../../core/store/after-commit";
import type { ContentStore } from "../../core/store/ports";
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
 * PostgreSQL implementation of the core `ContentStore` port (`core/store/ports.ts`). Reads and atomic changes for content, folders, relations, media metadata,
 * and settings. The driver and SQL live only in the modules under `store/`; the rules (slug addresses, translations, publish and lifecycle transitions) come from `core/domain/`.
 */

export type { ContentStoreHooks } from "./store/context";
export { migrateContentStore } from "./store/schema";

export function createContentStore(
	pool: Pool,
	options?: { schema?: string; afterCommit?: AfterCommit } & ContentStoreHooks,
): ContentStore {
	const ctx: StoreContext = {
		pool,
		qSchema: validateSchemaName(options?.schema),
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
	};
	return options?.afterCommit ? withAfterCommit(store, options.afterCommit) : store;
}
