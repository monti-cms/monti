# @monti-cms/nextjs

[English](README.md) | 한국어

Monti의 Next.js 어댑터. Next에 묶인 것을 모두 갖고 있어서 `@monti-cms/core`와 `@monti-cms/admin`은 `next/*` 없이 남는다.

- 관리자 API의 라우트 핸들러(`createRouteHandler`),
- `next.config.ts` 연결(`withCms`),
- 관리자가 필요로 하는 App Router 어댑터를 얹은 관리자 페이지·레이아웃(`CmsAdminLayout`·`CmsAdminPage`·`NextAdminRouter`),
- NextAuth 관리자 로그인(`githubAuth`).

지금 지원하는 호스트는 Next.js(App Router)뿐이다. `@monti-cms/core` README의 "지원하는 프레임워크"를 본다. 다른 프레임워크는 이 패키지 같은 다른 패키지가 된다.

## 설치

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/nextjs next-auth@5.0.0-beta.32
```

아래 파일들은 `monti init`(`@monti-cms/core`)이 만들어 준다. `next`와 `react`는 peer이고, `next-auth`는 GitHub 로그인에만 필요하다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`, `CmsRouteHandler` 타입 |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms(nextConfig)` |
| `@monti-cms/nextjs/admin` | 관리자 라우트 파일 | `CmsAdminLayout`·`CmsAdminPage`·`CmsAdminPageProps`·`cmsAdminMetadata(cms)`·`NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `cms.server.ts` | `githubAuth(options)` |

### 라우트 핸들러

```ts
// app/api/cms/[...path]/route.ts
import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "../../../../cms.server";

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

설정 파일은 잇지 않는다(사이트 설정은 `cms.server.ts`의 `createCms`에 넘기고, 관리자는 그 인스턴스에서 받는다). 코어 패키지를 앱과 함께 빌드하고, Next의 `basePath`를 서버·브라우저 번들에 알리고, 설치하지 않은 CMS 패키지의 선택 의존성은 빈 모듈로 잇는다(코어 README의 "선택 의존성").

### 관리자 페이지·레이아웃

```tsx
// app/(admin)/admin/layout.tsx
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "../../../cms.server";

export const generateMetadata = () => cmsAdminMetadata(cms);

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}

// app/(admin)/admin/[[...path]]/page.tsx
import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "../../../../cms.server";

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
```

`CmsAdminLayout`은 관리자 레이아웃의 props(`themeProvider`·`themeStorageKey`·`toaster`, `@monti-cms/admin` README)를 받아 `NextAdminRouter` 안에 그린다.

`NextAdminRouter`는 관리자용 App Router 어댑터다. `next/link`와 `next/navigation` 위에 만든 `Link`·`navigate`·`replace`·`usePathname`·`useSearchParams`를 `@monti-cms/admin`에 주는 클라이언트 컴포넌트다. `CmsAdminPage`는 관리자의 서버 화면에 Next의 `redirect`와 `notFound`를 준다. 관리자 자체는 Next에서 아무것도 가져오지 않는다.

### GitHub 로그인

```ts
// cms.server.ts
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { githubAuth } from "@monti-cms/nextjs/auth";

export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		auth: githubAuth({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
			secret: process.env.AUTH_SECRET,
		}),
	}),
});
```

옵션·로그인 경로·호스트 신뢰·개발용 우회는 코어 README("서버 설정", "로그인 경로", "호스트 신뢰", "개발용 로그인 우회")에 있다. NextAuth(`next-auth`)는 로그인을 처음 쓸 때 불러오므로, 콘텐츠만 읽는 코드와 명령줄 도구는 불러오지 않는다. 이 연결은 코어가 호스트에 요구하는 두 가지를 채운다. 지금 요청의 헤더(`next/headers`)와, NextAuth의 리다이렉트를 Next까지 보내는 방법이다.

## 올리기

`@monti-cms/core/next`·`@monti-cms/core/server`·`@monti-cms/admin/next`에서 바뀐 import는 `@monti-cms/core` README의 "`@monti-cms/nextjs`로 올리기"를 본다.
