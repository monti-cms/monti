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
| 서버 설정(DB·GitHub 로그인, 비밀 값은 환경 변수) | `cms.server.ts` |
| 관리자 화면 | `app/(admin)/admin/[[...path]]/page.tsx`·`layout.tsx` |
| 관리자 API와 로그인(`/api/cms/v1/*`·`/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| 설정 별칭 `@cms-config`·`@cms-server` | `tsconfig.json` `paths`에 더한다 |
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

서버 설정 `cms.server.ts`는 저장소·미디어·로그인 연결과 비밀 값이고 서버에서만 읽힌다. 연결은 처음 쓸 때 만들어 빌드 중에는
환경 변수가 비어 있어도 된다. 이미지 올리기를 쓰려면 `@monti-cms/core/s3`의 저장소를 `media`에 더하고 AWS SDK를 설치한다
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
| `CMS_SECRET` | 임의의 긴 값(`AUTH_SECRET`과 다르게). 저장 값(AI 서비스 키) 암호화(서버 설정 `secret`). 바꾸면 저장한 키를 다시 넣는다 |
| `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET` | GitHub OAuth 앱. 콜백 주소는 `<사이트 주소>/api/cms/auth/callback/github` |
| `CMS_ADMIN_GITHUB_ID` | 관리자 GitHub 숫자 ID |
| `CMS_DEV_AUTH_BYPASS` | 선택. `1`이면 `next dev`에서 로그인 없이 관리자 |

```sh
pnpm exec monti migrate
```

표를 만들거나 최신 모양으로 맞춘다(플러그인 표 포함). 여러 번 돌려도 결과가 같고, 패키지를 올린 뒤에도 다시 돌린다.
본체 변경은 번호 붙은 단계로 `cms_migrations`에 남아 아직 돌지 않은 단계만 돌고(한 트랜잭션), 같은 스키마에 동시에 돌려도
하나씩 돈다. 플러그인은 한 번만 할 일을 `db.once(이름, 함수)`로 맡긴다.

- 환경 파일: 기본으로 `.env.local`·`.env`(있는 것만)를 읽는다. 셸에서 준 값이 이기고 앞 파일이 뒤 파일을 이긴다.
  `--env-file <파일>`(여러 번)로 고르고 `--no-env-file`이면 읽지 않는다.
- 설정 파일: `--config`·`--server` → `CMS_CONFIG_PATH`·`CMS_SERVER_PATH` → `tsconfig.json` `paths`의 별칭 →
  `./cms.config.ts`·`./src/cms.config.ts` 순서로 찾는다.
- 예전 방식(`migrate.ts`에 `import "@monti-cms/core/migrate";`를 두고 `tsx --import @monti-cms/core/register migrate.ts`)도 그대로 돈다.

#### `monti content:rewrite`

```sh
pnpm exec monti content:rewrite           # 예행: 바뀔 것을 알려 주고 아무것도 쓰지 않는다
pnpm exec monti content:rewrite --apply   # 바뀐 내용을 쓴다
```

저장된 모든 본문(항목의 작업본·발행본, 본문 템플릿)을 저장된 문서에서 사이트에 설정된 문법으로 다시 써("저장된 본문" 절 참고), 저장 글이 한 표기가 되게 한다.
`directiveSyntax()`를 켜거나 끈 뒤, 또는 직렬화기를 올린 뒤에 글을 저장할 때마다 한 편씩 맞춰지길 기다리지 않고 한 번에 맞춘다. `monti migrate` 다음에 돌린다.
`migrate`와 같은 `--env-file`·`--no-env-file`·`--config`·`--server` 옵션을 받는다.

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
import { handlers } from "@monti-cms/core/runtime";
export const { GET, POST } = handlers;
```

`basePath`가 기본값이 아니면 관리자 API 라우트는 `/api/cms/auth/*`를 받지 않는다(404).

### 선택 의존성

CMS 패키지의 선택 의존성(예: 블록 확장의 `mermaid`·`recharts`)은 그 기능을 쓸 때만 설치한다. 설치하지 않은 것은 `withCms`가
빈 모듈(`@monti-cms/core/stubs/missing-optional`)로 이어 빌드가 멈추지 않게 하고, 그 기능을 쓰면 설치하라는 오류가 난다.
설치한 뒤에는 개발 서버를 다시 띄운다.

### 직접 잇기 (`monti init` 없이)

`monti init`이 하는 일을 손으로 하려면: 두 설정 파일을 만들고, `next.config.ts`를
`withCms(nextConfig, { config: "./cms.config.ts", server: "./cms.server.ts" })`로 감싸고, `tsconfig.json` `paths`에
`"@cms-config": ["./cms.config.ts"]`·`"@cms-server": ["./cms.server.ts"]`를 더하고(테스트(Vitest)를 쓰면 `resolve.alias`에도),
위 표의 라우트 파일 셋을 두고, 전역 CSS에 아래 줄을 넣는다.

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

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/core` | `cms.config.ts` | `defineConfig`·`defineCollection`·`fields`·`defineBlock`·`definePlugin` |
| `@monti-cms/core/server` | `cms.server.ts` | `defineServerConfig`·`postgres`·`githubAuth`, 저장소 계약 타입(`MediaStore` 등). 저장소 모듈은 처음 쓸 때 불러온다 |
| `@monti-cms/core/s3` | `cms.server.ts` | `r2Storage`·`s3Storage`(S3 API 미디어 저장소, AWS SDK 선택 의존성) |
| `@monti-cms/core/next` | `next.config.ts` | `withCms` |
| `@monti-cms/core/next/route-handler` | 관리자 API 라우트 | `createCmsRouteHandler` |
| `@monti-cms/core/render` | 공개 화면(서버 컴포넌트) | `renderMdx(mdx, options)` → `{ content, toc }`. 사이트 CSS에 `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | 공개 화면(서버 컴포넌트·sitemap·RSS) | `getEntry`·`listEntries`·`getTranslations`·`getPreview`: 공개본 읽기(관계·주소·옛 주소 이동·원문 대체) |
| `@monti-cms/core/runtime` | 서버 코드(크론 스크립트·사이트 테스트 포함) | 저장소·서비스·로그인 확인·미디어 공개 주소(`resolvePublicMediaUrl`). `server-only`를 쓰지 않아 Next 밖에서도 불러온다(`tsx --import @monti-cms/core/register`) |
| `@monti-cms/core/client` | 화면 코드 | API 모양·컬렉션·언어·주소·블록·스키마 도우미 |
| `@monti-cms/core/mdx`·`/code-block` | 공개 렌더러·편집기 | MDX 해석·직렬화, 코드 블록 주석 모델 |
| `@monti-cms/core/syntax`(실험적) | `cms.config.ts`, 문법 확장 패키지 | `SyntaxExtension` 인터페이스와 확장이 쓰는 도우미("본문 문법"). 지시자 표기는 `@monti-cms/syntax-directive`다 |
| `@monti-cms/core/plugin/server` | 플러그인 서버 쪽 | 라우트 틀·DB 연결·오류 |
| `monti`(명령줄, 패키지 `bin`) | 터미널 | `monti init`(파일 만들기)·`monti migrate`(표 만들기)·`monti content:rewrite`(저장된 본문 다시 직렬화) |
| `@monti-cms/core/cli` | 명령줄 도구 | `runCli`·`initProject`·`migrate`·`contentRewrite`(명령 `monti`의 코드) |
| `@monti-cms/core/migrate`·`/register` | 명령줄(예전 방식) | 표 만들기, 직접 만든 스크립트에서 설정 별칭 잇기 |
| `@monti-cms/core/testing` | 테스트 | 격리 스키마 DB·예시 데이터, 주어진 확장 목록으로 MDX를 해석하는 함수와 remark 플러그인(`parseMdxAst`·`syntaxRemarkPlugins`) |

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
- 편집기 노드는 관리자 패키지가 정의에서 만든다. 편집 모양은 관리자 패키지의 `blockEditors`(속성·본문 상자)나
  `blockViews`(화면 전체)로 바꾸고, 코드 펜스 블록의 미리보기는 `fencePreviews`로 넣는다.
- 공개 화면의 코드 펜스 블록은 `@monti-cms/core/mdx`의 `remarkFenceBlocksToMdx`를 렌더 체인(문법 확장의 플러그인 뒤)에 넣어
  `component`로 그린다.
- 번역 구조 검사(`compareStructure`)는 `translatable` 속성과, 그 값을 가리키는 `childValue` 속성(예: 처음 열 탭)만 번역에서
  바뀌어도 된다고 본다. 사람이 읽는 속성(제목·설명 등)에는 `translatable: true`를 단다.
- `editor.icon`이 관리자 패키지의 기본 아이콘에 없는 이름이면 관리자 화면에 아이콘을 등록한다(`@monti-cms/admin` README).

### 코드 블록 줄 효과

코드 블록 줄 효과(`// @line 이름 {0-2}`)의 기본은 강조·추가·삭제·경고·오류다. 설정의 `codeBlock.lineEffects`로 더하고,
같은 이름을 적으면 기본을 바꾼다.

```ts
codeBlock: {
	lineEffects: [
		{
			name: "focus", // 주석 이름(소문자 케밥). collapse·anchor와 글자 효과 이름은 쓸 수 없다
			label: "초점", // 줄 효과 메뉴 이름
			icon: "eye", // 메뉴 아이콘(lucide 이름, 관리자 화면에 등록된 이름)
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
- 같은 출처 검사는 `X-Forwarded-Host`(첫 값)·`Host`·`site.url`의 호스트를 받는다. `Host`를 바꾸는 프록시 뒤라면 `site.url`을 적는다.
- 플러그인 코드는 `@monti-cms/core/plugin/server`의 `getCmsDatabase()`(DB 연결)와 본체 라우트 틀(`adminRoute` 등)을 쓴다.

## 서버 설정

| 항목 | 뜻 |
|---|---|
| `database` | 콘텐츠 저장소. `postgres({ connectionString, schema })` |
| `media` | 이미지·첨부 파일 저장소. `@monti-cms/core/s3`의 `r2Storage`·`s3Storage`(`region`·`forcePathStyle`) 또는 `MediaStore` 계약을 구현한 연결. 없으면 미디어 기능을 못 쓴다. |
| `auth` | 관리자 로그인. `githubAuth({ clientId, clientSecret, adminIds, devBypass, basePath?, secret })`. `basePath`는 로그인 API 경로(기본 `/api/cms/auth`, "로그인 경로"), `secret`은 로그인 세션 서명 값(없으면 NextAuth가 `AUTH_SECRET`을 읽는다) |
| `secret` | 저장 값(AI 서비스 키)을 DB에 암호화해 둘 때 쓰는 키. 로그인 서명 값과 따로 둔다. 바꾸면 저장된 키를 다시 넣어야 한다. |
| `publicApi` | 선택. 공개 JSON API(`/api/cms/v1/public/entries`·`/entries/:collection/:slug`, 로그인 없이 공개본만, 캐시 안 함). `{ collections, filters?: { 질의이름: 관계필드 }, toJson?(entry, { body }) }` |
| `afterCommit` | 선택. 저장 뒤 알림 `(change) => …`: 글을 만들고·저장하고·발행·보관·휴지통·복원·지운 변경이 커밋된 뒤 `{ kind, entryId, collection, locale, translationGroupId, status, publishedSlug, workingSlug }`를 받는다. 캐시 갱신(`revalidatePath`)·웹훅·검색 색인 자리. 되돌린 변경은 오지 않고, 실패해도 저장은 그대로다. 플러그인도 `afterCommit`을 둘 수 있다 |

다른 저장소·로그인을 쓰려면 `DatabaseAdapter`·`MediaAdapter`·`AuthAdapter`를 직접 만들어 넣는다.

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
| `admin.legacyBackupNames` | 예전 브라우저 복구본 DB 이름. 관리자 화면이 읽고 지우되 새로 만들지 않는다(지금 이름 `cms_backup`). |

### 컬렉션

- **종류(`kind`).** `document`(문서)는 본문을 쓰고 초안과 공개본을 나눠 명시적으로 발행한다. `item`(항목)은 작은 폼에서 저장하면
  곧바로 공개 값에 반영한다(발행·보관·번역본이 없고, 언어별 값은 `translations`에 둔다). 본문(`body`)은 없으면 문서만 쓴다.
  예전 이름 `workflow: "publish" | "record"`도 받아 `document`·`item`으로 바꾼다(앞으로 없앨 이름이다). 본체 코드는 `kind`만 읽는다.
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
  예전 값 `required: "publish"`도 같은 뜻으로 받는다.
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
제목에 "(복사)"를 붙여 보낸다). 없으면 원본 제목 그대로다. 저장소는 붙일 말을 정하지 않는다.

## 아직 남은 일

이 패키지는 한 블로그에서 떼어 낸 것이라, 다른 블로그에서 쓰기 전에 아래를 정리해야 한다.

- 저장소는 Postgres(`ContentStore`)만 있다. 다른 DB를 쓰려면 같은 계약을 구현해야 하는데 계약이 아직 크다.

## 개발

```bash
pnpm --filter @monti-cms/core test:run
pnpm --filter @monti-cms/core typecheck
```

패키지 자체 테스트는 예시 설정 `test/cms.config.ts`·`test/cms.server.ts`로 돈다.

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
