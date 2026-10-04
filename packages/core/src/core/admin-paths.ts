import { DEFAULT_ADMIN_PATH } from "../config/define";
import { cmsConfig } from "../config/resolved";
import { adminHrefWith, withBasePath } from "./base-path";

export { DEFAULT_ADMIN_PATH };
export { adminHrefWith, CMS_API_PATH, cmsApiUrl, cmsBasePath, normalizeBasePath, withBasePath } from "./base-path";

/** 관리자 화면 경로(`admin.path`, 기본 `/admin`). 앱의 관리자 라우트 폴더와 같아야 한다. */
export const ADMIN_PATH: string = cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH;

/**
 * 관리자 화면 안 주소. `adminHref()`는 목록(`/admin`), `adminHref("/media")`는 `/admin/media`,
 * `adminHref("?collection=post")`는 `/admin?collection=post`다. 경로는 `admin.path`를 따른다.
 * Next의 `Link`·`router`·`redirect()`·`usePathname()`과 같은 기준이라 `basePath`는 없다. 브라우저 주소가 필요하면 `adminUrl()`.
 */
export const adminHref = (path = ""): string => adminHrefWith(ADMIN_PATH, path);

/** `adminHref()`에 `basePath`를 더한 브라우저 주소(`window.open`·`history`·로그인 `redirectTo`·세션 로그인 화면 주소용). */
export const adminUrl = (path = ""): string => withBasePath(adminHref(path));

/** 관리자 화면 안 글 편집 주소. */
export const adminEntryEditHref = (id: string): string => adminHref(`/entries/${id}/edit`);

/** 관리자 사이드바 `사이트 보기` 주소(`site.home`, 기본 `/`). */
export const SITE_HOME: string = cmsConfig.site?.home ?? "/";
