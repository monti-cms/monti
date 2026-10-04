import type { Pool, PoolClient } from "pg";
import type { AfterCommit } from "../adapters/postgres/store/after-commit";
import type { BlockDefinition } from "../blocks/define";
import type { CollectionsConfig } from "../config/define";

/**
 * 플러그인(v2 M5). 사이트 설정(`cms.config.ts`)의 `plugins`에 한 번만 적는다.
 *
 * - 설정 값(`options`)·사이드바 항목(`nav`)·설정 검사(`validate`)는 서버와 브라우저가 함께 읽는다. 함수 말고는 JSON 값만 둔다.
 * - 서버 코드(`server`)와 관리자 화면 코드(`admin`)는 불러오는 함수로 둔다. 쓸 때만 읽고, 서버 코드는 브라우저 묶음에
 *   들어가지 않게 플러그인 패키지가 브라우저용 빈 진입점(`exports`의 `browser` 조건)을 준다.
 */
export interface CmsPlugin<Name extends string = string, Options = unknown> {
	readonly name: Name;
	readonly options: Options;
	/** 관리자 사이드바의 "관리" 묶음에 더할 항목. `path`는 관리자 경로(`admin.path`, 기본 `/admin`) 뒤 한 칸 주소이고, 관리자 플러그인의 `pages`가 그린다. */
	readonly nav?: readonly PluginNavItem[];
	/** 본문 블록(블록 확장). 사이트 설정의 `blocks`와 같은 규칙으로 더한다. */
	readonly blocks?: readonly BlockDefinition[];
	/** 사이트 설정을 만들 때 부르는 검사. 잘못된 설정이면 오류를 던진다. */
	readonly validate?: (config: PluginConfigView) => void;
	/** 서버 쪽(API 경로·마이그레이션). 기본 내보내기가 `CmsServerPlugin`이다. */
	readonly server?: () => Promise<{ readonly default: CmsServerPlugin }>;
	/** 관리자 화면 쪽(페이지·공급자). 기본 내보내기가 관리자 패키지의 `CmsAdminPlugin`이다. */
	readonly admin?: () => Promise<{ readonly default: unknown }>;
	/**
	 * 공개 화면 쪽(본문 블록의 공개 컴포넌트). 기본 내보내기가 `(context) => 컴포넌트 표`이고 `@monti-cms/core/render`가 부른다
	 * (`context`: 사이트 언어·이미지 해석기). 서버에서 읽히며 클라이언트 컴포넌트는 그 모듈이 `"use client"`로 나눈다.
	 */
	readonly render?: () => Promise<{ readonly default: unknown }>;
	/**
	 * 다른 플러그인에 더하는 것. 키는 받는 쪽이 정한 이름이고(예: AI 플러그인은 `ai: { actions }`를 읽는다), 본체는 읽지 않는다.
	 * 받는 플러그인이 없으면 쓰이지 않는다. 그래서 확장은 받는 플러그인을 몰라도 기능을 더할 수 있다.
	 */
	readonly contributes?: Readonly<Record<string, unknown>>;
}

export interface PluginNavItem {
	readonly path: string;
	readonly label: string;
	/** lucide 아이콘 이름(예: `sparkles`). */
	readonly icon?: string;
}

/** 플러그인 검사가 보는 사이트 설정. */
export interface PluginConfigView {
	readonly collections: CollectionsConfig;
	readonly locales: readonly { readonly code: string; readonly name?: string }[];
	readonly defaultLocale: string;
	/** 사이트가 쓰는 본문 블록 이름(본체 블록 + 플러그인·사이트 설정이 더한 블록). */
	readonly blocks: readonly string[];
	/** 그 블록의 정의(`blocks`와 같은 순서). */
	readonly blockDefinitions: readonly BlockDefinition[];
	/** 사이트 설정의 모든 플러그인(자기 자신 포함). 다른 플러그인이 더한 것(`contributes`)을 읽을 때 쓴다. */
	readonly plugins: readonly CmsPlugin[];
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * 플러그인 API 경로 하나. `pattern`은 `/api/cms/` 뒤 주소(예: `v1/ai/run`)이고 `[이름]`은 한 칸이다.
 * 본체가 관리자 로그인 확인과 같은 출처 검사로 감싼다. 로그인 없이 받아야 하는 경로(외부 실행기·웹훅 등)만 `public: true`로
 * 빼고, 그때는 경로가 스스로 요청을 확인한다.
 */
export interface PluginRoute {
	readonly pattern: string;
	readonly module: Partial<Record<Method, unknown>>;
	readonly public?: boolean;
}

/** 어느 플러그인의 경로인지 붙인 `PluginRoute`(주소가 겹칠 때 오류에 이름을 쓴다). */
export interface OwnedPluginRoute extends PluginRoute {
	readonly plugin: string;
}

/** 플러그인이 쓰는 DB(지금은 Postgres만, D13). `schema`는 검사한 스키마 이름이라 SQL에 그대로 넣어도 된다. */
export interface PluginDatabase {
	readonly pool: Pool;
	readonly schema: string;
	/**
	 * 한 번만 하는 일(예전 데이터 옮기기 등). 이름을 본체 마이그레이션 기록에 남겨 다시 돌지 않고, 동시에 불러도 한 번만 돈다.
	 * `run`은 트랜잭션 안에서 받은 `client`로 쓴다(실패하면 되돌리고 기록하지 않는다). 이름 앞에 플러그인 이름을 붙인다.
	 * @returns 이번에 돌았는가
	 */
	readonly once: (name: string, run: (client: PoolClient) => Promise<void>) => Promise<boolean>;
}

export interface CmsServerPlugin {
	/** 본체 경로에 없는 주소를 이 경로표에서 찾는다. */
	readonly routes?: readonly PluginRoute[];
	/** `monti migrate`가 본체 표 다음에 부른다. 여러 번 불러도 같은 결과여야 한다. */
	readonly migrate?: (db: PluginDatabase) => Promise<void>;
	/** 관리자 메타 API(`/v1/meta`)의 `features.<플러그인 이름>`에 담을 값. 다른 플러그인·본체 이름과 섞이지 않는다. */
	readonly features?: () => Promise<Readonly<Record<string, boolean>>>;
	/** 저장 뒤 알림(서버 설정 `afterCommit`과 같다). 실패해도 저장은 그대로다. */
	readonly afterCommit?: AfterCommit;
}

/**
 * 플러그인을 만든다. 플러그인 패키지는 이 값을 돌려주는 함수(예: `aiPlugin()`)를 내보낸다. 더하는 것(`contributes`)의 타입은
 * 그대로 남아 받는 플러그인이 읽을 수 있다(예: AI 기능 이름).
 */
export function definePlugin<
	const Name extends string,
	Options,
	const Contributes extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
>(
	plugin: CmsPlugin<Name, Options> & { readonly contributes?: Contributes },
): CmsPlugin<Name, Options> & { readonly contributes?: Contributes } {
	if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) throw new Error(`cms plugin: invalid name "${plugin.name}"`);
	return plugin;
}

/** 사이트 설정의 플러그인 목록에서 이름으로 고른 플러그인의 타입. */
export type PluginNamed<Plugins, Name extends string> = Plugins extends readonly (infer P)[]
	? Extract<P, CmsPlugin<Name, unknown>>
	: never;
