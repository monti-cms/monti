import type { ContentStore, Entry } from "./adapters/postgres/content-store";
import { CmsError } from "./adapters/postgres/store/errors";
import type { MediaStore } from "./adapters/r2/types";
import { adminUrl } from "./core/admin-paths";
import { notifyAfterCommit } from "./plugin/server";
import type { CmsAuth } from "./server/define";
import { cmsServerConfig } from "./server/resolved";
import { createContentService } from "./services/content-service";

/**
 * 서버 연결 모음. 서버 설정(`cms.server.ts`)의 연결을 처음 쓸 때 만들고, 개발 서버가 모듈을 다시 읽어도
 * 연결을 새로 만들지 않도록 `global`에 둔다.
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

/** 서버 설정에 미디어 저장소가 있는가. 없으면 관리자 화면이 미디어 메뉴와 업로드를 감춘다. */
export const isCmsMediaConfigured = (): boolean => Boolean(cmsServerConfig.media);

export function getCmsMediaStore(): MediaStore {
	if (!cmsServerConfig.media) throw new CmsError("Media storage is not configured", "media_not_configured");
	global.__cmsMediaStore ??= cmsServerConfig.media.createStore();
	return global.__cmsMediaStore;
}

export function getCmsAuth(): CmsAuth {
	global.__cmsAuth ??= cmsServerConfig.auth.create({ loginPath: adminUrl("/login") });
	return global.__cmsAuth;
}

/** 비밀 값 암호화 키(서버 설정의 `secret`). */
export const getCmsSecret = (): string | undefined => cmsServerConfig.secret;
