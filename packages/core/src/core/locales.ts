import type { LocalePrefixMode } from "../config/define";
import { cmsConfig } from "../config/resolved";

/** 콘텐츠 언어(`cms.config.ts`의 `locales`). 관리자 화면 자체의 언어와는 별개다. */
export const LOCALES = cmsConfig.locales.map((locale) => locale.code);
export type Locale = (typeof cmsConfig.locales)[number]["code"];

/** 기본 언어. 번역본의 원본 언어이고, 기본 주소 방식(`except-default`)에서는 주소에 언어 접두사를 붙이지 않는다. */
export const DEFAULT_LOCALE: Locale = cmsConfig.defaultLocale;

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** 기본 언어가 아닌 언어(번역 언어). 이름은 예전 그대로다. 주소 접두사 여부는 `localePrefix`가 정한다. */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/** 그 언어로 쓴 언어 이름. 모르는 코드는 그대로 돌려준다. */
export const localeName = (code: string): string =>
	cmsConfig.locales.find((locale) => locale.code === code)?.name ?? code;

/** 관리자 화면의 언어 이름. 모르는 코드는 그대로 돌려준다. */
export const localeLabel = (code: string): string => {
	const locale = cmsConfig.locales.find((entry) => entry.code === code);
	return locale ? (locale.label ?? locale.name) : code;
};

/** 공개 주소에 언어를 붙이는 방식(`site.localePrefix`, 기본 `except-default`). */
export const LOCALE_PREFIX_MODE: LocalePrefixMode = cmsConfig.site?.localePrefix ?? "except-default";

/** 설정을 읽지 않는 언어 접두사 규칙. `code`는 아는 언어여야 한다. */
export function localePrefixFor(code: string, mode: LocalePrefixMode, defaultLocale: string): string {
	if (mode === "never") return "";
	if (mode === "except-default" && code === defaultLocale) return "";
	return `/${code}`;
}

/** 설정을 읽지 않는 경로 바꾸기. 기본 언어 기준 경로(`/posts/a`)에 접두사를 붙인다(`/`는 `/{code}`). */
export function localizePathWith(prefix: string, path: string): string {
	if (!prefix) return path;
	return path === "/" ? prefix : `${prefix}${path}`;
}

/** 공개 주소의 언어 접두사(`site.localePrefix`를 따른다). 접두사가 없거나 모르는 언어면 빈 글자다. */
export const localePrefix = (code: string): string =>
	isLocale(code) ? localePrefixFor(code, LOCALE_PREFIX_MODE, DEFAULT_LOCALE) : "";

/** 기본 언어 기준 경로(`/posts/a`)를 그 언어의 경로로 바꾼다(`site.localePrefix`를 따른다). */
export const localizePath = (code: string, path: string): string => localizePathWith(localePrefix(code), path);
