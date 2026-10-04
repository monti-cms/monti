import type { AfterCommit, ContentStore } from "../adapters/postgres/content-store";
import type { MediaStore } from "../adapters/r2/types";
import type { PublicApiOptions } from "../http/v1/public/options";
import type { PluginDatabase } from "../plugin/define";

/**
 * 서버 설정(`cms.server.ts`) 규격. 저장소·미디어·로그인 연결과 비밀 값을 둔다. 서버에서만 읽는다.
 * 사이트 설정(`cms.config.ts`)과 달리 비밀 값을 넣어도 되고, 보통 환경 변수에서 읽는다.
 *
 * 연결은 처음 쓸 때 만든다. 빌드처럼 환경 변수가 없는 곳에서 설정을 읽어도 실패하지 않는다.
 */

/** 콘텐츠 저장소 연결. */
export interface DatabaseAdapter {
	readonly name: string;
	/** 저장소를 만든다. `afterCommit`은 본체가 넘긴다(서버 설정·플러그인의 저장 뒤 알림). */
	createStore(options?: { readonly afterCommit?: AfterCommit }): ContentStore;
	/** 표를 만들거나 최신 모양으로 맞춘다(`monti migrate`). 여러 번 실행해도 결과가 같다. */
	migrate(): Promise<void>;
	/** 플러그인이 자기 표를 만들고 읽을 연결(`CmsServerPlugin.migrate`·플러그인 API). */
	pluginDatabase(): PluginDatabase;
	/** 연결을 닫는다(명령줄 도구가 끝날 때). */
	close?(): Promise<void>;
}

/** 미디어(이미지·첨부 파일) 저장소 연결. */
export interface MediaAdapter {
	readonly name: string;
	createStore(): MediaStore;
}

/** 관리자 로그인 확인 결과. */
export interface AuthContext {
	userId: string;
	isAdmin: boolean;
	/** 로그인 방식의 계정 ID(GitHub이면 숫자 ID). 관리자 목록과 견준다. */
	accountId: string;
}

/** 로그인 화면의 로그인 버튼 하나. */
export interface AuthProvider {
	/** `signIn(id)`에 넘기는 로그인 방식 이름(예: `github`). */
	readonly id: string;
	/** 로그인 방식의 보이는 이름(예: `GitHub`). 권한 안내 문구에 쓴다. */
	readonly name: string;
	/** 버튼 문구(예: `GitHub으로 로그인`). */
	readonly label: string;
}

/**
 * 로그인 API의 기본 경로. 관리자 API catch-all(`app/api/cms/[...path]/route.ts`)이 이 아래(`/api/cms/auth/*`)를
 * 로그인 연결에 넘기므로 로그인 라우트 파일이 따로 없어도 된다.
 */
export const CMS_AUTH_BASE_PATH = "/api/cms/auth";

/** 관리자 로그인. Next 라우트(`handlers`)와 관리자 확인을 함께 준다. */
export interface CmsAuth {
	/**
	 * 로그인 API 경로(예: `/api/cms/auth`). `CMS_AUTH_BASE_PATH`이면 관리자 API catch-all이 `handlers`로 넘긴다.
	 * 다른 경로면 앱이 그 경로에 라우트 파일을 두고 `@monti-cms/core/runtime`의 `handlers`를 내보낸다.
	 */
	readonly basePath?: string;
	/** 로그인 API 라우트 처리기(`basePath` 아래 요청). */
	readonly handlers: {
		GET(request: Request): Promise<Response>;
		POST(request: Request): Promise<Response>;
	};
	/** 지금 세션. 없으면 `null`. */
	session(): Promise<{ user?: { id?: string; accountId?: string } } | null>;
	/** 로그인 화면에 보일 로그인 방식. */
	readonly providers: readonly AuthProvider[];
	signIn(provider?: string, options?: { redirectTo?: string }): Promise<unknown>;
	signOut(options?: { redirectTo?: string }): Promise<unknown>;
	/** 이 사용자가 관리자인가. */
	isAdmin(userId: string | null | undefined): boolean;
	/** 로그인 없이 관리자로 보는 로컬 개발 우회가 켜졌는가. */
	readonly devBypass: boolean;
	/** 개발 우회 때 쓸 관리자 ID. */
	readonly devUserId: string;
}

/** 로그인 연결을 만들 때 본체가 주는 값. */
export interface AuthCreateContext {
	/** 관리자 로그인 화면 주소(관리자 경로 + `/login`, 예: `/admin/login`). Next `basePath`가 있으면 그것까지 포함한 브라우저 주소다. */
	readonly loginPath: string;
}

export interface AuthAdapter {
	readonly name: string;
	create(context: AuthCreateContext): CmsAuth;
}

export interface CmsServerConfig {
	readonly database: DatabaseAdapter;
	/** 없으면 미디어 업로드·관리 기능을 쓸 수 없다. */
	readonly media?: MediaAdapter;
	readonly auth: AuthAdapter;
	/**
	 * 비밀 값 암호화 키(AI 서비스 키를 DB에 저장할 때). 바꾸면 저장된 키를 풀 수 없어 다시 넣어야 한다.
	 * 없으면 AI 서비스 키를 저장할 수 없다.
	 */
	readonly secret?: string;
	/**
	 * 저장 뒤 알림(캐시 갱신·웹훅·검색 색인). 글을 만들고·저장하고·발행·보관·휴지통·복원·지운 변경이 커밋된 뒤 부른다.
	 * 실패해도 저장은 그대로다(오류는 로그로만). 플러그인의 `afterCommit`도 함께 불린다.
	 */
	readonly afterCommit?: AfterCommit;
	/** 공개 JSON API(`/api/cms/v1/public/*`). 없으면 끈다(404). */
	readonly publicApi?: PublicApiOptions;
}

/** 서버 설정을 정의한다. */
export const defineServerConfig = <const C extends CmsServerConfig>(config: C): C => config;
