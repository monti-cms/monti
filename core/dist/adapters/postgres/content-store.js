import { createDb, dbOn } from "./db/kysely.js";
import { validateSchemaName } from "./store/context.js";
import { createEntryOps } from "./store/entries.js";
import { createEventOps } from "./store/events.js";
import { createFolderOps } from "./store/folders.js";
import { createLifecycleOps } from "./store/lifecycle.js";
import { createListOps } from "./store/list.js";
import { createMediaOps } from "./store/media.js";
import { createPreferenceOps } from "./store/preferences.js";
import { createPublicReadOps } from "./store/public-read.js";
import { createPublishing } from "./store/publish.js";
import { createSchemaChangeOps } from "./store/schema-change.js";
import { createTemplateOps } from "./store/templates.js";
import { createTransferOps } from "./store/transfer.js";
export { migrateContentStore } from "./store/schema.js";
export function createContentStore(pool, options) {
    const qSchema = validateSchemaName(options?.schema);
    // One Kysely instance per store, on the pool the adapter owns; `db(tx)` is the same schema on the client of a transaction.
    const poolDb = createDb(pool, qSchema);
    const ctx = {
        pool,
        site: options.site,
        qSchema,
        db: (tx) => (tx ? dbOn(tx, qSchema) : poolDb),
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
        ...createSchemaChangeOps(ctx),
        ...createEventOps(ctx),
    };
    return store;
}
