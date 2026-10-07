# @monti-cms/core

[English](README.md) | 한국어

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, 문서 모델, 관리자 API, 플러그인 연결을 맡는다.
관리자 화면은 `@monti-cms/admin`, Next.js에 묶인 것은 모두 `@monti-cms/nextjs`, MDX(`mdx` 형식·원문 패널·문법 확장)는 플러그인 `@monti-cms/mdx`, AI 기능은 플러그인 `@monti-cms/ai`다. 다 붙인 예는 `examples/blog`다.

## 지원하는 프레임워크

지금은 Next.js(App Router)만 지원한다. 코드는 이것이 코어나 관리자가 아니라 패키지 하나의 성질이 되도록 나뉘어 있다.

- `@monti-cms/core`는 표준 `Request`·`Response`로 말하고(`cms.handle(request)`) Next.js에서 아무것도 가져오지 않는다. 호스트가 대 줘야 하는 것(지금 요청의 헤더, 로그인 뒤 리다이렉트)은 로그인 연결(`CmsAuth.requestHeaders`·`CmsAuth.rethrow`)로 들어온다.
- `@monti-cms/admin`(화면과 `@monti-cms/admin/hooks`)도 Next.js에서 아무것도 가져오지 않는다. 라우터는 받은 어댑터 `{ Link, navigate, replace, usePathname, useSearchParams }`로만 닿고(`@monti-cms/admin/router`의 `AdminRouterProvider`), 서버 화면이 필요로 하는 리다이렉트와 404는 `AdminServer`(`@monti-cms/admin/host`)로 받는다.
- `@monti-cms/nextjs`가 Next에 묶인 것을 모두 갖는다. 라우트 핸들러, `next.config.ts`용 `withCms`, App Router 어댑터를 얹은 관리자 페이지·레이아웃, 호스트 연결(Next 요청 헤더를 인스턴스에 붙여 주므로 `monti.config.ts`에는 `host` 옵션이 필요 없다)이다.
- `@monti-cms/auth`가 관리자 로그인이고, 이것도 프레임워크에 묶이지 않는다. Auth.js core 위에서 `CmsAuth`를 `Request`·`Response`로 구현하며, 로그인 방법은 갈아 끼우는 프로바이더다(GitHub가 들어 있다).

다른 호스트(Astro, Remix 등)는 코어나 관리자를 고치지 않고 어댑터 패키지를 새로 만들어 붙인다. 테스트가 경계를 지킨다. 코어와 관리자의 소스 파일은 `next/*`를 가져올 수 없다.

## 빈 Next 앱에 설치

Next 16(App Router)·React 19 앱 기준이다. 관리자에는 Tailwind가 필요 없다. 스타일이 미리 만들어져 있어서 앱은 어떤 CSS 구성이든 쓸 수 있다. 저장소는 Postgres만 지원한다. 가장 쉬운 길은 `npx monti init`(아래 2단계)이다. 1·2단계를 대신 해 주고 데이터베이스도 묻는다. 이 절의 나머지는 `monti init`이 하는 일이고, 읽어 보거나 손으로 할 때 쓴다. 순서는 `monti init` → 컬렉션 고치기 → `monti migrate`다.

### 1. 패키지

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/auth @monti-cms/nextjs next-themes @tanstack/react-query sonner \
  @tiptap/core @tiptap/pm @tiptap/react lucide-react
```

관리자 패키지와 AI 플러그인은 React Query·sonner·Tiptap·lucide 아이콘을 앱과 같은 하나로 써야 해서 앱이 설치한다(peer).
로그인은 `@monti-cms/auth`(Auth.js core, Next.js 없음)다. GitHub 로그인에 다른 패키지는 필요 없다. 프로바이더는 그 README를 본다.
명령줄 `monti`는 `@monti-cms/core`에 들어 있다(TypeScript 설정 파일은 함께 설치되는 tsx가 읽는다).

pnpm 12는 허락하지 않은 설치 스크립트가 있으면 설치를 실패로 끝낸다(10은 경고만 한다). tsx가 쓰는 esbuild의 설치 스크립트를 허락한다.

```yaml
# pnpm-workspace.yaml (앱 폴더)
allowBuilds:
  esbuild: true
```

### 2. `monti init`

앱 폴더(`package.json`이 있는 곳)에서 `npx monti init`으로 돌린다(`@monti-cms/core`를 설치한 뒤라면 `pnpm exec monti init`). 기존 Next.js(App Router) 앱에 Monti를 더한다. 앱을 읽고, 몇 가지를 묻고, 읽을 수 있는 파일을 적고, 패키지를 설치한 뒤, 남은 일을 쉬운 말로 적어 준다. **묻지 않고 파일을 덮어쓰지 않고**, 다시 돌려도 안전하다.

**알아내는 것:** App Router 폴더(`app/` 또는 `src/app/`), 패키지 매니저(락 파일이나 `packageManager`), TypeScript, 이미 있는 Tailwind·typography, 개발 포트(`dev` 스크립트), `.env.local`을 빠뜨린 `.gitignore`, Markdown·MDX 폴더(`content/`, `posts/`, `_posts/`, `blog/` 등). 그 폴더의 front matter 키가 시작용 `post` 컬렉션의 모양이 되고, 끝에서 `monti import <폴더>`를 권한다. `pages/`만 있는 앱은 이유를 알리고 멈춘다.

**질문**(각각 플래그가 있다. 아래 표):

| 질문 | 고르는 것 | 기본값 |
| --- | --- | --- |
| 데이터베이스 | Postgres URL 붙여넣기, 로컬 Docker Postgres(5432부터 비어 있는 첫 포트로 `docker-compose.yml`을 쓰고, Docker가 있으면 띄운다), 건너뛰기 | 건너뛰기 |
| 관리자 로그인 | GitHub. OAuth 앱을 만드는 순서와 정확한 콜백 주소(`<사이트 주소>/api/cms/auth/callback/github`)를 보여 주고, 숫자 GitHub id를 묻는다(비워도 된다) | |
| 언어 | 언어 코드, 기본 언어가 먼저 | `en` |
| 이미지 저장소 | S3 호환(S3·R2·MinIO. 설정은 `S3_*`), 또는 없음 | 없음 |
| 부가 기능 | AI 글쓰기, git 동기화(Bareun은 묻지 않는다) | 없음 |
| 블록 | 전부, 또는 `callout`, `collapsible`, `tabs`, `columns`, `code-explorer`, `mermaid`, `chart`, `tooltip`, `code-ref`, `color` 중에서 고르기 | 전부 |
| 관리자 경로 | `/studio` 같은 경로 | `/studio` |
| 블로그 테마 | 레지스트리로 블로그 테마 페이지 설치(`monti add blog-theme`) | 안 함 |

**쓰는 파일**(있는 파일은 그대로 두고, 그러겠다고 하거나 `--overwrite`를 줄 때만 바꾼다. `next.config`·`tsconfig.json`·`.gitignore`의 고침은 diff로 보여 주고 질문에서 물으며, `--yes`면 바로 한다):

| 내용 | 파일 |
| --- | --- |
| 하나뿐인 설정: 고른 기능마다 한 줄과 짧은 주석, 그다음 데이터베이스·로그인·저장소. 프리셋 뒤에 숨기는 것이 없다. 줄을 지우면 기능이 빠진다 | `monti.config.ts` |
| 스키마 파일: 시작용 `post` 컬렉션(콘텐츠를 찾으면 그 front matter대로), 언어, 시간대, 관리자 경로, 에디터용 `$schema` 링크 | `monti.schema.json` |
| 스키마 파일에서 쓴 타입(손으로 고치지 않는다) | `monti-env.d.ts` |
| 관리자 화면: 레이아웃(미리 만든 관리자 스타일시트를 불러온다)과 페이지 | `app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx` |
| 관리자 API와 로그인(`/api/cms/v1/*`, `/api/cms/auth/*`) | `app/api/cms/[...path]/route.ts` |
| 설정 잇기(`withCms`): 기본 모양이면 합치고 diff로 보여 주며, 아니면 바꿀 내용을 그대로 적어 준다 | `next.config.ts` |
| tsconfig에 없으면 `"resolveJsonModule": true`: 주석과 서식을 지키는 텍스트 삽입이고 diff로 보여 준다. `extends`가 있거나 모양이 특이하면 그대로 두고 할 일로 적는다 | `tsconfig.json` |
| `.gitignore`에 없으면 `.env.local`과 `.env*.local`(파일이 없으면 만든다). diff로 보여 준다 | `.gitignore` |
| 고른 기능이 읽는 모든 변수(값 없음) | `.env.example` |
| 직접 입력했거나 만든 값만: `MONTI_SECRET`(만든다), `DATABASE_URL`, `MONTI_ADMIN_GITHUB_ID`. 이미 있는 파일에는 없는 이름만 더한다 | `.env.local` |
| 로컬 Postgres(Docker를 골랐을 때만. compose 파일이 이미 있으면 건드리지 않고 넣을 서비스를 보여 준다) | `docker-compose.yml` |

`src/`를 쓰는 앱이면 설정 파일을 `src/`에, 라우트를 `src/app/` 아래에 만든다. Monti가 만드는 Next 파일은 셋이다: 관리자 레이아웃, 관리자 페이지, API 라우트. 레이아웃은 일부러 따로 둔다. Next는 동적 세그먼트(`[[...path]]`)의 값이 바뀔 때마다 그 아래 트리 전체를 다시 마운트하므로, 레이아웃을 페이지 안에 두면 화면을 옮길 때마다 관리자(내비게이션·쿼리 캐시·테마 프로바이더)가 다시 마운트된다. 한 세그먼트 위에 두어야 계속 마운트된 채로 남는다.

**파일을 쓴 뒤에는** 고른 기능에 필요한 패키지를 찾아낸 패키지 매니저로 설치하고, Docker 데이터베이스를 띄워 기다린 뒤, DB에 닿으면 `monti migrate`를 돌린다. 실패한 단계(네트워크 없음, Docker 없음)는 파일을 되돌리지 않는다. 실패로 표시하고 손으로 돌릴 명령을 목록에 적는다. 요약은 한 일을 먼저, 남은 일을 정확한 값이 든 번호 단계로 적는다: GitHub OAuth 앱, 그 콜백 주소와 ID·시크릿을 넣을 환경 변수 이름, 동작하지 않을 때 쓸 `monti doctor`(무엇이 잘못됐는지, 어디인지, 어떻게 고치는지를 알려 준다), `pnpm dev`, `/studio` 주소.

**질문 없이.** 플래그를 준 질문은 묻지 않는다. `--yes`, `--json`이거나 터미널이 없으면(CI) 아무것도 묻지 않고, 모든 질문이 플래그나 기본값을 쓴다. `--json` 출력은 JSON 문서 하나(`ok`, `created`, `updated`, `skipped`, `steps`, `notes`, `next` 등)이고, 오류는 `{ "ok": false, "error": "..." }`다. 종료 코드는 성공 0, 단계 실패나 잘못된 입력 1, 취소 130이다.

```sh
npx monti init                       # 대화형
npx monti init --yes                 # 전부 기본값: DB는 나중에, 블록 전부, /studio
npx monti init --yes --json --database docker --locales ko,en --storage s3 --extras ai,git-sync --blocks callout,tabs,mermaid
npx monti init --dry-run --yes       # 쓰고 돌릴 일만 보여 준다
```

| 플래그 | 뜻 | 기본값 |
| --- | --- | --- |
| `--yes`, `-y` | 질문 없이. 답이 없는 질문은 기본값 | |
| `--json` | 결과를 JSON으로 출력(`--yes`를 포함) | |
| `--dry-run` | 쓰지도 돌리지도 않고 계획만 보인다 | |
| `--database <값>` | `postgres://` URL, `docker`, `skip` | `skip` |
| `--admin-github-id <번호>` | 관리자의 숫자 GitHub id(`MONTI_ADMIN_GITHUB_ID`) | 없음 |
| `--site-url <url>` | 공개 사이트 주소. OAuth 콜백 주소에 쓴다 | `http://localhost:<개발 포트>` |
| `--locales <목록>` | 언어 코드, 기본 언어가 먼저(하나면 `--locale <코드>`도 같다) | `en` |
| `--time-zone <시간대>` | IANA 시간대 | `UTC` |
| `--storage <s3\|none>` | 이미지 저장소 | `none` |
| `--extras <목록>` | `ai`, `git-sync`, `none` | `none` |
| `--blocks <목록>` | `all`, `none`, 블록 이름 | `all` |
| `--admin-path <경로>` | 관리자 경로(영문자·숫자·`-`·`_`. `/`와 `/api` 아래는 안 된다) | `/studio` |
| `--blog-theme` / `--no-blog-theme` | 블로그 테마 페이지 추가 | 안 함 |
| `--overwrite` | 다른 내용인 기존 파일을 바꾼다 | 그대로 둔다 |
| `--no-install` | 패키지를 설치하지 않는다(그래서 마이그레이션과 테마 추가도 없다) | |
| `--no-migrate` | `monti migrate`를 돌리지 않는다 | |
| `--no-docker-start` | `docker-compose.yml`만 쓰고 띄우지 않는다 | |
| `--package-manager <이름>` | `npm`, `pnpm`, `yarn`, `bun` | 찾아낸 것 |

**관리자 경로는 `admin.path`(스키마 파일 또는 사이트 설정)와 라우트 폴더가 같아야 한다.** `monti init`은 둘을 함께 맞춘다. 나중에 바꿀 때는 둘을 함께 바꾼다. 관리자 API 경로(`/api/cms/v1`)는 바뀌지 않는다.

**안전.** 모든 쓰기는 프로젝트 밖의 경로(`..` 경로, 절대 경로, 밖으로 나가는 심볼릭 링크)를 거부하는 한 곳을 지난다. 모든 질문에 답하기 전에는 아무것도 쓰지 않으므로 Ctrl+C로 멈추면 프로젝트는 그대로다. 쓰다가 실패하면 오류가 이미 쓴 파일을 알려 주고(되돌리지 않는다) `monti init`을 다시 돌리라고 안내한다. 다시 돌리면 그 파일들은 그대로 둔다.

이미 `cms.config.ts`나 `cms.server.ts`가 있는 앱은 그대로 둔다. `monti init`은 두 번째 설정을 만들지 않고, 자기가 만들지 않은 설정 옆에는 스키마 파일도 만들지 않는다. 대신 둘을 `monti.config.ts`로 옮기라고("`cms.config.ts` + `cms.server.ts`에서 올리기") 알리고 `monti schema:extract`를 돌리라고 알린다("스키마 파일"). `monti.config.ts`가 JSON을 가져오므로 `tsconfig.json`에 `"resolveJsonModule": true`가 필요하다(`create-next-app`이 켜 두고, 없으면 `monti init`이 알린다).

### 3. 컬렉션 고치기

사이트의 데이터는 `monti.schema.json`에 있고, `monti.config.ts`가 그것을 불러와 코드가 필요한 것을 더한다("스키마 파일"). 관리자 화면은 인스턴스에서 사이트를 JSON 스냅샷으로 받으므로 스키마 파일에는 비밀 값이 없고, `monti.config.ts` 자체는 서버 전용이다. 만들어진 시작점은 이렇다.

```json
{
	"$schema": "./node_modules/@monti-cms/core/schema.json",
	"collections": {
		"post": {
			"label": "Post",
			"kind": "document",
			"path": "/posts/:slug",
			"icon": "file-text",
			"fields": {
				"title": { "kind": "text", "label": "Title", "required": true, "max": 200 },
				"slug": { "kind": "slug", "label": "Slug", "from": "title", "required": true },
				"summary": { "kind": "text", "label": "Summary", "role": "summary", "multiline": true, "fillFromBody": true }
			}
		}
	},
	"locales": [{ "code": "en", "name": "English" }],
	"defaultLocale": "en",
	"timeZone": "UTC",
	"site": { "name": "My site" }
}
```

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema, // 데이터는 monti.schema.json에 그대로 둔다
	plugins: [], // 기능마다 한 줄, 모두 인자 없이 동작한다: mdx(), seo(), callout(), ...
	database: postgres(), // DATABASE_URL, DATABASE_SCHEMA
	auth: auth({ providers: [github()] }), // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
	// storage: <아무 패키지의 어댑터>, // 미디어 올리기. 없으면 관리자가 미디어 메뉴를 숨긴다
});
```

여기서 `defineConfig`는 `@monti-cms/core/server`의 것이다. 사이트 옵션(`schema`·`plugins`·`blocks`·`site`·`admin`·`codeBlock`·`media`·`seed` …)과 서버 옵션(`database`·`auth`·`storage`·`secret` …)을 한 객체로 받아 CMS 인스턴스를 돌려준다("CMS 인스턴스" 절). 플러그인과 어댑터는 모두 인자 없이 동작하고 관례적인 환경 변수를 읽는다(아래를 본다). 명시한 옵션이 항상 이긴다.

컬렉션 이름(`post`)은 DB에 저장되므로 운영 중에 바꾸지 않는다. `kind`는 `document`(본문·초안·발행) 또는 `item`(태그 같은 작은 항목), `path`는 공개 주소로 본문 내부 링크와 미리보기 주소에 쓰고, 제목 필드는 `role: "title"`을 가진 필드(없으면 이름이 `title`인 필드)다.
`layout`·`list`를 적지 않으면 필드 순서대로 그리고 기본 목록 컬럼을 쓴다("컬렉션"). 파일을 고친 뒤에는 `pnpm exec monti schema:types`를 돌린다(`next dev`가 떠 있으면 저절로 돌아간다). 규칙은 아래 "스키마 파일"과 "설정"을 본다.

`monti.config.ts`가 CMS 인스턴스를 만들며 서버에서만 읽힌다. 서버 옵션은 저장소·미디어·로그인 연결과 비밀 값이다.
연결은 처음 쓸 때 만들고 환경 변수도 값이 처음 필요할 때 읽으므로, 빌드 중에는 환경 변수가 비어 있어도 된다. 이미지 올리기를 쓰려면 `@monti-cms/storage-s3`를 설치하고 그 저장소를 `storage`로 넣는다(미디어를 쓰는 사이트만, AWS SDK는 함께 설치된다):

```ts
import { s3Storage } from "@monti-cms/storage-s3";

storage: s3Storage(), // AWS S3, Cloudflare R2(S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com, S3_REGION=auto), MinIO 등 S3 API 저장소. S3_* 변수를 읽는다
```

변수 이름과 옵션은 패키지 README(`packages/storage-s3`)에 있다.

다른 저장소는 `@monti-cms/core/server`의 `MediaStore` 계약을 구현한 `MediaAdapter`(`{ name, createStore() }`)를 넣는다.

### 4. 환경 변수와 `monti migrate`

`.env.local`에 둔다.

| 이름 | 뜻 |
| --- | --- |
| `DATABASE_URL` | Postgres 연결 주소(`postgres()`가 읽는다) |
| `DATABASE_SCHEMA` | 선택. 스키마 이름(없으면 `public`). 이미 앱 표가 있는 DB에 붙일 때는 따로 두는 편이 안전하다. `monti migrate`가 없으면 만든다 |
| `MONTI_SECRET` | 임의의 긴 값(예: `openssl rand -base64 32`). 하나뿐인 비밀 값이다. 로그인 세션은 이 값에서 만든 키로 서명하고, 플러그인이 저장하는 값(AI 서비스 키, git-sync 토큰)도 이 값에서 만든 키로 암호화한다(`defineConfig({ secret })`에도 같은 값을 줄 수 있다). 바꿀 때는 옛 값을 `previousSecrets`에 남긴다("비밀 값") |
| `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET` | GitHub OAuth 앱(`github()`가 읽는다). 콜백 주소는 `<사이트 주소>/api/cms/auth/callback/github`. `next dev`에서는 필요 없다 |
| `MONTI_ADMIN_GITHUB_ID` | 관리자 GitHub 숫자 ID. 여럿이면 쉼표로 구분한다(`github()`가 읽는다). `next dev`에서는 필요 없다 |
| `SITE_URL` | 선택. 사이트의 공개 URL(`site.url`). 환경마다 다르다. 코드나 스키마 파일의 `site.url`이 있으면 그쪽이 이긴다 |
| `AUTH_TRUST_HOST` | 선택. `X-Forwarded-Host`를 덮어쓰는, 직접 운영하는 프록시(nginx, 로드 밸런서) 뒤에서 돌 때만 `true`. Vercel·Netlify·Cloudflare Pages 같은 플랫폼은 알아서 감지한다("호스트 신뢰" 참고) |

옵션에 명시한 값이 항상 이 환경 변수보다 앞서고, 다른 이름에서 값을 짐작하지 않는다. 필요한 값이 없으면 변수 이름을 알려 주는 오류가 난다(환경 변수는 값이 처음 쓰일 때 읽으므로 환경 변수 없이 빌드해도 실패하지 않는다). 개발용 로그인을 위한 변수는 없다. `next dev`에서는 저절로 켜진다("개발용 로그인 우회").

```sh
pnpm exec monti migrate
```

표를 만들거나 최신 모양으로 맞춘다(플러그인 표 포함). 여러 번 돌려도 결과가 같고, 패키지를 올린 뒤에도 다시 돌린다.
본체 변경은 번호 붙은 단계로 `cms_migrations`에 남아 아직 돌지 않은 단계만 돌고(한 트랜잭션), 같은 스키마에 동시에 돌려도
하나씩 돈다. 플러그인은 한 번만 할 일을 `storage.once(이름, 단계)`로 맡긴다("플러그인 저장소").
`monti migrate`(와 `cms.migrate()`)는 인스턴스의 형식(플러그인이 주는 것)을 마이그레이션에 넘긴다. MDX 글로 저장해 둔 본문을 읽는 옛 단계는 저장소에 그런 본문이 있을 때만 `@monti-cms/mdx`의 `mdx` 형식을 필요로 한다("코어에 있던 MDX에서 올리기").

- 환경 파일: 기본으로 `.env.local`·`.env`(있는 것만)를 읽는다. 셸에서 준 값이 이기고 앞 파일이 뒤 파일을 이긴다.
  `--env-file <파일>`(여러 번)로 고르고 `--no-env-file`이면 읽지 않는다.
- 파일: 설정 파일(인스턴스를 `cms`로 내보내는 모듈, `export const cms = …` 또는 default export)은 `--config <파일>` → `MONTI_CONFIG_PATH` → `./monti.config.ts`·`./src/monti.config.ts` 순서로 찾는다.
- `monti doctor`는 설정 전체를 점검하고 잘못된 것을 어떻게 고치는지 알려 준다. `"use client"` 파일이 설정에 닿지 않는지도 본다("문제 해결: `monti doctor`" 참고).
- 직접 만든 스크립트에서는 인스턴스를 불러와 부른다: `import { cms } from "./monti.config"; await cms.migrate(); await cms.close();`
  (`tsx --env-file=.env.local script.ts`로 돌린다. 인스턴스가 사이트 설정을 가지고 있어서 따로 이을 것이 없다).

### 5. 실행

`next dev`로 띄우고 관리자 경로(기본 `/admin`)를 연다.

### 로그인 경로

로그인 API는 기본으로 관리자 API 라우트가 함께 받는다(`/api/cms/auth/*`). 그래서 로그인 라우트 파일이 따로 없다.
예전처럼 `/api/auth/*`를 쓰는 앱(이미 등록한 OAuth 콜백 주소를 바꾸지 않으려는 앱)은 경로를 고르고 라우트 파일을 둔다.

```ts
// monti.config.ts
auth: auth({ providers: [/* … */], basePath: "/api/auth" }),

// app/api/auth/[...auth]/route.ts
import { cms } from "../../../../monti.config";
export const { GET, POST } = cms.authHandlers;
```

`basePath`가 기본값이 아니면 관리자 API 라우트는 `/api/cms/auth/*`를 받지 않는다(404).

### 선택 의존성

CMS 패키지의 선택 의존성(예: 블록 확장의 `mermaid`·`recharts`)은 그 기능을 쓸 때만 설치한다. 설치하지 않은 것은 `withCms`(`@monti-cms/nextjs/config`)가
빈 모듈(`@monti-cms/core/stubs/missing-optional`)로 이어 빌드가 멈추지 않게 하고, 그 기능을 쓰면 설치하라는 오류가 난다.
설치한 뒤에는 개발 서버를 다시 띄운다.

### 직접 잇기 (`monti init` 없이)

`monti init`이 하는 일을 손으로 하려면: `monti.config.ts`(`export const cms = defineConfig({ … })`)를 만들고, `next.config.ts`를
`withCms(nextConfig)`(`import { withCms } from "@monti-cms/nextjs/config"`)로 감싸고(더할 별칭도 `tsconfig.json` `paths` 항목도, 테스트(Vitest) 쪽 별칭도 없다),
Next 파일 셋(관리자 레이아웃과 페이지, API 라우트. 각 파일이 `monti.config.ts`에서 `cms`를 불러온다)을 두고, 관리자 레이아웃(`app/studio/layout.tsx`, 또는 고른 관리자 경로의 레이아웃)에서 미리 만든 관리자 스타일시트를 불러온다.

```ts
import "@monti-cms/admin/styles.css"; // 미리 만들어져 있다. 앱에 Tailwind·typography·tw-animate가 필요 없다
```

이 스타일시트는 관리자가 들어 있는 문서에만 영향을 주므로 앱 자체 페이지의 모습은 그대로다(`@monti-cms/admin` README의 "스타일" 참고).

### MDX 확장 (선택)

```sh
pnpm add @monti-cms/mdx
```

```ts
// monti.config.ts
import { mdx } from "@monti-cms/mdx";

export const cms = defineConfig({
	// …
	plugins: [mdx()], // `mdx` 형식과 관리자 원문 패널. 문법 확장은 mdx({ syntax: [...] })에 넣는다
});
```


코어는 문서를 저장하며 글 형식을 따로 갖지 않는다. 형식 플러그인이 없는 사이트는 문서(`doc`)만 받고, 글로 쓰면 `unknown_format`으로 실패한다. `format: "mdx"`와 `?format=mdx`는 이 패키지가 있어야 한다. 자세한 것은 `@monti-cms/mdx`의 README.

### 블록 확장 (선택)

```sh
pnpm add @monti-cms/blocks
```

```ts
// monti.config.ts
import { callout, tabs, tooltip } from "@monti-cms/blocks";

export const cms = defineConfig({
	// …
	plugins: [callout(), tabs(), tooltip()], // 블록마다 한 줄: 한 줄을 지우면 그 블록이 없어진다
});
```

```ts
import "@monti-cms/blocks/styles.css"; // 관리자 레이아웃에서 "@monti-cms/admin/styles.css" 뒤에(공개 페이지 스타일은 `@monti-cms/blocks/render.css`)
```

블록은 저마다 별도의 플러그인 함수이고 인자 없이 동작한다: `callout()`·`collapsible()`·`tabs()`·`columns()`·`codeExplorer()`·`mermaid()`·`chart()`·`tooltip()`·`codeRef()`·`color(options?)`. 전부 한꺼번에 더하는 `blocks()`는 없다. 글자 위에 겹치는 인라인 마크 `tooltip()`·`codeRef()`·`color()`는 `plugins`에 적은 순서대로 저장된다.

자세한 것은 `@monti-cms/blocks`의 README.

### AI 플러그인 (선택)

```sh
pnpm add @monti-cms/ai
```

```ts
// monti.config.ts
import { aiPlugin } from "@monti-cms/ai";

export const cms = defineConfig({
	// …
	// 기본 기능(주소·요약·태그 추천 등)이 필드 종류·역할·관계 대상으로 저절로 붙는다. 바꾸거나 끌 것만 `actions`에 적는다.
	plugins: [aiPlugin({ siteDescription: "기술 블로그" })],
});
```


자세한 것은 `@monti-cms/ai`의 README.

### SEO 확장 (선택)

```sh
pnpm add @monti-cms/seo
```

```ts
// monti.config.ts
import { seo, seoFields } from "@monti-cms/seo";

const article = defineCollection({
	// …
	fields: { title, slug, ...seoFields() }, // 검색 제목·설명·공유 이미지·숨기기·원본 주소 + 미리보기, 모두 SEO 탭
});

export const cms = defineConfig({
	// …
	plugins: [seo()],
});
```


자세한 것은 `@monti-cms/seo`의 README.

## 문제 해결: `monti doctor`

동작하지 않는 것이 있으면 먼저 이것을 돌린다(`monti init` 뒤와 배포 전에도 돌려 본다).

```sh
pnpm exec monti doctor
```

`monti migrate`처럼 앱을 불러온 뒤(env 파일, 그다음 `monti.config.ts`) 본체, 데이터베이스·로그인·저장소 어댑터, 모든 플러그인의 검사를 돌려 각각을 `ok`, `warn`, `FAIL`로 보여 준다. **경고와 실패마다 무엇이 잘못됐는지, 어디(파일, 환경 변수, 옵션)인지, 어떻게 고치는지**를 쉬운 말로 적는다. 앞의 문제 때문에 돌릴 수 없는 검사는 `skip`이다. 검사가 하나라도 실패하면 종료 코드가 1이다(경고는 바꾸지 않는다). 아무것도 바꾸지 않고, 비밀 값은 찍지 않는다.

```text
  FAIL  database/migrations   3 of 24 migrations are pending (0022_content_hash, 0023_events, 0024_x)
                              where: schema "public" (table cms_migrations)
                              fix:   run `monti migrate`; on a deployed site run it as a step of the deploy, before the new version starts
```

- `--json`은 도구와 CI를 위해 `{ ok, cwd, online, summary: { ok, warn, fail, skip }, checks: [{ id, group, title, status, message, where?, fix? }] }`를 찍는다. `id`는 `<그룹>/<검사>`다.
- `--online`은 네트워크를 쓰는 검사(토큰으로 git-sync 저장소에 닿는지, 키로 S3 버킷에 닿는지)도 돌린다. 없으면 `skip`이다.
- `--only <목록>`은 이름 붙인 그룹이나 id만 돌린다(`config`, `database`, `database/migrations`, `git-sync`). `monti doctor --only config`는 데이터베이스 없이 CI에서 돌릴 수 있는 검사다: 설정이 불러와지는지, 클라이언트 컴포넌트가 설정을 import하지 않는지.
- `--env-file <파일>`, `--no-env-file`, `--config <파일>`은 `monti migrate`와 같다.

출력 순서대로 검사하는 것:

| 그룹 | 검사 |
| --- | --- |
| `config` | env 파일, `.env.local`이 `.gitignore`에 있는지, 설정 파일을 찾았는지, 불러와지고 인스턴스를 내보내는지, **`"use client"` 파일이 설정이나 다른 서버 전용 모듈을 import하지 않는지**(`monti check:boundary`를 대신한다) |
| `schema` | 스키마 파일이 올바른지(문제마다 JSON 경로), `monti-env.d.ts`가 최신인지 |
| `database` | `DATABASE_URL`이 있고 Postgres URL인지, 데이터베이스에 닿는지(틀린 호스트·포트·비밀번호·데이터베이스 이름을 구분한다), `DATABASE_SCHEMA`가 있는지, **미적용 마이그레이션이 몇 개인지**(`monti migrate`) |
| `secrets` | `MONTI_SECRET`이 있고 충분히 강한지, 옛 `CMS_SECRET`·`AUTH_SECRET`이 아직 있지만 쓰이지 않는지 |
| `auth` | 로그인 방법, GitHub 클라이언트 id와 시크릿, 관리자가 있는지(숫자 id가 아니라 로그인 이름을 쓴 항목을 짚는다), `SITE_URL`, 호스트 신뢰 결과와 이유, OAuth 앱에 **등록할 콜백 URL**(`SITE_URL`에서 만든다) |
| `storage` | `s3Storage()`면 `S3_*` 값이 있고 형식이 맞는지, (`--online`) 키로 버킷에 닿는지 |
| `next` | 관리자 경로에 Next 파일 셋이 있고 알맞은 컴포넌트를 쓰는지(`admin.path`와 맞지 않는 폴더면 그 폴더를 짚는다), `next.config`가 `withCms`를 쓰는지, 관리자 주소 |
| `leftovers` | 옛 설정에서 남은 것과 정확한 단계: `cms.config.ts`·`cms.server.ts`와 그것을 import하는 파일, `monti.config.ts`에 남은 옛 옵션, 옛 변수 이름(`CMS_DATABASE_URL`, `CMS_SCHEMA`, `CMS_ADMIN_GITHUB_ID`, `CMS_DEV_AUTH_BYPASS`, `HOST_URL`), `(admin)` 라우트 폴더, `admin-components.tsx` |
| 플러그인 이름 | 플러그인이 더한 검사("플러그인"의 "`monti doctor` 검사"): git-sync(대상, 파일 형식, 토큰, 웹훅 시크릿, `--online`이면 저장소), AI 플러그인(연결이 저장돼 있는지), mdx(형식과 문법 확장이 불러와지는지) |

패키지가 던지는 오류도 같은 말투를 쓴다: 없는 `DATABASE_URL`·`MONTI_SECRET`·GitHub id·`S3_*` 값, 꺼져 있거나 마이그레이션되지 않은 데이터베이스, 올바르지 않은 스키마 파일, 어떤 플러그인도 제공하지 않는 형식, 인스턴스를 받지 못한 Next 파일. 각각 무엇이 잘못됐는지, 어디인지, 어떻게 고치는지를 말한다(오류 메시지 한 줄 안에서 `Where:`와 `Fix:`가 각 부분을 표시한다). 실행 중에 꺼져 있거나 마이그레이션되지 않은 데이터베이스를 만난 요청은 `503`으로 답하고, 서버 로그에 전체 메시지가 남는다.

## 기존 글 가져오기

`monti import <path>`는 `.md`·`.mdx` 글이 든 폴더(Astro, contentlayer를 쓰는 Next, Hugo, 메모 폴더)를 CMS로 가져온다. 한 번 옮기는 용도지만 다시 돌려도 된다. 어디로 갈지 짐작하고, 불분명한 것만 묻고, 글 사이 링크와 이미지를 풀어 주고, 관리자와 같은 파이프라인으로 쓴다(검증과 훅이 돌아서 발행 문제가 그대로 드러난다). 이름이 `migrate`가 아니라 `import`인 것은 `monti migrate`가 이미 데이터베이스 테이블을 만드는 명령이기 때문이다.

```sh
pnpm exec monti import content/posts --dry-run   # 먼저 보기: 개수, 필드 매핑, 문제 파일. 아무것도 쓰지 않는다
pnpm exec monti import content/posts             # 몇 가지 질문에 답하면 초안이 만들어진다
pnpm exec monti import content/posts --publish   # 프런트매터가 초안이 아닌 글을 발행한다
```

**필요한 것.** 파일의 형식은 확장자로 정하고, 설정이 등록한 형식(`cms.formats()`, "형식")에서 찾는다. MDX 플러그인(`@monti-cms/mdx`의 `plugins: [mdx()]`, 디렉티브 표기로 쓴 글이면 `directiveSyntax()`도)을 넣어야 하고, 없으면 명령이 멈추면서 그렇게 알려 준다. `.md`를 맡은 형식이 없으면 `.md`도 MDX 형식으로 읽으므로, 일반 마크다운에 `{`나 `<`가 섞여 있으면 그 파일이 파싱 오류가 된다(줄 번호와 함께 알려 주고 나머지 파일은 계속한다). `--format <name>`은 모든 파일을 한 형식으로 읽고, 매핑 파일의 `formats`는 확장자마다 하나씩 정한다. 로컬 이미지는 설정의 미디어 저장소(`storage`, 예: `s3Storage()`)에 올린다. 저장소가 없으면 URL로 남고 보고서가 그렇게 알려 준다. 가져오기는 기억을 데이터베이스에 두므로 먼저 `monti migrate`를 돌려 둔다.

**무엇을 짐작하고 언제 묻는가.** 이름이 맞으면 묻지 않고 짐작한 대로 쓴다. 그 밖에는 질문이다(번호를 고르고, Enter는 기본값). `--yes`이거나 터미널이 아니면 불분명한 것은 빼 둔다.

| 원본 | 가는 곳 | 묻는 경우 |
| --- | --- | --- |
| 폴더(`content/posts`) | 컬렉션: 폴더 이름을 컬렉션 이름·레이블과 단수·복수 구분 없이 견준다(`posts` → `post`) | 맞는 컬렉션이 없을 때(선택지는 컬렉션들과 "이 폴더는 가져오지 않기") |
| 프런트매터의 `slug`, 없으면 파일 이름(`hello.mdx`, `hello/index.mdx`는 `hello`) | 주소 | 묻지 않는다 |
| 파일 이름 `hello.ko.mdx`, 언어 폴더(`ko/hello.mdx`), 프런트매터의 `lang`/`locale`/`language` | 언어. 한 글의 여러 언어 파일은 짝지어지고, 기본 언어 파일이 원본이고 나머지는 그 주소를 쓰는 번역이 된다 | 묻지 않는다. 사이트에 없는 언어면 그 파일이 실패한다 |
| `title` | 제목 역할 필드 | 묻지 않는다 |
| `date`, `pubDate`, `publishDate`, `publishedAt` | 항목의 발행일(발행할 때 정해지므로 옛 글이 제 날짜를 지닌다) | 묻지 않는다 |
| `draft: true`, `published: false` | `--publish`를 줘도 초안으로 남는다 | 묻지 않는다 |
| `description`, `summary`, `excerpt` | `summary` 역할 필드 | 묻지 않는다 |
| `tags`, `categories`, `category`, `keywords`, `series` | 슬러그로 찾는 관계 필드(`Next.js` 같은 이름은 슬러그 `nextjs`로 바꾼다). 없는 대상은 매핑에 `create: true`가 있으면 만든다(태그 같은 아이템 컬렉션은 기본 켜짐) | 맞을 수 있는 관계 필드가 여럿이거나 없을 때, 그리고 없는 대상을 만들지 한 번 |
| 그 밖의 키 | 이름이 같은 필드 | 묻지 않는다. 필드가 없는 키는 건너뛰고, 그 키가 있는 파일마다 알려 준다 |

질문이 끝나면 매핑을 보여 주고 한 번 묻는다("Use it and save it for the next run?"). 저장된 매핑이 모든 것에 답하는 실행은 아무것도 묻지 않는다.

**매핑 파일**은 명령을 돌리는 곳 옆의 `monti.import.json`이다(`--mapping <file>`로 다른 파일을 고른다). 처음 확인한 실행 뒤에 쓰이고(`--dry-run`은 쓰지 않는다) 이후 모든 실행이 읽는다. 결정을 바꾸려면 직접 고치고, 폴더 항목을 지우면 그 폴더를 다시 짐작한다. 파일에 아직 없는 키(새 프런트매터 키)는 묻지 않고 건너뛰며 알려 준다.

```json
{
	"version": 1,
	"locale": { "from": ["frontMatter", "filename"] },
	"publicDir": "public",
	"folders": {
		"posts": {
			"collection": "post",
			"fields": {
				"title": "title",
				"slug": "@slug",
				"date": "@publishedAt",
				"draft": "@draft",
				"lang": "@locale",
				"summary": "summary",
				"tags": { "field": "tagIds", "create": true },
				"category": { "field": "categoryId", "create": false },
				"author": "@skip"
			}
		},
		"pages": { "collection": null, "fields": {} }
	}
}
```

폴더는 가져오는 폴더 아래 파일 경로의 첫 폴더다(언어 폴더와 `index` 파일의 폴더는 세지 않는다). `.`은 가져오는 폴더 바로 아래의 파일이며 그 폴더 이름으로 견준다. `collection: null`은 폴더를 뺀다. 키는 필드 이름으로 가거나, 관계는 `{ "field", "create" }`로 가거나, `@publishedAt`·`@slug`·`@locale`·`@draft`(참이면 초안)·`@published`(거짓이면 초안)·`@skip` 중 하나로 간다. `locale.from`은 언어를 읽는 곳을 앞에서부터 나열한다(`frontMatter`, `filename`, `folder`. 기본은 파일이 실제로 쓰는 것). `publicDir`은 `/images/a.png`를 찾는 곳이다(글 옆이나 그 위의 `public` 또는 `static`). `formats`(확장자 → 형식 이름)는 선택이다.

**링크와 이미지.** 가져온 파일끼리의 내부 링크는 항목 id 링크가 되므로 나중에 슬러그를 바꿔도 깨지지 않는다. 상대 경로(`./other.mdx`, `../posts/other`, `other/`, 폴더의 `index`)와 사이트 경로(`/posts/other`, 또는 옛 사이트의 `/blog/2024/other`. 그 주소를 가진 글이 하나뿐일 때 마지막 부분으로 찾고, 둘이면 폴더로 가른다)를 모두 풀어 준다. 찾지 못했거나 둘 중 하나일 수 있는 링크는 쓴 그대로 두고 알려 준다. `#section`이나 `?query`는 항목 링크가 담을 수 없어 버려진다(보고서에 개수가 나온다). 같은 실행에서 나중에 만들어지는 파일의 링크는 두 번째 패스에서 푼다. 로컬 이미지(`![](./cover.png)`, `![](/images/a.png)`, 미디어 필드의 경로)는 SHA-256 기준으로 한 번만 올라가므로 한 파일을 쓰는 두 글이 미디어 항목 하나를 함께 쓰고(실행이 달라도 같다) 본문은 미디어 항목을 가리킨다. 디스크에 없거나 미디어 라이브러리가 받지 않는 형식의 이미지는 쓴 그대로 두고 경고한다. MDX 안의 HTML `<img>`는 바꾸지 않는다.

**쓰기.** 모든 파일이 하나뿐인 쓰기 파이프라인인 `cms.contentService()`를 지난다. 1패스는 모든 파일을 초안으로 저장하고(기본 언어 파일이 먼저, 그다음 원본에서 `createTranslation`으로 만드는 번역), 2패스는 아직 항목이 없던 파일을 가리키던 본문을 다시 저장하고, 3패스는 `--publish`일 때 발행한다. 파이프라인이 거절한 발행(필수 필드 누락, `unparsed_body`)은 가져오기 실패가 아니다. 항목은 초안으로 남고 파일 줄에 이유가 나온다. `--publish`는 프런트매터가 초안이 아닌 항목만 발행하고 발행일을 `date`로 정한다. 없으면 모두 초안으로 만들고 요약이 그렇게 말한다.

**다시 돌리기.** 어느 파일이 어느 항목이 되었는지는 저장소의 파일이 아니라 데이터베이스의 플러그인 저장소(`cms.storage("monti-import")`, 컬렉션 `files`, 키는 명령을 돌리는 곳 기준 파일 경로)에 기억한다. 기억은 항목에 속하므로, 두 번째 데이터베이스는 처음부터 시작하고 복원한 백업은 기억도 되돌려 오며 git의 내용이 데이터베이스와 어긋날 일이 없다. 기록에는 항목 id, 파일과 그것을 읽은 매핑을 함께 해시한 값, 발행 여부, 가져오기가 끝났을 때 항목의 버전이 들어 있다. 그래서 다시 돌리면:

- 해시가 같은 파일은 건너뛴다("unchanged since the last import"). `--publish`이면 남아 있던 초안은 다시 쓰지 않고 발행만 한다.
- 파일이나 매핑이 바뀌면 새 항목이 아니라 같은 항목을 고친다. 블록이 짝지어지는 곳은 블록 id를 유지한다.
- 바뀐 파일이라도 지난 가져오기 뒤 CMS에서 고친 항목은 건너뛴다("edited in the CMS since the last import"). `--overwrite`를 주면 덮어쓴다. 휴지통이나 보관함에 있는 항목도 건너뛴다.
- CMS에서 지운 항목은 다시 만든다.
- 실패한 파일은 다시 시도하고, 중간에 멈춘 실행은 이어서 한다(멈추기 전에 만든 항목은 중복 없이 다시 찾는다).

이미지는 같은 식으로 기억하고(`media` 컬렉션, SHA-256), 태그와 카테고리는 만들기 전에 슬러그로 먼저 찾으므로 어느 것도 두 번 만들어지지 않는다.

| 플래그 | 뜻 |
| --- | --- |
| `--dry-run` | 컬렉션별 개수, 필드 매핑, 만들어질 것, 문제 파일(파싱 오류, 없는 필드, 필수 누락, 풀리지 않는 링크·이미지)을 출력한다. 매핑도 포함해 아무것도 쓰지 않는다 |
| `--publish` | 프런트매터가 초안이 아닌 항목을 발행한다(기본은 초안으로 만들기) |
| `--collection <name>` | 모든 폴더를 이 컬렉션으로 보낸다 |
| `--format <name>` | 모든 파일을 이 형식으로 읽는다 |
| `--mapping <file>` | 매핑 파일(기본 `./monti.import.json`) |
| `--yes`, `-y` | 묻지 않는다. 짐작한 대로 쓰고 불분명한 것은 뺀다 |
| `--json` | 보고서를 JSON으로 출력한다(질문 없음. 스크립트·CI용) |
| `--overwrite` | 지난 가져오기 뒤 CMS에서 고친 항목을 덮어쓴다 |
| `--env-file`, `--no-env-file`, `--config` | `monti migrate`와 같다 |

**보고서**는 가져온·고친·건너뛴·실패한 파일을 이유와 함께 나열하고, 태그·카테고리로 만든 항목, 이미지, 링크, 그리고 쉬운 말 요약을 보여 준다("Of 12 files, imported 9 new files, skipped 2 files, 1 file failed. 8 entries are drafts. Run again with --publish ..."). 파일이 하나라도 실패하면 종료 코드가 1이다(dry run은 제외). 스크립트가 거기서 멈출 수 있다.

아직 다루지 않는 것: 다른 원본(`--from wordpress`는 계획 중), 기본 언어가 아닌 언어의 아이템 컬렉션, 훅에서 파일의 출처를 아는 것(훅은 항목만 볼 뿐 어느 파일에서 왔는지는 보지 못한다).

## CMS 인스턴스

`defineConfig({ … })`(`@monti-cms/core/server`)는 사이트 옵션과 서버 옵션을 서버의 모든 곳이 쓰는 인스턴스로 만든다. 인스턴스가 사이트(풀어 놓은 사이트 설정, `cms.site`)·콘텐츠 저장소·서비스·미디어 저장소·로그인 연결·
플러그인 서버 모듈·쓰기 훅·비밀 값을 가진다. 전역 상태는 없어서, 설정이 다른 인스턴스 둘이 한 프로세스에 나란히 있을 수 있다(테스트·스크립트·사이트와 DB 여러 개).
연결은 처음 쓸 때 만들므로 import나 빌드 때 인스턴스를 만들어도 어디에도 연결하지 않는다.

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import { callout } from "@monti-cms/blocks";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,                                   // 데이터는 monti.schema.json에 그대로 둔다
	plugins: [mdx(), callout()],              // 기능마다 한 줄, 모두 인자 없이 동작한다
	database: postgres(),                     // DATABASE_URL, DATABASE_SCHEMA
	auth: auth({ providers: [github()] }), // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
	// storage: <아무 패키지의 어댑터>,        // 미디어 올리기. 없으면 관리자가 미디어 메뉴를 숨긴다
});
```

나머지는 모두 이 파일에서 `cms`를 불러다 쓴다. `defineConfig`는 사이트 옵션(`schema`, 또는 `collections`와 `locales`, 그리고 `plugins`·`blocks`·`site`·`admin`·`codeBlock`·`media`·`seed` …)과 서버 옵션("서버 옵션" 절)을 받는다. `database`와 `auth`는 필수이고 나머지는 선택이다.

공개된 `defineConfig`는 `@monti-cms/core/server`의 것 하나뿐이다. `@monti-cms/core`(루트 진입점)는 더 이상 `defineConfig`를 내보내지 않는다. 낮은 수준 API인 `createCms({ config, server })`(`server`는 `CmsServerConfig`)는 `@monti-cms/core`의 `defineSite`로 만든 사이트 설정을 받으며, 테스트와 도구가 이것을 쓴다. `defineServerConfig`는 없어졌다.

`site.url`은 관례대로 `SITE_URL` 환경 변수에서 읽는다. 코드의 `site.url`이나 스키마 파일의 `site.url`이 정하면 그쪽이 이긴다.

`cms.config.ts` + `cms.server.ts`에서 옮긴다면 "`cms.config.ts` + `cms.server.ts`에서 올리기"를 본다.

| 어디서 | 코드 |
| --- | --- |
| 관리자 API 라우트(`app/api/cms/[...path]/route.ts`) | `export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);` (`@monti-cms/nextjs`의 `createRouteHandler`, `cms.handle(request)`의 Next 어댑터) |
| 다른 호스트의 관리자 API | `cms.handle(request)`: 표준 `Request`를 받아 `Response`를 돌려준다 |
| 관리자 레이아웃·페이지 | `<CmsAdminLayout cms={cms}>…</CmsAdminLayout>`, `<CmsAdminPage cms={cms} {...props} />`, 레이아웃 파일의 `export const generateMetadata = () => cmsAdminMetadata(cms);`(`@monti-cms/nextjs/admin`) |
| 사이트 페이지(서버 컴포넌트·sitemap·RSS) | `cms.read.getEntry(…)`·`cms.read.listEntries(…)`·`cms.read.getTranslations(…)`·`cms.read.getPreview(…)`(`format: "mdx"`를 넘기면 본문을 그 형식의 글로도 받는다. `entry.body`, "형식" 절) |
| 공개 미디어와 링크 | `entry.refs`(`entry.doc`에 쓰인 미디어의 URL과 내부 링크의 주소. `<CmsContent cms={cms} entry={entry} />`가 그린다), `cms.read.mediaUrl(mediaId)` |
| 저장소·설정 | `cms.store()`·`cms.contentService()`·`cms.bulkService()`·`cms.mediaStore()`·`cms.storage(플러그인이름)`·`cms.secrets(플러그인이름)`·`cms.auth()`·`cms.authGateway`·`cms.authHandlers`·`cms.isMediaConfigured` |
| 스크립트·명령줄 | `cms.migrate()`·`cms.close()` |
| 플러그인 라우트 | `adminRoute(async ({ request, params, auth, cms }) => …)`: 라우트는 자신을 맡은 인스턴스를 받는다 |
| 사이트 | `cms.site`: 컬렉션과 그 규칙·언어·URL·블록·코드 블록 설정·관리자 주소와 언어("사이트 설정은 인스턴스에 속한다") |
| 테스트 | `@monti-cms/core/testing`의 `fakeCms({ config, store, verifyAdmin, … })`: 테스트가 준 부품 위에 만든 진짜 인스턴스(`config`를 주지 않으면 영어 사이트 하나짜리 최소 설정) |

HTTP 계층은 표준 웹 `Request`와 `Response`로 동작한다.
관리자 API, 로그인 연결, 공개 API, 플러그인 라우트에는 `NextRequest`, `NextResponse`, `request.nextUrl`을 쓰지 않는다.
`cms.handle(request)`가 요청 하나를 처리하고(`/api/cms/` 뒤의 경로는 URL에서 읽는다), `@monti-cms/nextjs`의 `createRouteHandler(cms)`는 그 위에 얹은 얇은 Next 어댑터다.
플러그인 라우트(`adminRoute`)는 표준 `Request`를 받는다. 쿼리는 `new URL(request.url).searchParams`로 읽고, 응답은 `Response.json(…)`으로 만든다.
코어는 Next.js에서 아무것도 가져오지 않는다. 호스트가 대 주는 것은 로그인 연결로 들어온다. `CmsAuth.requestHeaders()`(처리 중인 요청의 헤더, 개발용 로그인 우회와 `session()`이 읽는다)와 `CmsAuth.rethrow(error)`(로그인 라이브러리가 던지는 리다이렉트를 호스트까지 보낸다. `@monti-cms/auth`는 `Response`로 답하므로 필요 없다)다. Next 통합(`@monti-cms/nextjs`의 `createRouteHandler(cms)`, `CmsAdminLayout`, `CmsAdminPage`, `cmsAdminMetadata`)이 `cms.attachHost(host)`로 Next 요청 헤더를 인스턴스에 직접 붙이므로(`RequestHost`는 `@monti-cms/core/server`에서 온다. `AuthCreateContext`에는 `host: RequestHost`가 있다) 설정에 호스트를 적지 않는다. `auth({ host })`는 Next 통합 밖에서 쓰는 명시적 재정의로 남아 있고, 붙여 둔 호스트보다 우선한다. 다른 프레임워크의 호스트는 제 것을 채운다.

읽기 API는 인스턴스에 달려 있다(`getEntry(cms, …)`가 아니라 `cms.read.getEntry(…)`). 사이트 코드가 하나만 불러오면 되고, 타입(`MetadataFor` 등)은 `@monti-cms/core/read`에 남는다.

**개발 중 다시 불러오기.** `next dev`는 고친 뒤 `monti.config.ts`를 다시 실행하고, 그러면 인스턴스를 또 만든다. 새 DB 어댑터가 연결 풀을 하나 더 열고 앞의 것은 닫지 않는다.
그래서 개발 중(`NODE_ENV=development`)에만, 같은 `id`(기본 `"default"`)로 먼저 만든 인스턴스의 DB 어댑터(와 미디어 저장소)를 새 인스턴스가 다시 쓴다.
`globalThis`의 `Symbol.for("monti.cms.dev-connections")` 항목 하나에 둔다. 나머지(저장소·서비스·로그인 연결·플러그인·훅·비밀 값)는 새 설정으로 다시 만들어서 훅과 옵션을 고치면 바로 반영된다.
DB 연결 자체를 바꾸는 것은 다시 시작해야 한다. 운영과 테스트에는 이런 캐시가 없고 인스턴스가 자기 연결만 가진다. 개발 프로세스 하나에서 인스턴스를 둘 이상 만들면 각각 `id`를 준다: `createCms({ id: "reports", config, server })`.

### 사이트 설정은 인스턴스에 속한다

인스턴스는 사이트 설정을 값으로 받아 가진다(`defineConfig`가 사이트 옵션으로 만들고, 직접 만든 설정은 `createCms({ config })`로 넘긴다). 설정 별칭도, 설정에서 뽑아 만든 모듈 수준 상수도 없으므로 모듈을 불러올 때 설정을 알고 있다고 가정하는 곳이 없고, 한 프로세스가
사이트를 여럿 가질 수 있다. `createSite(config)`(`@monti-cms/core/client`)는 설정을 `Site`로 푼다: `LOCALES`·`DEFAULT_LOCALE`·`COLLECTIONS`·`schemaOf(이름)`·`storedFields(이름)`·`contentPath(…)`·`parseInternalLink(…)`·`adminHref(…)`·`BLOCKS`·
`CODE_LINE_EFFECTS`·`getPluginOptions(이름)`·`createTranslator(messages)`와, 전에는 설정을 읽어 상수와 함수로 내보내던 나머지다. 인스턴스는 `Site`를 `cms.site`로 가진다
(`cms.site.config`는 설정 객체 그대로다). 설정이 필요하던 모든 곳은 인스턴스에서 받는다:

| 곳 | 사이트를 받는 데 |
| --- | --- |
| 저장소·서비스·읽기 API·HTTP 핸들러·플러그인·로그인 연결·`monti migrate` | 인스턴스: `createCms`가 `cms.site`를 넘긴다(`createStore({ site })`·`createContentService(store, { site })`·`createRead({ site })`·`AuthCreateContext.site` …) |
| 관리자 화면 | `<CmsAdminLayout cms={cms}>`가 화면을 `<SiteProvider config={cms.site.snapshot()}>`로 감싸고, 클라이언트 컴포넌트는 `useSite()`·`useTranslator(messages)`(`@monti-cms/core/client`)로 읽는다. 브라우저는 설정 파일을 불러오지 않는다 |
| 공개 렌더러 | `<CmsContent cms={cms} entry={entry} />`와 `renderDocument(doc, { site: cms.site })`: 사이트가 어떤 블록·마크·코드 펜스가 있는지, 줄 효과와 하이라이트 테마, 더해지는 플러그인 컴포넌트를 정한다 |
| 직접 짠 코드 | 서버에서는 `cms.site`, 클라이언트 컴포넌트에서는 `useSite()`. 사이트가 필요한 도우미는 매개변수로 받는다 |

**브라우저로 가는 것.** `site.snapshot()`은 설정을 일반 데이터로 만든 것이다. 컬렉션·언어·`site`·`admin`·`timeZone`·`media`·`codeBlock` 설정, 모든 블록(플러그인 블록 포함), 플러그인마다 `name`·`nav`·`options`·`contributes`를 JSON으로 담는다. 플러그인의 `options`나
`contributes` 안의 함수, 함수인 `admin.messages` 문구(문자열은 간다), 플러그인의 `server`·`admin`·`render`·`formats`·`validate`는 가지 않는다. 관리자 레이아웃이 플러그인의 관리자 모듈을 서버에서 불러 그 프로바이더를 직접 그린다. 브라우저에 필요한 `options` 값은 JSON으로 둔다.

**타입.** 타입은 넘긴 설정을 따라가며 등록 단계가 없다. `defineConfig({ … })`(와 `createCms({ config })`)는 `Cms<typeof config>`를 돌려주므로 `cms.read.listEntries({ collection: "post" })`는 컬렉션 이름과 각 컬렉션의 메타데이터를 알고(`MetadataFor<"post", typeof config>`, `CollectionName<typeof config>`),
설정에 없는 컬렉션은 타입 오류다. 라이브러리 타입이 인스턴스를 볼 수 없는 곳에서는 설정 타입을 준다: `DocumentComponentsFor<typeof config>`나 `DocumentComponentsOf<typeof cms>`가 `<CmsContent>`의 `components`(블록 이름과 블록마다의 속성 props)를 타입으로 정하고, AI 플러그인의 동작 이름도 같은 식으로 설정 타입을 받는다.
그냥 `Cms`나 `Site`는 어떤 설정의 인스턴스든 가리키고 이름은 `string`이다. 설정이 다른 인스턴스 둘은 따로 타입이 정해진다. 데이터를 스키마 파일에 두는 사이트는 `monti schema:types`가 쓰는 선언 파일에서 같은 타입을 얻는다("스키마 파일").

### 서버 전용 설정

`monti.config.ts`에는 데이터베이스와 로그인 설정이 있으므로 서버만 불러올 수 있다. 관리자도 불러오지 않는다. 관리자 레이아웃(`<CmsAdminLayout cms={cms}>`, 서버 컴포넌트)이 브라우저에 사이트의 JSON 스냅샷(`cms.site.snapshot()`)을 넘기고, 관리자의 클라이언트 컴포넌트는 `useSite()`로 읽는다.

- `defineConfig`는 `window`가 있는 곳에서 실행되면 오류를 던진다. 실수가 설정을 브라우저로 보내기 전에 첫 로드에서 드러난다.
- `monti doctor`의 `config/boundary` 검사는 빌드 없이 소스를 읽어, `"use client"` 파일이 import를 따라가 `monti.config.ts`에 닿거나 `@monti-cms/core/server`·`@monti-cms/core/runtime`·`@monti-cms/core/plugin/server`·`@monti-cms/auth`·`@monti-cms/nextjs/auth`를 불러오면 실패한다. 타입만 가져오는 import는 세지 않는다. CI에서는 `monti doctor --only config/boundary`를 돌린다(데이터베이스가 필요 없다). `monti check:boundary`는 없어졌다.
- `withCms`(`next.config.ts`)는 `next dev`를 시작할 때 한 번 같은 검사를 하고 경고한다.
- 사이트의 값이 필요한 클라이언트 컴포넌트는 `useSite()`를, 타입이 필요하면 `import type`을 쓴다.

### `@cms-config` 별칭에서 올리기

- 설정 파일(지금은 `monti.config.ts`: `export const cms = defineConfig({ … })`)에서 인스턴스를 만든다. 이 글은 `createCms({ config, server })` 시절에 쓰였다.
- `tsconfig.json` `paths`와 Vitest `resolve.alias`에서 `"@cms-config"`를 지운다. `withCms(nextConfig)`는 옵션을 받지 않는다. `monti migrate`에는 `--config` 옵션이 없고 `CMS_CONFIG_PATH`도 읽지 않는다. 인스턴스인 설정 파일을 불러온다. `@monti-cms/core/register`는 없어졌다: 스크립트는 그냥 `tsx`로 돌린다.
- 관리자 레이아웃: `export { cmsAdminMetadata as metadata } from "@monti-cms/nextjs/admin"` 대신 `export const generateMetadata = () => cmsAdminMetadata(cms);`(제목이 인스턴스의 사이트 이름과 관리자 언어를 따른다).
- 렌더링: `<CmsContent cms={cms} entry={entry} />`와 `renderDocument(doc, { site: cms.site, … })`, `renderMdx(doc, { site })`도 같다. `components` 표의 타입은 전의 `DocumentComponents`(이제 타입이 없는 표다) 대신 `DocumentComponentsOf<typeof cms>`(또는 `DocumentComponentsFor<typeof config>`)로 적는다.
- `@monti-cms/core/client`가 내보내던 설정 파생 값과 도우미(`LOCALES`·`DEFAULT_LOCALE`·`isLocale`·`localizePath`·`COLLECTIONS`·`schemaOf`·`contentPath`·`parseInternalLink`·`adminHref`·`SITE_NAME`·`BLOCKS`·`CODE_LINE_EFFECTS`·`getPluginOptions` …)는 사이트의 멤버다: 서버에서는 `cms.site.LOCALES`, 클라이언트 컴포넌트에서는 `useSite().LOCALES`.
  모듈 수준의 `createTranslator(messages)`는 `site.createTranslator(messages)`가 되고, 컴포넌트 안에서는 `useTranslator(messages)`다. `formatDateTimeInput`·`parseDateTimeInput`은 시간대를 받는다(또는 사이트의 것을 쓴다: `site.formatDateTimeInput(value)`).
- 플러그인과 어댑터: `CmsServerPlugin`과 라우트는 그대로다(받는 인스턴스에 `cms.site`가 있다). `DatabaseAdapter`는 사이트를 받고(`createStore({ site })`, `migrate({ site, formats })`), `AuthAdapter`는 `create({ site, loginPath, trustHost })`로 받는다.
  블록과 줄 효과 정의가 `createActiveTranslator`로 고르는 글은 사이트를 만들 때 그 사이트의 관리자 언어로 한 번 읽는다. 그 밖에 실행 중에 번역하는 것은 `site.createTranslator`를 쓴다.
- 테스트: 설정 모듈을 모킹할 필요가 없다. 테스트에 필요한 사이트나 인스턴스를 만들고(`createSite(config)`·`fakeCms({ config })`·`createCms({ config, server })`), React 트리는 `<SiteProvider site={site}>`로 감싼다.

### `@monti-cms/nextjs`로 올리기

Next에 묶인 코드는 모두 `@monti-cms/core`와 `@monti-cms/admin`에서 새 패키지 `@monti-cms/nextjs`로 옮겼다. 옛 자리에는 별칭이 남아 있지 않다.

- `@monti-cms/nextjs`를 설치한다(`next`는 이 패키지의 peer다. 코어와 관리자는 더 이상 요구하지 않는다).
- `next.config.ts`: `import { withCms } from "@monti-cms/core/next"`는 `from "@monti-cms/nextjs/config"`가 된다.
- `githubAuth`는 `@monti-cms/auth`로 대체됐다("`@monti-cms/auth`로 올리기"를 본다).
- `app/api/cms/[...path]/route.ts`: `cms.routeHandler()`는 `@monti-cms/nextjs`의 `createRouteHandler(cms)`가 된다. `CmsRouteHandler` 타입도 거기서 내보낸다.
- 관리자 레이아웃·페이지: `@monti-cms/admin/next`는 `@monti-cms/nextjs/admin`이 된다(`CmsAdminLayout`·`CmsAdminPage`·`CmsAdminPageProps`·`cmsAdminMetadata`, props는 같다). 레이아웃이 관리자용 App Router 어댑터를 그린다.
- 관리자 메시지: 페이지 제목 키가 `cms-admin.next` 사전에서 `cms-admin.layout`으로 옮겼다(`admin.messages["cms-admin.next"]`를 덮어쓴 경우에만 해당한다).
- 직접 만든 `AuthAdapter`: `CmsAuth`에 선택 항목 `requestHeaders()`와 `rethrow(error)`가 생겼다. `requestHeaders`가 없으면 개발용 로그인 우회는 적용되지 않는다.
- `CmsAdminLayout`이 아닌 다른 방법으로 관리자 화면을 붙인다면: `NextAdminRouter`(`@monti-cms/nextjs/admin`)로, 또는 직접 만든 어댑터를 준 `AdminRouterProvider`로 감싼다.

### `@monti-cms/auth`로 올리기

GitHub 로그인이 NextAuth(`next-auth`, `@monti-cms/nextjs` 안)에서 프레임워크에 묶이지 않는 패키지 `@monti-cms/auth`로 옮겼다. Auth.js core 위에 만들었고 로그인 방법을 프로바이더로 받는다.

- `@monti-cms/auth`를 설치한다. `@monti-cms/nextjs/auth`의 `githubAuth`는 없어졌다. 아래 모양으로 바꾼다.
- 새 모양은 `auth: auth({ providers: [github({ clientId, clientSecret, admins: [id] })], devBypass, secret })`다(지금은 관례적인 환경 변수가 있으면 `github()`와 `auth()`에 옵션이 필요 없다. "환경 변수와 `monti migrate`" 참고). `auth`는 `@monti-cms/auth`, `github`는 `@monti-cms/auth/github`에서 온다(호스트는 Next 통합이 붙인다. "CMS 인스턴스" 절 참고). `adminIds`는 프로바이더의 `admins`가 되고 여전히 GitHub 숫자 ID를 받는다(로그인 이름은 처음부터 비교하지 않았다).
- 모두 한 번 다시 로그인한다. NextAuth가 만든 세션은 읽지 않는다. OAuth 콜백 URL(`/api/cms/auth/callback/github`)과 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·`AUTH_URL`·`AUTH_TRUST_HOST`는 이 이동에서 바뀌지 않았다(세션 비밀 값은 지금 `MONTI_SECRET`이다. "`cms.config.ts` + `cms.server.ts`에서 올리기" 참고). `package.json`에서 `next-auth`는 빼도 된다.
- 계정 ID에 프로바이더가 붙는다(`github:12345678`). `AuthContext.accountId`, `CmsAuth.devUserId`, 이름이 없을 때 변경 기록에 남는 작성자가 그렇다. 직접 만든 `CmsAuth`의 `isAdmin(userId)`는 이 값을 받는다.
- `CmsAuth`가 바뀐 곳(직접 만든 `AuthAdapter`용): `session(request?)`가 요청을 받을 수 있고, `signIn`·`signOut`이 라우트가 그대로 돌려줄 `Response`(쿠키를 실은 리다이렉트)로 끝날 수 있으며, `AuthProvider`에 선택 항목 `icon`이, `AuthCreateContext`에 `storage(plugin)`(`cms.storage`)이 생겼다.
- NextAuth와 함께 `next-auth` 모듈 확장(`session.user.githubId`)도 없어졌다.

### `@cms-server` 별칭에서 올리기

- 서버 파일은 더 이상 서버 설정을 default로 내보내지 않는다. 인스턴스는 이름 있는 export `cms`다(지금은 `@monti-cms/core/server`의 `export const cms = defineConfig({ … })`).
- `tsconfig.json` `paths`와 Vitest `resolve.alias`에서 `"@cms-server"`를 지운다. `withCms(nextConfig, { config })`는 `server` 옵션을 받지 않는다.
- 플러그인 라우트와 직접 만든 관리자 라우트는 `NextRequest` 대신 표준 `Request`를 받는다. `request.nextUrl`은 `new URL(request.url)`로, `NextResponse.json`은 `Response.json`으로 바꾼다.
- 관리자 API 라우트는 `@monti-cms/nextjs`의 `createRouteHandler(cms)`다("`@monti-cms/nextjs`로 올리기").
- 관리자에 인스턴스를 넘긴다: `<CmsAdminLayout cms={cms}>`, `<CmsAdminPage cms={cms} {...props} />`(페이지 파일이 작은 컴포넌트가 된다. 모양은 `monti init`이 보여 준다).
- 사이트 페이지는 `@monti-cms/core/read`의 자유 함수 대신 `cms.read.*`로 읽는다. `createPublicImageResolver(mdx)`는 `entry.refs`(`cms.read.imageResolver`도 없어졌다. "코어에 있던 MDX에서 올리기"), `resolvePublicMediaUrl(id)`는 `cms.read.mediaUrl(id)`가 대신한다.
- 없어진 것: `getCmsContentStore`·`getCmsMediaStore`·`getCmsSecret`·`getCmsDatabase`·`loadServerPlugins`와 `@monti-cms/core/runtime`의 로그인 자유 함수(`authGateway`·`auth`·`signIn`·`signOut`·`handlers`·`isDevAuthBypassEnabled` 등). 인스턴스를 쓴다:
  `cms.store()`·`cms.mediaStore()`·`cms.secrets(플러그인이름)`·`cms.storage(플러그인이름)`·`cms.plugins()`·`cms.auth()`·`cms.authGateway`·`cms.authHandlers`.
  마스터 비밀 값 자체를 내주는 길은 이제 없다(`cms.secret`과 `cms.server.secret`도 없어졌다). "플러그인 비밀 값"을 본다.
  플러그인 라우트는 핸들러 입력으로 `cms`를 받고, `CmsServerPlugin.features(cms)`와 `migrate(storage, cms)`는 인자로 받고, 훅은 직접 만든 `cms`를 클로저로 쓴다.
- `@monti-cms/core/migrate`는 없어졌다: `monti migrate`를 돌리거나 스크립트에서 `await cms.migrate()`를 쓴다. `monti migrate`는 이제 설정 파일을 불러오므로 그 파일이 `cms`를 내보내야 한다.
- 로그인·로그아웃은 서버 액션이 아니라 `/api/cms/v1/session/*`로 보내는 일반 폼 전송이다(서버 액션은 인스턴스를 실을 수 없다). 앱에서 바꿀 것은 없다.

### `cms.database()`를 쓰던 플러그인 올리기

- `cms.database()`·`PluginDatabase`(`pool`과 `once` 포함)·`withTransaction`은 `@monti-cms/core`와 `@monti-cms/core/plugin/server`에서 없어졌다. 플러그인은 데이터를 `cms.storage("<플러그인 이름>")`에 두고("플러그인 저장소") `migrate(db, cms)`는 `migrate(storage, cms)`가 된다.
- 자기 표를 만들던 플러그인은 그 데이터를 한 번 옮겨야 한다. `storage.once(이름, 단계)` 안에서 `migration.readLegacyTable(표)`과 `migration.importItem(...)`으로 옮긴다. 옛 표는 읽기만 하므로 백업으로 남는다. AI 플러그인이 이렇게 했다(그 README를 본다).
- 배포할 때 `monti migrate`를 돌린다. `plugin_documents` 표를 만들고 AI 플러그인의 데이터를 옮긴다. 옛 버전 인스턴스는 계속 옛 AI 표에 쓰므로 한꺼번에 바꾼다.
- `createContentLookup(cms.database())`는 `createContentLookup(cms)`다. `createContentStore`와 `migrateContentStore`는 더 이상 `@monti-cms/core/runtime`에서 내보내지 않는다. 테스트는 `@monti-cms/core/testing`에서 가져온다.
- `Entry`·`ListEntriesParams`·`CmsError` 같은 타입은 전과 같이 `@monti-cms/core/runtime`에서 온다. 정의는 Postgres 어댑터가 아니라 `src/core/store`에 있다.

### 코어에 있던 MDX에서 올리기

MDX가 코어에서 `@monti-cms/mdx` 패키지로 옮겨 갔다. 코어는 이제 MDX 의존성이 없다(`next-mdx-remote`·`remark-*`·`rehype-*`·`unified`·`vfile`·mdast 타입이 `package.json`에서 빠졌다). 이 버전을 배포하기 **전에** 다음을 한다.

1. `@monti-cms/mdx`를 설치한다.
2. `plugins`에 `mdx()`를 넣고 `mdx.syntax`를 그 안으로 **옮긴다**. `defineConfig({ mdx: { syntax: [directiveSyntax()] } })`는 `plugins: [mdx({ syntax: [directiveSyntax()] }), ...]`가 된다. 옵션은 그대로 둔다(지시자로 쓰던 사이트는 쓰기 모드가 켜진 `directiveSyntax()`). `mdx` 설정 키는 없어졌다.
3. 관리자 스타일을 위해 따로 불러올 것은 없다. `@monti-cms/admin/styles.css`가 MDX 원문 패널까지 담고 있다.
4. `@monti-cms/core/render`의 `renderMdx` import를 `@monti-cms/mdx/render`로 바꾸거나(또는 `CmsContent`로 문서를 그린다), `cms.read.imageResolver(...)`를 `entry.refs`로 바꾼다(`renderMdx(source, { refs: entry.refs })`). `renderMdx`는 `{ content, toc, unknown }`을 돌려주며 MDX를 컴파일하거나 실행하지 않는다.
5. 없어진 `@monti-cms/core/mdx`·`@monti-cms/core/syntax`·`@monti-cms/core/format/mdx` import를 바꾼다. 문법 확장 인터페이스(`SyntaxExtension`·`SerializeContext`·`RAW_SOURCE_PARAGRAPH`, 표·코드 주석 문법 도우미)는 `@monti-cms/mdx`에서, 해석기와 직렬화기(`analyze`·`serialize`·`toDocument`·`bodyFromMdx`·`mdxFormat` 등)는 `@monti-cms/mdx/format`에서 가져온다. 문법 확장 패키지는 이제 `@monti-cms/mdx`를 피어로 둔다.
6. 직접 만든 블록 확장은 `render` 모듈의 기본 내보내기를 지우고 `documentComponents`만 둔다(`CmsPlugin.render`는 `{ documentComponents }`를 돌려준다).
7. `monti migrate`를 돌린다. 설정에 `mdx()`가 있으면 옛 데이터베이스가 알맞은 문법 확장으로 올라간다. 없으면 옛 단계로 읽을 본문이 남은 저장소는 `@monti-cms/mdx`를 설치하고 사이트 설정의 `plugins`에 `mdx()`를 넣으라는 메시지와 함께 실패한다.
8. 스크립트에서 `monti content:rewrite`를 뺀다. 없어졌다(`cms.rewrite`도). 정규화할 저장 글이 없다.

그 밖에 바뀐 것:

- **기본 제공 형식이 없다.** 형식 플러그인이 없는 사이트는 문서(`doc`)만 받고, 글로 쓰면 `unknown_format`으로 실패한다. `format: "mdx"`와 `?format=mdx`는 `@monti-cms/mdx`가 있어야 한다.
- **데이터베이스.** `entry_bodies.mdx`와 `body_templates.mdx`는 null을 허용하고(`seed_initial_body_templates` 앞에서 도는 `0020_mdx_columns_optional` 단계) 더는 쓰지 않는다. 열을 지우지는 않으므로 옛 행에는 글이 남는다. 미디어 사용 중 검사는 `doc`을 본다.
- **옛 단계.** `0010`·`0011`·`0012`·`0013`·`0015`는 이름은 코어에 그대로 두고, `@monti-cms/mdx/server`가 주는 `mdx` 형식(`CmsFormat.legacyBodies`, "형식" 절)으로 해석한다. 저장소에 그 단계로 읽을 본문이 실제로 있을 때만 패키지가 필요하다. 새 저장소와 이미 그 단계를 지난 저장소는 마이그레이션 때 필요 없다. `monti migrate`와 `cms.migrate()`는 인스턴스의 형식을 마이그레이션에 넘기므로, `mdx()`를 설정에 둔 사이트는 문법 확장과 함께 옛 데이터를 옮긴다.
- **그리기.** `renderMdx`와 `compileMDX`는 `@monti-cms/core/render`에 없다. 코어는 문서를 그린다(`CmsContent`, `renderDocument`). 블록 확장은 `render` 모듈에서 `documentComponents`만 내보내고, `@monti-cms/blocks`에는 MDX 컴포넌트 표가 없다.
- **관리자.** 원문 패널은 `mdx()` 플러그인이 등록한다(없으면 원문 전환이 없다). 문구 이름공간은 `cms-mdx.source`다(전에는 `cms-admin.mdx-source`). 관리자는 `SOURCE_ERROR_ID`와 `useLinkPaths`(`@monti-cms/admin/hooks`)를 내보내고, `mdxBrowserFormat`은 `@monti-cms/admin/editor`에서 더는 내보내지 않는다. 문서가 생기기 전에 브라우저가 저장한 복구 사본은 `unparsed` 문서로 보관되고 패널이 다시 읽는다.
- **AI.** `@monti-cms/ai`는 `@monti-cms/mdx`를 피어로 둔다. 모델은 `mdx` 형식으로 MDX를 읽고 쓴다.
- `@monti-cms/core/notation`은 새 가벼운 진입점이다(표기용 코드 주석 문법과 표 도우미).

## `cms.config.ts` + `cms.server.ts`에서 올리기

사이트 설정은 파일 둘로 나뉘어 있었다. `cms.config.ts`(사이트 설정, `@monti-cms/core`의 `defineConfig`로 쓴 `export default defineConfig({ … })`. 이것은 이제 `@monti-cms/core/server`의 `defineConfig` 하나에 합쳐졌다)와 `cms.server.ts`(`createCms({ config, server: defineServerConfig({ … }) })`)다. 이제는 만들어진 인스턴스를 `cms`로 내보내는 파일 하나, `monti.config.ts`다. `defineServerConfig`는 없어졌다(대체 shim도 없다). `monti` 명령은 `monti.config.ts`(또는 `src/monti.config.ts`)를 찾고, 코드로 쓴 설정에 대한 `monti schema:extract`는 바뀐 것이 없다. 블로그 예시를 줄인 모습이다.

```diff
-// cms.config.ts
-import { aiPlugin } from "@monti-cms/ai";
-import { bareun } from "@monti-cms/bareun";
-import { blocks } from "@monti-cms/blocks";
-import { defineConfig } from "@monti-cms/core";
-import { gitSync } from "@monti-cms/git-sync";
-import { mdx } from "@monti-cms/mdx";
-import { seo } from "@monti-cms/seo";
-import { directiveSyntax } from "@monti-cms/syntax-directive";
-import schema from "./monti.schema.json";
-
-export default defineConfig({
-	schema,
-	site: { url: process.env.HOST_URL || undefined },
-	plugins: [
-		mdx({ syntax: [directiveSyntax()] }),
-		...blocks(),
-		seo(),
-		aiPlugin({ siteDescription: "A personal tech blog", shared: { /* ... */ } }),
-		bareun(),
-		gitSync({ enabled: false, targets: [/* ... */] }),
-	],
-});
-
-// cms.server.ts
-import { auth } from "@monti-cms/auth";
-import { github } from "@monti-cms/auth/github";
-import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
-import { nextHost } from "@monti-cms/nextjs/auth";
-import config from "./cms.config";
-
-export const cms = createCms({
-	config,
-	server: defineServerConfig({
-		database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
-		auth: auth({
-			providers: [
-				github({
-					clientId: process.env.AUTH_GITHUB_ID,
-					clientSecret: process.env.AUTH_GITHUB_SECRET,
-					admins: [process.env.CMS_ADMIN_GITHUB_ID],
-				}),
-			],
-			host: nextHost,
-			devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
-			secret: process.env.AUTH_SECRET,
-		}),
-		secret: process.env.CMS_SECRET,
-	}),
-});
+// monti.config.ts
+import { aiPlugin } from "@monti-cms/ai";
+import { auth } from "@monti-cms/auth";
+import { github } from "@monti-cms/auth/github";
+import { callout, chart, codeExplorer, codeRef, collapsible, color, columns, mermaid, tabs, tooltip } from "@monti-cms/blocks";
+import { defineConfig, postgres } from "@monti-cms/core/server";
+import { gitSync } from "@monti-cms/git-sync";
+import { mdx } from "@monti-cms/mdx";
+import { seo } from "@monti-cms/seo";
+import { directiveSyntax } from "@monti-cms/syntax-directive";
+import schema from "./monti.schema.json";
+import { wordList } from "./plugins/word-list";
+
+export const cms = defineConfig({
+	schema,
+	plugins: [
+		mdx({ syntax: [directiveSyntax()] }),
+		callout(),
+		collapsible(),
+		tabs(),
+		columns(),
+		codeExplorer(),
+		mermaid(),
+		chart(),
+		tooltip(),
+		codeRef(),
+		color(),
+		seo(),
+		aiPlugin({ siteDescription: "A personal tech blog", shared: { /* ... */ } }),
+		wordList(), // replaces admin-components.tsx
+		gitSync({ enabled: false, targets: [/* ... */] }),
+	],
+	database: postgres(), // DATABASE_URL, DATABASE_SCHEMA
+	auth: auth({ providers: [github()] }), // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
+	// MONTI_SECRET signs the login session and encrypts stored values
+});
```

순서대로 한다.

1. **두 파일을 `monti.config.ts`로 합친다.** 사이트 옵션과 서버 옵션을 `@monti-cms/core/server`의 `export const cms = defineConfig({ … })` 하나에 넣고 `cms.config.ts`와 `cms.server.ts`를 지운다. `@/cms.server`나 `../cms.server`를 불러오던 import(라우트 파일, 관리자 레이아웃·페이지, 사이트 페이지, 스크립트)는 모두 새 파일로 바꾼다.
2. **`...blocks()`를 블록마다 한 줄로 바꾼다.** `blocks()`와 `blocks({ only, omit })`는 없어졌다. `@monti-cms/blocks`에서 `callout()`·`collapsible()`·`tabs()`·`columns()`·`codeExplorer()`·`mermaid()`·`chart()`·`tooltip()`·`codeRef()`·`color(options?)`를 불러온다. 쓰는 것만 적는다. `tooltip()`·`codeRef()`·`color()`는 겹치는 마크를 저장하고 싶은 순서대로 둔다.
3. **환경 변수 이름을 바꾼다**(`HOST_URL`은 `SITE_URL`이 되고 `site` 줄은 지운다). 그다음 `postgres()`와 `github()`에 넘기던 `process.env.X` 인자를 지운다. 둘이 관례적인 이름을 알아서 읽는다.

   | 전 | 후 |
   | --- | --- |
   | `CMS_DATABASE_URL` | `DATABASE_URL` |
   | `CMS_SCHEMA` | `DATABASE_SCHEMA` |
   | `CMS_ADMIN_GITHUB_ID` | `MONTI_ADMIN_GITHUB_ID`(GitHub 숫자 ID 하나, 또는 쉼표로 구분한 여럿) |
   | `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET` | 그대로 |
   | `CMS_DEV_AUTH_BYPASS` | 지운다. 개발용 로그인은 `next dev`에서 저절로 켜진다("개발용 로그인 우회") |
   | `AUTH_TRUST_HOST` | 직접 운영하는 프록시 뒤에서만 필요하다. Vercel·Netlify·Cloudflare Pages는 감지한다("호스트 신뢰") |
   | `HOST_URL` | `SITE_URL`, 그리고 `site: { url: … }` 줄을 지운다. `defineConfig`가 `SITE_URL`을 알아서 읽는다 |
   | `CMS_SECRET`·`AUTH_SECRET` | `MONTI_SECRET`, 다음 단계를 본다 |

4. **비밀 값.** `MONTI_SECRET`을 **옛 `CMS_SECRET` 값**으로 정하면 전에 암호화한 값(AI 서비스 키, git-sync 토큰)이 모두 그대로 풀린다. 또는 새 `MONTI_SECRET`을 정하고 `defineConfig`의 `previousSecrets: [process.env.CMS_SECRET]`로 옛 값을 계속 읽게 한다. 값은 다시 저장할 때 새 비밀 값으로 다시 암호화되고, 옛 값은 그 뒤에 뺀다. `AUTH_SECRET`은 더 이상 읽지 않으므로 지워도 된다. 로그인 세션 키가 이제 `MONTI_SECRET`에서 만들어지므로 모두 한 번 로그아웃된다(세션이 초기화될 뿐 잃는 것은 없다).
5. **호스트.** `host: nextHost`와 그 import를 지운다. Next 통합이 붙여 준다.
6. **Next 파일.** `app/(admin)/studio/*`를 `app/studio/*`로 옮긴다(라우트 그룹은 이제 선택이다). Monti 파일은 셋이 된다: `app/<관리자 경로>/layout.tsx`, `app/<관리자 경로>/[[...path]]/page.tsx`, `app/api/cms/[...path]/route.ts`(레이아웃을 페이지에 합칠 수 없는 이유는 "`monti init`"을 본다). `admin-components.tsx`는 지우고 그 컴포넌트를 플러그인으로 등록한다. `definePlugin({ name, options: {}, admin: () => import("./admin") })`를 만들고, 그 관리자 모듈의 default export를 `defineAdminPlugin({ Provider })`(`@monti-cms/admin/plugins`)로 한다. `Provider`는 관리자를 감싸고 `CmsAdminComponentsProvider`를 쓴다(`examples/blog/plugins/word-list/`). 세 파일의 import는 `monti.config.ts`로 고친다.
7. **`bareun()`을 쓰지 않으려면 뺀다.** 패키지는 그대로 남아 있고, 블로그 예시에서는 뺐다.
8. **확인하고 마이그레이션한다.** `monti doctor`를 돌린다. 이 안내에서 남은 것(옛 파일, 옛 변수 이름, `(admin)` 라우트 폴더, 설정에 남은 옛 옵션)을 정확한 단계와 함께 보여 주고, `"use client"` 파일이 설정에 닿으면 실패한다. 그다음 `monti migrate`를 돌린다.

## 소스로 쓰는 컴포넌트

`monti add <이름...>`은 Monti 레지스트리의 컴포넌트를 앱에 소스로 복사해, 앱이 직접 소유하는 코드로 만듭니다. 공개 페이지용 `article-body`(저장된 문서와 목차), 컬렉션의 글 목록(페이지 나눔)과 글 페이지를 주는 `blog-theme`(필요한 `article-body` 포함), `useEntryEditor`와 `useField`로 만든
어드민 `entry-editor` 화면, `blockViews`에 넣는 블록 편집 화면이 있습니다. import는 앱의 별칭(`components.json` 또는 `@/components`)으로 바뀌고, 필요한 npm 패키지는
앱의 패키지 매니저로 설치하며, 고친 파일은 `--overwrite`를 주지 않는 한 덮어쓰지 않습니다.

```sh
pnpm exec monti add article-body              # -> components/monti/article-body/article-body.tsx
pnpm exec monti add entry-editor --dry-run    # 계획만 보여 주고 아무것도 바꾸지 않음
pnpm exec monti add blog-theme --yes          # 타이포그래피 플러그인과 render.css import도 묻지 않고 전역 CSS에 추가
pnpm exec monti add article-body --registry ./registry/r   # 다른 레지스트리(폴더 또는 URL)
```

레지스트리는 shadcn 레지스트리 스키마를 따르며 저장소의 `registry/`에 있습니다(`registry/r`로 빌드해 커밋). 컴포넌트는 호스트의 Tailwind와 공개 진입점
(`@monti-cms/admin/hooks`, `@monti-cms/core/render`, `@monti-cms/core/client`, `@monti-cms/core/read`, `@monti-cms/nextjs`)만 씁니다. `examples/blog`가 이 방법으로 `blog-theme`을 설치해 블로그 목록과 글 페이지에서 씁니다.
`article-body`와 `blog-theme`은 전역 CSS에 `@tailwindcss/typography`와 `@monti-cms/core/render.css` import(블록을 쓰면 `@monti-cms/blocks/render.css`도)가 있는지 확인하고, 바꿀 내용을 diff로 보여 주며 묻고, 거절하면 추가할 줄을 그대로 출력합니다. `monti init`도 블로그 테마를 고르면 같게 하고, 루트 레이아웃의 `<html>` 태그에 `suppressHydrationWarning`도 추가합니다(diff와 질문 포함). 어드민 테마가 React가 하이드레이션하기 전에 `<html>`에 클래스를 달기 때문에, 없으면 첫 어드민 화면에서 하이드레이션 불일치가 기록됩니다. `monti init`이 쓰는 어드민 라우트 파일은 Next의 `cacheComponents`가 있든 없든 동작하며, 페이지에 `export const instant = false`가 있는 것은 세그먼트 설정을 패키지에서 다시 내보낼 수 없기 때문입니다.
전체 설명, 컴포넌트 목록, 추가하는 법은 [`registry/README.ko.md`](../../registry/README.ko.md)에 있습니다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/core` | 테스트·도구·스키마 코드 | `defineSite`(사이트 설정만 다루는 쪽, `schema`와 함께. 여기에는 `defineConfig`가 없고 앱은 `/server`의 것을 쓴다)·`defineCollection`·`fields`·`defineBlock`·`definePlugin`, `parseSchemaFile`, `SchemaFile` 타입 |
| `@monti-cms/core/schema.json` | 에디터, `$schema` | `monti.schema.json`의 JSON Schema("스키마 파일") |
| `@monti-cms/core/schema-types` | 개발 도구(`withCms`) | `generateSchemaTypes`, `watchSchemaTypes`: 스키마 파일에서 `monti-env.d.ts`를 쓴다 |
| `@monti-cms/core/schema-change` | 설정 화면, 명령줄 | `diffSchema`, `checkSchemaChange`, `suggestTransforms`, `planSchemaChange`, `applySchemaChange`("스키마 바꾸기") |
| `@monti-cms/core/schema-edit` | 설정 화면(서버 쪽) | `schemaEditAccess`(누가 스키마 파일을 쓸 수 있나), `readSchemaScreen`, `previewSchemaEdit`, `saveSchemaEdit`, `formatSchemaText`("관리자에서 스키마 편집하기") |
| `@monti-cms/core/server` | `monti.config.ts` | `defineConfig`(사이트·서버 옵션을 한꺼번에 받아 인스턴스를 돌려준다)·`postgres`·`createCms`(낮은 수준 API), 저장소 계약 타입(`MediaStore` 등). 저장소 모듈은 처음 쓸 때 불러온다 |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)` |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms` |
| `@monti-cms/nextjs/admin` | 관리자 라우트 파일 | `CmsAdminLayout`·`CmsAdminPage`·`cmsAdminMetadata(cms)`·`NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `monti.config.ts` | `nextHost`(로그인의 Next 쪽. 사이트에는 필요 없고 Next 통합이 붙인다) |
| `@monti-cms/auth` | `monti.config.ts` | `auth({ providers, devBypass?, basePath?, host? })`, `LoginProvider` 타입 |
| `@monti-cms/auth/github` | `monti.config.ts` | `github({ clientId?, clientSecret?, admins? })`(주지 않으면 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·`MONTI_ADMIN_GITHUB_ID`를 읽는다) |
| `@monti-cms/admin/plugins` | 플러그인의 관리자 모듈 | `defineAdminPlugin({ Provider })`("플러그인") |
| `@monti-cms/core/render` | 공개 화면(서버 컴포넌트) | `CmsContent`(`<CmsContent cms={cms} entry={entry} />`), `renderDocument(doc, { site, … })` → `{ content, toc, unknown }`, `DocumentComponentsFor<typeof config>`·`DocumentComponentsOf<typeof cms>`, `tableOfContents(doc)`, 컴포넌트 props 타입("저장된 문서 그리기"). MDX 글은 `@monti-cms/mdx/render`의 `renderMdx`가 그린다. 사이트 CSS에 `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | 공개 화면(타입) | `ReadEntry`·`MetadataFor` 등 `cms.read`의 타입. `cms.read`가 공개본을 읽는다(`getEntry`·`listEntries`·`getTranslations`·`getPreview`: 관계·주소·옛 주소 이동·원문 대체) |
| `@monti-cms/core/runtime` | 서버 코드(크론 스크립트·사이트 테스트 포함) | 저장소·서비스 타입, 로그인 타입, 스냅샷 도우미. `server-only`를 쓰지 않아 Next 밖에서도 불러온다(그냥 `tsx`) |
| `@monti-cms/core/client` | 화면 코드 | `createSite`·`Site`·`SiteProvider`·`useSite`·`useTranslator`, API 모양과 설정이 필요 없는 컬렉션·언어·주소·블록·스키마 도우미(설정에 기대는 것은 `Site`의 멤버다) |
| `@monti-cms/core/code-block` | 공개 렌더러·편집기 | 코드 블록 주석 모델 |
| `@monti-cms/core/document` | 본문을 고치거나 살피는 화면·플러그인 | `StoredDocument` 타입과, 표기법을 모르고 문서만으로 일하는 도우미: 블록 ID(`assignBlockIds`, `isBlockId`, `withoutBlockIds`), `canonicalDocument`, `readStoredDocument`, `emptyStoredDocument`, `unparsedDocument`, 링크·이미지·표 도우미, 저장 코드 블록 모델. 글 표기를 읽거나 쓰는 것은 없다. 관리자 편집기와 AI가 여기서 불러온다 |
| `@monti-cms/core/format` | 형식을 더하는 플러그인 | `defineFormat`, `CmsFormat` 인터페이스와 그 맥락·문제 타입, `createFormatRegistry`("형식" 절). 사이트 설정을 읽지 않으므로 플러그인이 어디서든 불러와도 된다 |
| `@monti-cms/core/front-matter` | 마크다운 파일을 읽고 쓰는 도구(git-sync, `monti import`) | `parseFile`(YAML 프런트매터와 본문, YAML 오류의 줄 번호 포함)과 `composeFile` |
| `@monti-cms/core/notation` | 형식·문법 확장 패키지 | 표기가 기대는 도우미만 담은 가벼운 진입점: 코드 주석 문법(`resolveCommentSyntax`·`formatAnnotationComment`)과 표 도우미. `@monti-cms/mdx`가 문법 확장용으로 다시 내보낸다 |
| `@monti-cms/core/plugin/server` | 플러그인 서버 쪽 | 라우트 틀(`adminRoute`가 라우트에 `cms` 인스턴스를 넘긴다)·`Cms` 타입·오류 |
| `monti`(명령줄, 패키지 `bin`) | 터미널 | `monti init`(파일 만들기)·`monti doctor`(설정을 점검하고 잘못된 것을 어떻게 고치는지 알려 줌, "문제 해결")·`monti add`(컴포넌트를 소스로 설치)·`monti migrate`(표 만들기)·`monti import`(기존 MD/MDX 글 가져오기, "기존 글 가져오기")·`monti events:retry`(때가 된 `afterCommit` 이벤트 전달)·`monti <플러그인>:<명령>`(플러그인이 더하는 명령, "플러그인")·`monti schema:types`(스키마 파일의 타입)·`monti schema:extract`(TypeScript 설정을 스키마 파일로 옮기기)·`monti schema:diff`와 `monti schema:apply`(스키마 변경 점검과 적용) |
| `@monti-cms/core/cli` | 명령줄 도구 | `runCli`·`runDoctor`·`initProject`·`addComponents`·`migrate`·`runImport`·`generateSchemaTypes`·`extractSchema`(명령 `monti`의 코드) |
| `@monti-cms/core/testing` | 테스트 | `fakeCms`(테스트가 준 부품 위의 인스턴스)·격리 스키마 DB·예시 데이터. MDX 글이 필요한 도우미는 `@monti-cms/mdx/testing`에 있다 |

## 패키지 빌드

저장소 안에서는 소스(`src`)를 바로 쓴다. 배포 묶음은 `pnpm build:packages`로 `dist`를 만들고 `pnpm pack`이
`publishConfig.exports`(dist)로 묶는다. `pnpm example:pack`은 묶음을 `examples/blog/vendor`에 넣는다.

## 본문 문법

코어는 본문을 문서로 저장하며 글 표기를 읽거나 쓰지 않는다. 표기는 **형식**("형식" 절)이고, MDX는 [`@monti-cms/mdx`](../mdx/README.ko.md) 패키지의 형식이다. 기본으로 쓰는 표기(줄바꿈·표·이미지·JSX 블록), 표기를 더하는 *문법 확장*
(`:::callout`은 `@monti-cms/syntax-directive`, Shiki 코드 표기는 `@monti-cms/syntax-shiki`), 확장을 만드는 법은 그 README에 있다. 문법 확장은 코어의 설정 키가 아니라 `plugins`의 `mdx({ syntax })`에 나열한다.

#### 저장된 본문

모든 본문(항목의 작업본·발행본, 번역이 확인한 기준 원문, 본문 템플릿)은 버전이 있는 **문서**(`entry_bodies.doc`·`body_templates.doc`, 해석한 본문을 JSON으로 담은 것)로 저장한다. 문서가 유일한 원본이며 그 옆에 글을 따로 쓰지 않는다. `entry_bodies`와 `body_templates`의 `mdx` 열은 선택 사항(`0020_mdx_columns_optional`)이고 더는 쓰지 않는다. 열을 지우지는 않으므로 옛 행에는 글이 남아 있다.
이미 가진 내용을 다른 표기로 저장하면 아무것도 바뀌지 않는다(새 버전도 생기지 않는다). 원문 패널(`mdx()` 플러그인이 준다)에 입력한 글은 브라우저에서 문서로 읽히고, 저장되는 것은 그 문서다.
문서가 될 수 없는 본문(글이 해석되지 않거나, 머리말이 있거나, 다시 읽었을 때 같지 않은 본문)은 **`unparsed`** 문서로 저장된다. 노드 하나 `{ "type": "unparsed", "attrs": { "format": "mdx", "source": "<받은 글 그대로>" } }`이고, 글은 그대로 보존된다. 초안은 이 상태로 둘 수 있고 편집기는 소스로 보여 주며, 발행은 `unparsed_body` 문제로 막힌다. 거절된 이유(글의 줄·칸을 담은 `mdx_error`, `frontmatter_present`)는 함께 알려 준다.

**무엇을 검사하나.** 코어는 글이 아니라 저장된 문서를 검사하고, 해시를 만들고, 검색한다. 그래서 본문은 어떻게 쓰였든 어떤 경로로 왔든 똑같이 다뤄진다. 대상은 `prepareSnapshot`과 `validateForPublish`(블록 속성의 필수·모르는·잘못된 값, 참조, 내부 링크, 이미지 출처, 각주, 코드 줄 링크, 표 병합, 글에 남은 번역 안내), 내용 해시(`computeContentHash(metadata, doc)`. 값은 전과 같다. 블록 ID를 뺀 문서를 키 순서대로 정렬해 해시하고, 글이 저장된 스키마 버전은 들어가지 않는다. "스키마 바꾸기" 참고)
, 검색용 글자와 발췌(`documentText(doc, options)`, `bodyExcerpt(doc, maxLength)`), 번역 도구(`withTranslationHints`, `compareStructure`, `diffSources`는 문서를 받는다)다. 글로 받은 본문은 먼저 그 형식으로 문서로 읽고, 문서로 받은 본문은 그대로 쓴다(글 조각과 끝의 빈 문단만 정해진 모양으로 맞춘다).
발견한 것의 위치는 그것이 든 블록이다. 문제의 `position`은 `{ blockId }`이고(읽히지 않은 글은 그 글의 `{ line, column }`을 대신 가진다), 본문 참조 위치는 `{ "type": "body", "blockId" }`다.

**코드 블록.** 코드 블록은 주석을 뺀 코드와 데이터로 둔 주석(줄 효과, 글자 효과, 정규식 규칙)으로 저장하고, 글 형식이 Monti 주석으로 되돌려 쓴다. 글을 읽는 다른 도구에서도 주석이 그대로 보인다.
`monti migrate`는 `0015_code_annotations` 단계를 실행해 기존 문서(번역이 확인한 기준 문서 포함)를 바꾸고, 코드 펜스의 주석을 정해진 한 모양으로 다시 쓴다(`// @line plus`는 `// @line plus {0-0}`이 되고, 코드 전체에 걸리는 규칙은 맨 위로 간다). 내용 해시와 검색용 글자(이제 주석을 담지 않는다)는 새로 만들며, `version`과 `updated_at`은 그대로다. 옛 글은 저장소에 그런 본문이 있을 때만 `mdx` 형식으로 읽는다("코어에 있던 MDX에서 올리기").

**블록 ID.** 문서의 모든 블록은 본문 안에서 유일한 `id`(소문자 영숫자 8자)를 가진다. 블록 ID는 버전이 달라져도 어느 블록이 어느 블록인지 알려 주는 값이며, 글 형식에는 쓰이지 않고 콘텐츠 해시에도 들어가지 않으므로 변경으로 취급되지 않는다.
글로 저장한 본문은 바꾸기 전 버전에서 ID를 물려받는다. 똑같이 읽히는 블록은 ID를 그대로 가지고, 수정한 블록, 둘로 나눈 블록, 옮긴 블록도 마찬가지다(나눈 문단은 앞부분이 ID를 가진다). 짝이 없는 블록은 새 ID를 받고, API로 보낸 문서는 담고 있는 ID를 그대로 유지한다.
`monti migrate`는 `0014_block_ids` 단계를 실행해 기존 문서에 ID를 달아 준다(발행본은 작업본과 공통인 블록의 ID를 함께 쓴다). 바뀌는 것은 `doc`뿐이며 글, 해시, `version`, `updated_at`은 그대로다.
관리자 편집기는 표기법을 거치지 않고 문서 자체로 일한다. 편집하는 동안 블록마다 ID를 유지하고, 저장할 때 늘 문서를 보내므로 블록 ID가 정확히 유지된다. 원문 패널에 쓴 글은 브라우저에서 읽어 그 글이 읽히는 문서로 바꾸고, 그 블록은 위와 같이 바꿔 치우는 본문과 짝지어진다. 템플릿을 항목에 적용하면 템플릿 문서를 새 블록 ID로 복사한다(ID는 본문 하나 안에서만 유일하고, 번역·비교 화면이 ID로 블록을 짝짓기 때문이다).
관리자는 이 ID로 블록을 가리킨다. 발행 검증 문제와 참조 위치는 해당 블록을 알려 주고(`position.blockId`) 시각 편집기에서 그 블록으로 이동한다. 번역 화면은 번역할 때 확인한 원문과 지금 원문을 블록 단위로 비교하며, 자리만 옮긴 블록은 이동으로 보여 준다. AI 번역은 번역할 블록을 ID로 찾는다.

**업그레이드.** `0013_stored_documents` 단계는 `doc` 열을 더하고 기존 본문마다 문서를 만들어 준다. 옛 글은 `@monti-cms/mdx`의 `mdx` 형식으로, `mdx({ syntax })`의 문법 확장과 함께 읽는다("코어에 있던 MDX에서 올리기"). 그때 옛 글을 사이트의 표기로 다시 썼으므로 많은 본문의 저장 글이 한꺼번에 바뀌었다(`version`과 `updated_at`은 그대로였다).
해석되지 않거나, 머리말이 있거나, 다시 읽었을 때 같지 않은 본문은 문서 없이 그대로 두고 하나씩 로그에 남긴다(`[monti] no stored document for …`). 이어서 `0017_unparsed_bodies` 단계가 이런 본문에 `unparsed` 문서를 만들어 준다(아래). 먼저 데이터베이스를 백업하고, 실행한 뒤 로그를 확인한다.

`monti migrate`는 `0017_unparsed_bodies`도 실행한다. 문서가 없는 본문과 템플릿마다 그 글의 `unparsed` 문서를 만들고, 내용 해시를 새로 계산하며(문서가 아닌 글은 늘 그랬듯 따로 붙인 태그로 해시한다), 모든 번역의 번역 상태를 버전 4(`{ version: 4, baseDoc }`, 번역이 확인한 원문의 문서)로 올린다. 원문 MDX를 담던 버전 2·3도 계속 읽힌다. `mdx`, `search_text`, `version`, `updated_at`은 그대로다.
이런 본문 때문에 실패하는 일은 없다. 발행본과 템플릿도 마찬가지인데, 기존 저장소의 데이터는 언제나 옮겨져야 하기 때문이다. 그중 발행본과 템플릿은 id로 로그에 남는다(`[monti] N published bodies have no document …`). 편집기에서 고치기 전까지는 `unparsed`로 읽힌다(페이지는 아무것도 그리지 않는다).
**참조 위치.** 저장된 참조의 본문 위치는 전에 `{ "type": "mdx", "line", "column", "blockId"? }`였다. 읽을 때는 두 모양을 모두 받고, 그 항목을 다음에 저장하면 새 모양(`{ "type": "body", "blockId" }`)으로 쓴다. SQL 마이그레이션은 없다.

- **선택 칸용 항목 검색.** `GET /api/cms/v1/entries/search?collection=…&query=…&locale=…&publishedOnly=true&limit=20`은 선택 칸이 쓰도록 한 컬렉션의 항목을 제목으로 찾는다(관리자의 관계 필드는 전체 목록을 불러오지 않고 이렇게 검색한다). `{ items: [{ id, title, slug, status }] }`를 돌려주며 제목이 잘 맞는 순서다(제목이 같은 것, 질의로 시작하는 제목, 질의로 시작하는 낱말이 있는 제목, 질의를 포함한 제목, 질의를 포함한 슬러그). 최대 `limit`개(기본 20, 최대 50)이고 휴지통은 찾지 않는다. `id`를 되풀이하면 검색 대신 그 항목들을 id로 찾는다. 저장소 포트는 `searchEntries`(`ListStore`)다.
- **관리자 항목 API.** `POST /api/cms/v1/entries`와 `PATCH /api/cms/v1/entries/:id`는 본문을 `doc`(항목의 `working.doc`·`published.doc`로 읽은 문서 JSON) 또는 `body`(글)와 그것을 읽는 `format`으로 받는다("형식" 절). `mdx`는 없다. 문서와 글을 함께 보내거나, 형식 없이 글만 보내거나, 올바른 저장 문서가 아닌 값을 보내면 `400 invalid_input`이다. 아무것도 없으면 새 항목은 빈 본문이고, 패치는 지금 본문을 그대로 둔다.
  읽은 `doc`을 그대로 되돌려 보내면 아무것도 바뀌지 않는다. `GET /api/cms/v1/entries/:id?format=<이름>`은 `working`과 `published`(번역이면 원문도)에 `body`(문자열)를 더한다. 그 형식으로 쓴 글이며, 다시 가져올 수 있게 쓴다. `GET /api/cms/v1/meta`는 크기 한도를 `limits.textBytes`(어떤 형식이든 글)와 `limits.docBytes`로, 인스턴스의 형식을 `formats`(`{ name, label, mimeType, extension, canImport }`)로 알려 준다. 관리자 편집기는 늘 `doc`을 보낸다.
- **템플릿 API와 템플릿.** 본문 템플릿은 항목 본문처럼 문서다. `body_templates.doc`이 유일한 원본이고 `body_templates.mdx`는 이제 아무도 쓰지 않는다(열은 남고 선택 사항이다). `POST /api/cms/v1/templates`와 `PATCH /api/cms/v1/templates/:id`는 `{ name, doc }` 또는 `{ name, body, format }`을 받고(둘 다 없으면 빈 템플릿이고, 패치는 본문을 그대로 둔다) `doc`을 돌려주며 `mdx`는 주지 않는다. `GET`의 `?format=<이름>`은 템플릿마다 `body`를 더한다. 형식이 거절한 글은 형식의 발견 사항과 함께 `422 format_import_failed`다. 템플릿에는 항목 초안과 달리 문서가 아닌 글을 담아 둘 자리가 없기 때문이다.
  관리자 템플릿 관리 화면과 편집기의 템플릿 메뉴는 문서로 일한다. 템플릿을 적용하면 그 문서를 새 블록 ID로 항목에 복사한다. 시드 템플릿(사이트 설정의 `seed.templates`)은 `{ id, name, doc }` 또는 `{ id, name, body, format }`이다. 글은 새 저장소를 처음 채우는 마이그레이션이 그 형식으로 읽고, 설치된 어떤 플러그인도 읽지 못하는 시드는 그 형식을 알리는 메시지와 함께 마이그레이션을 멈춘다(`mdx`라면 `@monti-cms/mdx`를 설치한다). 이미 데이터가 있는 저장소는 이 때문에 멈추지 않는다.
  `monti migrate`는 `0019_templates_documents`를 실행한다. 읽을 수 있는 문서가 없는 템플릿은 그 글의 `unparsed` 문서를 받고, `body_templates.mdx`는 더 이상 필수가 아니다. `version`, `updated_at`, 열에 이미 있는 글은 그대로다. 템플릿 때문에 실패하는 일은 없고, 문서가 없던 것은 id로 로그에 남는다. 다시 돌려도 바뀌는 것이 없다.
- **관리자 내보내기**(`GET` 또는 `POST /api/cms/v1/export`)는 형식 버전 4다. 보관 파일은 문서를 담는다. 본문마다 `working.doc.json`·`published.doc.json`, `doc`이 있는 `templates.json` 항목, `doc`이 있는 공개 내보내기의 `published.json`이며, 다이제스트가 이를 포함한다. MDX는 따로 없다. `format=<이름>`(쿼리, 또는 `POST` 본문의 `format`)을 주면 본문마다 `working.<확장자>`·`published.<확장자>`로, 템플릿은 `body`로 그 형식의 글도 쓰고 `manifest.format`이 그 형식을 알려 준다. 관리자 보관 파일의 글은 다시 가져올 수 있게 쓴다(풀 수 없는 항목 링크는 id를 유지한다). 공개 보관 파일의 글은 읽는 사람을 위한 것이다(공개된 항목만 담고, 공개되지 않은 대상은 링크가 아니다). 모르는 형식은 `400 unknown_format`이다.
- **공개 읽기 API와 공개 내보내기**는 문서를 돌려준다. `cms.read.getEntry` / `listEntries` / `getPreview`는 `entry.doc`(저장된 문서. 목록에서는 `body: true`일 때만, 아니면 `null`)과 `entry.refs`
  (`{ media: { [mediaId]: { url, width?, height?, file? } | { failure } }, links: { [entryId]: { path, title, locale } } }`: 그 문서의 이미지, 파일, 내부 링크를 그리는 데 필요한 값. 문서가 쓰는 것만 들어 있고, `collectRefs(doc)`가 id 목록을 준다)를 담는다.
  문서의 링크는 `{ entryId }`(내부) 또는 `{ href, title? }`(외부)다. `entryId`는 번역 그룹 id(원문 항목의 id. 관계 필드가 담는 id와 같다)라서, `refs.links`는 읽는 사람의 언어로 된 주소와 제목을 주고 번역이 없으면 원문 것을 준다.
  가리키는 글이 공개되지 않았으면 `refs.links`에 없고 링크는 일반 글자로 그려진다. 주소(slug)를 바꿔도 저장된 문서는 그대로다. 링크는 관계 필드처럼 참조다. 항목의 참조에 블록 단위로 기록되고, 없는 항목(또는 아무도 쓰지 않는 주소)을 가리키는 링크는 발행을 막는다(`unresolved_internal_link`). 공개되지 않았거나 휴지통에 있는 항목을 가리키는 링크는 경고만 한다(`unpublished_internal_link`). 가리키는 글이 공개될 때까지 페이지는 그 링크를 일반 글자로 그리므로, 서로 링크한 글은 어떤 순서로 발행해도 된다.
  글 주소로 쓴 링크(`[x](/posts/slug)`. 어떤 형식이든 문서든)는 그 주소를 가진 항목이 있으면 쓸 때 id 링크로 바뀐다. 주소를 가진 항목이 없으면 쓴 그대로 남고 발행을 막는다. 기존 데이터베이스의 저장된 문서는 마이그레이션 `0018_link_entry_ids`가 옮긴다(문서 버전 3).
  `entry.mdx`는 없다. `format: "mdx"`를 넘기고 `entry.body`(`{ format, text }`, "형식" 절)를 읽는다. `GET /api/cms/v1/public/entries/:collection/:slug`는 `doc`과 `refs`를 돌려주고, `?format=<이름>`이면 `body: { format, text }`도 준다(모르는 형식은 `400 invalid_input`). 목록에는 없다.
  문서가 될 수 없는 초안은 `unparsed` 문서로 미리보기가 된다.

### 문법 확장 만들기(실험적)

`SyntaxExtension` 인터페이스(`remarkPlugins`·`fromDocument`·`fromMark`·`escapeText`), `SerializeContext`, `RAW_SOURCE_PARAGRAPH`, 표 도우미, 코드 주석 문법 도우미는 `@monti-cms/mdx`가 내보내며, 그 README("문법 확장 만들기")에 설명이 있다. 코어는 이것들이 기대는 가벼운 진입점 `@monti-cms/core/notation`만 준다.

## 형식

저장된 문서가 본문의 유일한 원본이다. **형식**은 문서를 써 낼 수 있는 표기이고, 형식이 가능하면 그 표기에서 문서를 읽어 올 수도 있다. MDX, Hugo 머리말이 붙은 Markdown, 일반 글 같은 것이다. 형식은 플러그인이고, 읽기·쓰기 API의 `format` 옵션으로 쓴다. 플러그인은 변환하고 코어는 검사하고 저장한다. 누구나 형식을 만들 수 있다. 코어에는 기본 제공 형식이 없다. `mdx` 형식은 `@monti-cms/mdx`가 준다. 형식 플러그인이 없는 사이트는 문서(`doc`)만 받고, 글로 쓰면 `unknown_format`으로 실패한다.

```ts
import { defineFormat } from "@monti-cms/core/format";

export default defineFormat({
	name: "hugo", // `format` 옵션의 값. 소문자·숫자·하이픈
	label: "Hugo Markdown",
	mimeType: "text/markdown",
	extension: "md",
	// 문서 → 글. 순수하다: 데이터베이스도 네트워크도 사이트 설정도 쓰지 않는다.
	export(doc, ctx) {
		return "…";
	},
	// 글 → 문서. 쓰기만 되는 형식이면 빼 둔다.
	import(text, ctx) {
		return { ok: true, doc, warnings: [] }; // 또는 { ok: false, issues: [{ code, position: { line, column } }] }
	},
});
```

플러그인은 `server`·`render`처럼 느리게 불러오는 함수로 형식을 준다. `definePlugin({ name: "hugo", formats: () => import("./formats") })`이고, 기본 내보내기는 형식 하나 또는 그 목록이다. 같은 이름이 두 번 나오면 인스턴스가 플러그인을 불러올 때 실패한다. `cms.formats()`가 한 인스턴스의 목록이고, `GET /api/cms/v1/meta`가 이를 `formats`로 알려 준다.

**형식이 받는 것.** 두 방향 모두 `ctx.locale`, `ctx.blocks`(사이트의 본문 블록), `ctx.codeLineEffects`를 받는다. `export`는 `ctx.purpose`(`"read"`: 읽는 쪽이 글을 쓰므로 데이터베이스 밖에서도 통하는 주소가 필요하다. `"sync"`: 다시 가져올 글이므로 양방향 형식은 돌려받는 데 필요한 것을 유지한다), `ctx.link(entryId)`(링크가 가리키는 항목의 지금 주소 `{ url, title, locale }`, 없으면 `null`), `ctx.media(mediaId)`(`{ url, width?, height?, filename, mimeType, byteSize }` 또는 `null`), 문서가 말하는 대로 쓰지 못한 것을 알리는 `ctx.report(issue)`도 받는다. 코어가 `export`를 부르기 전에 문서의 모든 링크와 미디어를 풀어 두므로, 이 조회는 모두 동기식이다.
`import`는 글이 말하는 문서를 돌려준다. 블록 ID나 문서 버전은 신경 쓰지 않는다. 코어가 모든 블록에 ID를 달고(글이 바꾸는 본문과 짝지어서, 바뀌지 않은 블록은 ID를 유지한다) 문서를 정해진 모양으로 맞춘다. 경고는 `blockIndex`로 돌려준 문서의 블록을 가리킬 수 있고, 코어가 그것을 블록 ID로 바꾼다.

**코어가 모든 형식에 해 주는 것.**
- *내보내기:* 내부 링크는 **가리키는 항목의 실제 경로**(`ctx.link(entryId)`. MDX라면 `[x](/en/posts/slug)`)로 쓰고 `entry:<id>`로는 쓰지 않는다. 그래서 파일이 Astro·Hugo·git 동기화에서 통하고, 대상의 slug가 바뀌면 경로가 따라간다(문서는 바뀌지 않는다). 대상이 없거나 공개되지 않은 링크는 읽는 사람을 위한 글(`read`)에서는 빠지고(글자는 남는다), 다시 가져올 글(`sync`)에서는 id를 유지한다(MDX는 `entry:<id>`). 등록된 이미지는 `read`에서는 공개 URL이고 `sync`에서는 `mediaId`를 유지한다.
- *가져오기:* 이 사이트 콘텐츠의 주소로 쓴 링크(`/posts/slug`. 언어 접두사가 있어도 없어도)는 그 주소를 가진 항목이 있으면 항목 id 링크가 되고, `src`가 등록된 미디어 파일의 공개 URL인 이미지는 그 파일(`mediaId`)이 된다. 아무도 갖지 않은 것은 쓴 그대로 남는다(아무도 쓰지 않는 주소는 발행할 때 `unresolved_internal_link`로 알려 준다). 형식이 내보낸 글을 가져오면 같은 id로 돌아온다.
- *검사와 저장*은 코어의 일이다. 형식이 돌려준 문서는 바로 보낸 문서처럼 검사하고 저장한다(`prepareSnapshot`, 쓰기 훅, 내용 해시, 참조). 그래서 형식은 코어 규칙을 넘어갈 수 없다. 형식이 거절한 글(`ok: false`)도 사라지지 않는다. 초안은 그 글을 `unparsed` 문서(`{ "type": "unparsed", "attrs": { "format", "source" } }`)로 두고 형식이 발견한 것을 문제로 알려 주며, 고칠 때까지 발행은 막힌다("저장된 본문" 절).

**`format` 옵션.**

| 어디 | 어떻게 |
| --- | --- |
| `cms.read.getEntry`·`listEntries`(`body: true`일 때)·`getPreview` | `format: "mdx"`가 `entry.body = { format, text }`를 더한다. 링크는 읽는 사람이 보는 경로(공개되지 않은 대상은 링크가 아니다)이고 이미지는 공개 URL이다. 모르는 형식은 `unknown_format` 코드의 `ServiceError`를 던진다 |
| `GET /api/cms/v1/public/entries/:collection/:slug` | `?format=mdx`가 `body: { format, text }`를 더한다 |
| `POST /api/cms/v1/entries`·`PATCH /api/cms/v1/entries/:id`·`cms.contentService()`(만들기·저장·일괄) | 본문은 `{ doc }` 또는 `{ body, format }`이고 둘을 함께 보낼 수 없다 |
| `GET /api/cms/v1/entries/:id` | `?format=mdx`가 `working.body`와 `published.body`(문자열)를 더한다 |
| `/api/cms/v1/templates` | `{ name, doc }` 또는 `{ name, body, format }`. `GET`의 `?format=`은 `body`를 더한다 |
| `GET` 또는 `POST /api/cms/v1/export` | `format=mdx`는 본문을 그 형식의 파일로도 쓴다 |

| 오류 코드 | 상태 | 언제 |
| --- | --- | --- |
| `unknown_format` | 400(공개 API: `invalid_input`) | 그 형식을 주는 플러그인이 없다 |
| `format_not_importable` | 400 | 쓰기만 되는 형식으로 쓰려 했다 |
| `format_import_failed` | 422 | 형식이 예외를 던졌거나 문서가 아닌 것을 돌려줬다(그 메시지는 로그에만 남는다). 또는 템플릿의 글이 거절됐다(`issues`가 글 안의 위치를 담는다) |
| `format_export_failed` | 500(공개 API: 503 `unavailable`) | 형식이 예외를 던졌다 |
| `body_too_large` | 413 | `limits.textBytes`(2 MiB)를 넘는 글, 또는 `limits.docBytes`(8 MiB)를 넘는 문서 |

**옛 본문(`legacyBodies`).** 형식은 `legacyBodies`(`@monti-cms/core/format`의 `LegacyBodies` 타입)도 줄 수 있다. 옛 저장소가 본문을 담아 둔 글을 읽고 쓰는 방법(`read`·`write`·`insertSoftBreaks`·`documentOf`)이다. `mdx` 형식만 갖고 있으며(`@monti-cms/mdx/server`가 준다), 마이그레이션 단계 `0010`·`0011`·`0012`·`0013`·`0015`는 이름은 코어에 그대로 두고 이것으로 해석한다. 읽을 본문이 있을 때만 이를 요청한다("코어에 있던 MDX에서 올리기").

**`mdx` 속성에서 올리기.** 별칭은 없다. 쓰기 API와 `createDraft` / `saveDraft`에는 `{ mdx }` 대신 `{ doc }` 또는 `{ body, format: "mdx" }`를 보낸다. `entry.mdx` 대신 (`format: "mdx"`를 넘기고) `entry.body.text`를 읽는다. 템플릿 API와 `seed.templates`는 `doc` 또는 `{ body, format: "mdx" }`를 받는다. `limits.mdxBytes`는 `limits.textBytes`가 되었고 오류 `mdx_too_large`는 `body_too_large`가 되었다. 내보내는 글이 내부 링크에 쓰는 것은 대상의 경로이고, 이제 아무도 쓰지 않는 옛 `mdx` 열은 `entry:<id>`를 담고 있었다. 내장 `mdx` 형식은 없어졌고 `@monti-cms/mdx`가 준다("코어에 있던 MDX에서 올리기").

## 본문 블록

본체에는 다른 기능이 기대거나 Markdown 문법인 블록(이미지·파일·표·수식·정렬, 밑줄·위아래 첨자·줄바꿈·번역 안내)만 있다.
콜아웃·접기·탭·단·Mermaid·차트와 글자 꾸밈(툴팁·코드 연결·글자색)은 블록 확장 `@monti-cms/blocks`에서 필요한 것만
플러그인으로 설치한다.

```ts
import { callout, mermaid, tooltip } from "@monti-cms/blocks";

plugins: [callout(), mermaid(), tooltip()], // 블록마다 한 줄
```

사이트가 직접 만든 블록은 설정의 `blocks`에 넣는다. 블록 확장도 같은 정의(`definePlugin({ blocks })`)로 블록을 더한다.

```ts
import { defineBlock } from "@monti-cms/core";

blocks: [
	defineBlock({
		name: "notice", // <Notice level="warn"> … </Notice>로 저장
		label: "공지",
		syntax: { kind: "container", directive: "notice" },
		component: "Notice", // 글 표기에서 블록의 이름(MDX의 JSX 이름). 공개 화면은 블록 이름에 등록된 컴포넌트로 그린다
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
		component: "Graphviz", // 공개 화면은 블록에 등록된 컴포넌트로 그린다(코드를 `source`로 받는다)
		attributes: {},
		editor: { view: "node", insertable: true, insert: { code: "digraph { a -> b }" }, placeholder: "Graphviz 코드를 입력하세요" },
	}),
],
```

- 더할 수 있는 블록은 요소 블록(`container`·`leaf`. `component` 이름의 MDX JSX 요소로 저장하며, 지시자 확장을 쓰면 지시자로도 저장한다. 이때 `directive`가 지시자 이름이다. `@monti-cms/mdx` 참고), 글자 꾸밈(`text` + `editor.view: "mark"`), 코드 펜스 블록(`fence`)이다.
  코드 펜스 블록은 그 언어의 코드 펜스를 모두 가져가므로 일반 코드 언어 이름(`ts` 등)을 쓰지 않는다.
- 글자 꾸밈은 `<컴포넌트 속성>글자</컴포넌트>`로 저장한다(지시자 확장을 쓰면 `:이름[글자]{속성}`). 속성은 정의 순서대로 쓰고, 꼭 있어야 하는 속성(`required`)은 비어도, 나머지는
  값이 있을 때만 쓴다. 겹친 꾸밈은 더한 순서(바깥부터)로 저장한다. 편집기 표시는 관리자 패키지가 정의에서 만들고, 모양·서식
  도구·버블·슬래시 메뉴는 확장이 관리자 화면에 등록한다(`@monti-cms/admin` README의 "글자 꾸밈"). 속성에 `codeAnchor: true`를
  달면 그 값이 코드 블록 줄 이름표(`anchor` 줄 효과)이고, 편집기의 본문–코드 잇기가 이 꾸밈을 쓴다(사이트에 하나만).
- 속성의 선택 값·필수 값·자식 값(`childValue`, 예: 처음 열 탭은 탭 이름 중 하나)과 자식 개수(`children.min`·`max`)는
  발행 전에 검사한다.
- 블록은 `validate(node, ctx)`로 자기 문법을 직접 검사할 수 있다. 코어는 쓰기 파이프라인에서 본체 준비 다음에, 만들기·저장·발행과 일괄·API·AI 쓰기마다 그 블록의 모든 노드(그 언어의 코드 펜스, 요소, 글자 꾸밈)에 이것을 부른다.
  `node`에는 `name`, `id`(저장된 문서에서 그 블록의 id), `attributes`, 코드 펜스 블록이면 `source`(주석을 뺀 코드)가 있고, `ctx`에는 `site`(`site.createTranslator(메시지)`로 관리자 언어의 글을 얻는다), `locale`, `operation`이 있다.
  `{ code, message?, params? }[]`(또는 그것의 프로미스)를 돌려준다. 결과는 **경고**이며 막지 않는다. 각 경고는 `position.blockId`에 그 블록의 id를, `params.block`에 블록 이름을 담고, 저장·발행 응답의 `warnings`로 돌아오며, 편집기는 그 블록 아래에 보여 준다. 검사가 예외를 던지면 `block_validate_failed` 경고가 되고 쓰기는 계속된다.
  `validate`는 함수이므로 서버에서 돌고, 브라우저가 받는 블록 데이터에는 들어 있지 않다.
  `@monti-cms/blocks`는 차트를 자체 파서(`parseChartDsl`)로, Mermaid 다이어그램을 `mermaid.parse`로 검사한다(`mermaid`가 설치되어 있을 때만).

```ts
defineBlock({
	name: "map",
	label: "지도",
	syntax: { kind: "fence", lang: "map" },
	component: "Map",
	attributes: {},
	editor: { view: "node", insertable: true },
	validate: (node) =>
		(node.source ?? "")
			.split("\n")
			.flatMap((line, index) =>
				/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(line.trim())
					? []
					: [{ code: "map_line", message: `${index + 1}줄이 "위도,경도" 형식이 아닙니다.`, params: { line: index + 1 } }],
			),
});
```

- 쓰던 블록을 빼면 저장 문법에서 빠진다. 이미 그 블록을 쓴 본문은 다시 저장할 때 일반 글로 바뀌므로 쓰던 블록은 빼지 않는다.
- 본문을 담는 컨테이너는 슬래시 메뉴로 넣으면 빈 문단으로 시작한다. `editor.insert.codeBlocks`(`[{ language, title?, code? }]`)를 주면 그 코드 블록들로 시작하며, `title`은 코드 펜스의 `title` 메타다(코드 탐색기가 `src/index.ts` 파일 하나로 시작하는 데 쓴다).
- 편집기 노드는 관리자 패키지가 정의에서 만든다. 편집 모양은 관리자 패키지의 `blockViews`(모든 블록의 화면 전체,
  `useBlockEditor`와 `Content`로 만든다)로 바꾸고, 코드 펜스 블록의 미리보기는 `fencePreviews`로 넣는다.
- 공개 화면의 코드 펜스 블록은 `renderDocument`/`CmsContent`가 문서에서 바로 그린다. 블록에 등록된 컴포넌트(플러그인 `render` 모듈의 `documentComponents`나 사이트의 `components`)를 쓰므로 렌더 체인에 따로 넣을 것이 없다.
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

### 본문별 허용 블록·마크

본문마다 글쓴이가 더할 수 있는 블록과 마크를 제한할 수 있다. 컬렉션의 `body`를 객체로 쓴다. `monti.schema.json`에도, 코드의 `defineCollection`에도 같은 모양이다.

```json
"memo": {
	"label": "메모",
	"kind": "document",
	"body": {
		"blocks": ["callout", "collapsible", "table", "codeBlock", "image"],
		"marks": ["bold", "italic", "link", "tooltip"],
		"headings": [2, 3]
	},
	"fields": { "title": { "kind": "text", "label": "제목", "required": true } }
}
```

객체로 쓰면 그 컬렉션에 본문이 있다는 뜻이다. 키는 모두 선택이며, 빠진 키는 그 종류를 모두 허용한다(목록이 없는 본문은 전과 같이 모두 허용). 편집기와 검증이 같은 목록 하나를 읽으므로 둘이 어긋나지 않는다.

- `blocks`: 코어 블록은 이름으로 쓴다. `table`, `taskList`, `math`, `image`, `file`, `codeBlock`, `blockquote`, `horizontalRule`, `footnotes`(참조와 정의), `text-align`. 블록 확장이나 설정의 `blocks`가 더한 블록은 블록 이름으로 쓴다(`callout`, `tabs`, `chart` 등).
  블록의 하위(탭, 열, 표의 행과 칸)는 부모를 따른다. 문단, 목록, 줄바꿈은 항상 허용된다.
- `marks`: `bold`, `italic`, `strike`, `underline`, `code`, `link`, `superscript`, `subscript`, 그리고 블록 확장이나 설정이 더한 글자 꾸밈의 블록 이름(`tooltip`, `color`, `code-ref` 등). 번역 안내 글은 제한하지 않는다.
- `headings`: 본문이 허용하는 제목 단계(1~6). 편집기는 2~4단계만 보여 주므로(글 제목이 1단계 제목) 다른 단계는 저장된 내용에서만 검사한다.
- 사이트에 없는 블록·마크 이름(오타, 설치하지 않은 블록)은 설정을 읽을 때 오류다. 실수로 블록이 허용된 채 남는 일이 없게 하려는 것이다.

**편집기가 보여 주는 것.** `CmsEditor`는 이 목록(`allowed`, 편집 화면은 컬렉션의 것을 넘긴다)을 받아 허용된 것만 보여 준다. 툴바(제목 단계, 글자 꾸밈, 위·아래 첨자, 정렬, 목록, 인용, 코드 블록, 표, 구분선, 각주, 링크, 업로드 도구), `/` 슬래시 메뉴, 컴포넌트 메뉴, 글 위에 뜨는 말풍선이 그렇다. 허용하지 않는 것의 입력 규칙(`> `, `# `, `- [ ] `, `---`, 코드 펜스, `**굵게**`)과 단축키는 꺼지고, 그것을 더하는 명령은 거절된다.
블록 뷰에서 더하는 블록(`useBlockEditor().addChild`)도 같은 목록을 따른다. 코드 블록을 허용하지 않을 때 컨테이너에 코드 블록을 더하면 `invalid_state`로 실패한다.

**붙여넣기.** 허용하지 않는 블록을 붙여넣으면 그 블록은 들어가지 않고 글만 들어간다. 글 블록(다른 단계의 제목, 코드 블록)은 문단이 되고, 컨테이너(표, 인용, 콜아웃)는 안의 문단들이 된다. 글이 없는 블록은 버려지며, 수식은 소스를, 이미지는 설명을, 파일은 이름을 글로 남긴다. 허용하지 않는 마크는 글에서 떼어 낸다. 내용은 남고 모양만 바뀐다. 편집기 안에서 블록을 옮기는 것은 붙여넣기가 아니므로 그대로 옮겨진다.

**이미 있는 내용.** 목록은 글쓴이가 **더하는 것**만 막는다. 더는 허용하지 않는 블록이나 마크가 있는 본문도 열리고, 보이고, 그대로 저장된다. 지워지지 않으며 글쓴이는 그 안을 고치고 옮기고 복제하고 지울 수 있다(코드 블록 도구를 끌 때와 같은 규칙). 서버도 거절하거나 지우지 않는다.

**검증.**

- 목록이 허용하지 않는 저장된 내용은 **저장할 때마다, 그리고 발행할 때 나오는 경고**이며 아무것도 막지 않는다. `disallowed_block`(블록 이름, 제목 단계는 `heading 4`)과 `disallowed_mark`이고, 각각 들어 있는 블록의 id(`position.blockId`)를 담는다.
- 목록이 허용하지 않는 내용 때문에 쓰기를 **거절하지 않는다**. 글쓴이의 다른 수정이 늘 저장되게 하려는 것이다. 모든 저장(관리 화면, REST API, AI, 일괄 변경, 템플릿)이 같은 경고를 돌려주고, 관리 화면은 다른 저장 경고처럼 보여 준다. 새 내용을 목록 안에 두는 것은 편집기(메뉴, 입력 규칙, 붙여넣기 변환)다.

### 글자색 목록

글자색은 블록 확장(`@monti-cms/blocks`의 `color({ palette })`)이 준다. 예전 설정 `textColors`는 없어졌다(옵션으로 옮긴다).

## 저장된 문서 그리기

`@monti-cms/core/render`의 `renderDocument`(와 서버 컴포넌트 `CmsContent`)는 저장된 문서(`StoredDocument`)를 React로 그린다. 공개 경로에서 MDX를 컴파일하거나 코드를 실행하지 않는다.
코어는 문서만 그린다. 글은 먼저 문서로 읽어서 그린다(MDX는 `@monti-cms/mdx/render`의 `renderMdx`가 그렇게 한다).

```tsx
import { CmsContent, type DocumentComponentsOf, renderDocument, tableOfContents } from "@monti-cms/core/render";

const entry = (await cms.read.getEntry({ collection: "post", slug, locale })).entry; // 문서와 refs
// 서버 컴포넌트에서는: 이미지와 파일은 entry.refs에서, 언어는 entry.locale에서,
// 블록·코드 설정·플러그인 컴포넌트는 `cms`의 사이트에서 가져온다
<CmsContent cms={cms} entry={entry} components={components} />;
tableOfContents(entry.doc); // 2·3단계 제목, 같은 앵커, React 없음
// 문서 하나만 있을 때:
const { content, toc, unknown } = await renderDocument(doc, { site: cms.site, locale, refs, components });
<CmsContent cms={cms} doc={doc} refs={refs} locale={locale} components={components} />;
```

- **두 단계.** 비동기 선처리가 문서를 한 번 훑고(제목 앵커와 목차, 각주 번호, 모든 코드 블록의 Shiki 강조, 모든 수식의 KaTeX 출력), 그다음 동기 순수 렌더가 노드를 요소로 바꾼다.
  결과는 서버 컴포넌트와 `renderToStaticMarkup` 테스트에서 그대로 쓰는 평범한 React 트리다.
- **내용 때문에 던지지 않는다.** 모르는 노드·마크·블록, 컴포넌트가 없는 블록, 속성이 잘못된 노드는 `fallback` 컴포넌트로 그려지고 `unknown`에 담긴다(`onUnknown`도 부른다).
  모르는 컨테이너는 안의 내용을 보이고 모르는 리프는 아무것도 그리지 않는다. 개발 중에는 기본 fallback이 숨겨진 `<span data-cms-unknown>`을 남긴다. `strict: true`면 대신 던진다(테스트, 미리보기 화면).
  저장된 문서가 아닌 값은 빈 본문으로 그리고 로그를 남긴다.
- **컴포넌트**는 층층이 합쳐진다: 코어 기본값, 블록 확장의 컴포넌트(플러그인 `render` 모듈의 `documentComponents`. `CmsPlugin.render`는 `{ documentComponents }`를 돌려주며, MDX 모양의 옛 기본 내보내기는 없어졌다), 사이트의 `components` 순이다. 노드마다 속성 타입이 하나씩 있고
  (`ParagraphProps`, `id`가 있는 `HeadingProps`, `ListProps`, `CodeBlockProps`, 해석된 `src`가 있는 `ImageProps`, `FileProps`, `TableProps`·`TableRowProps`·`TableCellProps`, `MathProps`,
  `FootnoteRefProps`·`FootnotesProps`, `HardBreakProps`), 코어 마크(`link`, `bold`, `italic` …)마다 하나, 코드 블록 안 요소용 `codeTags`(`fold`, `collapse`, `Tooltip`)가 있다.
  모든 컴포넌트는 `ctx`(`locale`과 고정 문구 `labels`; 순수 JSON이라 클라이언트 컴포넌트로 넘길 수 있다)도 받고, 블록 컴포넌트는 `blockId`, `node`, `items`도 받는다.
- **블록은 블록 이름으로 등록하고 속성은 평평한 props로 받는다.** props 타입은 사이트 설정에서 나온다: `blocks: { callout: ({ variant, title, children }) => … }`,
  `marks: { tooltip: ({ content, children }) => … }`. `components`의 타입(`DocumentComponentsOf<typeof cms>`, 또는 `DocumentComponentsFor<typeof config>`)은 `monti.config.ts`의 `blocks`와 플러그인의 `blocks`로 만들어진다
  (`defineBlock`이 속성을 리터럴로 보존하므로 `variant`는 `"note" | "tip" | …`이다). 불리언 속성은 늘 불리언이고, 기본값이 있는 값과 필수 문자열은 늘 있으며,
  선택지에 없는 값은 기본값으로 바뀐다. 코드 펜스 블록(`mermaid`, `chart`)은 코드를 `source`로 받는다.
- **렌더러는 하나.** 제목 앵커는 `github-slugger`를 따르고, 각주는 처음 참조한 순서로 번호가 붙고, 같은 Shiki 흐름이 코드(줄 효과, 글자 효과, 줄 이름표)를 그리며,
  블록 수식은 KaTeX `htmlAndMathml`이다. 표는 표 컴포넌트가 그리고(스크롤 래퍼와 `cms-table-*` 클래스), 블록 KaTeX 출력은 `<div class="cms-math">` 안에 들어가며, 이미지는 `refs`를 거친다.

## 플러그인

`monti.config.ts`의 `plugins`에 한 번 적는다(예: AI 플러그인 `@monti-cms/ai`의 `aiPlugin()`). 플러그인은 모두 인자 없이 동작하는 함수다(`mdx()`·`seo()`·`aiPlugin()`·`@monti-cms/blocks`의 블록마다 `callout()` 같은 함수·`gitSync()`). `targets` 없는 `gitSync()`는 플러그인만 등록하고, `targets`에 저장소를 적기 전에는 아무것도 동기화하지 않는다. `plugins`의 순서는 순서가 중요한 곳에서 그대로 쓰인다(훅은 그 순서로 돌고, 인라인 마크 `tooltip()`·`codeRef()`·`color()`가 겹칠 때는 그 순서로 저장된다).

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
		formats: () => import("my-plugin/formats"), // CmsFormat 하나 또는 그 목록("형식" 절)
	});
```

- 서버 쪽(`server`)은 브라우저 묶음에 들어가지 않게 패키지 `exports`의 `browser` 조건으로 빈 진입점을 준다.
- `formats`는 형식(문서를 써 내고 읽어 올 수 있는 표기, "형식" 절)을 더한다. 인스턴스가 형식이 처음 필요할 때 서버에서 읽는다.
- `validate`는 컬렉션·언어·블록 정의와 모든 플러그인(`plugins`)을 받는다. 역할을 쓰는 확장은 여기서 필드 종류를 확인한다.
- `contributes`는 다른 플러그인에 더하는 것이다. 키와 모양은 받는 플러그인이 정하고 본체는 읽지 않는다. 예를 들어
  `contributes: { ai: { actions: { … } } }`는 AI 플러그인(`@monti-cms/ai`)이 있으면 그 기능을 더하고, 없으면 쓰이지 않는다.
  확장은 받는 플러그인을 몰라도 기능을 더할 수 있다(블록 확장의 다이어그램 만들기, SEO 확장의 검색 제목 추천).
- 서버 쪽 `routes`는 본체 경로(`/api/cms/v1/*`)에 없는 주소를 받는다. 본체가 관리자 로그인 확인과 같은 출처 검사로 감싸므로
  인증을 빠뜨려도 열린 경로가 되지 않는다. 로그인 없이 받아야 하는 경로(외부 실행기·웹훅)만 `public: true`로 빼고 스스로 확인한다.
  `migrate`는 `monti migrate`가 본체 표 다음에 부른다.
- 같은 출처 검사는 `Host`·`site.url`의 호스트를 받고, `X-Forwarded-Host`의 첫 값은 호스트를 신뢰할 때만 받는다("호스트 신뢰"). `Host`를 바꾸는 프록시 뒤라면 `site.url`을 적거나 호스트를 신뢰한다.
- 서버 쪽 `hooks`(`transform`·`validate`·`validatePublish`·`afterCommit`)는 서버 설정의 `hooks`와 같고, 서버 설정의 훅 다음에 플러그인 순서대로 돈다. "훅 계약"을 본다.
- 서버 쪽 `afterCommit(event, cms)`(`hooks`와 별개)는 `hooks.afterCommit`과 같은 알림(아웃박스에서 전달, 재시도, 최소 한 번, "이벤트 전달")이지만 인스턴스도 받는다. 그래서 자기 저장소·스토어·형식이 필요한 구독자가 따로 상태를 두지 않아도 된다. 둘 다 가진 플러그인은 `hooks.afterCommit`을 먼저 돌리는 구독자 하나(`plugin:<이름>`)다.
- 서버 쪽 `commands`는 명령줄 명령을 더한다. `monti <플러그인 이름>:<명령> [옵션]`이 `monti migrate`처럼 앱을 불러오고(`--env-file`, `--no-env-file`, `--config`) `command.run({ cms, args, log, error })`를 돌려 그것이 돌려주는 코드로 끝난다. 명령은 `options`(`{ 이름: { type: "string" | "boolean", description } }`)를 선언하고, `--help`가 그것을 나열한다. `monti git-sync:pull`이 그중 하나다.
- 직접 만든 관리자 컴포넌트도 플러그인이다. `admin` 모듈을 주고 그 default export를 `defineAdminPlugin({ Provider })`(`@monti-cms/admin/plugins`)로 만든다. `Provider`(`"use client"` 컴포넌트)가 관리자를 감싸고 `CmsAdminComponentsProvider`로 컴포넌트를 등록한다. `admin-components.tsx` 파일은 더 이상 없다. `examples/blog/plugins/word-list/`가 예시다:

  ```ts
  export const wordList = () => definePlugin({ name: "word-list", options: {}, admin: () => import("./admin") });
  // ./admin.ts: export default defineAdminPlugin({ Provider })
  ```

- `@monti-cms/core/plugin/server`의 `exportBodyText(cms, { format, doc, locale, scope? })`는 저장된 문서를 인스턴스의 형식으로 다시 가져올 수 있게(`purpose: "sync"`, 링크는 대상의 실제 경로) 텍스트로 쓴다. 관리자 내보내기와 같다. 본문을 다른 곳에 두는 플러그인을 위한 것이다.
- 플러그인 라우트는 자신을 맡은 인스턴스를 받으므로, 플러그인 코드는 자기 저장소(`cms.storage("<플러그인 이름>")`)·저장소(`cms.store()`·`cms.mediaStore()`)·비밀 값(`cms.secrets("<플러그인 이름>")`)을 거기서 읽고 따로 전역 상태를 두지 않는다. `adminRoute` 등 라우트 틀은 `@monti-cms/core/plugin/server`에 있고, `features(cms)`와 `migrate(storage, cms)`도 인스턴스를 받는다.

### `monti doctor` 검사

서버 플러그인은 `checks`로 검사를 더한다(데이터베이스·로그인·미디어 어댑터에도 같은 필드가 있다). 검사는 `id`, `title`, 네트워크를 쓰는 검사에 붙이는 `online: true`(`--online`일 때만 돈다), 찾은 것을 돌려주는 `run(context)`로 이루어진다. `ok(message)`, `warn(message, { where, fix })`, `fail(message, { where, fix })`, `skip(message)`(`@monti-cms/core`의 도우미)를 돌려준다. 컨텍스트에는 인스턴스(`cms`: 플러그인 저장소, 비밀 값, 사이트), 폴더(`cwd`), 환경(`env`), `online`이 있다. 검사는 플러그인 이름 아래(`git-sync/token`)에 나온다. 던지는 검사는 오류 메시지와 함께 실패이고, 30초가 넘어도 실패다.

```ts
import { type CmsServerPlugin, fail, ok, warn } from "@monti-cms/core";

const server: CmsServerPlugin = {
	checks: [
		{
			id: "token",
			title: "Token",
			run: async ({ cms }) =>
				(await hasToken(cms))
					? ok("a token is saved")
					: warn("no token is saved", { where: "the Demo screen (/admin/demo)", fix: "paste a token there" }),
		},
		{ id: "reachable", title: "Service reachable", online: true, run: async () => (await ping()) ? ok("reachable") : fail("the service does not answer", { fix: "check its status page" }) },
	],
};
export default server;
```

`where`와 `fix`는 사람에게 말하듯 쓴다: 파일·변수·화면, 그리고 정확한 값이나 명령이 든 다음 단계. 플러그인이 던지는 오류도 같게 말해야 한다(`@monti-cms/core`의 `problemText({ what, where, fix })`가 한 줄 형태로 써 준다).

### 비밀 값

비밀 값은 하나, `MONTI_SECRET`(또는 `defineConfig({ secret })`)이다. `AUTH_SECRET`과 `CMS_SECRET`을 대신하며 이 둘은 더 이상 읽지 않는다. 비밀 값 자체는 누구에게도 건네지 않고, HKDF-SHA256으로 만든 파생 키만 쓴다.

- 로그인 세션 서명 키: `cms.secrets("auth").deriveKey("session")`. 로그인 연결용으로 만든다(`AuthCreateContext.secrets`). `MONTI_SECRET`이 없으면 로그인은 `MONTI_SECRET`을 이름으로 알리는 오류로 실패한다.
- 플러그인마다의 암호화 키: `cms.secrets(<플러그인 이름>)`, 아래를 본다.

#### 플러그인 비밀 값

플러그인은 마스터 비밀 값을 받지 않는다. 인스턴스가 이 값에서 플러그인마다 키를 하나씩 만들고(HKDF-SHA256, info 문자열은 `monti:plugin:<플러그인 이름>:v1`), 그 키로만 동작하는 API를 플러그인에 건넨다.

```ts
const secrets = cms.secrets("my-plugin");   // 라우트, `features(cms)`, `migrate(storage, cms)` 안에서
secrets.available;                          // 비밀 값(MONTI_SECRET 또는 `secret`)이 없으면 false
const stored = secrets.encrypt("sk-live-1234");   // "mk1:<키 id>:<iv>:<tag>:<body>", AES-256-GCM, 텍스트 열에 그대로 저장해도 된다
secrets.decrypt(stored);                    // "sk-live-1234". 이 플러그인의 값이 아니거나, 모르는 secret으로 만들었거나, 깨졌으면 null
secrets.isCurrent(stored);                  // 이전 secret으로 만든 값이면 false: 풀어서 다시 암호화한다
secrets.deriveKey("signing");               // 다른 용도(HMAC, 해시)용 32바이트 키. 플러그인과 용도마다 다르다
```

- 플러그인끼리는 키가 서로 무관하므로, 한 플러그인이 다른 플러그인의 값을 풀 수 없고, 한 플러그인의 테이블에서 읽은 값으로는 마스터 비밀 값도 다른 플러그인의 데이터도 알 수 없다. 플러그인 코드는 여전히 같은 서버 프로세스에서 돌므로 이것은 플러그인이 저장하는 값을 서로 나누는 장치이지 샌드박스가 아니다.
- 값마다 만든 키의 id가 붙어 있어(`mk1:<키 id>` 접두어), `decrypt`는 모든 secret을 시도하지 않고 맞는 것을 바로 고른다.
- 교체: 새 값을 `MONTI_SECRET`(또는 `secret`)에, 옛 값들을 `previousSecrets`에 둔다(`previousSecrets: [process.env.OLD_MONTI_SECRET]`. 항목이 설정하지 않은 환경 변수여도 되고, 그런 항목은 무시한다). `decrypt`는 현재 secret을 먼저, 그다음 이전 secret들을 시도하고, `encrypt`는 항상 현재 secret을 쓴다. 플러그인은 `isCurrent`가 false인 값을 다시 저장할 때 새로 암호화한다. 그 secret으로 저장된 값을 모두 다시 암호화한 뒤에만 `previousSecrets`에서 뺀다(AI 플러그인은 `monti migrate`에서 이 일을 한다).
- 이 API가 생기기 전에 자기 형식으로 값을 저장한 플러그인은 그 형식을 알릴 수 있다. `cms.secrets("my-plugin", { legacy: { prefix: "v1", domain: "my-key:" } })`로 알리면 `decrypt`가 `sha256("my-key:" + secret)`으로 암호화한 `v1:<iv>:<tag>:<body>` 값도 읽는다. 옛 형식은 읽기 전용이며 `encrypt`는 쓰지 않는다.
- `cms.server`는 `secret`과 `previousSecrets`를 뺀 서버 설정이다.
- `MONTI_SECRET`을 바꾸면 로그인 세션 키도 바뀌어 모두 한 번 다시 로그인한다. `previousSecrets`는 저장된 값을 계속 읽게 할 뿐 옛 로그인 세션을 살려 주지는 않는다.

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

## 서버 옵션

서버 옵션은 사이트 옵션과 함께 하나의 `defineConfig({ … })` 호출에 들어간다("CMS 인스턴스" 절). 서버에서만 읽힌다. 옵션을 주지 않으면 어댑터가 관례적인 환경 변수를 읽고, 명시한 옵션이 항상 이긴다.

| 항목 | 뜻 |
|---|---|
| `database` | 필수. 콘텐츠 저장소. `postgres()`는 `DATABASE_URL`과 `DATABASE_SCHEMA`를 읽고, `postgres({ connectionString, schema })`는 코드에서 정한다 |
| `auth` | 필수. 관리자 로그인. `@monti-cms/auth`의 `auth({ providers: [github()], host?, devBypass?, basePath? })`. `github()`는 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·`MONTI_ADMIN_GITHUB_ID`(GitHub 숫자 ID 하나, 또는 쉼표로 구분한 여럿)를 읽고, `github({ clientId, clientSecret, admins })`는 코드에서 정한다. `basePath`는 로그인 API 경로(기본 `/api/cms/auth`, "로그인 경로")다. 세션 서명 키는 비밀 값에서 만든다("비밀 값"). `host`는 Next 통합 밖에서 쓰는 명시적 재정의다(`cms.attachHost`가 붙인 호스트보다 우선한다). Next.js 앱에서는 적지 않는다. 개발 우회가 켜진 `next dev`에서는 GitHub 앱이 없어도 로그인을 시도할 때만 오류가 나고, 로그인이 필요한 서버에서는 로그인 연결을 만들 때 오류가 난다 |
| `storage` | 선택. 이미지·첨부 파일 저장소. 아무 패키지의 어댑터(예: `@monti-cms/storage-s3`의 `s3Storage`: AWS S3·Cloudflare R2·MinIO) 또는 `MediaStore` 계약을 구현한 연결(`MediaAdapter`). 없으면 미디어 기능을 못 쓰고 관리자가 미디어 메뉴를 숨긴다. |
| `secret` | 선택. 하나뿐인 비밀 값. 없으면 `MONTI_SECRET` 환경 변수. 로그인 세션과 플러그인이 암호화해 두는 값(AI 서비스 키, git-sync 토큰)이 이 값에서 만든 키를 받는다. 비밀 값 자체는 누구도 받지 않는다("비밀 값"). |
| `previousSecrets` | 선택. `secret`이 바뀌기 전의 값들(항목이 정의되지 않은 환경 변수 값이어도 된다). 이 값으로 암호화한 저장 값도 계속 읽히고, 다시 저장할 때 `secret`으로 새로 암호화된다. 그래서 `secret`을 바꿔도 저장된 키를 다시 넣지 않아도 된다. |
| `trustHost` | 선택. `Host`·`X-Forwarded-Host`를 믿을지("호스트 신뢰"). 기본값은 `AUTH_TRUST_HOST` 환경 변수, 없으면 알려진 프록시 플랫폼이 감지되거나 개발일 때 켬, 그 밖에는 끔 |
| `publicApi` | 선택. 공개 JSON API(`/api/cms/v1/public/entries`·`/entries/:collection/:slug`, 로그인 없이 공개본만, 캐시 안 함). `{ collections, filters?: { 질의이름: 관계필드 }, toJson?(entry, { body }) }` |
| `hooks` | 선택. 모든 콘텐츠 쓰기에 거는 훅: `transform`·`validate`·`validatePublish`·`afterCommit`(변경이 커밋된 뒤 알림: 캐시 갱신·웹훅·검색 색인. 실패하면 다시 시도하므로 멱등이어야 한다). "훅 계약"과 "이벤트 전달"을 본다. 플러그인도 `hooks`를 둘 수 있다 |
| `events` | 선택. `afterCommit` 전달을 다시 시도하고 보관하는 방식: `{ maxAttempts?, backoffMs?(attempt), retentionDays?, retrySecret? }`. "이벤트 전달"을 본다 |

다른 저장소·로그인을 쓰려면 `DatabaseAdapter`·`MediaAdapter`(`storage`로)·`AuthAdapter`를 직접 만들어 넣는다. 낮은 수준의 `createCms({ config, server })`는 같은 옵션을 `CmsServerConfig`로 받고(`storage` 대신 `media`) 사이트 설정은 따로 받는다.

### 호스트 신뢰

`Host`와 `X-Forwarded-Host`는 클라이언트가 직접 보낼 수 있어서, 운영에서는 기본적으로 믿지 않는다. 믿는다는 것은 두 가지다. 로그인 콜백 주소를 요청의 호스트로 만들고, 같은 출처 검사가 `X-Forwarded-Host`의 첫 값을 받는다.

순서는 이렇다. `trustHost` 옵션이 가장 앞서고, 그다음 `AUTH_TRUST_HOST` 환경 변수(`true`·`1` 또는 `false`·`0`), 그다음 알려진 프록시 플랫폼이 감지되거나(환경 변수 `VERCEL`·`NETLIFY`·`CF_PAGES`·`RENDER`·`RAILWAY_ENVIRONMENT`·`FLY_APP_NAME`·`K_SERVICE` 중 하나가 있을 때) 개발·테스트일 때(그곳의 호스트는 `localhost`다) **자동으로 켜진다**. 그 밖의 운영 환경에서는 꺼진다. 켜지 않은 운영 서버에서는 로그인이 `UntrustedHost` 오류로 실패한다(이 옵션들을 알려 주는 경고도 남긴다).

- 보안상 주의: 켜 두면 프록시가 `X-Forwarded-Host`를 덮어쓰지 않는 한 클라이언트가 로그인 콜백 주소를 만드는 호스트를 고를 수 있다. 위의 플랫폼은 덮어쓴다.
- 직접 운영하는 프록시(nginx, 로드 밸런서)는 감지되지 않는다. `trustHost: true` 또는 `AUTH_TRUST_HOST=true`로 켜고, 그 프록시가 `X-Forwarded-Host`를 덮어쓸 때만 그렇게 한다.
- 그렇지 않으면 `AUTH_URL`에 사이트의 공개 주소를 적는다. 로그인이 쓰는 출처가 고정되므로 호스트를 믿지 않아도 로그인이 된다. 같은 출처 검사에는 `site.url`을 적어 공개 호스트를 받게 한다.

### 개발용 로그인 우회

`next dev`(`NODE_ENV=development`)에서는 방문자를 로그인 없이 첫 번째 관리자로 보며, 이것이 **기본값**이다. 따로 정할 변수는 없다(`CMS_DEV_AUTH_BYPASS`는 없어졌다). `auth({ devBypass: false })`로 끈다. 스테이징 서버가 실수로 열리지 않도록 다음처럼 제한한다.

- `NODE_ENV`가 `development`여야 한다. 운영에서는 절대 켜지지 않고, 다른 모드에서 `devBypass: true`를 주면 무시하고 경고를 남긴다.
- 배포된 서버처럼 보이면 안 된다. 호스팅 플랫폼 변수(`VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`, `AWS_EXECUTION_ENV`, `AWS_LAMBDA_FUNCTION_NAME`, `KUBERNETES_SERVICE_HOST`, `DYNO`)가 있거나 `AUTH_URL`이 공개 주소를 가리키면 거부한다. 이때 서버는 시작을 거부하고(로그인 연결을 처음 쓸 때 오류를 던진다) 이유를 알려 준다. `devBypass`를 정하지 않았다면 그런 곳에서는 우회가 그냥 꺼져 있고, 배포된 것처럼 보이는 프로세스에 `devBypass: true`를 명시하면 시작을 거부한다.
- 요청마다 내 컴퓨터에서 온 것이어야 한다. `Host`가 `localhost`·`*.localhost`·`127.0.0.0/8`·`::1`이고, `X-Forwarded-Host`와 `X-Forwarded-For`가 있으면 그것도 루프백이어야 한다. 그 밖의 요청은 평소처럼 로그인해야 하고, 경고를 한 번 남긴다. `cms.authGateway.isDevBypassActive()`가 같은 검사를 한다(비동기).

## 훅 계약

모든 콘텐츠 쓰기는 본체 서비스의 한 파이프라인을 지난다: 만들기, 저장, 발행(하나 또는 일괄), 복제, 번역본 만들기, 메타데이터·폴더 일괄 변경.
훅은 서버 옵션(`defineConfig({ hooks, … })`)이나 플러그인 서버 쪽(`CmsServerPlugin.hooks`)에 같은 모양으로 등록한다.
타입(`WriteHooks`·`WriteHookContext`·`WriteData`·`ValidationHookContext`·`ValidationResult`·`WriteOperation`)은 `@monti-cms/core/server`와 `@monti-cms/core/plugin/server`에서 내보낸다.

```ts
import { defineConfig } from "@monti-cms/core/server";

export const cms = defineConfig({
	// schema, plugins, database, auth, ...
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
		afterCommit: (event) => revalidate(event.collection, event.publishedSlug),
	},
});
```

| 단계 | 하는 일 |
|---|---|
| 1 | 입력 만들기: 요청에서, 또는 저장된 초안에서(발행·일괄) |
| 2 | `transform` 훅. 등록 순서대로(설정 자체의 훅이 먼저, 그다음 플러그인을 설정 순서대로). 각 훅은 앞 훅의 결과를 받는다 |
| 3 | 본체 준비: 정규화·참조 수집·본체 검증. **항상, 변환된 데이터에 대해 돈다** |
| 4 | 블록마다 `validate`(경고만), 이어서 `validate` 훅: 실패와 경고를 더한다 |
| 5 | 발행(그리고 다시 발행되는 항목 복원)에서 `validatePublish` 훅: 실패와 경고를 더한다 |
| 6 | 저장소 커밋. 글 하나에 트랜잭션 하나(일괄은 항목마다 커밋) |
| 7 | `afterCommit` 훅 |

- `operation`은 `create`·`save`·`publish`·`duplicate`·`translate`·`restore`다. 메타데이터·폴더 일괄 변경은 항목마다 `save`, 일괄 발행은 항목마다 `publish`다.
  글을 만드는 중에는 `entryId`가 없다. `metadata`와 `doc`(저장 문서 형태의 본문, 문서가 될 수 없는 초안은 `unparsed` 노드 하나)은 복사본이라, `transform`이 돌려주지 않으면 바꿔도 아무 일도 없다.
  `validate`와 `validatePublish`는 준비된 `snapshot`(복사본)도 받는다.
- 보관·보관 해제·휴지통·삭제는 내용을 바꾸지 않으므로 2~5단계를 건너뛰고 `afterCommit`만 부른다. 항목(record)을 복원하면 다시 발행되므로 `restore`로 3~5단계를 거친다(`validate`와 `validatePublish`가 돌아서 휴지통에 넣었다 복원하는 식으로 발행 제한을 피할 수 없다. 내용이 그대로이므로 `transform`은 돌지 않는다). 다른 글의 복원은 초안으로 돌려놓을 뿐이라 아무 훅도 돌지 않는다.
- 훅은 DB 트랜잭션 밖에서 돌고 DB 클라이언트를 받지 않는다. 비동기여도 된다. 저장소 내부 옵션 `beforePublishCommit`(트랜잭션 클라이언트를 받는다)은 이 계약에 들지 않고 그대로다.
- 발행하는 중에 `transform`이 초안을 바꾸면 그 변경은 발행과 함께 한 트랜잭션으로 저장된다(`afterCommit`에는 그 글의 `saved` 변경 다음에 `published` 변경이 온다. 바뀐 것이 없는 발행은 `published`만 온다). 만들거나 저장하면서 바로 발행하는 경우(항목)도 같게 `created` 또는 `saved`, 그다음 `published`로 알린다.
- 훅이 예외를 던지거나 계약에 맞지 않는 값을 돌려주면 쓰기는 `hook_failed`(HTTP 500)로 실패한다. 오류의 `issues[].params`에 훅 이름과 소유자(`server` 또는 `plugin:<이름>`)가 들어가고, 아무것도 저장되지 않는다. `validate` 실패는 `validation_failed`, `validatePublish` 실패는 `publish_validation_failed`(HTTP 422)이며, 더한 이슈가 초안 자체의 이슈 옆에 붙는다.
- `afterCommit`은 이벤트를 받는다. id·상태·주소·`version`·`contentHash`·`eventId`, 그리고 커밋된 글을 읽는 `read()`다(본문 자체는 아니다). 전달은 아웃박스에서 하며 최소 한 번, 글마다 순서대로, 실패하면 다시 시도한다. "이벤트 전달"을 본다.

계약(각각 `src/services/__test__/write-hooks.test.ts`와 `write-pipeline.test.ts`에 시험이 있다):

1. **변환된 데이터도 본체를 거친다.** 정규화·참조 수집·검증이 `transform`의 결과에 대해 돌아서, 변환으로 본체 검사를 피할 수 없다.
2. **추가 검증은 실패를 더할 수만 있다.** `validate`와 `validatePublish`가 돌려준 이슈와 경고는 본체의 것에 더해진다. 훅은 스냅샷의 복사본을 받으므로 본체 이슈를 지우거나 낮출 수 없고, 발행의 본체 무결성 검사(참조·미디어·링크·필수 값)는 항상 돈다.
3. **커밋 전의 실패는 쓰기를 막는다.** 본체 준비 실패, 훅이 더한 실패, 훅의 예외는 아무것도 저장하지 않고 `afterCommit`도 부르지 않는다.
4. **`afterCommit`의 실패는 끝난 쓰기를 되돌리지 않는다.** 기록하고 다시 시도하며, 다른 `afterCommit` 훅은 그대로 돈다. 이벤트는 쓰기의 트랜잭션에서 쓰이므로 롤백된 쓰기는 이벤트를 남기지 않는다.
5. **일괄은 모든 항목에 같은 훅을 적용한다.** 항목마다 파이프라인 전체를 돌고, 결과나 오류(`hook_failed`·`validation_failed` 등)는 항목별로 돌아간다.

## 이벤트 전달(`afterCommit`)

`afterCommit`은 아웃박스에서 전달되므로, 구독자가 실패하거나 프로세스가 멈춰도 사라지지 않는다.

- **아웃박스.** 변경과 같은 트랜잭션에서 저장소가 `cms_events`(마이그레이션 `0022_events`)에 행을 넣는다. 열은 `id`, `kind`(`created`·`saved`·`published`·`archived`·`unarchived`·`trashed`·`restored`·`deleted`), `entry_id`, `collection`, `locale`, `content_hash`, `version`, `occurred_at`, 그리고 상태와 주소를 담은 `payload`다. 롤백된 변경은 이벤트를 남기지 않고, 커밋된 변경에는 항상 이벤트가 있다. 만들거나 저장하면서 바로 발행하면 이벤트가 둘 생긴다(`created`/`saved`, 그다음 `published`). `entries`로 가는 외래 키가 없어서 삭제의 이벤트는 글보다 오래 남는다. 원본의 번역본에 미치는 변경은 변경을 가한 글 하나로 한 번만 알린다(`translationGroupId`가 묶음을 가리킨다).
- **구독자.** 설정의 `hooks.afterCommit`은 구독자 `server`, 각 플러그인의 `hooks.afterCommit`은 `plugin:<플러그인 이름>`이다. 이름은 바뀌지 않는 값이고 `cms_event_deliveries`의 전달 상태(이벤트와 구독자마다 한 행: `state`, `attempts`, `last_error`, `next_attempt_at`)의 키가 되므로, 구독자가 있는 플러그인의 이름은 바꾸지 않는다. 나중에 생긴 구독자는 생긴 뒤에 커밋된 이벤트부터 받고, 그 전의 기록은 받지 않는다.
- **전달.** 커밋 뒤에 변경을 만든 프로세스가 같은 호출 안에서 바로 각 구독자에게 보내므로 지연은 이전과 같다. 실패는 기록하고 점점 길어지는 간격(15초에서 시작해 두 배씩, 최대 1시간. `events.backoffMs`로 바꾼다)으로 나중에 다시 시도하며, `events.maxAttempts`번(기본 8) 시도하고도 실패하면 전달이 데드레터(`dead`)가 된다. 쓰기는 되돌리지 않고, 다른 구독자도 막지 않는다.
- **최소 한 번, 글마다 순서대로.** 이벤트는 두 번 이상 전달될 수 있다(일을 하고 나서 실패한 구독자, 끝나지 못한 시도). 그래서 **구독자는 멱등이어야 한다.** 구독자는 시도마다 같은 `event.eventId`를 받아 처리한 이벤트를 기억한다. 한 글의 이벤트는 커밋 순서로 전달된다. 같은 글의 앞선 이벤트가 대기 중이거나 전달 중이거나 실패해 아직 죽지 않았다면 뒤의 이벤트는 기다린다. 죽었거나 닫은 전달은 순서를 붙들지 않으므로, 죽은 것을 손으로 다시 보내면 뒤의 이벤트보다 늦게 도착할 수 있다. 글을 내보내는 구독자는 글의 현재 상태를 읽고 `version`을 비교한다. 다른 글의 이벤트는 서로 상관없다.
- **커밋된 글 읽기.** `event.read()`는 글의 현재 상태(본문 문서와 발행 문서가 든 `Entry`)를, 삭제됐다면 `null`을 돌려준다. `event.version`과 `event.contentHash`가 이 이벤트가 어떤 변경인지 알려 준다. `read().version`이 더 크면 그 글의 뒤 이벤트가 이어서 온다. 형식(format)으로 글을 내보내는 구독자(git-sync)는 글을 읽어 형식을 거치고, 이미 더 새 버전을 썼다면 이벤트를 건너뛴다.
- **미루기.** 아직 준비되지 않은 구독자(이벤트를 묶는 중이거나, 요청 제한이 언제 풀리는지 아는 경우)는 `{ retryAt: Date }`을 돌려주거나 `new DeferDelivery(retryAt)`을 던진다(`@monti-cms/core/server`, `@monti-cms/core/plugin/server`). 전달은 `pending`으로 돌아가 `retryAt`에 다시 도래한다. **실패가 아니다.** 로그를 남기지 않고, 이벤트 화면에 나오지 않고, 실패 배지에 들지 않고, 시도 횟수를 쓰지 않으며(`attempts`가 하나 되돌아가므로 몇 번을 미뤄도 그 시도 그대로다) dead letter가 될 수도 없다. 그 글의 뒤 이벤트 순서는 계속 잡고 있다. `cms.events.retry()`는 `deferred`가 몇 개인지 돌려주고, `retry({ all: true })`는 아직 때가 안 된 미뤄진 전달도 시도한다. git-sync가 묶음 창에 이것을 쓴다.

```ts
// git-sync/server.ts, 플러그인의 `server` 모듈(`definePlugin({ name: "git-sync", server: () => import("./server") })`)
import type { CmsServerPlugin } from "@monti-cms/core";

const plugin: CmsServerPlugin = {
	hooks: {
		// 최소 한 번 전달된다. 이미 처리한 이벤트는 `event.eventId`로 건너뛴다.
		afterCommit: async (event) => {
			if (await alreadyHandled(event.eventId)) return;
			const entry = await event.read(); // 커밋된 글, 삭제됐다면 null
			await pushToGit(event, entry);
			await markHandled(event.eventId);
		},
	},
};
export default plugin;
```

### 워커 없이 다시 시도하기

사이트가 서버리스 함수에서 돌 수 있으므로 백그라운드에서 도는 것은 없다. 다시 시도는 다음에서 시작한다.

- **같은 프로세스의 다음 쓰기.** 쓰기는 자기 이벤트를 보낸 뒤 때가 된 재시도를 최대 5건, 프로세스마다 10초에 한 번까지 함께 돌린다.
- **`cms.events.retry({ all?, limit? })`.** 때가 된 전달을 보낸다(`all`이면 아직 때가 안 된 실패도, 죽은 것은 손으로만). 커밋과 전달 사이에 프로세스가 멈춰 전달 행이 없는 이벤트도 보낸다. `{ delivered, failed, dead }`를 돌려준다. `cms.events.list()`·`counts()`·`retryDelivery({ eventId, subscriber })`·`dismiss({ eventId, subscriber })`는 관리자 화면이 쓴다.
- **`monti events:retry [--all] [--limit <n>]`.** `monti migrate`처럼 설정 파일을 불러와 `cms.events.retry()`를 부른다. 크론 작업이나 CI 일정에서 돌린다.
- **`POST /api/cms/v1/events/retry[?all=1&limit=100]`.** URL만 부를 수 있는 스케줄러(예: Vercel 크론)를 위한 길이다. 관리자 세션을 받고, 설정에 `events.retrySecret`이 있으면 `Authorization: Bearer <retrySecret>`도 받는다(환경 변수에 두고, `cms.server`에는 들어가지 않는다).

```ts
defineConfig({
	// ...
	events: { retrySecret: process.env.CMS_EVENTS_SECRET, maxAttempts: 8 },
});
```

끝난 이벤트는 `events.retentionDays`일(기본 30) 뒤에 같은 쓰기 쪽 정리에서 지워진다. 관리자의 **이벤트** 화면(`/admin/events`)은 실패한 전달과 죽은 전달을 마지막 오류와 함께 보여 주고 하나씩 다시 시도하거나 닫을 수 있게 하며, 사이드바가 그 수를 보여 준다.

## 스키마 파일

사이트 루트의 `monti.schema.json`은 사이트 설정 중 순수 데이터인 부분을 담는다. 컬렉션과 필드·레이아웃, 언어와 기본 언어, 시간대, 데이터로 쓸 수 있는 `site` 설정, `admin`(경로·언어·문자열 문구 바꾸기), 시드 템플릿(저장된 문서, 또는 글과 그 형식), `schemaVersion`, 데이터 변환(`migrations`, "스키마 바꾸기" 참고)이다.
번들러가 실행하는 코드가 아니라 저장소의 파일이라 도구가 읽고 쓸 수 있고, 여기서 타입을 만든다.

```json
{
	"$schema": "./node_modules/@monti-cms/core/schema.json",
	"collections": {
		"post": {
			"label": "Post",
			"kind": "document",
			"path": "/posts/:slug",
			"fields": {
				"title": { "kind": "text", "label": "Title", "required": true, "max": 200 },
				"slug": { "kind": "slug", "label": "Address", "from": "title", "required": true },
				"categoryId": { "kind": "relation", "label": "Category", "to": "category", "required": true },
				"stage": { "kind": "select", "label": "Stage", "options": { "idea": "Idea", "done": "Done" }, "defaultValue": "idea" }
			},
			"layout": [{ "fields": ["title", "slug"] }, { "group": "Classification", "fields": ["categoryId", "stage"] }]
		},
		"category": {
			"label": "Category",
			"kind": "item",
			"fields": {
				"title": { "kind": "text", "label": "Name", "required": true },
				"slug": { "kind": "slug", "label": "Address", "from": "title" }
			}
		}
	},
	"locales": [{ "code": "en", "name": "English" }, { "code": "fr", "name": "Français" }],
	"defaultLocale": "en",
	"timeZone": "Europe/Paris",
	"site": { "name": "My blog", "localePrefix": "always" },
	"admin": { "path": "/studio" }
}
```

**형식.** 각 부분은 같은 이름 빌더의 옵션 객체에 `kind`를 붙인 모양이다. 컬렉션은 `defineCollection`이 받는 값(`label`, `kind`, `body`, `fields`, `path`, `icon`, `layout`, `list`)이고, 필드는 `fields.<kind>`가 받는 값에 `"kind"`를 더한 것이다. 필드 종류는 `text`, `slug`, `relation`(`many`, `ordered`, `createInline`, `publishedOnly`, `allowUnpublished`),
`select`(`options`와 `defaultValue`), `media`(`accept: "image" | "file"`, 이미지 필드), `conditional`(`discriminant` 선택 필드와 선택값마다 보이는 `values`), `backlink`, `view`로, `fields.*`가 가진 종류를 모두 쓸 수 있다. 지금 `fields.*`에는 날짜·불리언·숫자 종류가 없어 파일에도 없다. 날짜는 텍스트 필드에 둔다.
`$schema`는 `@monti-cms/core/schema.json`을 가리킨다. 런타임 검사와 같은 정의에서 만든 JSON Schema라서 에디터가 키를 자동 완성하고 틀린 `kind`나 잘못 쓴 옵션을 입력하는 즉시 알려 준다(존재하는 컬렉션을 가리키는 관계처럼 컬렉션 사이의 규칙은 설정을 읽을 때 검사한다).
**없앤 옛 이름은 받지 않는다.** `workflow`와 `required: "publish"`는 오류다(`kind`와 `required: true`를 쓴다).

**읽기.** `monti.config.ts`가 읽어 들인 파일을 `defineConfig`에 넘긴다. `import`는 번들러가 빌드에 담아 주므로 운영에서는 읽기 전용이다(`"resolveJsonModule": true`가 필요하고 `create-next-app`이 켜 둔다). 경로 문자열(`schema: "./monti.schema.json"`)은 실행할 때 작업 폴더 기준으로 읽으며 Node에서만 된다(스크립트·테스트):

```ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	plugins: [mdx()],
	database: postgres(),
	auth: auth({ providers: [github()] }),
});
```

낮은 수준 `createCms({ config: defineSite({ … }), server })`는 `@monti-cms/core`의 `defineSite`로 만든 사이트 부분만 받는다(데이터베이스도 로그인도 없고, 테스트와 도구용이다. `@monti-cms/core`는 더 이상 `defineConfig`를 내보내지 않는다). `createCms`·`createSite`와 나머지는 사이트 설정을 다른 설정과 똑같이 받으므로, 제 파일을 가진 여러 사이트가 한 프로세스에 함께 있을 수 있다. 올바르지 않은 파일은 시작할 때 모든 문제를 JSON 경로와 함께 알리고 멈춘다:

```text
monti.schema.json is not a valid schema file:
  collections.post.fields.title.kind: a field needs a "kind" of text, slug, relation, select, media, conditional, backlink or view
  collections.post.workflow: is not part of the schema format
  locales[1].code: must look like "en", "pt-BR" or "zh-Hant"
```

**파일과 코드 설정을 합치는 법.** 코드는 파일에 더하고 환경마다 다른 값을 덮어쓸 수 있지만, 파일의 데이터를 조용히 바꾸지는 않는다.

| 부분 | 규칙 |
| --- | --- |
| `collections` | 파일의 컬렉션 뒤에 코드로 쓴 것(`defineCollection`)을 더한다. 같은 이름이 둘 다 있으면 오류 |
| `locales`, `defaultLocale`, `schemaVersion` | 파일에만 둔다. 코드에도 쓰면 오류(`schemaVersion`은 스키마 파일이 없는 설정에는 쓸 수 있다) |
| `site`, `admin` | 키마다 코드 값이 이긴다. `undefined`로 둔 키(비어 있는 환경 변수)는 파일 값을 그대로 둔다. `site.url`은 보통 코드에 둔다 |
| `timeZone` | 코드 값이 이긴다 |
| `seed.templates` | 파일의 템플릿 뒤에 코드의 템플릿 |
| `plugins`, `blocks`, `codeBlock`, `media` | 코드에만 있다 |

**코드에 남는 것.** 코드가 필요한 모든 것: 플러그인(문법 확장·형식·AI 동작 포함), 컴포넌트가 딸린 블록 정의, 훅과 서버 옵션(데이터베이스·저장소·로그인·비밀 값), `codeBlock`(줄 효과에 이름표와 함수가 있다), `media`, 함수인 옵션. `site.url`은 환경마다 달라서 코드에 남는다.

**필드를 더하는 플러그인.** `seoFields()` 같은 것은 평범한 필드 객체를 돌려주므로 그 필드는 이미 JSON으로 쓸 수 있다. 파일에는 보통 필드로 적히고(`monti schema:extract`가 해 준다), 플러그인(`seo()`)은 `plugins`에 남아 전처럼 역할로 필드를 확인한다.
형식에 따로 "플러그인 필드"는 없다. 코드로 쓴 컬렉션은 계속 `seoFields()`를 펼칠 수 있다. 파일의 이름표는 한 언어의 글이다(`monti schema:extract --locale`로 고른다).

### 타입: `monti schema:types`

`monti schema:types`는 파일을 읽어 그 옆에 `monti-env.d.ts`를 쓴다(`--schema <파일>`, `--out <파일>`). `@monti-cms/core`의 `MontiRegister` 인터페이스에 컬렉션·필드·언어를 등록하는 선언이다. 이것이 있으면 `defineConfig({ schema })`가 TypeScript 설정과 같은 타입을 돌려주고,
`createCms`·`cms.read`·`MetadataFor`·`CollectionName`·`DocumentComponentsFor<typeof config>`가 컬렉션 이름, 컬렉션별 메타데이터(선택 필드의 선택지, 여러 개 관계는 `readonly string[]`, 조건 필드의 하위 필드), 언어 코드를 안다. 사이트가 타입을 쓸 일은 없다. 이 파일은 타입만 담고(실행할 때 가져오지 않는다) 손으로 고치지 않으며 `next-env.d.ts`처럼 커밋한다.

- `monti schema:types --watch`는 계속 돌면서 스키마가 바뀌면 파일을 다시 쓴다(쓰다 만 파일은 알리고 마지막 정상 타입을 둔다).
- `withCms`(`@monti-cms/nextjs/config`)가 `next dev` 안에서 이 일을 해 주므로 따로 명령 없이 타입이 파일을 따라간다. 운영 빌드는 건드리지 않는다.
- `monti schema:types --check`는 아무것도 쓰지 않고 파일이 오래됐으면 1로 끝난다(CI용).
- 생성한 파일이 없으면 이름은 그냥 `string`이다. 앱에는 등록된 스키마가 하나이고, 같은 앱의 두 번째 스키마는 내용을 리터럴 타입으로 넘겨야 타입이 붙는다(`defineConfig({ schema: { ... } as const })`).

### TypeScript 설정 옮기기: `monti schema:extract`

`monti schema:extract`는 `monti.config.ts`(그것이 내보낸 `cms`)나 default export가 `defineSite(...)`인 옛 방식 `cms.config.ts`를 읽어(`--config <파일>`, 코드로 쓴 설정은 전과 같이 동작한다) 데이터 부분을 `monti.schema.json`(`--out <파일>`, 있는 파일을 바꾸려면 `--overwrite`, 플러그인이 주는 이름표의 언어는 `--locale <코드>`)과 `monti-env.d.ts`(`--no-types`로 건너뜀)에 쓰고, 코드에 남는 것을 알려 준다.
설정 파일은 고치지 않고, 거기에 넣을 얇은 설정을 보여 준다:

```text
Wrote monti.schema.json (5 collections, 2 locales, 3 seed templates).
Wrote monti-env.d.ts (the types of the schema; run `monti schema:types --watch` while you edit it).

Stays in code (monti.config.ts):
  - site.url: differs per environment, so it is read from `SITE_URL` by convention (no line in code)
  - plugins: mdx, callout, ..., seo, ai (code; the fields they add to collections are in the schema)
```

그다음 설정 파일의 컬렉션·언어·`defaultLocale`·`timeZone`·`seed`와 `site`·`admin`의 데이터 부분을 `schema`로 바꾸고 `plugins`와 나머지는 둔다(`monti.config.ts`로 합친다. "`cms.config.ts` + `cms.server.ts`에서 올리기" 참고). 결과를 다시 읽으면 같은 사이트가 된다(테스트가 기준 설정을 꺼냈다가 다시 읽어 견준다).

### 스키마 바꾸기: `monti schema:diff`와 `monti schema:apply`

스키마를 고치다 보면 필드나 선택지를 지우는 일은 흔하다. 데이터가 깨지지는 않는다(지운 필드나 선택지의 저장된 값은 "고아 값"으로 남는다. 발행할 때 경고하고, 공개 읽기는 숨긴다). 그리고 직접 말하지 않는 한 아무것도 지워지지 않는다. 명령 둘과 함수 몇 개가 변경을 **안전하고 설명 가능하게** 만든다. 저장하기 전에 변경이 어떤 글에 닿는지 보여 주고, 선언한 데이터 변환을 돌리고, 각 글이 어느 스키마로 쓰였는지 기록한다.

**적용된 스키마.** 데이터베이스는 마지막으로 적용한 스키마(`monti schema:apply`)를 기억한다. `schemaVersion`과 데이터 모델(컬렉션, 필드, 선택지, 언어, 허용 블록)을 `schema_state` 표에 JSON 스냅샷으로 둔다. 이 스냅샷이 모든 diff의 옛 쪽이다. 저장된 데이터가 마지막으로 맞춰진 기준이 바로 이것이기 때문이다(저장소의 브랜치나 태그는 이것과 다를 수 있다). 한 번도 적용하지 않은 저장소는 **기준선**에 있다. 첫 `schema:apply`는 스키마를 기록할 뿐 어떤 글도 바꾸지 않는다. 그래서 기존 블로그의 이전 경로는 `monti schema:extract` 다음에 변환 없이 `monti schema:apply`를 돌리는 것이고, 이는 아무것도 바꾸지 않는다.

**`schemaVersion`.** 스키마 파일의 1 이상 정수다(빼면 1이고, `monti schema:extract`가 써 준다). 모든 글 본문은 자기가 쓰이거나 변환된 버전을 기록한다(`entry_bodies.schema_version`). 이 버전은 **내용 해시에 들어가지 않는다**. `computeContentHash(metadata, doc)`는 상수로 정의되므로 지금까지 저장된 해시는 모두 그대로이고, 글의 내용을 건드리지 않는 스키마 변경은 글을 고친 것처럼 보이게 하지 않는다. 같은 내용을 더 새로운 버전으로 저장해도 아무것도 바뀌지 않고(글 버전도, 수정 시각도 그대로이며 저장된 버전도 그대로다), 고친 글은 사이트의 현재 버전으로 저장된다. `schema:apply`는 스키마가 바뀌었거나(또는 변환이 남았고) 파일의 번호가 옛것이면 파일의 번호를 올린다. 그 파일은 커밋한다. 이미 올린 번호가 적힌 파일(개발 기계에서 적용하고 배포한 경우)은 건드리지 않으므로, 운영에서 돌리면 같은 버전을 기록하고 파일에는 아무것도 쓰지 않는다.

**변환**은 스키마 파일의 `migrations`에, 그것이 속한 스키마 곁에 둔다. 각 변환은 `id`(영원한 이름이다. 한 번 돌면 `schema:<id>`로 `cms_migrations`에 기록되어 `storage.once`처럼 다시 돌지 않고, 적용된 변환은 기록으로 목록에 남는다), `op`, 그리고 변경**후** 스키마의 이름을 가진다.

```json
{
	"schemaVersion": 3,
	"collections": { "post": { "fields": { "excerpt": { "kind": "text", "label": "Excerpt" }, "stage": { "kind": "select", "label": "Stage", "options": { "idea": "Idea", "done": "Done" }, "defaultValue": "idea" } } } },
	"migrations": [
		{ "id": "2026-10-rename-summary", "op": "renameField", "collection": "post", "from": "summary", "to": "excerpt" },
		{ "id": "2026-10-merge-draft", "op": "mapOption", "collection": "post", "field": "stage", "from": "draft", "to": "idea" },
		{ "id": "2026-10-drop-legacy", "op": "dropField", "collection": "post", "field": "legacy", "note": "더 이상 어디에서도 쓰지 않는다" },
		{ "id": "2026-10-author-default", "op": "setDefault", "collection": "post", "field": "author", "value": "Staff" }
	]
}
```

| `op` | 하는 일 |
| --- | --- |
| `renameField` | `from`의 값을 `to`로 옮긴다. 아무것도 덮어쓰지 않는다. 이미 `to`에 값이 있는 글은 둘 다 남기고, 적용 결과가 그것을 알린다. `to`는 스키마의 필드이거나(연쇄 이름 바꾸기라면 뒤의 이름 바꾸기의 `from`), `from`은 스키마의 필드가 아니어야 한다 |
| `mapOption` | 더 이상 선택지가 아닌 저장된 선택 값을 필드의 다른 선택지로 바꾼다. 값 목록 안에서도 바꾼다(중복은 없앤다) |
| `dropField` | 스키마에 더는 없는 필드의 저장된 값을 **지운다**. 데이터를 지우는 유일한 변환이고, 스키마에 그 필드가 아직 있으면 오류다 |
| `setDefault` | 텍스트나 선택 필드에 값이 없는 글에 `value`를 넣는다(필수가 된 필드 같은 경우). 조건부 분기 안의 필드는 그 분기가 보이는 글에만 채우고, 번역은 언어별 필드에만 채운다 |

필드를 조건부 분기 안으로 또는 밖으로 옮기는 데에는 변환이 필요 없다. 저장된 값은 필드가 어디 있든 그대로 보존된다(조건부 값은 평평하게 저장된다). 그래서 데이터는 움직이지 않는다. diff가 이를 알리고(`field_moved`), 점검은 새 분기가 값을 보여 주지 않는 글을 센다. **컬렉션** 이름 바꾸기는 변환이 아니다. 컬렉션 이름은 저장된 값(`entries.collection`, 폴더, 주소)이라서 이름을 바꾼 컬렉션은 지운 것과 새로 더한 것의 쌍이다. diff는 닮은 쌍을 짚어 주지만(`renameHints`) 아무것도 적용하지 않는다.

**아무것도 조용히 지워지지 않는다.** `dropField` 없이 지운 것은 전처럼 고아 값을 그대로 둔다. 스키마와 맞지 않는 변환(스키마에 아직 있는 필드의 삭제, 선택지가 아닌 값으로의 매핑, 필드에 맞지 않는 기본값)은 문제로 보고되고 적용은 시작하지 않는다. 글 하나라도 다시 쓸 수 없으면 아무것도 바뀌지 않는다.

**변환이 쓰는 방식.** 모든 변환은 쓰기 규칙(`prepareSnapshot`, 쓰기 훅은 제외)을 거친다. 바뀐 메타데이터를 검사하고, 내용 해시, 검색용 글자, 메타데이터 참조(이름이 바뀌거나 지워진 관계·미디어 필드는 참조를 옮기거나 지우므로 삭제 검사가 계속 맞다)를 거기서 다시 계산한다. 작업본과 발행본은 한 트랜잭션에서 같은 방식으로 다시 쓰고, 글과 본문의 `version`과 `updated_at`은 전의 데이터 이전처럼 그대로 둔다. 발행하지 않은 변경이 있던 글은 그대로 있고, 없던 글은 그대로 없다. 변환된 본문에는 새 버전이 찍힌다. 실행은 이전이 쓰는 잠금을 잡으므로 둘이 동시에 적용해도 각 변환은 한 번만 돈다.

**명령.**

- `monti schema:diff [--schema <파일>] [--check]`(읽기 전용)는 앱의 스키마를 적용된 스키마와 견주어, 모든 변경을 닿는 글과 그 결과와 함께 보여 준다. 고아 값으로 남음, 변환이 다시 씀, `dropField`가 지움, 채우기 전에는 발행할 수 없음 등이다. `--check`를 주면 적용할 것이 있을 때 1로 끝난다.
- `monti schema:apply [--schema <파일>] [--dry-run]`은 저장소를 이전하고(`monti migrate`), 아직 돌지 않은 변환을 돌리고, 스키마와 버전을 기록하고, 필요하면 파일의 `schemaVersion`을 올린다. 여러 번 돌려도 같다. `--dry-run`은 되돌리는 트랜잭션 안에서 모든 것을 돌리고 파일을 포함해 아무것도 쓰지 않는다.

```text
$ monti schema:diff
Applied schema version: 2. After the apply: 3.
Changes (3):
  - post.summary renamed to excerpt [transform 2026-10-rename-summary]: 12 entries ("Hello", "Notes", ...); rewritten by its transform
  - post.stage option "draft" removed [transform 2026-10-merge-draft]: 4 entries ("WIP", ...); rewritten by its transform
  - post.legacy removed (text): 2 entries ("Old post", ...); values kept as orphans (hidden from the public read; publishing warns)
Transforms to run (2): 2026-10-rename-summary, 2026-10-merge-draft
```

**API(설정 화면이 부르는 것).** `@monti-cms/core/schema-change`는 인스턴스의 저장소와 사이트 위에서 도는 평범한 함수를 내보낸다.

| 함수 | 주는 것 |
| --- | --- |
| `diffSchema(old, new, { transforms })` | `{ changes, renameHints }`. 변경은 `collection_added`, `collection_removed`, `collection_kind_changed`, `body_changed`, `allowed_changed`, `field_added`, `field_removed`, `field_renamed`, `field_type_changed`, `field_required_changed`, `field_locale_changed`, `field_moved`, `option_added`, `option_removed`, `option_renamed`, `locale_added`, `locale_removed`, `default_locale_changed` 중 하나다. `renameField`나 `mapOption` 변환은 제거와 추가의 쌍을 이름 바꾸기로 바꾸고, 변환이 맡는 변경에는 `handledBy`가 붙는다. `changeKey(change)`는 목록용 안정된 키, `describeSchemaChange(change)`는 영어 한 문장이다. 순수 함수 |
| `checkSchemaChange(store, diff, { site, transforms, sampleSize })` | 변경마다 `entries`(글은 한 번만 센다), id와 제목의 `sample`, `consequence`, 그리고 `checked` 여부. 저장된 본문을 한 번 읽고 아무것도 쓰지 않는다. 허용 블록 변경과 분기 안의 필수 필드를 점검하려면 새 스키마의 `site`가 필요하다 |
| `suggestTransforms(change, { options, renameTo })` | 변경에 맞는 변환(삭제, 이름 바꾸기, 남은 선택지마다의 매핑, 기본값). id는 없고, 화면이 제안하는 데 쓴다 |
| `planSchemaChange({ site, store, migrations })` | 적용된 스키마와의 diff, 남은 변환, `problems`, `nextVersion`, 파일의 번호를 올려야 하는지(`needsVersionBump`). 읽기 전용 |
| `applySchemaChange({ site, store, migrations, dryRun })` | 계획을 실행한다. 돈 것, 변환마다 바뀐 글과 본문 수, 이름 바꾸기의 `conflicts`를 돌려준다. 실패하면 `SchemaChangeError`를 던지고 아무것도 바꾸지 않는다 |
| `applyTransforms`, `checkTransforms` | 순수한 조각. 글 하나의 메타데이터를 변환에 통과시키는 것, 변환을 스키마에 견주어 확인하는 것 |

저장소 쪽은 `SchemaChangeStore` 포트(`readSchemaState`, `appliedSchemaTransforms`, `scanBodies`, `applySchemaChange`)이고 `ContentStore`의 일부다.

### 관리자에서 스키마 편집하기 (개발 서버 전용)

관리자에는 `monti.schema.json`을 편집하는 **스키마** 화면(`<관리자 경로>/schema`, 사이드바 "관리" 아래)이 있다. 위의 API 위에 얇게 얹은 화면이다. diff, 영향 점검, 변환은 같고, 파일을 대신 써 준다.

**누가 쓸 수 있나.** 개발 모드로 도는 서버(`NODE_ENV=development`, `next dev`가 설정한다)이면서 스키마 파일이 있고 쓸 수 있을 때만이다. 판단은 화면이 아니라 서버가 한다(`@monti-cms/core/schema-edit`의 `schemaEditAccess(cms)`). 운영에서는 `PUT /api/cms/v1/schema`와 `POST /api/cms/v1/schema/preview`가 **403 `schema_read_only`**(`reason`은 `production`, `no_schema_file`, `not_writable`)로 답하고, 화면은 짧은 설명과 함께 스키마를 읽기 전용으로 보여 준다. `GET /api/cms/v1/schema`는 어디서나 된다(운영 서버는 파일을 읽기만 한다). 모든 경로는 관리자 API의 다른 경로처럼 관리자가 필요하고, 쓰는 경로는 같은 출처도 확인한다.

**경로** (`/api/cms/v1/schema`, `cms.handle()`이 처리한다):

| 경로 | 하는 일 |
| --- | --- |
| `GET` | 파일의 내용과 `hash`, 쓸 수 있는지(`access`), 파일이 맞지 않을 때의 `issues`(JSON 경로 포함), 적용된 버전, 설정이 코드로 더한 컬렉션, 본문 목록에 쓸 수 있는 블록과 서식 이름 |
| `POST /preview` | 본문 `{ schema, transforms?, renames? }`. 편집을 점검하고 아무것도 쓰지 않는다. `valid`와 `issues`(JSON 경로와 메시지), 변경마다의 `impacts`(영향받는 글 수, id와 제목 표본, 결과), `decisions`(저장된 값을 여러 방법으로 다룰 수 있는 변경과 `suggestTransforms`의 선택지, 적용 중인 선택), 기록될 `transforms`와 그 `problems`, `nextVersion` |
| `PUT` | 본문 `{ schema, transforms?, renames?, baseHash }`. 편집을 저장한다(아래). `baseHash` 뒤로 파일이 바뀌었으면 `409 schema_conflict`, `issues`와 함께 `400 invalid_schema`, `422 invalid_transforms`, `500 schema_apply_failed`(파일은 썼고 데이터베이스는 바뀌지 않았다) |

`transforms`는 작성자의 선택이고 id가 없다(서버가 `v<버전>-<op>-<컬렉션>-<필드>`로 이름 붙인다). 빼면 서버가 결정마다 고른다. 화면이 `renames`로 알려 준 이름 바꾸기(작성자가 이름을 바꾼 필드나 선택지)는 이름 바꾸기, 매핑이나 삭제는 그 값을 가진 **저장된 글이 없을 때만**(값을 지우게 되는 삭제는 작성자 대신 고르지 않는다), 기본값은 값이 있을 때만이다. 선택이 없으면 값은 전처럼 고아로 남는다.

**저장이 하는 일, 순서대로** (처음 실패에서 멈춘다):

1. 편집한 내용에 파일 형식과 `defineConfig`의 규칙을, 변환에는 그 스키마와의 맞음을 확인한다. 편집을 시작한 뒤 디스크의 파일이 바뀌었으면 저장을 거절한다.
2. 변환을 개발 데이터베이스에서 시험 실행한다. 다시 쓸 수 없는 글이 있으면 파일을 건드리기 전에 저장이 멈춘다.
3. 고른 변환을 `migrations`에 붙이고 `schemaVersion`을 올려 `monti.schema.json`을 쓴다. 바뀌지 않은 곳은 옛 텍스트를 그대로 두고(손으로 맞춘 배열, 띄어쓰기, 키 순서, 마지막 줄바꿈) 새 부분은 파일 자신의 들여쓰기로 쓰므로, 변경은 작은 diff가 된다(`formatSchemaText`).
4. 생성된 타입(`monti-env.d.ts`)을 `monti schema:types`처럼 쓴다.
5. 개발 데이터베이스에 `applySchemaChange`를 돌린다(표가 없으면 먼저 만든다). 스키마를 적용된 것으로 기록하는 것도 이때다.
6. 돌고 있는 인스턴스를 다시 읽는다(`cms.reloadSchema()`). 그다음 화면이 관리자 페이지를 다시 불러온다.

**돌고 있는 인스턴스가 스키마를 받는 방법.** `defineConfig({ schema })`로 만든 인스턴스는 다른 스키마로 설정을 다시 만드는 방법과 스키마 파일의 경로를 기억한다(`cms.schemaFile()`. 작업 폴더의 `monti.schema.json` 또는 `src/monti.schema.json`을 찾거나, `createCms`에 `schemaFile`로 준다). 개발 모드에서는 설정 화면이 저장했을 때, 그리고 파일이 디스크에서 바뀐 것을 스스로 알아챘을 때(손으로 고쳤거나 다른 프로세스가 저장한 경우. 250ms에 한 번 넘게 보지 않는다) 사이트, 저장소, 서비스, 읽기 API, 핸들러를 **그 자리에서** 바꾼다(같은 `cms` 객체이고 데이터베이스 연결은 공유한다). 읽거나 확인하지 못하는 파일은 한 번 알리고, 인스턴스는 마지막으로 좋았던 스키마를 쓴다. 그래서 `next dev`를 다시 켜지 않아도 관리자가 저장한 변경을 보여 준다. 타입은 `withCms`의 감시자와 저장 자체가 맞춰 준다. 운영에서 `cms.reloadSchema()`는 아무것도 하지 않는다. 운영 서버는 빌드할 때의 스키마로 돈다. `cms.forSchema(schema)`는 어떤 스키마에 대한 다른 인스턴스를 설치하지 않고 만든다. 설정 화면이 편집을 점검하는 데 쓴다.

화면은 컬렉션(이름표, 아이콘, 종류, 공개 주소, 본문과 허용 블록·서식·제목 단계), 모든 종류의 필드와 그 옵션(추가, 삭제, 이름 바꾸기, 순서 바꾸기, 필수와 언어, 선택지, 조건부 분기), 배치 묶음, 목록 열, 언어와 시간대를 편집한다. 일반 데이터지만 거의 바뀌지 않는 것(`site`, `admin`, `seed`, 기록된 `migrations`)은 편집하지 않고 보여 주기만 하며, 파일에서 고친다. 코드(`monti.config.ts`)에 적은 컬렉션은 파일에 없으므로 화면이 편집할 수 없다고 알려 준다.

## 설정

`codeBlock`과 `media`를 뺀 이 표의 항목은 스키마 파일에 대신 적을 수 있고("스키마 파일"), `plugins`와 `blocks`는 언제나 코드다. 아래 규칙은 어느 쪽이든 같다.

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
| `seed.templates` | 첫 마이그레이션이 저장소를 만들 때 한 번 넣는 본문 템플릿. `{ id, name, doc }`(저장된 문서) 또는 `{ id, name, body, format }`(글과 그것을 읽는 형식, "형식" 절). |
| `codeBlock.lineEffects` | 코드 블록 줄 효과 더하기·바꾸기("코드 블록 줄 효과"). |
| `codeBlock.omitLineEffects` / `features` / `themes` / `languages` | 편집기의 줄 효과·도구 감추기, 강조 테마, 언어 더하기("코드 블록 도구 끄기·테마·언어"). |
| `media` | 올릴 수 있는 미디어. `maxImageBytes`(기본 10MB)·`maxPixels`(기본 4천만)·`maxFileBytes`(기본 50MB)와 받을 형식 `imageTypes`(jpeg·png·webp·gif·avif 가운데)·`fileTypes`(pdf·zip·txt·md·csv·json 가운데, 빈 목록이면 첨부 파일을 받지 않음). 업로드 API·관리자 파일 고르기 창·`/v1/meta`가 따른다. |
| `admin.locale` | 관리자 화면 언어와 날짜·숫자 표기(BCP 47, 예: `en`·`ko-KR`). 없으면 사이트 기본 언어(`defaultLocale`). 시각은 `timeZone`으로 보인다. |
| `admin.messages` | 화면 문구 덮어쓰기: 이름공간 → 키 → 문구. 본체 블록 이름표는 `"cms.blocks"`(`image.label`처럼 `<블록>.label`), 코드 블록 효과는 `"cms.code-block"`, 검사 오류 문구는 `"cms.core"`·`"cms.translation"`이다(MDX를 읽을 때의 문구는 `@monti-cms/mdx`의 `"cms.mdx"`). |
| `admin.templates` | `false`면 관리자에서 본문 템플릿을 감춘다: 편집기의 템플릿 메뉴, 사이드바 링크, 템플릿 화면(404). 기본 `true`. 저장된 템플릿은 그대로 남는다. |
| `admin.translations` | `false`면 관리자에서 번역 UI를 감춘다: 편집기의 언어 탭, 목록의 언어 열·필터, 항목 패널의 언어 탭. 기본 `true`. 언어가 하나인 사이트는 이 값과 상관없이 보이지 않는다. |

### 컬렉션

- **종류(`kind`).** `document`(문서)는 본문을 쓰고 초안과 공개본을 나눠 명시적으로 발행한다. `item`(항목)은 작은 폼에서 저장하면
  곧바로 공개 값에 반영한다(발행·보관·번역본이 없고, 언어별 값은 `translations`에 둔다). 본문(`body`)은 없으면 문서만 쓴다. `body`를 객체로 쓰면 본문이 허용하는 블록·마크·제목 단계를 제한한다("본문별 허용 블록·마크").
  예전 이름 `workflow: "publish" | "record"`는 없앴다. 아직 쓰는 설정은 써야 할 `kind`를 알려 주며 실패한다(`publish` → `document`, `record` → `item`).
- **배치(`layout`).** 없으면 필드 선언 순서대로 한 묶음이고, 제 `tab`을 가진 필드는 그 탭에 모인다.
- **목록(`list.columns`).** 없으면 기본 컬럼이다. 문서는 제목·상태·언어(언어가 둘 이상일 때)·분류 필드(항목 컬렉션을 가리키는
  관계)·수정일·발행일, 항목은 제목·주소(주소 필드가 있을 때)·언어·상태·수정일.

컬렉션의 `path`(예: `/posts/:slug`)는 공개 주소 모양이다. 주소로 쓴 내부 링크를 알아보고(항목의 id로 저장된다. 공개 읽기 API 참고) 편집기가 링크를 만들 때 쓴다. `path`가 없는 컬렉션은 본문 링크로 가리킬 수 없다.

### 필드 규칙

- **제목 필드는 역할로 정하고, 이름과 이름표는 자유.** 모든 컬렉션은 제목 텍스트 필드를 정확히 하나 가진다. `role: "title"`을 가진 필드, 없으면 이름이 `title`인 텍스트 필드다(그래서 기존 스키마는 그대로 동작한다).
  조건부 필드 안에는 둘 수 없고, 다른 필드가 역할을 가지면 다른 필드 이름을 `title`로 둘 수 없다. 제목은 `titleFieldOf(schema)`(`site.titleField(collection)`, `site.titleOfValues(collection, metadata)`)로 읽고 키로 직접 읽지 않는다.
  목록·검색·관계 고르기·본문 링크·복제·SEO 대체값·동기화 이름표·편집 화면 제목 칸이 이 필드를 쓴다. 스키마 설정에서 이름을 바꿔도 제목으로 남는다(바뀐 필드에 `role: "title"`이 붙는다). 이름표(`label`)는 사이트가 정한다(예: `Headline`·
  `이름`). 제목 글자 수 한도는 따로 없고 이 필드의 `max`를 따른다(없으면 한도 없음).
- **주소 필드는 하나.** 주소(`fields.slug`)는 본체 개념이라 콘텐츠마다 하나다. 한 컬렉션에 주소 필드를 둘 이상 두면 설정 오류다.
- **주소는 `from`에서 만든다.** `fields.slug({ from: "title" })`이면 주소를 직접 고치기 전까지 그 필드 값으로 주소를 만들고,
  항목 컬렉션은 주소를 비우고 저장하면 그 값에서 만든다. `from`이 없으면 자동으로 만들지 않는다. `from`은 같은 컬렉션의
  텍스트 필드여야 한다.
- **필드 역할(`role`).** 확장과 화면은 값을 필드 이름이 아니라 역할로 찾는다(`roleField(collection, role)`, 설정을 읽지 않는
  `fieldWithRole(schema, role)`). 역할 이름은 자유(영문자·숫자·하이픈)이고 한 컬렉션에 역할마다 한 필드만 둔다. 본체가 아는
  역할은 `title`(텍스트 필드, 제목, 위 참고)과 `summary`(텍스트 필드, 요약)다. 요약은 필드 옆 동작(AI 등)에 `summary`로 넘어간다. 다른 역할은 그 역할을 쓰는 확장이
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
  본문 앞부분의 일반 글자로 채운다(본문이 있는 컬렉션만, 필드 `max`를 넘지 않는다). 본체 함수는 `bodyExcerpt(doc, maxLength)`다. 글자는 저장된 문서에서 뽑으므로 본문이 어떤 표기로 쓰였든 상관없다. 문단·제목·목록 항목·표 칸·블록 본문과 블록의 글자 속성(콜아웃 제목)이 대상이고, 코드·수식·이미지는 뺀다. 본문 검색용 글자도 같은 방식으로 만들며, 코드와 이미지 대체글·캡션은 남긴다.
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

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나, 기본 언어가 목록에 없거나, 제목 필드가 없거나, 주소 필드가 둘 이상이거나,
역할이 겹치거나 `summary`나 `title`이 텍스트 필드가 아니거나, 탭 이름이 1~20자가 아니거나, `from`·`fillFromBody`가 필드와 맞지 않거나,
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

패키지 자체 테스트는 예시 사이트 `testSite`(`test/site.ts`, 예시 사이트 설정 `test/cms.config.ts`로 만든다)를 상대로 돈다. 인스턴스가 필요한 테스트는 `fakeCms`(또는 가짜 어댑터 위의 `createCms`)로 만들고, 자기 설정이 필요한 테스트는 그 설정으로 사이트나 인스턴스를 만든다. 그것 때문에 모듈을 모킹하는 테스트는 없다.

**다른 사이트 설정으로도 돈다(재발 방지).** `test/other-site.config.ts`는 블로그와 일부러 다른 설정이다(컬렉션 article·topic·author,
`title`·`slug` 말고는 다른 필드 이름, 영어만, 차트 + 사이트 블록, 글자 꾸밈 없음). 본체·관리자·AI 패키지마다 `vitest.othersite.config.ts`가 같은
테스트를 이 설정으로 다시 돌린다(`MONTI_TEST_SITE=other-site`를 주고 `test/site.ts`가 읽는다. 묶음 이름 `core (other-site)`·`admin (other-site)`·`ai (other-site)`, 저장소 루트
`pnpm test:run`이 함께 돈다. 패키지에서는 `pnpm test:other-site`). 새 테스트는 저절로 두 설정으로 돈다. 컬렉션·필드 이름은
테스트에 적지 말고 설정에서 찾는다(`test/any-site.ts`: 컬렉션·관계 필드·두 번째 언어, 발행 필수값을 채우는 `fillRequiredMetadata`).
설정에 없는 기능(두 번째 언어, 묶음 블록 등)이 필요한 경우는 `skipIf`로 감싼다. 본체 패키지에서 블로그 예시 데이터를 그대로 확인하는
부분은 `*.blog.test.ts`에 두고 다른 사이트 실행·타입 검사에서 뺀다. 관리자·AI 패키지는 각 `vitest.othersite.config.ts`의
`BLOG_FIXTURE_TESTS`에 적어 뺀다.

**자동 검사(CI).** push·PR마다 `.github/workflows/ci.yml`이 lint(검사만)·타입 검사·패키지 빌드, 테스트(Postgres 17 서비스),
예시 앱 묶음 검사(`pnpm example:check`)를 돈다. `pnpm example:check`는 패키지를 빌드해 묶고, 예시 앱을 저장소 밖 임시 폴더에
그 묶음으로 설치해 `tsc`(`skipLibCheck: false`)와 `next build`를 예시 설정·확장을 모두 넣은 설정으로 한 번씩 돈다.
