import { CmsError } from "./adapters/postgres/store/errors.js";
import { adminUrl } from "./core/admin-paths.js";
import { notifyAfterCommit } from "./plugin/server.js";
import { cmsServerConfig } from "./server/resolved.js";
import { createContentService } from "./services/content-service.js";
export function getCmsContentStore() {
    global.__cmsStore ??= cmsServerConfig.database.createStore({ afterCommit: notifyAfterCommit });
    return global.__cmsStore;
}
export function getCmsContentService() {
    global.__cmsService ??= createContentService(getCmsContentStore());
    return global.__cmsService;
}
/** Whether the server config has a media store. Without one, the admin hides the media menu and uploads. */
export const isCmsMediaConfigured = () => Boolean(cmsServerConfig.media);
export function getCmsMediaStore() {
    if (!cmsServerConfig.media)
        throw new CmsError("Media storage is not configured", "media_not_configured");
    global.__cmsMediaStore ??= cmsServerConfig.media.createStore();
    return global.__cmsMediaStore;
}
export function getCmsAuth() {
    global.__cmsAuth ??= cmsServerConfig.auth.create({ loginPath: adminUrl("/login") });
    return global.__cmsAuth;
}
/** Encryption key for secrets (`secret` in the server config). */
export const getCmsSecret = () => cmsServerConfig.secret;
