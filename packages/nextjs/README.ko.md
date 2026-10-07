# @monti-cms/nextjs

[English](README.md) | 한국어

Monti의 Next.js 어댑터. Next에 묶인 것을 모두 갖고 있어서 `@monti-cms/core`와 `@monti-cms/admin`은 `next/*` 없이 남는다.

- 관리자 API의 라우트 핸들러(`createRouteHandler`),
- `next.config.ts` 연결(`withCms`),
- 관리자가 필요로 하는 App Router 어댑터를 얹은 관리자 페이지·레이아웃(`CmsAdminLayout`·`CmsAdminPage`·`NextAdminRouter`),
- 관리자 로그인(`@monti-cms/auth`)의 Next.js 쪽인 요청 헤더(라우트 핸들러·레이아웃·페이지가 인스턴스에 붙인다),
- 클라이언트 컴포넌트가 서버 전용 설정을 불러올 때 개발 중에 내는 경고(`checkImportBoundaryInDev`, `withCms`가 실행한다).

지금 지원하는 호스트는 Next.js(App Router)뿐이다. `@monti-cms/core` README의 "지원하는 프레임워크"를 본다. 다른 프레임워크는 이 패키지 같은 다른 패키지가 된다.

## 설치

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/auth @monti-cms/nextjs
```

아래 파일들은 `monti init`(`@monti-cms/core`)이 만들어 준다. `next`와 `react`는 peer다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`, `CmsRouteHandler` 타입 |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms(nextConfig)` |
| `@monti-cms/nextjs/admin` | 관리자 라우트 파일 | `CmsAdminLayout`·`CmsAdminPage`·`CmsAdminPageProps`·`cmsAdminMetadata(cms)`·`NextAdminRouter` |
| `@monti-cms/nextjs/auth` | (라우트 핸들러와 관리자가 알아서 붙인다) | `nextHost` |

### 라우트 핸들러

```ts
// app/api/cms/[...path]/route.ts
import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "@/monti.config";

export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
```

요청과, Next가 이미 나눈 경로 조각을 `cms.handle(request)`에 넘길 뿐이다. 이 라우트 하나가 관리자 API(`/api/cms/v1/*`)·로그인(`/api/cms/auth/*`)·플러그인 라우트를 맡는다.

### `next.config.ts`

```ts
import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig);
```

설정 파일은 잇지 않는다(설정은 `cms` 인스턴스를 내보내는 `monti.config.ts` 하나이고, 관리자는 그 인스턴스에서 사이트를 받는다). 코어 패키지를 앱과 함께 빌드하고, Next의 `basePath`를 서버·브라우저 번들에 알리고, 설치하지 않은 CMS 패키지의 선택 의존성은 빈 모듈로 잇는다(코어 README의 "선택 의존성"). `next dev`에서는 `"use client"` 파일이 서버 전용 설정을 불러올 때 서버를 시작할 때마다 한 번 경고하기도 한다("파일" 참고).

### 관리자 페이지·레이아웃

```tsx
// app/admin/layout.tsx
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "@/monti.config";

export const generateMetadata = () => cmsAdminMetadata(cms);

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}

// app/admin/[[...path]]/page.tsx
import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "@/monti.config";

// 세그먼트 설정은 여기에 써야 합니다(다시 내보낼 수 없습니다). 어드민은 요청마다 그려지는 앱이므로 Next의 instant 내비게이션 검증이 건너뜁니다.
export const instant = false;

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
```

`CmsAdminLayout`은 관리자 레이아웃의 props(`themeProvider`·`themeStorageKey`·`toaster`, `@monti-cms/admin` README)를 받아 `NextAdminRouter` 안에 그린다.

**Cache Components.** 관리자는 Next의 `cacheComponents`(와 `partialPrefetching`)가 있든 없든 동작한다. `create-next-app`은 새 앱에서 이 둘을 켠다. `CmsAdminLayout`은 폴백 없는 `Suspense` 경계 안에서 요청을 기다리므로(`connection()`) 그 아래는 미리 렌더링되지 않는다. 세션, 데이터베이스, 현재 시각, URL이 모두 요청 시점의 데이터이기 때문이다. 페이지는 그 경계의 자식이라 따로 경계가 필요 없다. 페이지의 `export const instant = false`는 절대 instant하지 않은 라우트를 Next 16.4의 개발 전용 instant 검증이 검사하지 않게 한다. 다른 Next 버전은 이 export를 무시한다. 관리자 테마 프로바이더는 React가 하이드레이션하기 전에 `<html>`에 클래스와 `color-scheme`을 달므로, 루트 레이아웃의 `<html>` 태그에 `suppressHydrationWarning`이 필요하다(`monti init`이 추가한다).

`NextAdminRouter`는 관리자용 App Router 어댑터다. `next/link`와 `next/navigation` 위에 만든 `Link`·`navigate`·`replace`·`usePathname`·`useSearchParams`를 `@monti-cms/admin`에 주는 클라이언트 컴포넌트다. `CmsAdminPage`는 관리자의 서버 화면에 Next의 `redirect`와 `notFound`를 준다. 관리자 자체는 Next에서 아무것도 가져오지 않는다.

### 로그인

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	database: postgres(), // DATABASE_URL, DATABASE_SCHEMA
	auth: auth({ providers: [github()] }), // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
});
```

환경 변수, 하나뿐인 비밀 값(`MONTI_SECRET`), 호스트 신뢰, 개발용 우회(`next dev`에서 켜짐)는 `@monti-cms/auth` README에 있다. 로그인 자체는 `@monti-cms/auth`(`Request`·`Response` 위의 Auth.js core. 로그인 방법을 프로바이더로 받는다)이고 Next에서 아무것도 가져오지 않는다. 이 패키지는 로그인이 Next 호스트에 요구하는 한 가지, 지금 요청의 헤더를 채운다(요청할 때 `next/headers`에서 읽으므로 콘텐츠만 읽는 코드와 명령줄 도구는 불러오지 않는다). 라우트 핸들러·관리자 레이아웃·관리자 페이지가 이것을 인스턴스에 자동으로 붙이므로(`cms.attachHost(nextHost)`) 설정 없이 개발용 우회와 세션이 동작하고, 아래 세 파일도 그대로다. `nextHost`는 `@monti-cms/nextjs/auth`에서 여전히 내보내지만 사이트가 쓸 필요는 없다.

## 파일

관리자 경로가 무엇이든 앱에는 파일이 세 개 필요하다(`monti init`이 만든다).

| 파일 | 내용 |
| --- | --- |
| `app/<관리자 경로>/layout.tsx` | `CmsAdminLayout`과 `generateMetadata`(`cmsAdminMetadata`), 관리자 스타일시트 import |
| `app/<관리자 경로>/[[...path]]/page.tsx` | `CmsAdminPage` |
| `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`: 관리자 API·로그인·플러그인 라우트 |

라우트 그룹도, 그 밖의 관리자 파일도 없다. 직접 만든 관리자 컴포넌트는 관리자 쪽을 가진 플러그인이다(`@monti-cms/admin` README의 "사이트 컴포넌트 넣기"). 세 파일 모두 `monti.config.ts`에서 `cms`를 불러온다.

**레이아웃을 페이지에 합치지 않는 이유.** Next는 동적 세그먼트(`[[...path]]`)의 값이 바뀌면 그 아래 서브트리를 다시 마운트한다. 레이아웃을 페이지 안에 두면 화면을 옮길 때마다 관리자 전체(내비게이션, 쿼리 캐시, 테마 공급자)가 다시 마운트된다. 그래서 레이아웃은 한 단계 위에 두어, 화면을 옮겨도 상태가 유지되게 한다.

**서버 전용.** `monti.config.ts`에는 DB와 로그인 설정이 있으므로 브라우저에 닿으면 안 된다. 브라우저에서 불러오면 오류가 난다. `monti doctor`는 import 연쇄가 이 파일에 닿는 `"use client"` 파일을 모두 알려 주고(CI에서는 `monti doctor --only config/boundary`로 이것만 돌린다), `withCms`는 같은 경우를 `next dev`를 시작할 때마다 한 번 경고한다(`checkImportBoundaryInDev`). 인스턴스를 받지 못한 Next 파일(`cms`를 잘못 import한 경우)은 어느 파일인지와 어떻게 import하는지를 알려 주는 메시지로 실패하고, `monti doctor`는 관리자 경로에 Next 파일 셋이 있는지와 `next.config`가 `withCms`를 쓰는지도 본다. 관리자는 레이아웃에서 사이트의 JSON 스냅샷을 받으므로 브라우저에 설정이 필요하지 않다.

## 미리보기 페이지

초안을 보여 주는 사이트 페이지(`site.previewPath`, 예: `/preview/ko/posts/<slug>`)는 `cms.read.getPreview`를 직접 부르지 말고 `@monti-cms/nextjs`의 `previewEntry(cms, { collection, slug, locale })`로 읽는다. 읽기 전에 요청 헤더를 인스턴스에 붙이므로, 콜드 스타트 뒤 첫 요청이 미리보기이거나 서버리스 인스턴스가 사이트 페이지만 처리했더라도 관리자 세션(`next dev`에서는 개발용 우회)을 읽을 수 있다. 관리자가 아니면 `null`이라 페이지는 404를 낸다. `examples/blog`와 레지스트리의 `blog-theme`에 이 페이지가 있다.

## 올리기

NextAuth에서 `@monti-cms/auth`로 옮기는 것(`githubAuth`는 없어졌고, 모두 한 번 다시 로그인한다)은 `@monti-cms/core` README의 "`@monti-cms/auth`로 올리기"를 본다.

`@monti-cms/core/next`·`@monti-cms/core/server`·`@monti-cms/admin/next`에서 바뀐 import는 `@monti-cms/core` README의 "`@monti-cms/nextjs`로 올리기"를 본다.
