# @monti-cms/core

[English](README.md) | 한국어

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, MDX 변환, 관리자 API, 플러그인 연결을 맡는다.
관리자 화면은 `@monti-cms/admin`, AI 기능은 플러그인 `@monti-cms/ai`다. 다 붙인 예는 `examples/other-site`다.

## 빈 Next 앱에 설치

Next 16(App Router)·React 19·Tailwind CSS 4 앱 기준이다. 저장소는 Postgres만 지원한다. 순서는 `monti init` → 컬렉션 고치기 → `monti migrate`다.

### 1. 패키지

```sh
pnpm add @monti-cms/core @monti-cms/admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react lucide-react
pnpm add -D tw-animate-css @tailwindcss/typography
```

관리자 패키지와 AI 플러그인은 React Query·sonner·Tiptap·lucide 아이콘을 앱과 같은 하나로 써야 해서 앱이 설치한다(peer).
`next-auth`는 GitHub 로그인(`githubAuth`)을 쓸 때만 필요하다.
명령줄 `monti`는 `@monti-cms/core`에 들어 있다(TypeScript 설정 파일은 함께 설치되는 tsx가 읽는다).

pnpm 12는 허락하지 않은 설치 스크립트가 있으면 설치를 실패로 끝낸다(10은 경고만 한다). tsx가 쓰는 esbuild의 설치 스크립트를 허락한다.

```yaml
# pnpm-workspace.yaml (앱 폴더)
allowBuilds:
  esbuild: true
```

### 2. `monti init`

앱 폴더(`package.json`이 있는 곳)에서 돌린다. **있는 파일은 덮어쓰지 않고** "건너뛴 파일"로 알린다. 다시 돌려도 안전하다.

```sh
pnpm exec monti init                       # 관리자 화면 /admin, 영어(en), 시간대 UTC
pnpm exec monti init --admin-path /studio  # 관리자 화면 경로를 바꿀 때
pnpm exec monti init --locale ko --time-zone Asia/Seoul  # 사이트 기본 언어와 시간대를 정할 때
```

| 하는 일 | 파일 |
| --- | --- |
| 사이트 설정(컬렉션 하나짜리 시작점, 영어 이름표) | `cms.config.ts` |
| CMS 인스턴스와 서버 설정(DB·GitHub 로그인, 비밀 값은 환경 변수) | `cms.server.ts` |
| 관리자 화면 | `app/(admin)/admin/[[...path]]/page.tsx`·`layout.tsx` |
| 관리자 API와 로그인(`/api/cms/v1/*`·`/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| 설정 별칭 `@cms-config` | `tsconfig.json` `paths`에 더한다 |
| 관리자 스타일 줄 | 전역 CSS(`app/globals.css` 등)의 마지막 `@import` 다음에 더한다 |
| 설정 잇기(`withCms`) | `next.config.ts`(`export default nextConfig;` 한 줄인 기본 모양일 때), 없으면 만든다 |

`src/app`을 쓰는 앱이면 설정 파일을 `src/`에, 라우트를 `src/app/` 아래에 만든다. 안전하게 고칠 수 없는 파일(주석이 있는
`tsconfig.json`, 기본 모양이 아닌 next 설정, Tailwind 4가 없는 CSS)은 그대로 두고 넣을 내용을 "할 일"로 보인다.
끝에 설치할 패키지·환경 변수·GitHub 콜백 주소를 알려 준다.

`--admin-path`를 주면 라우트 폴더가 그 경로(`app/(admin)/studio/…`)가 되고 사이트 설정에 `admin: { path: "/studio" }`가
들어간다. **관리자 경로는 사이트 설정 `admin.path`와 라우트 폴더가 같아야 한다.** 나중에 바꿀 때도 둘을 함께 바꾼다.
관리자 API 경로(`/api/cms/v1`)는 바뀌지 않는다.

`--locale <코드>`는 사이트 기본 언어(`defaultLocale`)이고 기본값은 `en`이다(`ko`처럼 소문자 언어 코드). 관리자 화면의 언어와
날짜·숫자 표기가 이 언어를 따르고, 설정의 `admin.locale`로 따로 고를 수 있다. `--time-zone <시간대>`는 날짜·시각을 입력하고
보이는 시간대(IANA 이름, 기본 `UTC`)다. 만든 설정 파일과 명령줄 도움말·결과는 개발자가 읽으므로 영어다.

### 3. 컬렉션 고치기

`cms.config.ts`는 서버와 관리자 화면이 함께 읽는다. 비밀 값은 넣지 않는다. 만들어진 시작점은 이렇다.

```ts
import { defineCollection, defineConfig, fields } from "@monti-cms/core";

const post = defineCollection({
	label: "Post",
	kind: "document", // 본문·초안·발행. 태그 같은 작은 항목은 "item"
	path: "/posts/:slug", // 공개 주소. 본문 내부 링크·미리보기 주소에 쓴다
	icon: "file-text", // 관리자 사이드바 아이콘(lucide 이름)
	fields: {
		title: fields.text({ label: "Title", required: true, max: 200 }), // 제목 필드 이름은 `title`
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
		summary: fields.text({ label: "Summary", role: "summary", multiline: true, fillFromBody: true }),
	},
	// layout·list를 적지 않으면 필드 순서대로 그리고 기본 목록 컬럼을 쓴다("컬렉션").
});

export default defineConfig({
	collections: { post },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: { name: "My site" },
	timeZone: "UTC",
});
```

컬렉션 이름(`post`)은 DB에 저장되므로 운영 중에 바꾸지 않는다. 필드 규칙은 아래 "설정"을 본다.

`cms.server.ts`는 CMS 인스턴스를 만든다(`createCms({ server })`, "CMS 인스턴스" 절). 그 서버 설정은 저장소·미디어·로그인 연결과 비밀 값이고 서버에서만 읽힌다.
연결은 처음 쓸 때 만들어 빌드 중에는 환경 변수가 비어 있어도 된다. 이미지 올리기를 쓰려면 `@monti-cms/core/s3`의 저장소를 `media`에 더하고 AWS SDK를 설치한다
(`pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`, 미디어를 쓰는 사이트만):

```ts
import { r2Storage, s3Storage } from "@monti-cms/core/s3";

// Cloudflare R2
media: r2Storage({ endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
// AWS S3
media: s3Storage({ endpoint: "https://s3.ap-northeast-2.amazonaws.com", region: "ap-northeast-2", bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
// MinIO 등 경로 방식
media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true, bucket, accessKeyId, secretAccessKey, publicBaseUrl }),
```

다른 저장소는 `@monti-cms/core/server`의 `MediaStore` 계약을 구현한 `MediaAdapter`(`{ name, createStore() }`)를 넣는다.

### 4. 환경 변수와 `monti migrate`

`.env.local`에 둔다.

| 이름 | 뜻 |
| --- | --- |
| `CMS_DATABASE_URL` | Postgres 연결 주소 |
| `CMS_SCHEMA` | 선택. 스키마 이름(없으면 `public`). 이미 앱 표가 있는 DB에 붙일 때는 따로 두는 편이 안전하다. `monti migrate`가 없으면 만든다 |
| `AUTH_SECRET` | 임의의 긴 값. 로그인 세션 서명(`githubAuth({ secret })`) |
| `CMS_SECRET` | 임의의 긴 값(`AUTH_SECRET`과 다르게). 플러그인이 저장하는 값(AI 서비스 키)을 암호화할 때 바탕이 되는 마스터 비밀 값(서버 설정 `secret`). 바꿀 때는 옛 값을 `previousSecrets`에 남긴다("플러그인 비밀 값") |
| `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET` | GitHub OAuth 앱. 콜백 주소는 `<사이트 주소>/api/cms/auth/callback/github` |
| `CMS_ADMIN_GITHUB_ID` | 관리자 GitHub 숫자 ID |
| `CMS_DEV_AUTH_BYPASS` | 선택. `1`이면 `next dev`에서 내 컴퓨터가 보낸 요청은 로그인 없이 관리자("개발용 로그인 우회" 참고) |
| `AUTH_TRUST_HOST` | 선택. 서버가 `Host`·`X-Forwarded-Host`를 채워 주는 프록시 뒤나 플랫폼(Vercel, nginx, 로드 밸런서)에서 돌면 `true`("호스트 신뢰" 참고) |

```sh
pnpm exec monti migrate
```

표를 만들거나 최신 모양으로 맞춘다(플러그인 표 포함). 여러 번 돌려도 결과가 같고, 패키지를 올린 뒤에도 다시 돌린다.
본체 변경은 번호 붙은 단계로 `cms_migrations`에 남아 아직 돌지 않은 단계만 돌고(한 트랜잭션), 같은 스키마에 동시에 돌려도
하나씩 돈다. 플러그인은 한 번만 할 일을 `storage.once(이름, 단계)`로 맡긴다("플러그인 저장소").

- 환경 파일: 기본으로 `.env.local`·`.env`(있는 것만)를 읽는다. 셸에서 준 값이 이기고 앞 파일이 뒤 파일을 이긴다.
  `--env-file <파일>`(여러 번)로 고르고 `--no-env-file`이면 읽지 않는다.
- 파일: 사이트 설정은 `--config` → `CMS_CONFIG_PATH` → `tsconfig.json` `paths`의 `@cms-config` 별칭 → `./cms.config.ts`·`./src/cms.config.ts` 순서로 찾는다.
  서버 파일(인스턴스를 `cms`로 내보내는 모듈)은 `--server` → `CMS_SERVER_PATH` → `./cms.server.ts`·`./src/cms.server.ts` 순서다.
- 직접 만든 스크립트에서는 인스턴스를 불러와 부른다: `import { cms } from "./cms.server"; await cms.migrate(); await cms.close();`
  (`tsx --env-file=.env.local --import @monti-cms/core/register script.ts`로 돌린다. `@cms-config` 별칭을 이어 준다).

#### `monti content:rewrite`

```sh
pnpm exec monti content:rewrite           # 예행: 바뀔 것을 알려 주고 아무것도 쓰지 않는다
pnpm exec monti content:rewrite --apply   # 바뀐 내용을 쓴다
```

저장된 모든 본문(항목의 작업본·발행본, 본문 템플릿)을 저장된 문서에서 사이트에 설정된 문법으로 다시 써("저장된 본문" 절 참고), 저장 글이 한 표기가 되게 한다.
`directiveSyntax()`를 켜거나 끈 뒤, 또는 직렬화기를 올린 뒤에 글을 저장할 때마다 한 편씩 맞춰지길 기다리지 않고 한 번에 맞춘다. `monti migrate` 다음에 돌린다.
`migrate`와 같은 `--env-file`·`--no-env-file`·`--config`·`--server` 옵션을 받는다(스크립트에서는 `cms.rewrite({ apply })`).

- 본문마다 한 줄씩 `collection/slug (locale) state: changed|unchanged`를 찍고 요약을 보인다.
- 글자(문서가 없던 본문은 문서도)만 바뀐다. 내용 해시는 해석한 본문을 덮으므로 표기가 달라져도 같다. `version`·`updated_at`·`content_hash`는 건드리지 않고 "발행하지 않은 변경"도 그대로다.
  명령이 본문마다 이를 확인해서, 해시가 바뀔 본문은 쓰지 않고 건너뛴 채 알린다.
- 문서가 없고 깨끗하게 해석되지 않는(또는 머리말이 있는) 본문은 건너뛰고 알린다. 다시 쓴 본문의 검색용 글자는 새로 만들고, 참조 색인이 가진 위치(링크·이미지의 줄·칸)는 그 항목을 다음에 저장할 때 새로 잡힌다.
- 쓰기는 한 트랜잭션이고, 두 번째로 돌리면 바뀌는 것이 없다.

### 5. 실행

`next dev`로 띄우고 관리자 경로(기본 `/admin`)를 연다.

### 로그인 경로

GitHub 로그인 API는 기본으로 관리자 API 라우트가 함께 받는다(`/api/cms/auth/*`). 그래서 로그인 라우트 파일이 따로 없다.
예전처럼 `/api/auth/*`를 쓰는 앱(이미 등록한 OAuth 콜백 주소를 바꾸지 않으려는 앱)은 경로를 고르고 라우트 파일을 둔다.

```ts
// cms.server.ts
auth: githubAuth({ /* … */, basePath: "/api/auth" }),

// app/api/auth/[...nextauth]/route.ts
import { cms } from "../../../../cms.server";
export const { GET, POST } = cms.authHandlers;
```

`basePath`가 기본값이 아니면 관리자 API 라우트는 `/api/cms/auth/*`를 받지 않는다(404).

### 선택 의존성

CMS 패키지의 선택 의존성(예: 블록 확장의 `mermaid`·`recharts`)은 그 기능을 쓸 때만 설치한다. 설치하지 않은 것은 `withCms`가
빈 모듈(`@monti-cms/core/stubs/missing-optional`)로 이어 빌드가 멈추지 않게 하고, 그 기능을 쓰면 설치하라는 오류가 난다.
설치한 뒤에는 개발 서버를 다시 띄운다.

### 직접 잇기 (`monti init` 없이)

`monti init`이 하는 일을 손으로 하려면: 사이트 설정과 서버 파일(인스턴스)을 만들고, `next.config.ts`를
`withCms(nextConfig, { config: "./cms.config.ts" })`로 감싸고, `tsconfig.json` `paths`에
`"@cms-config": ["./cms.config.ts"]`를 더하고(테스트(Vitest)를 쓰면 `resolve.alias`에도),
위 표의 라우트 파일 셋을 두고(각 파일이 서버 파일에서 `cms`를 불러온다), 전역 CSS에 아래 줄을 넣는다.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@monti-cms/admin/styles.css"; /* `cms-*` 색과 `cms-dark`·`cms-horizontal`·`cms-vertical` 변형을 정한다(앱의 이름과 겹치지 않는다). Tailwind 4가 필요하다 */
@plugin "@tailwindcss/typography";
```

### 블록 확장 (선택)

```sh
pnpm add @monti-cms/blocks
```

```ts
// cms.config.ts
import { blocks } from "@monti-cms/blocks";

export default defineConfig({
	// …
	plugins: [...blocks()], // 전부. 고르려면 blocks({ only: ["callout", "tooltip"] }), 하나씩은 callout()·tabs()…
});
```

```css
@import "@monti-cms/blocks/styles.css"; /* 관리자 패키지 스타일 다음 */
```

자세한 것은 `@monti-cms/blocks`의 README.

### AI 플러그인 (선택)

```sh
pnpm add @monti-cms/ai
```

```ts
// cms.config.ts
import { aiPlugin } from "@monti-cms/ai";

export default defineConfig({
	// …
	// 기본 기능(주소·요약·태그 추천 등)이 필드 종류·역할·관계 대상으로 저절로 붙는다. 바꾸거나 끌 것만 `actions`에 적는다.
	plugins: [aiPlugin({ siteDescription: "기술 블로그" })],
});
```

```css
@import "@monti-cms/ai/styles.css"; /* 관리자 패키지 스타일 다음 */
```

자세한 것은 `@monti-cms/ai`의 README.

### SEO 확장 (선택)

```sh
pnpm add @monti-cms/seo
```

```ts
// cms.config.ts
import { seo, seoFields } from "@monti-cms/seo";

const article = defineCollection({
	// …
	fields: { title, slug, ...seoFields() }, // 검색 제목·설명·공유 이미지·숨기기·원본 주소 + 미리보기, 모두 SEO 탭
});

export default defineConfig({
	// …
	plugins: [seo()],
});
```

자세한 것은 `@monti-cms/seo`의 README.

## CMS 인스턴스

`createCms({ server })`(`@monti-cms/core/server`)는 서버 설정을 서버의 모든 곳이 쓰는 인스턴스로 만든다. 인스턴스가 콘텐츠 저장소·서비스·미디어 저장소·로그인 연결·
플러그인 서버 모듈·쓰기 훅·비밀 값을 가진다. 전역 상태는 없어서, 서버 설정이 다른 인스턴스 둘이 한 프로세스에 나란히 있을 수 있다(테스트·스크립트·DB 여러 개).
연결은 처음 쓸 때 만들므로 import나 빌드 때 인스턴스를 만들어도 어디에도 연결하지 않는다.

```ts
// cms.server.ts
import { createCms, defineServerConfig, githubAuth, postgres } from "@monti-cms/core/server";

export const cms = createCms({
	server: defineServerConfig({ database: postgres({ /* … */ }), auth: githubAuth({ /* … */ }) }),
});
```

나머지는 모두 이 파일에서 `cms`를 불러다 쓴다.

| 어디서 | 코드 |
| --- | --- |
| 관리자 API 라우트(`app/api/cms/[...path]/route.ts`) | `export const { GET, POST, PATCH, PUT, DELETE } = cms.routeHandler();` (`cms.handle(request)`의 Next 어댑터) |
| Next가 아닌 호스트의 관리자 API(실험적) | `cms.handle(request)`: 표준 `Request`를 받아 `Response`를 돌려준다 |
| 관리자 레이아웃·페이지 | `<CmsAdminLayout cms={cms}>…</CmsAdminLayout>`, `<CmsAdminPage cms={cms} {...props} />` |
| 사이트 페이지(서버 컴포넌트·sitemap·RSS) | `cms.read.getEntry(…)`·`cms.read.listEntries(…)`·`cms.read.getTranslations(…)`·`cms.read.getPreview(…)` |
| 공개 미디어 | `cms.read.imageResolver(mdx)`(`renderMdx`의 `imageResolver`), `cms.read.mediaUrl(mediaId)` |
| 저장소·설정 | `cms.store()`·`cms.contentService()`·`cms.bulkService()`·`cms.mediaStore()`·`cms.storage(플러그인이름)`·`cms.secrets(플러그인이름)`·`cms.auth()`·`cms.authGateway`·`cms.authHandlers`·`cms.isMediaConfigured` |
| 스크립트·명령줄 | `cms.migrate()`·`cms.rewrite({ apply })`·`cms.close()` |
| 플러그인 라우트 | `adminRoute(async ({ request, params, auth, cms }) => …)`: 라우트는 자신을 맡은 인스턴스를 받는다 |
| 테스트 | `@monti-cms/core/testing`의 `fakeCms({ store, verifyAdmin, … })`: 테스트가 준 부품 위에 만든 진짜 인스턴스 |

HTTP 계층은 표준 웹 `Request`와 `Response`로 동작한다.
관리자 API, 로그인 연결, 공개 API, 플러그인 라우트에는 `NextRequest`, `NextResponse`, `request.nextUrl`을 쓰지 않는다.
`cms.handle(request)`가 요청 하나를 처리하고(`/api/cms/` 뒤의 경로는 URL에서 읽는다), `cms.routeHandler()`는 그 위에 얹은 얇은 Next 어댑터다.
플러그인 라우트(`adminRoute`)는 표준 `Request`를 받는다. 쿼리는 `new URL(request.url).searchParams`로 읽고, 응답은 `Response.json(…)`으로 만든다.
Next가 아닌 호스트에서 `handle`을 쓰는 것은 실험적이다. 관리자 화면, 로그인 연결(Auth.js), 관리자 확인은 아직 Next의 요청 컨텍스트를 읽으므로, 지금은 API 라우트만 호스트에 묶이지 않는다.

읽기 API는 인스턴스에 달려 있다(`getEntry(cms, …)`가 아니라 `cms.read.getEntry(…)`). 사이트 코드가 하나만 불러오면 되고, 타입(`MetadataFor` 등)은 `@monti-cms/core/read`에 남는다.

**개발 중 다시 불러오기.** `next dev`는 고친 뒤 `cms.server.ts`를 다시 실행하고, 그러면 `createCms`가 또 불린다. 새 DB 어댑터가 연결 풀을 하나 더 열고 앞의 것은 닫지 않는다.
그래서 개발 중(`NODE_ENV=development`)에만, 같은 `id`(기본 `"default"`)로 먼저 만든 인스턴스의 DB 어댑터(와 미디어 저장소)를 새 인스턴스가 다시 쓴다.
`globalThis`의 `Symbol.for("monti.cms.dev-connections")` 항목 하나에 둔다. 나머지(저장소·서비스·로그인 연결·플러그인·훅·비밀 값)는 새 서버 설정으로 다시 만들어서 훅과 옵션을 고치면 바로 반영된다.
DB 연결 자체를 바꾸는 것은 다시 시작해야 한다. 운영과 테스트에는 이런 캐시가 없고 인스턴스가 자기 연결만 가진다. 개발 프로세스 하나에서 인스턴스를 둘 이상 만들면 각각 `id`를 준다: `createCms({ id: "reports", server })`.

**사이트 설정은 아직 `@cms-config` 별칭으로 읽는다.** 사이트 설정(컬렉션·언어·플러그인·블록)은 당분간 `@cms-config` 별칭으로 이어서, 한 프로세스에 사이트 설정은 하나다. `createCms`는 서버 쪽만 받는다.

### `@cms-server` 별칭에서 올리기

- `cms.server.ts`는 더 이상 서버 설정을 default로 내보내지 않는다. 감싼다: `export const cms = createCms({ server: defineServerConfig({ … }) })`(`createCms`는 `@monti-cms/core/server`에 있다).
- `tsconfig.json` `paths`와 Vitest `resolve.alias`에서 `"@cms-server"`를 지운다. `withCms(nextConfig, { config })`는 `server` 옵션을 받지 않는다.
- 플러그인 라우트와 직접 만든 관리자 라우트는 `NextRequest` 대신 표준 `Request`를 받는다. `request.nextUrl`은 `new URL(request.url)`로, `NextResponse.json`은 `Response.json`으로 바꾼다. `CmsRouteHandler`는 `@monti-cms/core/next`로 옮겼고 `createRouteHandler`는 `cms.handle()`로 대체됐다.
- 관리자 API 라우트는 `cms.routeHandler()`다. `createCmsRouteHandler`와 `@monti-cms/core/next/route-handler` 진입점은 없어졌다.
- 관리자에 인스턴스를 넘긴다: `<CmsAdminLayout cms={cms}>`, `<CmsAdminPage cms={cms} {...props} />`(페이지 파일이 작은 컴포넌트가 된다. 모양은 `monti init`이 보여 준다).
- 사이트 페이지는 `@monti-cms/core/read`의 자유 함수 대신 `cms.read.*`로 읽는다. `createPublicImageResolver(mdx)`는 `cms.read.imageResolver(mdx)`, `resolvePublicMediaUrl(id)`는 `cms.read.mediaUrl(id)`가 대신한다.
- 없어진 것: `getCmsContentStore`·`getCmsMediaStore`·`getCmsSecret`·`getCmsDatabase`·`loadServerPlugins`와 `@monti-cms/core/runtime`의 로그인 자유 함수(`authGateway`·`auth`·`signIn`·`signOut`·`handlers`·`isDevAuthBypassEnabled` 등). 인스턴스를 쓴다:
  `cms.store()`·`cms.mediaStore()`·`cms.secrets(플러그인이름)`·`cms.storage(플러그인이름)`·`cms.plugins()`·`cms.auth()`·`cms.authGateway`·`cms.authHandlers`.
  마스터 비밀 값 자체를 내주는 길은 이제 없다(`cms.secret`과 `cms.server.secret`도 없어졌다). "플러그인 비밀 값"을 본다.
  플러그인 라우트는 핸들러 입력으로 `cms`를 받고, `CmsServerPlugin.features(cms)`와 `migrate(storage, cms)`는 인자로 받고, 훅은 직접 만든 `cms`를 클로저로 쓴다.
- `@monti-cms/core/migrate`는 없어졌다: `monti migrate`를 돌리거나 스크립트에서 `await cms.migrate()`를 쓴다. `monti migrate`와 `monti content:rewrite`는 이제 서버 파일을 불러오므로 그 파일이 `cms`를 내보내야 한다.
  `@monti-cms/core/register`는 `@cms-config` 별칭만 잇는다.
- 로그인·로그아웃은 서버 액션이 아니라 `/api/cms/v1/session/*`로 보내는 일반 폼 전송이다(서버 액션은 인스턴스를 실을 수 없다). 앱에서 바꿀 것은 없다.

### `cms.database()`를 쓰던 플러그인 올리기

- `cms.database()`·`PluginDatabase`(`pool`과 `once` 포함)·`withTransaction`은 `@monti-cms/core`와 `@monti-cms/core/plugin/server`에서 없어졌다. 플러그인은 데이터를 `cms.storage("<플러그인 이름>")`에 두고("플러그인 저장소") `migrate(db, cms)`는 `migrate(storage, cms)`가 된다.
- 자기 표를 만들던 플러그인은 그 데이터를 한 번 옮겨야 한다. `storage.once(이름, 단계)` 안에서 `migration.readLegacyTable(표)`과 `migration.importItem(...)`으로 옮긴다. 옛 표는 읽기만 하므로 백업으로 남는다. AI 플러그인이 이렇게 했다(그 README를 본다).
- 배포할 때 `monti migrate`를 돌린다. `plugin_documents` 표를 만들고 AI 플러그인의 데이터를 옮긴다. 옛 버전 인스턴스는 계속 옛 AI 표에 쓰므로 한꺼번에 바꾼다.
- `createContentLookup(cms.database())`는 `createContentLookup(cms)`다. `createContentStore`와 `migrateContentStore`는 더 이상 `@monti-cms/core/runtime`에서 내보내지 않는다. 테스트는 `@monti-cms/core/testing`에서 가져온다.
- `Entry`·`ListEntriesParams`·`CmsError` 같은 타입은 전과 같이 `@monti-cms/core/runtime`에서 온다. 정의는 Postgres 어댑터가 아니라 `src/core/store`에 있다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/core` | `cms.config.ts` | `defineConfig`·`defineCollection`·`fields`·`defineBlock`·`definePlugin` |
| `@monti-cms/core/server` | `cms.server.ts` | `createCms`·`defineServerConfig`·`postgres`·`githubAuth`, 저장소 계약 타입(`MediaStore` 등). 저장소 모듈은 처음 쓸 때 불러온다 |
| `@monti-cms/core/s3` | `cms.server.ts` | `r2Storage`·`s3Storage`(S3 API 미디어 저장소, AWS SDK 선택 의존성) |
| `@monti-cms/core/next` | `next.config.ts` | `withCms` |
| `@monti-cms/core/render` | 공개 화면(서버 컴포넌트) | `renderMdx(mdx, options)` → `{ content, toc }`. 사이트 CSS에 `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | 공개 화면(타입) | `ReadEntry`·`MetadataFor` 등 `cms.read`의 타입. `cms.read`가 공개본을 읽는다(`getEntry`·`listEntries`·`getTranslations`·`getPreview`: 관계·주소·옛 주소 이동·원문 대체) |
| `@monti-cms/core/runtime` | 서버 코드(크론 스크립트·사이트 테스트 포함) | 저장소·서비스 타입, 로그인 타입, 스냅샷 도우미. `server-only`를 쓰지 않아 Next 밖에서도 불러온다(`tsx --import @monti-cms/core/register`) |
| `@monti-cms/core/client` | 화면 코드 | API 모양·컬렉션·언어·주소·블록·스키마 도우미 |
| `@monti-cms/core/mdx`·`/code-block` | 공개 렌더러·편집기 | MDX 해석·직렬화, 코드 블록 주석 모델 |
| `@monti-cms/core/syntax`(실험적) | `cms.config.ts`, 문법 확장 패키지 | `SyntaxExtension` 인터페이스와 확장이 쓰는 도우미("본문 문법"). 지시자 표기는 `@monti-cms/syntax-directive`다 |
| `@monti-cms/core/plugin/server` | 플러그인 서버 쪽 | 라우트 틀(`adminRoute`가 라우트에 `cms` 인스턴스를 넘긴다)·`Cms` 타입·오류 |
| `monti`(명령줄, 패키지 `bin`) | 터미널 | `monti init`(파일 만들기)·`monti migrate`(표 만들기)·`monti content:rewrite`(저장된 본문 다시 직렬화) |
| `@monti-cms/core/cli` | 명령줄 도구 | `runCli`·`initProject`·`migrate`·`contentRewrite`(명령 `monti`의 코드) |
| `@monti-cms/core/register` | 직접 만든 스크립트 | `tsx --import`로 돌리는 스크립트에서 `@cms-config` 별칭 잇기 |
| `@monti-cms/core/testing` | 테스트 | `fakeCms`(테스트가 준 부품 위의 인스턴스)·격리 스키마 DB·예시 데이터, 주어진 확장 목록으로 MDX를 해석하는 함수와 remark 플러그인(`parseMdxAst`·`syntaxRemarkPlugins`) |

## 패키지 빌드

저장소 안에서는 소스(`src`)를 바로 쓴다. 배포 묶음은 `pnpm build:packages`로 `dist`를 만들고 `pnpm pack`이
`publishConfig.exports`(dist)로 묶는다. `pnpm example:pack`은 묶음을 `examples/other-site/vendor`에 넣는다.

## 본문 문법

저장하는 MDX는 **CommonMark + GFM + 표준 MDX JSX**다. 그 밖의 표기는 선택해서 켜는 *문법 확장*이 맡고, 확장은 한 표기의 읽기와 쓰기를 함께 제공한다.
한 가지 뜻에는 저장 표기가 하나다. 다른 표기도 읽을 때는 받아들이고, 저장할 때 바꿔 쓴다.

확장이 없을 때 기본으로 쓰는 표기:

| 뜻 | 저장 표기 |
| --- | --- |
| 줄바꿈 | `<br />`(문단에서는 뒤에 줄을 바꿔 `줄<br />` + 줄바꿈 + `다음`). `\` + 줄바꿈, 줄 끝 공백 두 칸, `<br />`을 모두 읽고 이렇게 쓴다. 문단 안의 줄바꿈 한 번은 공개 화면과 편집기 모두에서 공백일 뿐이다(CommonMark) |
| 빈 줄(편집기에서 블록 사이에 Enter를 눌러 만든 줄) | `<br />`만 있는 줄, 빈 문단 하나에 한 줄씩 순서대로. 문서 노드로는 빈 `paragraph`다. 본문 맨 끝의 빈 줄은 저장하지 않는다 |
| 밑줄·위 첨자·아래 첨자·번역 안내 | `<u>`·`<sup>`·`<sub>`·`<Untranslated>` |
| 글 정렬 | `<TextAlign align="center">` |
| 셀 병합·열 너비·GFM이 아닌 머리글이 있는 표 | `<Table>`·`<TableRow>`·`<TableCell colspan="2">`(나머지 표는 GFM) |
| 미디어 이미지, 또는 크기·정렬·캡션·자르기·회전·장식 표시가 있는 이미지 | `<Image mediaId="…" />`(바깥 주소의 보통 이미지는 `![대체글](주소 "제목")` 그대로) |
| 파일 카드 | `<File mediaId="…" />` |
| 컨테이너·리프 블록(콜아웃·탭·단·사이트 블록) | `<컴포넌트 속성>` … `</컴포넌트>`. 불리언은 참일 때 이름만 쓰고 거짓이면 생략한다 |
| 글자 꾸밈(툴팁·코드 연결·글자색·사이트 글자 블록) | `<컴포넌트 속성>글자</컴포넌트>` |

문단 안의 줄바꿈 한 번이 줄바꿈으로 보이던 때 쓴 글이 같은 모습을 유지하도록, 마이그레이션 `0012_soft_line_endings`(`monti migrate`가 실행)가 문단 글에서 그런 줄 끝마다 `<br />`을 써 넣는다.
대상은 작업본·발행본 본문, 번역의 기준 원문, 템플릿이다. 저장된 문자열을 파서가 알려 주는 위치에서만 고치며(코드·수식·표·속성·표현식은 건드리지 않고, 파싱되지 않는 본문은 그대로 두고 알린다) 다른 글자는 바뀌지 않는다.

표기를 더하려면 `mdx.syntax`에 확장을 나열한다. 순서가 쓰기 우선순위다.

```ts
import { directiveSyntax } from "@monti-cms/syntax-directive";

export default defineConfig({
	// …
	mdx: { syntax: [directiveSyntax()] },
});
```

- [`@monti-cms/syntax-directive`](../syntax-directive/README.ko.md)는 표준 MDX 이전에 Monti가 쓰던 지시자(`:::callout{…}`·`::image{…}`·`:u[글자]`·`::::table`)를 읽고 쓴다. 없으면 `:::callout`은 그냥 글자다.
  `directiveSyntax({ write: false })`는 지시자를 읽기만 하고 표준 MDX로 저장하므로, 글을 저장할 때마다 한 편씩 옮겨 가게 된다(`monti content:rewrite --apply`로 한 번에 옮길 수도 있다). 줄바꿈은 `:br[]`로 쓰지 않는다.
- [`@monti-cms/syntax-shiki`](../syntax-shiki/README.ko.md)는 코드 펜스의 Shiki 코드 표기(`// [!code ++]`·`[!code highlight]`·`[!code focus]`, `[!code ++:3]` 같은 개수)를 읽어 Monti 코드 주석(`// @line plus`)으로 바꾼다. 읽기만 하며 본문은 언제나 Monti 주석으로 쓴다.
- 공개 렌더러(`@monti-cms/core/render`)는 편집기 해석기와 같은 플러그인을 돌리므로 편집기가 읽은 대로 사이트에 그려진다.

**지시자 본문이 있는 사이트의 업그레이드.** 이 버전을 배포하기 전에 `@monti-cms/syntax-directive`를 설치하고 `mdx.syntax`에 `directiveSyntax({ write: false })`(지시자로 계속 저장하려면 `directiveSyntax()`)를 넣는다.
`directiveSyntax`는 더 이상 `@monti-cms/core/syntax`에서 내보내지 않으니 import를 `@monti-cms/syntax-directive`로 바꾼다.
확장이 없으면 기존 글이 지시자 문자 그대로 그려지고 검사에도 걸린다(`:::callout{…}`의 `{…}`를 표현식으로 읽는다). `write: false`로 두면 글을 표준 표기로 저장해도 내용 해시(해석한 본문을 해시한다)는 바뀌지 않는다.
저장된 본문 어디에도 지시자가 남지 않으면 확장을 뺀다.

#### 저장된 본문

모든 본문(항목의 작업본·발행본, 번역이 확인한 기준 원문, 본문 템플릿)은 버전이 있는 **문서**(`entry_bodies.doc`·`body_templates.doc`, 해석한 본문을 JSON으로 담은 것)와 **그 문서에서 써 낸 MDX**를 함께 저장한다.
문서가 원본이고 MDX는 그 글이므로, 저장하면 표기가 정규화된다. 같은 내용은 어떤 표기로 입력했든 늘 같은 글이 된다(`제목` + `=====`와 `# 제목`은 둘 다 `# 제목`으로 저장). 이미 가진 내용을 다른 표기로 저장하면 아무것도 바뀌지 않는다(새 버전도 생기지 않는다).
편집기의 소스 모드는 보조 수단이다. 입력한 글은 저장할 때 해석되어 사이트의 표기로 다시 쓰인다.
해석되지 않거나 머리말이 있는 본문은 문서가 없고 받은 그대로 저장된다(초안만 그럴 수 있다).

**코드 블록.** 코드 블록은 주석을 뺀 코드와 데이터로 둔 주석(줄 효과, 글자 효과, 정규식 규칙)으로 저장하고, MDX로 쓸 때는 Monti 주석으로 되돌려 쓴다. MDX를 읽는 다른 도구에서도 주석이 그대로 보인다.
`monti migrate`는 `0015_code_annotations` 단계를 실행해 기존 문서(번역이 확인한 기준 문서 포함)를 바꾸고, 코드 펜스의 주석을 정해진 한 모양으로 다시 쓴다(`// @line plus`는 `// @line plus {0-0}`이 되고, 코드 전체에 걸리는 규칙은 맨 위로 간다). 내용 해시와 검색용 글자(이제 주석을 담지 않는다)는 새로 만들며, `version`과 `updated_at`은 그대로다.

**블록 ID.** 문서의 모든 블록은 본문 안에서 유일한 `id`(소문자 영숫자 8자)를 가진다. 블록 ID는 버전이 달라져도 어느 블록이 어느 블록인지 알려 주는 값이며, MDX에는 쓰이지 않고 콘텐츠 해시에도 들어가지 않으므로 변경으로 취급되지 않는다.
MDX로 저장한 본문은 바꾸기 전 버전에서 ID를 물려받는다. 똑같이 읽히는 블록은 ID를 그대로 가지고, 수정한 블록, 둘로 나눈 블록, 옮긴 블록도 마찬가지다(나눈 문단은 앞부분이 ID를 가진다). 짝이 없는 블록은 새 ID를 받고, API로 보낸 문서는 담고 있는 ID를 그대로 유지한다.
`monti migrate`는 `0014_block_ids` 단계를 실행해 기존 문서에 ID를 달아 준다(발행본은 작업본과 공통인 블록의 ID를 함께 쓴다). 바뀌는 것은 `doc`뿐이며 MDX, 해시, `version`, `updated_at`은 그대로다.
관리자 편집기는 편집하는 동안 블록마다 ID를 유지하고, 저장할 때 MDX 대신 문서를 보내므로 블록 ID가 정확히 유지된다. 편집기가 쓰지 않은 글(소스 모드, 템플릿)은 MDX로 저장되고 위와 같이 짝지어진다.
관리자는 이 ID로 블록을 가리킨다. 발행 검증 문제와 참조 위치는 해당 블록을 알려 주고(`line`, `column` 옆의 `position.blockId`) 시각 편집기에서 그 블록으로 이동한다. 번역 화면은 번역할 때 확인한 원문과 지금 원문을 블록 단위로 비교하며, 자리만 옮긴 블록은 이동으로 보여 준다. AI 번역은 번역할 블록을 ID로 찾는다.

**업그레이드.** `monti migrate`를 돌리기 전에 `mdx.syntax`를 사이트가 쓰려는 대로 맞춰 둔다. `monti migrate`는 `0013_stored_documents` 단계를 실행한다. `doc` 열을 더하고, 기존 본문마다 문서를 만들어 주고, **MDX를 사이트의 표기로 다시 쓴다**(많은 본문의 저장 글이 한꺼번에 바뀐다. `version`과 `updated_at`은 그대로다).
해석되지 않거나, 머리말이 있거나, 다시 읽었을 때 같지 않은 본문은 문서 없이 그대로 두고 하나씩 로그에 남긴다(`[monti] no stored document for …`). 먼저 데이터베이스를 백업하고, 실행한 뒤 로그를 확인한다.
`monti content:rewrite`는 이제 문서에서 다시 쓰고, 문서가 없던 본문은 해석되면 문서를 만들어 준다.

- **관리자 항목 API.** `POST /api/cms/v1/entries`와 `PATCH /api/cms/v1/entries/:id`는 `mdx` 대신 `doc`(항목의 `working.doc`·`published.doc`로 읽은 문서 JSON)을 받는다. 둘을 함께 보내거나 올바른 저장 문서가 아닌 값을 보내면 `400 invalid_input`이다. 둘 다 없으면 새 항목은 빈 본문이고, 패치는 지금 본문을 그대로 둔다.
  읽은 `doc`을 그대로 되돌려 보내면 아무것도 바뀌지 않는다. `GET /api/cms/v1/meta`는 크기 한도를 `limits.mdxBytes` 옆에 `limits.docBytes`로 알려 준다. 템플릿 API는 계속 `mdx`만 받고, 템플릿마다 `doc`을 돌려준다.
- **관리자 내보내기**(`GET /api/cms/v1/export`)는 형식 버전 2다. 문서가 있는 본문에는 `working.mdx`·`published.mdx` 옆에 `working.doc.json`·`published.doc.json`이 있고, `templates.json` 항목에 `doc`이 있으며, 다이제스트가 문서를 포함한다.
- **공개 읽기 API와 공개 내보내기**는 그대로다. MDX만 있고 `doc`은 없다(공개 내보내기는 새 `formatVersion` 값만 달라진다).

### 문법 확장 만들기(실험적)

`@monti-cms/core/syntax`는 실험적이라 마이너 버전에서 바뀔 수 있다.

```ts
interface SyntaxExtension {
	name: string;
	/** 읽기: remark 플러그인(또는 사이트 블록을 받아 플러그인을 돌려주는 함수). 공개 렌더 체인에도 들어간다. */
	remarkPlugins?: PluggableList | ((context: SyntaxContext) => PluggableList);
	/** CmsNode → MDX. 키는 노드 타입(또는 블록의 렌더러 이름), "*"는 나머지. undefined를 돌려주면 다음 확장, 그다음 표준 직렬화기로 넘어간다. */
	fromDocument?: Record<string, (node: CmsNode, context: SerializeContext) => string | undefined>;
	/** 이 확장이 쓰는 마크. 키는 마크 타입이고 넘김 규칙은 같다. `inner`는 이미 쓴 안쪽 내용이다. */
	fromMark?: Record<string, (mark: CmsMark, inner: string, context: SerializeContext) => string | undefined>;
	/** 본문 글자가 이 문법으로 읽히지 않게 이스케이프한다(예: `\:name`). */
	escapeText?: (text: string, context: SerializeContext) => string;
}
```

`SyntaxContext`는 사이트 블록(`blocks.list`·`blocks.byName`·`blocks.byComponent`)과 코드 블록 줄 효과 이름(`codeLineEffects`)을 준다. `SerializeContext`는 여기에 `indent`(노드가 시작하는 줄의 들여쓰기이며 쓰는 쪽이 직접 넣는다),
자식을 쓰는 `serializeBlocks`·`serializeInlines`, `componentName`, `hasSpread`, 표준 표기가 쓰는 속성 목록을 만드는 `nodeAttributes`·`markAttributes`, `escapeAttribute`를 더한다.
줄바꿈은 언제나 `<br />`라서 확장에 넘기지 않는다. `image` 노드는 Markdown으로 쓸 수 없을 때만 넘긴다. 지시자 확장(`packages/syntax-directive`)이 참고 구현이며 `@monti-cms/core/syntax`에서만 가져온다.
이 진입점은 Monti 코드 주석이 쓰는 코드 주석 문법 도우미(`resolveCommentSyntax`·`formatAnnotationComment`)도 내보내므로, 코드 주석을 읽거나 쓰는 확장(`packages/syntax-shiki`)이 쓴다.

## 본문 블록

본체에는 다른 기능이 기대거나 Markdown 문법인 블록(이미지·파일·표·수식·정렬, 밑줄·위아래 첨자·줄바꿈·번역 안내)만 있다.
콜아웃·접기·탭·단·Mermaid·차트와 글자 꾸밈(툴팁·코드 연결·글자색)은 블록 확장 `@monti-cms/blocks`에서 필요한 것만
플러그인으로 설치한다.

```ts
import { blocks } from "@monti-cms/blocks";

plugins: [...blocks({ only: ["callout", "mermaid", "tooltip"] })],
```

사이트가 직접 만든 블록은 설정의 `blocks`에 넣는다. 블록 확장도 같은 정의(`definePlugin({ blocks })`)로 블록을 더한다.

```ts
import { defineBlock } from "@monti-cms/core";

blocks: [
	defineBlock({
		name: "notice", // <Notice level="warn"> … </Notice>로 저장
		label: "공지",
		syntax: { kind: "container", directive: "notice" },
		component: "Notice", // 공개 화면은 사이트의 MDX 컴포넌트 표에서 이 이름으로 그린다
		attributes: {
			level: { type: "string", label: "단계", options: { info: "안내", warn: "주의" }, defaultValue: "info" },
			title: { type: "string", label: "제목", translatable: true }, // 번역 화면이 머리 줄로 따로 번역한다
		},
		translateInside: true, // 번역 화면이 상자를 펼쳐 안쪽 블록을 하나씩 번역한다
		editor: {
			view: "node", // "opaque"면 편집기에서 원문 상자로 보인다
			insertable: true,
			icon: "message-square", // 슬래시·컴포넌트 메뉴 아이콘(lucide 이름)
			insert: { values: { level: "warn" }, text: "내용" }, // 넣을 때 처음 값
		},
	}),
	defineBlock({
		name: "graphviz", // 저장 문법 ```graphviz … ```
		label: "Graphviz",
		syntax: { kind: "fence", lang: "graphviz" },
		component: "Graphviz", // 공개 화면은 remarkFenceBlocksToMdx가 <Graphviz source="…" />로 바꾼다
		attributes: {},
		editor: { view: "node", insertable: true, insert: { code: "digraph { a -> b }" }, placeholder: "Graphviz 코드를 입력하세요" },
	}),
],
```

- 더할 수 있는 블록은 요소 블록(`container`·`leaf`. `component` 이름의 MDX JSX 요소로 저장하며, 지시자 확장을 쓰면 지시자로도 저장한다. 이때 `directive`가 지시자 이름이다), 글자 꾸밈(`text` + `editor.view: "mark"`), 코드 펜스 블록(`fence`)이다.
  코드 펜스 블록은 그 언어의 코드 펜스를 모두 가져가므로 일반 코드 언어 이름(`ts` 등)을 쓰지 않는다.
- 글자 꾸밈은 `<컴포넌트 속성>글자</컴포넌트>`로 저장한다(지시자 확장을 쓰면 `:이름[글자]{속성}`). 속성은 정의 순서대로 쓰고, 꼭 있어야 하는 속성(`required`)은 비어도, 나머지는
  값이 있을 때만 쓴다. 겹친 꾸밈은 더한 순서(바깥부터)로 저장한다. 편집기 표시는 관리자 패키지가 정의에서 만들고, 모양·서식
  도구·버블·슬래시 메뉴는 확장이 관리자 화면에 등록한다(`@monti-cms/admin` README의 "글자 꾸밈"). 속성에 `codeAnchor: true`를
  달면 그 값이 코드 블록 줄 이름표(`anchor` 줄 효과)이고, 편집기의 본문–코드 잇기가 이 꾸밈을 쓴다(사이트에 하나만).
- 속성의 선택 값·필수 값·자식 값(`childValue`, 예: 처음 열 탭은 탭 이름 중 하나)과 자식 개수(`children.min`·`max`)는
  발행 전에 검사한다.
- 쓰던 블록을 빼면 저장 문법에서 빠진다. 이미 그 블록을 쓴 본문은 다시 저장할 때 일반 글로 바뀌므로 쓰던 블록은 빼지 않는다.
- 본문을 담는 컨테이너는 슬래시 메뉴로 넣으면 빈 문단으로 시작한다. `editor.insert.codeBlocks`(`[{ language, title?, code? }]`)를 주면 그 코드 블록들로 시작하며, `title`은 코드 펜스의 `title` 메타다(코드 탐색기가 `src/index.ts` 파일 하나로 시작하는 데 쓴다).
- 편집기 노드는 관리자 패키지가 정의에서 만든다. 편집 모양은 관리자 패키지의 `blockViews`(모든 블록의 화면 전체,
  `useBlockEditor`와 `Content`로 만든다)로 바꾸고, 코드 펜스 블록의 미리보기는 `fencePreviews`로 넣는다.
- 공개 화면의 코드 펜스 블록은 `@monti-cms/core/mdx`의 `remarkFenceBlocksToMdx`를 렌더 체인(문법 확장의 플러그인 뒤)에 넣어
  `component`로 그린다.
- 번역 구조 검사(`compareStructure`)는 `translatable` 속성과, 그 값을 가리키는 `childValue` 속성(예: 처음 열 탭)만 번역에서
  바뀌어도 된다고 본다. 사람이 읽는 속성(제목·설명 등)에는 `translatable: true`를 단다.
- `editor.icon`이 관리자 패키지의 기본 아이콘에 없는 이름이면 관리자 화면에 아이콘을 등록한다(`@monti-cms/admin` README).

### 코드 블록 줄 효과

코드 블록 줄 효과(`// @line 이름 {0-2}`)의 기본은 강조·포커스·추가·삭제·경고·오류다. 포커스(`// @line focus`)는 독자가 코드에 마우스를 올리거나
키보드 포커스를 옮기기 전까지 블록의 나머지 줄을 흐리게 한다(`render.css`의 `.code-focus`). 본문이 `:code-ref`로 가리키는 줄은 늘 선명하다.
설정의 `codeBlock.lineEffects`로 더하고, 같은 이름을 적으면 기본을 바꾼다.

```ts
codeBlock: {
	lineEffects: [
		{
			name: "info", // 주석 이름(소문자 케밥). collapse·anchor와 글자 효과 이름은 쓸 수 없다
			label: "정보", // 줄 효과 메뉴 이름
			icon: "star", // 메뉴 아이콘(lucide 이름, 관리자 화면에 등록된 이름)
			class: "bg-primary/10", // 공개 화면이 그 줄에 붙이는 클래스(사이트 Tailwind가 읽는 곳에 둔다)
			editor: { background: "bg-cms-primary/10" }, // 편집기 표시(관리자 색은 `cms-*`, 어두운 테마는 `cms-dark:`): background·wavy(물결 밑줄 색)·marker({ text, className })
		},
	],
},
```

공개 화면은 `@monti-cms/core/code-block`의 `annotationConfig`(기본 + 설정)를 렌더 체인에 넘긴다.

#### 코드 블록 도구 끄기·테마·언어

```ts
codeBlock: {
	omitLineEffects: ["plus", "minus"], // 편집기가 내놓지 않을 줄 효과(기본 또는 더한 것)
	features: { rules: false, fold: false, tooltip: false, textStyles: false }, // 끌 편집기 도구. `false`로 적지 않으면 모두 켜져 있다
	themes: { light: "github-light", dark: "github-dark" }, // Shiki 테마 이름(기본 one-light / one-dark-pro)
	languages: ["elixir", "zig"], // 더 강조할 Shiki 언어. 편집기 언어 목록에도 나온다
},
```

- `omitLineEffects`: 편집기 줄 메뉴에서 뺄 줄 효과 이름.
- `features`: `rules`(정규식 규칙과 그 패널), `fold`(줄 메뉴의 "접기"와 글자 접기 효과), `tooltip`(글자 툴팁 효과),
  `textStyles`(코드 안 굵게·기울임·취소선·밑줄).
- 도구를 끄면 편집기의 메뉴·패널·툴바·단축키에서만 빠진다. 이미 그 도구를 쓰는 본문은 그대로 열리고, 공개 화면에 그려지고,
  고쳐서 저장해도 바뀌지 않으며, 블록에 이미 있는 효과는 계속 보여 지울 수 있다. 읽기·변환·그리기는 이 설정을 보지 않는다.
- `themes`: 공개 화면과 편집기가 함께 쓰는 Shiki 테마 이름 한 쌍. 편집기는 Shiki 테마가 아닌 이름이면 기본 테마로 돌아간다.
- `languages`: 기본 목록에 더할 Shiki 언어 이름이나 별칭(예: `elixir`, `zig`). 편집기 언어 목록에 이름 그대로 나온다.
  언어가 불러와 있지 않은 펜스(기본 목록에도 `languages`에도 없는 것)는 일반 글자로 그려진다.

### 글자색 목록

글자색은 블록 확장(`@monti-cms/blocks`의 `color({ palette })`)이 준다. 예전 설정 `textColors`는 없어졌다(옵션으로 옮긴다).

## 플러그인

사이트 설정의 `plugins`에 한 번 적는다(예: AI 플러그인 `@monti-cms/ai`의 `aiPlugin()`).

```ts
import { definePlugin } from "@monti-cms/core";

export const myPlugin = () =>
	definePlugin({
		name: "my-plugin",
		options: {}, // JSON 값. 서버·브라우저가 함께 읽는다
		nav: [{ path: "my", label: "내 화면", icon: "plug" }], // 관리자 사이드바 "관리" 묶음
		validate: ({ collections }) => {}, // 사이트 설정을 만들 때 부른다
		server: () => import("my-plugin/server"), // CmsServerPlugin: API 경로·표 만들기·메타 표시
		admin: () => import("my-plugin/admin"), // CmsAdminPlugin(@monti-cms/admin): 화면·공급자
	});
```

- 서버 쪽(`server`)은 브라우저 묶음에 들어가지 않게 패키지 `exports`의 `browser` 조건으로 빈 진입점을 준다.
- `validate`는 컬렉션·언어·블록 정의와 모든 플러그인(`plugins`)을 받는다. 역할을 쓰는 확장은 여기서 필드 종류를 확인한다.
- `contributes`는 다른 플러그인에 더하는 것이다. 키와 모양은 받는 플러그인이 정하고 본체는 읽지 않는다. 예를 들어
  `contributes: { ai: { actions: { … } } }`는 AI 플러그인(`@monti-cms/ai`)이 있으면 그 기능을 더하고, 없으면 쓰이지 않는다.
  확장은 받는 플러그인을 몰라도 기능을 더할 수 있다(블록 확장의 다이어그램 만들기, SEO 확장의 검색 제목 추천).
- 서버 쪽 `routes`는 본체 경로(`/api/cms/v1/*`)에 없는 주소를 받는다. 본체가 관리자 로그인 확인과 같은 출처 검사로 감싸므로
  인증을 빠뜨려도 열린 경로가 되지 않는다. 로그인 없이 받아야 하는 경로(외부 실행기·웹훅)만 `public: true`로 빼고 스스로 확인한다.
  `migrate`는 `monti migrate`가 본체 표 다음에 부른다.
- 같은 출처 검사는 `Host`·`site.url`의 호스트를 받고, `X-Forwarded-Host`의 첫 값은 호스트를 신뢰할 때만 받는다("호스트 신뢰"). `Host`를 바꾸는 프록시 뒤라면 `site.url`을 적거나 호스트를 신뢰한다.
- 서버 쪽 `hooks`(`transform`·`validate`·`validatePublish`·`afterCommit`)는 서버 설정의 `hooks`와 같고, 서버 설정의 훅 다음에 플러그인 순서대로 돈다. "훅 계약"을 본다.
- 플러그인 라우트는 자신을 맡은 인스턴스를 받으므로, 플러그인 코드는 자기 저장소(`cms.storage("<플러그인 이름>")`)·저장소(`cms.store()`·`cms.mediaStore()`)·비밀 값(`cms.secrets("<플러그인 이름>")`)을 거기서 읽고 따로 전역 상태를 두지 않는다. `adminRoute` 등 라우트 틀은 `@monti-cms/core/plugin/server`에 있고, `features(cms)`와 `migrate(storage, cms)`도 인스턴스를 받는다.

### 플러그인 비밀 값

플러그인은 마스터 비밀 값(서버 설정의 `secret`)을 받지 않는다. 인스턴스가 이 값에서 플러그인마다 키를 하나씩 만들고(HKDF-SHA256, info 문자열은 `monti:plugin:<플러그인 이름>:v1`), 그 키로만 동작하는 API를 플러그인에 건넨다.

```ts
const secrets = cms.secrets("my-plugin");   // 라우트, `features(cms)`, `migrate(storage, cms)` 안에서
secrets.available;                          // 서버 설정에 `secret`이 없으면 false
const stored = secrets.encrypt("sk-live-1234");   // "mk1:<키 id>:<iv>:<tag>:<body>", AES-256-GCM, 텍스트 열에 그대로 저장해도 된다
secrets.decrypt(stored);                    // "sk-live-1234". 이 플러그인의 값이 아니거나, 모르는 secret으로 만들었거나, 깨졌으면 null
secrets.isCurrent(stored);                  // 이전 secret으로 만든 값이면 false: 풀어서 다시 암호화한다
secrets.deriveKey("signing");               // 다른 용도(HMAC, 해시)용 32바이트 키. 플러그인과 용도마다 다르다
```

- 플러그인끼리는 키가 서로 무관하므로, 한 플러그인이 다른 플러그인의 값을 풀 수 없고, 한 플러그인의 테이블에서 읽은 값으로는 마스터 비밀 값도 다른 플러그인의 데이터도 알 수 없다. 플러그인 코드는 여전히 같은 서버 프로세스에서 돌므로 이것은 플러그인이 저장하는 값을 서로 나누는 장치이지 샌드박스가 아니다.
- 값마다 만든 키의 id가 붙어 있어(`mk1:<키 id>` 접두어), `decrypt`는 모든 secret을 시도하지 않고 맞는 것을 바로 고른다.
- 교체: 새 값을 `secret`에, 옛 값들을 `previousSecrets`에 둔다(`previousSecrets: process.env.CMS_PREVIOUS_SECRET ? [process.env.CMS_PREVIOUS_SECRET] : []`). `decrypt`는 현재 secret을 먼저, 그다음 이전 secret들을 시도하고, `encrypt`는 항상 현재 secret을 쓴다. 플러그인은 `isCurrent`가 false인 값을 다시 저장할 때 새로 암호화한다. 그 secret으로 저장된 값을 모두 다시 암호화한 뒤에만 `previousSecrets`에서 뺀다(AI 플러그인은 `monti migrate`에서 이 일을 한다).
- 이 API가 생기기 전에 자기 형식으로 값을 저장한 플러그인은 그 형식을 알릴 수 있다. `cms.secrets("my-plugin", { legacy: { prefix: "v1", domain: "my-key:" } })`로 알리면 `decrypt`가 `sha256("my-key:" + secret)`으로 암호화한 `v1:<iv>:<tag>:<body>` 값도 읽는다. 옛 형식은 읽기 전용이며 `encrypt`는 쓰지 않는다.
- `cms.server`는 `secret`과 `previousSecrets`를 뺀 서버 설정이다.

### 플러그인 저장소

플러그인은 자기 데이터(설정, 글마다의 동기화 상태, 캐시한 결과)를 자기 표나 데이터베이스 드라이버가 아니라 인스턴스의 플러그인 저장소에 둔다.
`cms.storage("<플러그인 이름>")`은 그 플러그인으로 범위가 정해진 저장소를 돌려준다. 이름 붙은 컬렉션에 문자열 키로 JSON 문서를 두고, 문서마다 버전이 있다.

```ts
const settings = cms.storage("my-plugin").collection<{ endpoint: string }>("settings");
await settings.get("default");                                                       // { key, value, version, createdAt, updatedAt } 또는 null
const saved = await settings.set("default", { endpoint: "https://…" }, { expectedVersion: 0 });   // 0이면 만든다
await settings.set("default", { endpoint: "https://…/v2" }, { expectedVersion: saved.version }); // 바꾼다
await settings.list({ prefix: "team-" });                                            // 키 순서
await settings.delete("default", { expectedVersion: saved.version + 1 });
```

- 쓰기는 기대하는 버전을 적는다. 저장된 버전이 다르면 저장된 버전(없으면 0)을 담은 `CmsError`(코드 `conflict`)로 실패하므로, 두 편집자가 모르는 새 덮어쓰지 못하고 동시에 쓰는 둘 중 하나만 이긴다. 없는 문서를 지우면 `not_found`다.
- 플러그인과 컬렉션 이름은 소문자 낱말이다(`ai`, `action-overrides`). 값은 JSON이다. JSON으로 저장되고 파싱되어 돌아오므로 `Date`는 ISO 문자열이 되고 `undefined`는 거절된다(`invalid_input`).
- 마이그레이션 훅은 `CmsServerPlugin.migrate(storage, cms)`이고 `monti migrate`가 본체 표 다음에 부른다. `storage.once(이름, 단계)`는 `단계`를 한 번만 돌리고(`cms_migrations`에 `plugin:<플러그인>:<이름>`으로 남고, 동시에 불러도 한 번이며, 던지면 남지 않는다) 돌았는지를 돌려준다. `단계`는 `PluginMigration`을 받는다. 단계의 트랜잭션 안에서 쓰는 컬렉션, `importItem(컬렉션, { key, value, version, createdAt, updatedAt })`(문서가 갖고 있던 버전과 날짜로 넣고 덮어쓰지 않는다), 플러그인의 이전 버전이 직접 만든 표의 행을 읽는 `readLegacyTable(표)`(없으면 `null`, 표는 읽기만 한다)가 있다. `once(이름, 단계, { legacyNames })`는 이전 버전이 그 이름 중 하나를 남겼을 때도 단계를 끝난 것으로 본다.
- Postgres 어댑터는 문서를 본체 표 `plugin_documents`에 둔다(본체 마이그레이션이 만든다). 다른 어댑터의 저장소도 똑같이 동작해야 한다. `src/plugin/__test__/storage-contract.ts`가 그 계약이고, Postgres와 `@monti-cms/core/testing`의 `createMemoryPluginStorage()`로 돌린다. `fakeCms`는 이를 기본으로 쓴다(`fakeCms({ storage })`로 바꾼다).
- 플러그인 API에는 데이터베이스 드라이버 타입이 없다. `PluginDatabase`·`cms.database()`·`withTransaction`은 없어졌고, `@monti-cms/core`와 `@monti-cms/core/plugin/server`는 `pg`의 어떤 것도 내보내지 않는다.

## 서버 설정

| 항목 | 뜻 |
|---|---|
| `database` | 콘텐츠 저장소. `postgres({ connectionString, schema })` |
| `media` | 이미지·첨부 파일 저장소. `@monti-cms/core/s3`의 `r2Storage`·`s3Storage`(`region`·`forcePathStyle`) 또는 `MediaStore` 계약을 구현한 연결. 없으면 미디어 기능을 못 쓴다. |
| `auth` | 관리자 로그인. `githubAuth({ clientId, clientSecret, adminIds, devBypass, basePath?, secret })`. `basePath`는 로그인 API 경로(기본 `/api/cms/auth`, "로그인 경로"), `secret`은 로그인 세션 서명 값(없으면 NextAuth가 `AUTH_SECRET`을 읽는다) |
| `trustHost` | 선택. `Host`·`X-Forwarded-Host`를 믿을지("호스트 신뢰"). 기본값은 `AUTH_TRUST_HOST` 환경 변수, 없으면 운영에서는 끔·개발에서는 켬 |
| `secret` | 플러그인이 DB에 암호화해 두는 값(AI 서비스 키)의 마스터 비밀 값. 플러그인은 이 값을 보지 못하고, 이 값과 플러그인 이름에서 만든 키만 받는다("플러그인 비밀 값"). 로그인 서명 값과 따로 둔다. |
| `previousSecrets` | 선택. `secret`이 바뀌기 전의 값들. 이 값으로 암호화한 저장 값도 계속 읽히고, 다시 저장할 때 `secret`으로 새로 암호화된다. 그래서 `secret`을 바꿔도 저장된 키를 다시 넣지 않아도 된다. |
| `publicApi` | 선택. 공개 JSON API(`/api/cms/v1/public/entries`·`/entries/:collection/:slug`, 로그인 없이 공개본만, 캐시 안 함). `{ collections, filters?: { 질의이름: 관계필드 }, toJson?(entry, { body }) }` |
| `hooks` | 선택. 모든 콘텐츠 쓰기에 거는 훅: `transform`·`validate`·`validatePublish`·`afterCommit`(변경이 커밋된 뒤 알림: 캐시 갱신·웹훅·검색 색인). "훅 계약"을 본다. 플러그인도 `hooks`를 둘 수 있다 |

다른 저장소·로그인을 쓰려면 `DatabaseAdapter`·`MediaAdapter`·`AuthAdapter`를 직접 만들어 넣는다.

### 호스트 신뢰

`Host`와 `X-Forwarded-Host`는 클라이언트가 직접 보낼 수 있어서, 운영에서는 기본적으로 믿지 않는다. 믿는다는 것은 두 가지다. 로그인 콜백 주소를 요청의 호스트로 만들고, 같은 출처 검사가 `X-Forwarded-Host`의 첫 값을 받는다.

- 이 헤더를 채워 주는 프록시 뒤나 플랫폼(Vercel, nginx, 로드 밸런서)에서는 서버 설정의 `trustHost: true` 또는 `AUTH_TRUST_HOST=true`로 켠다. 옵션이 환경 변수보다 우선한다.
- 그렇지 않으면 `AUTH_URL`에 사이트의 공개 주소를 적는다. 로그인이 쓰는 출처가 고정되므로 호스트를 믿지 않아도 로그인이 된다. 같은 출처 검사에는 `site.url`을 적어 공개 호스트를 받게 한다.
- 기본값은 `AUTH_TRUST_HOST` 환경 변수, 없으면 운영에서는 끄고 개발·테스트에서는 켠다(그곳의 호스트는 `localhost`다). 켜지 않은 운영 서버에서는 로그인이 `UntrustedHost` 오류로 실패한다(이 옵션들을 알려 주는 경고도 남긴다).
- Vercel도 더는 자동으로 믿지 않는다. 프로젝트 환경 변수에 `AUTH_TRUST_HOST=true`를 더한다.

### 개발용 로그인 우회

`githubAuth({ devBypass: true })`(생성된 설정에서는 `CMS_DEV_AUTH_BYPASS=1`)는 방문자를 로그인 없이 첫 번째 관리자로 본다. 스테이징 서버가 실수로 열리지 않도록 다음처럼 제한한다.

- `NODE_ENV`가 `development`여야 한다. 다른 모드에서는 이 값을 무시하고 경고를 남긴다.
- 배포된 서버처럼 보이면 안 된다. 호스팅 플랫폼 변수(`VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`, `AWS_EXECUTION_ENV`, `AWS_LAMBDA_FUNCTION_NAME`, `KUBERNETES_SERVICE_HOST`, `DYNO`)가 있거나 `AUTH_URL`이 공개 주소를 가리키면 거부한다. 이때 서버는 시작을 거부하고(로그인 연결을 처음 쓸 때 오류를 던진다) 이유를 알려 준다.
- 요청마다 내 컴퓨터에서 온 것이어야 한다. `Host`가 `localhost`·`*.localhost`·`127.0.0.0/8`·`::1`이고, `X-Forwarded-Host`와 `X-Forwarded-For`가 있으면 그것도 루프백이어야 한다. 그 밖의 요청은 평소처럼 로그인해야 하고, 경고를 한 번 남긴다. `cms.authGateway.isDevBypassActive()`가 같은 검사를 한다(비동기).

## 훅 계약

모든 콘텐츠 쓰기는 본체 서비스의 한 파이프라인을 지난다: 만들기, 저장, 발행(하나 또는 일괄), 복제, 번역본 만들기, 메타데이터·폴더 일괄 변경.
훅은 서버 설정(`createCms({ server: defineServerConfig({ hooks }) })`)이나 플러그인 서버 쪽(`CmsServerPlugin.hooks`)에 같은 모양으로 등록한다.
타입(`WriteHooks`·`WriteHookContext`·`WriteData`·`ValidationHookContext`·`ValidationResult`·`WriteOperation`)은 `@monti-cms/core/server`와 `@monti-cms/core/plugin/server`에서 내보낸다.

```ts
import { createCms, defineServerConfig } from "@monti-cms/core/server";

const server = defineServerConfig({
	// database, auth, ...
	hooks: {
		// 본체 준비 전에 돈다. 준비할 데이터를 돌려준다(아무것도 안 돌려주면 그대로).
		transform: ({ operation, collection, entryId, locale, metadata, doc }) => ({
			metadata: { ...metadata, title: String(metadata.title ?? "").trim() },
			doc,
		}),
		// 본체 준비 뒤, 모든 쓰기에서 돈다. 실패는 쓰기를 막고, 경고는 결과와 함께 돌아간다.
		validate: ({ metadata, snapshot }) => ({
			issues: String(metadata.title ?? "").includes("TODO") ? [{ code: "title_has_todo", path: "title" }] : [],
		}),
		// 같은 방식, 발행에서만.
		validatePublish: ({ metadata }) => ({ warnings: metadata.summary ? [] : [{ code: "no_summary", path: "summary" }] }),
		// 변경이 커밋된 뒤.
		afterCommit: (change) => revalidate(change.collection, change.publishedSlug),
	},
});

export const cms = createCms({ server });
```

| 단계 | 하는 일 |
|---|---|
| 1 | 입력 만들기: 요청에서, 또는 저장된 초안에서(발행·일괄) |
| 2 | `transform` 훅. 등록 순서대로(서버 설정이 먼저, 그다음 플러그인을 설정 순서대로). 각 훅은 앞 훅의 결과를 받는다 |
| 3 | 본체 준비: 정규화·참조 수집·본체 검증. **항상, 변환된 데이터에 대해 돈다** |
| 4 | `validate` 훅: 실패와 경고를 더한다 |
| 5 | 발행(그리고 다시 발행되는 항목 복원)에서 `validatePublish` 훅: 실패와 경고를 더한다 |
| 6 | 저장소 커밋. 글 하나에 트랜잭션 하나(일괄은 항목마다 커밋) |
| 7 | `afterCommit` 훅 |

- `operation`은 `create`·`save`·`publish`·`duplicate`·`translate`·`restore`다. 메타데이터·폴더 일괄 변경은 항목마다 `save`, 일괄 발행은 항목마다 `publish`다.
  글을 만드는 중에는 `entryId`가 없다. `metadata`와 `doc`(저장 문서 형태의 본문, 해석되지 않는 초안은 `null`)은 복사본이라, `transform`이 돌려주지 않으면 바꿔도 아무 일도 없다.
  `validate`와 `validatePublish`는 준비된 `snapshot`(복사본)도 받는다.
- 보관·보관 해제·휴지통·삭제는 내용을 바꾸지 않으므로 2~5단계를 건너뛰고 `afterCommit`만 부른다. 항목(record)을 복원하면 다시 발행되므로 `restore`로 3~5단계를 거친다(`validate`와 `validatePublish`가 돌아서 휴지통에 넣었다 복원하는 식으로 발행 제한을 피할 수 없다. 내용이 그대로이므로 `transform`은 돌지 않는다). 다른 글의 복원은 초안으로 돌려놓을 뿐이라 아무 훅도 돌지 않는다.
- 훅은 DB 트랜잭션 밖에서 돌고 DB 클라이언트를 받지 않는다. 비동기여도 된다. 저장소 내부 옵션 `beforePublishCommit`(트랜잭션 클라이언트를 받는다)은 이 계약에 들지 않고 그대로다.
- 발행하는 중에 `transform`이 초안을 바꾸면 그 변경은 발행과 함께 한 트랜잭션으로 저장된다(`afterCommit`에는 그 글의 `saved` 변경 다음에 `published` 변경이 온다. 바뀐 것이 없는 발행은 `published`만 온다). 만들거나 저장하면서 바로 발행하는 경우(항목)도 같게 `created` 또는 `saved`, 그다음 `published`로 알린다.
- 훅이 예외를 던지거나 계약에 맞지 않는 값을 돌려주면 쓰기는 `hook_failed`(HTTP 500)로 실패한다. 오류의 `issues[].params`에 훅 이름과 소유자(`server` 또는 `plugin:<이름>`)가 들어가고, 아무것도 저장되지 않는다. `validate` 실패는 `validation_failed`, `validatePublish` 실패는 `publish_validation_failed`(HTTP 422)이며, 더한 이슈가 초안 자체의 이슈 옆에 붙는다.
- `afterCommit`은 id·상태·주소만 받고 본문은 받지 않는다. 커밋된 글은 `cms.store().getEntry(change.entryId)`로 읽는다. 전달은 프로세스 안에서 최대 한 번이며, 다시 시도하지 않고 아직 아웃박스도 없다.

계약(각각 `src/services/__test__/write-hooks.test.ts`와 `write-pipeline.test.ts`에 시험이 있다):

1. **변환된 데이터도 본체를 거친다.** 정규화·참조 수집·검증이 `transform`의 결과에 대해 돌아서, 변환으로 본체 검사를 피할 수 없다.
2. **추가 검증은 실패를 더할 수만 있다.** `validate`와 `validatePublish`가 돌려준 이슈와 경고는 본체의 것에 더해진다. 훅은 스냅샷의 복사본을 받으므로 본체 이슈를 지우거나 낮출 수 없고, 발행의 본체 무결성 검사(참조·미디어·링크·필수 값)는 항상 돈다.
3. **커밋 전의 실패는 쓰기를 막는다.** 본체 준비 실패, 훅이 더한 실패, 훅의 예외는 아무것도 저장하지 않고 `afterCommit`도 부르지 않는다.
4. **`afterCommit`의 실패는 끝난 쓰기를 되돌리지 않는다.** 기록만 남기고, 다른 `afterCommit` 훅은 그대로 돈다.
5. **일괄은 모든 항목에 같은 훅을 적용한다.** 항목마다 파이프라인 전체를 돌고, 결과나 오류(`hook_failed`·`validation_failed` 등)는 항목별로 돌아간다.

## 설정

| 항목 | 뜻 |
|---|---|
| `collections` | 컬렉션 이름 → `defineCollection` 정의. 이름은 DB에 저장되므로 운영 중에 바꾸지 않는다. |
| `locales` | 콘텐츠 언어 목록(`code`, `name`, 관리자 화면 이름 `label`). |
| `defaultLocale` | 기본 언어(번역의 원본). 기본 주소 방식에서는 공개 주소에 언어 접두사가 붙지 않는다. |
| `site.url` | 공개 사이트 주소. 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다. 환경 변수에서 읽어도 된다. |
| `site.aliases` | 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). |
| `site.name` | 관리자 화면에 보이는 사이트 이름. 없으면 `site.url`의 호스트 이름. |
| `site.home` | 관리자 사이드바 `사이트 보기` 주소. 경로나 전체 주소. 기본 `/`. |
| `site.localePrefix` | 공개 주소에 언어를 붙이는 방식. `except-default`(기본: 기본 언어는 그대로, 다른 언어는 `/{code}`)·`always`(모든 언어에 `/{code}`)·`never`(붙이지 않음). 검색 미리보기·초안 미리보기·`localizePath`가 따른다. |
| `site.previewPath` | 초안 미리보기 주소 앞부분(예: `/preview`). 없으면 미리보기 단추가 없다. |
| `site.previewLocaleParam` | 미리보기 주소에 언어를 넘기는 쿼리 이름(기본 `locale`, 기본 언어가 아닐 때만 `?locale=en`). `false`면 `localePrefix` 규칙대로 경로에 넣는다(`/preview/en/posts/a`). |
| `admin.path` | 관리자 화면 경로(기본 `/admin`). 앱의 관리자 라우트 폴더와 같아야 한다. `/`나 `/api` 아래는 안 된다. 화면 안 링크·로그인 이동·플러그인 화면 주소가 따른다. |
| `mdx.syntax` | 문법 확장(실험적, `@monti-cms/core/syntax`)을 쓰기 우선순위 순으로 나열한다. 예: `@monti-cms/syntax-directive`의 `[directiveSyntax()]`. 없으면 저장하는 MDX는 표준(CommonMark + GFM + MDX JSX)이다("본문 문법"). |
| `codeBlock.lineEffects` | 코드 블록 줄 효과 더하기·바꾸기("코드 블록 줄 효과"). |
| `codeBlock.omitLineEffects` / `features` / `themes` / `languages` | 편집기의 줄 효과·도구 감추기, 강조 테마, 언어 더하기("코드 블록 도구 끄기·테마·언어"). |
| `media` | 올릴 수 있는 미디어. `maxImageBytes`(기본 10MB)·`maxPixels`(기본 4천만)·`maxFileBytes`(기본 50MB)와 받을 형식 `imageTypes`(jpeg·png·webp·gif·avif 가운데)·`fileTypes`(pdf·zip·txt·md·csv·json 가운데, 빈 목록이면 첨부 파일을 받지 않음). 업로드 API·관리자 파일 고르기 창·`/v1/meta`가 따른다. |
| `admin.locale` | 관리자 화면 언어와 날짜·숫자 표기(BCP 47, 예: `en`·`ko-KR`). 없으면 사이트 기본 언어(`defaultLocale`). 시각은 `timeZone`으로 보인다. |
| `admin.messages` | 화면 문구 덮어쓰기: 이름공간 → 키 → 문구. 본체 블록 이름표는 `"cms.blocks"`(`image.label`처럼 `<블록>.label`), 코드 블록 효과는 `"cms.code-block"`, 검사 오류 문구는 `"cms.mdx"`·`"cms.core"`·`"cms.translation"`이다. |

### 컬렉션

- **종류(`kind`).** `document`(문서)는 본문을 쓰고 초안과 공개본을 나눠 명시적으로 발행한다. `item`(항목)은 작은 폼에서 저장하면
  곧바로 공개 값에 반영한다(발행·보관·번역본이 없고, 언어별 값은 `translations`에 둔다). 본문(`body`)은 없으면 문서만 쓴다.
  예전 이름 `workflow: "publish" | "record"`는 없앴다. 아직 쓰는 설정은 써야 할 `kind`를 알려 주며 실패한다(`publish` → `document`, `record` → `item`).
- **배치(`layout`).** 없으면 필드 선언 순서대로 한 묶음이고, 제 `tab`을 가진 필드는 그 탭에 모인다.
- **목록(`list.columns`).** 없으면 기본 컬럼이다. 문서는 제목·상태·언어(언어가 둘 이상일 때)·분류 필드(항목 컬렉션을 가리키는
  관계)·수정일·발행일, 항목은 제목·주소(주소 필드가 있을 때)·언어·상태·수정일.

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 본문의 내부 링크를 알아보고(가리키는 글이 있는지·공개됐는지
발행 전에 검사) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

### 필드 규칙

- **제목 필드 이름은 `title`, 이름표는 자유.** 라이브러리 약속이다. 모든 컬렉션은 `title` 텍스트 필드(`fields.text`)를 가진다.
  목록·검색·관계 고르기·본문 링크·복제·편집 화면 제목 칸이 이 필드를 쓴다. 이름표(`label`)는 사이트가 정한다(예: `Headline`·
  `이름`). 제목 글자 수 한도는 따로 없고 이 필드의 `max`를 따른다(없으면 한도 없음).
- **주소 필드는 하나.** 주소(`fields.slug`)는 본체 개념이라 콘텐츠마다 하나다. 한 컬렉션에 주소 필드를 둘 이상 두면 설정 오류다.
- **주소는 `from`에서 만든다.** `fields.slug({ from: "title" })`이면 주소를 직접 고치기 전까지 그 필드 값으로 주소를 만들고,
  항목 컬렉션은 주소를 비우고 저장하면 그 값에서 만든다. `from`이 없으면 자동으로 만들지 않는다. `from`은 같은 컬렉션의
  텍스트 필드여야 한다.
- **필드 역할(`role`).** 확장과 화면은 값을 필드 이름이 아니라 역할로 찾는다(`roleField(collection, role)`, 설정을 읽지 않는
  `fieldWithRole(schema, role)`). 역할 이름은 자유(영문자·숫자·하이픈)이고 한 컬렉션에 역할마다 한 필드만 둔다. 본체가 아는
  역할은 `summary`(텍스트 필드, 요약) 하나다. 필드 옆 동작(AI 등)에 `summary`로 넘어간다. 다른 역할은 그 역할을 쓰는 확장이
  정하고 필드 종류를 플러그인 `validate`에서 확인한다(예: SEO 확장의 `seoTitle`·`ogImage`·`noindex`).
- **미디어 필드.** `fields.media({ label, accept?: "image" | "file" })`는 미디어 라이브러리의 파일 하나를 고르고 미디어 ID를
  글자로 저장한다. 값은 미디어 사용처(`entry_references`, 종류 `media`)에 잡혀 미디어 화면의 "사용처"·"사용하지 않음" 거르기에
  보이고, 쓰고 있는 파일은 지울 수 없다. 미디어 ID가 아닌 값은 `invalid_metadata_value`, 빈 값(`""`)은 고르지 않은 것이다.

- **필수 필드(`required: true`).** 문서 컬렉션은 발행할 때, 항목 컬렉션은 저장할 때 비어 있으면 막는다. 초안 저장은 막지 않는다.
  예전 값 `required: "publish"`는 없앴다(`true`를 쓴다). 아직 쓰는 설정은 안내 메시지와 함께 실패한다.
- **필드 값 오류.** 오류 코드는 필드와 상관없이 같다. 필수값이 비면 `missing_field`(주소는 `null_slug`), 글자 수가 `max`를
  넘으면 `field_too_long`이다. 문제(`issues`)의 `path`에 필드 이름, `message`에 필드 이름표가 담긴다(제목도 같다). 관계 대상
  컬렉션이 다르면 `invalid_reference_collection`이다. 빈 본문(`empty_body`)은 본문을 쓰는 컬렉션(`body`)만 막는다.
- **본문에서 채우기.** 텍스트 필드에 `fillFromBody: true`(160자) 또는 `fillFromBody: { maxLength }`를 두면 발행할 때 비어 있으면
  본문 앞부분의 일반 글자로 채운다(본문이 있는 컬렉션만, 필드 `max`를 넘지 않는다). 본체 함수는 `bodyExcerpt(mdx, maxLength)`다. 글자는 해석한 본문에서 뽑으므로 사이트가 읽는 문법이 무엇이든 따라간다. 문단·제목·목록 항목·표 칸·블록 본문과 블록의 글자 속성(콜아웃 제목)이 대상이고, 코드·수식·이미지는 뺀다. 본문 검색용 글자도 같은 방식으로 만들며, 코드와 이미지 대체글·캡션은 남긴다.
- **여러 줄 입력.** `multiline: true`인 텍스트 필드는 여러 줄 입력이고 `rows`(기본 2)로 처음 줄 수를 정한다.
- **쓸 수 없는 필드 이름.** 메타데이터에서 본체가 따로 쓰는 키(`translations`)는 필드 이름으로 쓸 수 없다.
- **탭.** 필드에 `tab: "이름"`을 두거나 `layout` 묶음에 `tab`을 두면 편집 화면 속성 칸에 그 이름의 탭이 생긴다(1~20자).
  묶음의 `tab`이 먼저고, 묶음에 `tab`이 없으면 필드의 `tab`이다. 제 `tab`을 가진 필드는 배치를 적지 않아도 탭마다 한 묶음으로
  모인다. 그래서 확장이 주는 필드 묶음(예: `seoFields()`)이 사이트가 `layout`을 적지 않아도 제 탭에 들어간다. 없으면 기본 탭
  `속성`이다.
- **보기 필드.** `fields.view({ view: "이름" })`은 값을 저장하지 않고 그 자리에 화면을 그리는 필드다. 화면은 관리자 확장이
  `fieldViews`로 등록한다(예: SEO 확장의 `search`). 등록한 화면이 없으면 아무것도 그리지 않는다.
- **입력 바꾸기.** `input: "이름"`은 관리자 확장이 `fieldInputs`로 등록한 입력을 가리킨다. 등록이 없으면 종류의 기본 입력이다.
  `inputOptions`(JSON 값)는 그 입력에 넘길 설정이고 본체는 읽지 않는다(예: 권장 글자 수).

```ts
fields: {
	title: fields.text({ label: "Title", required: true }),
	slug: fields.slug({ label: "Slug", from: "title" }),
	excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, rows: 3, fillFromBody: { maxLength: 200 } }),
	hero: fields.media({ label: "Hero image", tab: "Media" }),
	credit: fields.text({ label: "Credit", tab: "Media" }),
},
layout: [{ fields: ["title", "slug", "excerpt"] }], // hero·credit은 Media 탭에 모인다
```

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나, 기본 언어가 목록에 없거나, `title`이 없거나, 주소 필드가 둘 이상이거나,
역할이 겹치거나 `summary`가 텍스트 필드가 아니거나, 탭 이름이 1~20자가 아니거나, `from`·`fillFromBody`가 필드와 맞지 않거나,
필드 이름이 `translations`이거나, 컬렉션 종류가 없거나, `admin.path`·`site.localePrefix`·`site.previewLocaleParam`·`site.home`
모양이 틀리면 앱이 뜰 때 바로 오류를 낸다.

복제(`POST /api/cms/v1/entries/:id/duplicate`)는 본문에 `{ title }`을 받으면 복제본 제목을 그 값으로 둔다(관리자 화면은 원본
제목에 "(복사)"를 붙여 보낸다). 없으면 원본 제목 그대로다. 본체는 붙일 말을 정하지 않고, 복제본도 다른 쓰기와 같은 쓰기 파이프라인을 지난다.

## 아직 남은 일

이 패키지는 한 블로그에서 떼어 낸 것이라, 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- 저장소는 Postgres만 있다. 저장소는 포트(`src/core/store/ports.ts`의 `ContentStore`)이고 글·생애 주기·목록·폴더·공개 읽기·미디어 메타데이터·템플릿·환경설정·내보내기 하위 포트로 나뉜다. Postgres 어댑터(`src/adapters/postgres`)가 이를 구현한다. 저장소가 적용하는 규칙(슬러그 주소, 번역, 발행·생애 주기 전이)은 `src/core/domain`의 순수 함수다. `src/core/store/__test__/contract`는 두 번째 어댑터가 통과해야 할 계약 테스트 묶음이고, 계약은 아직 크다.

## 개발

```bash
pnpm --filter @monti-cms/core test:run
pnpm --filter @monti-cms/core typecheck
```

패키지 자체 테스트는 예시 사이트 설정 `test/cms.config.ts`로 돈다. 인스턴스가 필요한 테스트는 `fakeCms`(또는 가짜 어댑터 위의 `createCms`)로 만들고, 그것 때문에 모듈을 모킹하는 테스트는 없다.

**다른 사이트 설정으로도 돈다(재발 방지).** `test/other-site.config.ts`는 블로그와 일부러 다른 설정이다(컬렉션 article·topic·author,
`title`·`slug` 말고는 다른 필드 이름, 영어만, 차트 + 사이트 블록, 글자 꾸밈 없음). 본체·관리자·AI 패키지마다 `vitest.othersite.config.ts`가 같은
테스트를 이 설정으로 다시 돌린다(묶음 이름 `core (other-site)`·`admin (other-site)`·`ai (other-site)`, 저장소 루트
`pnpm test:run`이 함께 돈다. 패키지에서는 `pnpm test:other-site`). 새 테스트는 저절로 두 설정으로 돈다. 컬렉션·필드 이름은
테스트에 적지 말고 설정에서 찾는다(`test/any-site.ts`: 컬렉션·관계 필드·두 번째 언어, 발행 필수값을 채우는 `fillRequiredMetadata`).
설정에 없는 기능(두 번째 언어, 묶음 블록 등)이 필요한 경우는 `skipIf`로 감싼다. 본체 패키지에서 블로그 예시 데이터를 그대로 확인하는
부분은 `*.blog.test.ts`에 두고 다른 사이트 실행·타입 검사에서 뺀다. 관리자·AI 패키지는 각 `vitest.othersite.config.ts`의
`BLOG_FIXTURE_TESTS`에 적어 뺀다.

**자동 검사(CI).** push·PR마다 `.github/workflows/ci.yml`이 lint(검사만)·타입 검사·패키지 빌드, 테스트(Postgres 17 서비스),
예시 앱 묶음 검사(`pnpm example:check`)를 돈다. `pnpm example:check`는 패키지를 빌드해 묶고, 예시 앱을 저장소 밖 임시 폴더에
그 묶음으로 설치해 `tsc`(`skipLibCheck: false`)와 `next build`를 예시 설정·확장을 모두 넣은 설정으로 한 번씩 돈다.
