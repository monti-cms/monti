import { assertPluginPagesFree, type CmsPlugin } from "@monti-cms/core";
import { cmsConfig } from "@monti-cms/core/client";
import type { ComponentType, ReactNode } from "react";

/**
 * 플러그인의 관리자 화면 쪽. 플러그인 정의(`definePlugin`)의 `admin`이 이 값을 기본 내보내기로 주는 모듈을 불러온다.
 * 이 모듈은 브라우저 묶음에도 들어가므로 서버 전용 코드(DB·비밀 값)를 넣지 않는다.
 */
export interface CmsAdminPlugin {
	/**
	 * 관리자 경로 아래 `<경로>` 화면(기본 `/admin/<경로>`, 클라이언트 컴포넌트). 사이드바 항목은 플러그인 정의의 `nav`다.
	 * 관리자 로그인 확인은 관리자 화면이 그리기 전에 한다.
	 */
	readonly pages?: Readonly<Record<string, ComponentType>>;
	/**
	 * 관리자 화면 전체를 감싸는 공급자(클라이언트 컴포넌트). 안에서 `CmsAdminComponentsProvider`로 필드 입력·편집 화면 확장을
	 * 더하거나 자리(`SlotRegistryProvider`)에 동작을 붙인다.
	 */
	readonly Provider?: ComponentType<{ readonly children: ReactNode }>;
}

/** 관리자 플러그인을 만든다(타입만 맞춘다). */
export const defineAdminPlugin = (plugin: CmsAdminPlugin): CmsAdminPlugin => plugin;

/** 사이트 설정의 플러그인. 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다. */
const PLUGINS: readonly CmsPlugin[] = cmsConfig.plugins ?? [];

let loaded: Promise<readonly (CmsAdminPlugin & { readonly name: string })[]> | undefined;

/**
 * 사이트 설정의 플러그인 관리자 쪽을 불러온다. 성공하면 처음 한 번만 읽고 다시 쓴다.
 * 불러오기가 실패하거나 화면 주소가 본체·다른 플러그인과 겹치면 기억하지 않아 다음에 다시 시도하고, 오류는 그대로 던진다.
 */
export function loadAdminPlugins(): Promise<readonly (CmsAdminPlugin & { readonly name: string })[]> {
	loaded ??= Promise.all(
		PLUGINS.map(async (plugin) => ({
			name: plugin.name,
			...((await plugin.admin?.())?.default as CmsAdminPlugin | undefined),
		})),
	)
		.then((plugins) => {
			assertPluginPagesFree(
				plugins.flatMap((plugin) => Object.keys(plugin.pages ?? {}).map((path) => ({ plugin: plugin.name, path }))),
			);
			return plugins;
		})
		.catch((error) => {
			loaded = undefined;
			console.error("[@monti-cms/admin] failed to load admin plugins", error);
			throw error;
		});
	return loaded;
}
