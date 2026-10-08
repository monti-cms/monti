import type { Pool } from "pg";
import type { ContentStore } from "../../core/store/ports.js";
import type { Site } from "../../site/index.js";
import { type ContentStoreHooks } from "./store/context.js";
/**
 * PostgreSQL implementation of the core `ContentStore` port (`core/store/ports.ts`). Reads and atomic changes for content, folders, relations, media metadata,
 * settings, and the event outbox. The driver and SQL live only in the modules under `store/`; the rules (slug addresses, translations, publish and lifecycle transitions) come from `core/domain/`.
 */
export type { ContentStoreHooks } from "./store/context.js";
export { migrateContentStore } from "./store/schema.js";
export declare function createContentStore(pool: Pool, options: {
    site: Site;
    schema?: string;
} & ContentStoreHooks): ContentStore;
