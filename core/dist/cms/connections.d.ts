import type { MediaStore } from "../media/store.js";
import type { CmsServerConfig, DatabaseAdapter } from "../server/define.js";
/**
 * Connections that must survive a development server reloading modules. Next's dev server evaluates `monti.config.ts` again after an edit, which calls
 * `createCms` again. A new database adapter would open a second connection pool and leave the first one open, so in development the first adapter
 * (and the media store, which keeps its own client) of an instance is reused by the instances created later with the same `id`.
 * Everything else (store, services, login connection, plugins, hooks) is rebuilt by the new instance from its own server config, so edits to
 * hooks and other options take effect. Changing the database connection itself needs a restart.
 *
 * This is the only cache outside an instance. It is development only (`NODE_ENV=development`): in production and in tests an instance owns its
 * connections alone, and the cache is not used.
 */
export interface SharedConnections {
    database: DatabaseAdapter;
    mediaStore?: MediaStore;
}
export declare function connectionsFor(id: string, server: CmsServerConfig): SharedConnections;
