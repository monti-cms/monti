import { withAfterCommit } from "./store/after-commit.js";
import { validateSchemaName } from "./store/context.js";
import { createEntryOps } from "./store/entries.js";
import { createFolderOps } from "./store/folders.js";
import { createLifecycleOps } from "./store/lifecycle.js";
import { createListOps } from "./store/list.js";
import { createMediaOps } from "./store/media.js";
import { createPreferenceOps } from "./store/preferences.js";
import { createPublicReadOps } from "./store/public-read.js";
import { createPublishing } from "./store/publish.js";
import { createTemplateOps } from "./store/templates.js";
import { createTransferOps } from "./store/transfer.js";
export { PUBLIC_COLLECTIONS } from "./store/constants.js";
export { CmsError } from "./store/errors.js";
export { extractVisibleText, normalizeMetadata } from "./store/rows.js";
export { migrateContentStore } from "./store/schema.js";
export * from "./store/types.js";
export function createContentStore(pool, options) {
    const ctx = {
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
