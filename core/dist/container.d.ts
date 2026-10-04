import type { ContentStore, Entry } from "./adapters/postgres/content-store.js";
import type { MediaStore } from "./adapters/r2/types.js";
import type { CmsAuth } from "./server/define.js";
import { createContentService } from "./services/content-service.js";
/**
 * Server connection container. Connections from the server config (`cms.server.ts`) are created on first use and
 * kept on `global` so a dev server reloading modules does not create new ones.
 */
export type ContentService = ReturnType<typeof createContentService<Entry>>;
declare global {
    var __cmsStore: ContentStore | undefined;
    var __cmsService: ContentService | undefined;
    var __cmsMediaStore: MediaStore | undefined;
    var __cmsAuth: CmsAuth | undefined;
}
export declare function getCmsContentStore(): ContentStore;
export declare function getCmsContentService(): ContentService;
/** Whether the server config has a media store. Without one, the admin hides the media menu and uploads. */
export declare const isCmsMediaConfigured: () => boolean;
export declare function getCmsMediaStore(): MediaStore;
export declare function getCmsAuth(): CmsAuth;
/** Encryption key for secrets (`secret` in the server config). */
export declare const getCmsSecret: () => string | undefined;
