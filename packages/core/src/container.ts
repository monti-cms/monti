import type { ContentStore, Entry } from "./adapters/postgres/content-store";
import { CmsError } from "./adapters/postgres/store/errors";
import type { MediaStore } from "./adapters/r2/types";
import { adminUrl } from "./core/admin-paths";
import { notifyAfterCommit } from "./plugin/server";
import type { CmsAuth } from "./server/define";
import { cmsServerConfig } from "./server/resolved";
import { isCmsHostTrusted } from "./server/trust";
import { createContentService } from "./services/content-service";

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

export function getCmsContentStore(): ContentStore {
	global.__cmsStore ??= cmsServerConfig.database.createStore({ afterCommit: notifyAfterCommit });
	return global.__cmsStore;
}

export function getCmsContentService(): ContentService {
	global.__cmsService ??= createContentService<Entry>(getCmsContentStore());
	return global.__cmsService;
}

/** Whether the server config has a media store. Without one, the admin hides the media menu and uploads. */
export const isCmsMediaConfigured = (): boolean => Boolean(cmsServerConfig.media);

export function getCmsMediaStore(): MediaStore {
	if (!cmsServerConfig.media) throw new CmsError("Media storage is not configured", "media_not_configured");
	global.__cmsMediaStore ??= cmsServerConfig.media.createStore();
	return global.__cmsMediaStore;
}

export function getCmsAuth(): CmsAuth {
	global.__cmsAuth ??= cmsServerConfig.auth.create({ loginPath: adminUrl("/login"), trustHost: isCmsHostTrusted() });
	return global.__cmsAuth;
}

/** Encryption key for secrets (`secret` in the server config). */
export const getCmsSecret = (): string | undefined => cmsServerConfig.secret;
