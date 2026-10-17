/**
 * Adapter entry point (`@monti-cms/core/adapters`): what a database, media storage or login adapter implements, and what it needs from the core to do so.
 * The store ports (`ContentStore` and the stores it is made of, with the event outbox), `DatabaseAdapter`, `MediaAdapter` with the `MediaStore` it creates, and
 * `AuthAdapter` with the login types. A site config only names an adapter (`postgres()`, `storage`, `auth`); only code that writes one imports this entry point.
 * The login checks that routes run (the gateway and its errors) are in `@monti-cms/core/adapters/auth`.
 */
export type { AppliedSchemaChange, ApplySchemaChangeParams, BodyCursor, ClaimedDelivery, ContentStore, EntryStore, EventDelivery, EventDeliveryCounts, EventDeliveryState, EventLogState, EventStore, FolderStore, LifecycleStore, ListStore, MediaMetadataStore, MutableJsonValue, PreferenceStore, PublicReadStore, RewrittenBody, ScannedBody, SchemaChangeStore, SchemaState, TemplateStore, TransferStore, } from "./core/store/index.js";
export { DEFAULT_ENTRY_SEARCH_LIMIT, eventRowOf, MAX_ENTRY_SEARCH_LIMIT, withEventDispatch } from "./core/store/index.js";
export type { MediaStore, PrepareUploadInput, PrepareUploadOutput, PromoteFileInput, StoredFileHead, } from "./media/store.js";
export { ALLOWED_MEDIA_MIMES } from "./media/store.js";
export { type AuthAdapter, type AuthCreateContext, type AuthProvider, CMS_AUTH_BASE_PATH, type CmsAuth, type DatabaseAdapter, type DatabaseState, type LoginAccountRefusal, type LoginAccounts, type MediaAdapter, type MigrationSummary, type RequestHost, } from "./server/define.js";
