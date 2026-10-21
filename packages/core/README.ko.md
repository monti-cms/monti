# @monti-cms/core

[English](README.md) | 한국어

DB(Postgres) 기반 블로그 CMS의 본체. 사이트 설정, 컬렉션 스키마, 콘텐츠 저장·발행, 문서 모델, 관리자 API, 플러그인 연결을 맡는다.
관리자 화면은 `@monti-cms/admin`, Next.js에 묶인 것은 모두 `@monti-cms/nextjs`, MDX(`mdx` 형식·원문 패널·문법 확장)는 플러그인 `@monti-cms/mdx`, AI 기능은 플러그인 `@monti-cms/ai`다. 다 붙인 예는 `examples/blog`다.

## 빠른 시작 (기존 Next 앱)

React 19 위의 Next.js 16(App Router) 앱이 필요하다. `@monti-cms/core`를 먼저 설치한 다음 패키지 매니저로 `monti init`을 돌린다. 설치 전에 `npx monti`를 돌리면 이름이 `monti`인 전혀 다른 npm 패키지를 받으니, 언제나 설치를 먼저 한다.

전체 흐름:

```text
설치 → monti init → monti db:setup → monti doctor → pnpm dev
```

1~2단계: `@monti-cms/core`를 **설치**한 다음 **init**을 돌린다(Monti가 새로 만드는 파일을 쓰고, 묻고 나서 나머지 패키지를 설치하고, 남은 일을 적어 준다. `next.config`, 루트 레이아웃, `.gitignore`는 필요한 만큼만 고치고 어떤 파일을 어떻게 고쳤는지 적어 준다. 데이터베이스는 건드리지 않는다). 쓰는 패키지 매니저의 블록을 그대로 복사한다.

```sh
# 1. @monti-cms/core를 GitHub 주소로 추가한다(공개 릴리스 전에는 pnpm만 된다)
pnpm add "@monti-cms/core@github:monti-cms/monti#release/v0.2.0-next.16&path:/core"
# 2. init을 돌린다. 나머지 Monti 패키지는 같은 릴리스에서 설치된다
pnpm exec monti init
```

pnpm 12라면 1단계 전에 `pnpm-workspace.yaml`에 이렇게 적는다(core가 쓰는 `tsx`가 esbuild를 가져오고, pnpm 12는 그 설치 스크립트를 허락할 때까지 설치를 멈춘다. Monti는 그 파일을 고치지 않는다).

```yaml
allowBuilds:
  esbuild: true
```

3. **init이 적어 준 일을 한다.** init이 `next.config`(`withCms`), `<html>`(`suppressHydrationWarning`), `.gitignore`(`.env.local`, `.monti/`)를 직접 고치고 "Changed:"에 적어 준다(안전하게 고칠 수 없던 파일은 이유와 함께 번호 목록에 있다). 남은 일은 `cp .env.example .env.local`(채워 넣는다. `.env.example`에 각 값이 무엇이고 어디서 얻는지 적혀 있고, `MONTI_SECRET`은 `openssl rand -base64 32`로 만든다)이다.
4. **표 만들기와 설정 점검.** `pnpm exec monti db:setup`을 돌린 다음(처음 한 번. Monti를 올린 뒤에는 `monti db:migrate`) `pnpm exec monti doctor`를 돌린다. 모든 검사를 `ok`, `warn`, `FAIL`로 보여 주고, 경고마다 무엇이 잘못됐는지, 어디인지, 어떻게 고치는지를 알려 준다(위 init 단계 중 빠진 것이 있으면 그것도 알려 준다). Monti가 스스로 정한 값과 그 출처도 함께 보여 준다.
5. **앱 실행.** `pnpm dev`로 띄우고 `http://localhost:3000/studio`를 연다(`monti init`은 관리자를 `/studio`에 쓴다. `--admin-path`로 바꾼다).

`monti --help`는 모든 명령을 보여 주고, `monti <명령> --help`(예: `monti init --help`)는 그 명령의 도움말만 보여 준다. 아래는 모두 참조 내용이다.

## 참조

아래는 전체 문서다. `monti init`이 단계별로 하는 일, 모든 옵션, 각 부분이 맞물리는 방식을 다룬다.

## 지원하는 프레임워크

지금은 Next.js(App Router)만 지원한다. 코드는 이것이 코어나 관리자가 아니라 패키지 하나의 성질이 되도록 나뉘어 있다.

- `@monti-cms/core`는 표준 `Request`·`Response`로 말하고(`cms.handle(request)`) Next.js에서 아무것도 가져오지 않는다. 호스트가 대 줘야 하는 것(지금 요청의 헤더, 로그인 뒤 리다이렉트)은 로그인 연결(`CmsAuth.requestHeaders`·`CmsAuth.rethrow`)로 들어온다.
- `@monti-cms/admin`(화면과 훅)도 Next.js에서 아무것도 가져오지 않는다. 라우터는 받은 어댑터 `{ Link, navigate, replace, usePathname, useSearchParams }`로만 닿고(`@monti-cms/admin/router`의 `AdminRouterProvider`), 서버 화면이 필요로 하는 리다이렉트와 404는 `AdminServer`(`@monti-cms/admin/host`)로 받는다.
- `@monti-cms/nextjs`가 Next에 묶인 것을 모두 갖는다. 라우트 핸들러, `next.config.ts`용 `withCms`, App Router 어댑터를 얹은 관리자 페이지·레이아웃, 호스트 연결(Next 요청 헤더를 인스턴스에 붙여 주므로 `monti.config.ts`에는 `host` 옵션이 필요 없다)이다.
- `@monti-cms/auth`가 관리자 로그인이고, 이것도 프레임워크에 묶이지 않는다. Auth.js core 위에서 `CmsAuth`를 `Request`·`Response`로 구현하며, 로그인 방법은 갈아 끼우는 프로바이더다(GitHub가 들어 있다).

다른 호스트(Astro, Remix 등)는 코어나 관리자를 고치지 않고 어댑터 패키지를 새로 만들어 붙인다. 테스트가 경계를 지킨다. 코어와 관리자의 소스 파일은 `next/*`를 가져올 수 없다.

## Monti가 스스로 정하는 것과 끄는 법

자동은 괜찮지만 조용히 하는 것은 안 된다. `monti doctor`가 `config/automatic`에서 Monti가 스스로 정한 것과 각 값의 출처(`set in monti.config.ts`, `from env NAME`, `auto-detected (이유)`)를 보여 준다. 줄은 `주제: 값 [출처]` 꼴이다.

```text
  Database: localhost:5432/monti [from env DATABASE_URL]
  Login: GitHub [client id from env AUTH_GITHUB_ID, admins from env MONTI_ADMIN_GITHUB_ID]
  Dev login bypass: on (requests from this machine are the admin) [auto-detected (NODE_ENV is "development" and no hosting platform variable is set)]
  SITE_URL: http://localhost:3000 [from env SITE_URL]
  Schema file: monti.schema.ts [auto-detected (monti.schema.ts in the app folder)]
```

| 자동으로 하는 일 | 끄거나 바꾸는 법 |
| --- | --- |
| 데이터베이스 URL과 스키마를 `DATABASE_URL`, `DATABASE_SCHEMA`에서 읽는다 | `monti.config.ts`에서 `postgres({ connectionString, schema })`를 준다 |
| GitHub 로그인 설정을 `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `MONTI_ADMIN_GITHUB_ID`에서 읽는다 | `github({ clientId, clientSecret, admins })`를 준다 |
| 개발 로그인 우회는 `next dev`에서 켜지고, 내 컴퓨터에서 온 요청에만 적용된다 | `auth({ devBypass: false })` |
| 호스트 신뢰는 알려진 호스팅 플랫폼과 개발에서 켜지고, 그 밖의 프로덕션에서는 꺼진다 | `defineConfig`의 `trustHost: true 또는 false`, 또는 `AUTH_TRUST_HOST=true 또는 false` |
| 설정과 스키마 파일 어디에도 `site.url`이 없으면 `SITE_URL`이 채운다 | `monti.config.ts`의 `site.url` 또는 스키마 파일의 `site.url`을 적는다 |
| 스키마 파일을 이름(`monti.schema.ts`, `src/` 아래도)으로 찾고, 개발에서는 파일이 바뀌면 개발 서버가 `monti.config.ts`를 다시 평가한다 | 핫 리로드는 개발에서만 되고 끄는 스위치는 없다(프로덕션 서버는 시작한 스키마로 돈다) |
| `withCms`는 `transpilePackages`, `env.NEXT_PUBLIC_CMS_BASE_PATH`를 더하고, 개발에서는 타입 감시와 클라이언트 코드가 `monti.config.ts`를 import할 때의 경고도 더한다 | `next.config.ts`에서 `withCms`를 빼고 `transpilePackages: ["@monti-cms/core"]`를 직접 적는다 |
| `monti schema:apply`는 먼저 `monti db:migrate`를 돌린다(그 출력이 맨 앞에 나온다) | `monti schema:apply --dry-run`은 아무것도 마이그레이션하지 않는다 |

## 빈 Next 앱에 설치

Next 16(App Router)·React 19 앱 기준이다. 관리자에는 Tailwind가 필요 없다. 스타일이 미리 만들어져 있어서 앱은 어떤 CSS 구성이든 쓸 수 있다. 저장소는 Postgres만 지원한다. 가장 쉬운 길은 위의 빠른 시작(아래 2단계가 `monti init`)이다. 1·2단계를 대신 해 주고(설치는 확인을 받은 뒤에) 나머지는 적어 준다. 이 절의 나머지는 `monti init`이 하는 일이고, 읽어 보거나 손으로 할 때 쓴다. 순서는 `monti init` → 컬렉션 고치기 → `monti db:migrate`다.

### 1. 패키지

```sh
pnpm add "@monti-cms/core@github:monti-cms/monti#release/v0.2.0-next.16&path:/core" "@monti-cms/admin@github:monti-cms/monti#release/v0.2.0-next.16&path:/admin" "@monti-cms/nextjs@github:monti-cms/monti#release/v0.2.0-next.16&path:/nextjs" \
  next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react lucide-react
```

공개 릴리스 전에는 Monti 패키지를 GitHub 릴리스 번들에서 받으므로, 패키지마다 GitHub 주소로 추가한다(ref는 같고 `path:/<폴더>`만 다르다). `monti init`이 대신 해 준다.

관리자 패키지와 AI 플러그인은 React Query·sonner·Tiptap·lucide 아이콘을 앱과 같은 하나로 써야 해서 앱이 설치한다(peer).
`monti init`은 고른 로그인에 맞춰 `@monti-cms/auth`(Auth.js core, Next.js 없음)를 설치한다. 프로바이더는 그 README를 본다.
명령줄 `monti`는 `@monti-cms/core`에 들어 있다(TypeScript 설정 파일은 함께 설치되는 tsx가 읽는다).

pnpm 12는 허락하지 않은 설치 스크립트가 있으면 설치를 실패로 끝낸다(10은 경고만 한다). tsx가 쓰는 esbuild의 설치 스크립트를 허락한다. `pnpm-workspace.yaml`에 `allowBuilds:`와 `esbuild: true`를 적는다.

### 2. `monti init`

`@monti-cms/core`를 설치한 뒤 앱 폴더(`package.json`이 있는 곳)에서 `pnpm exec monti init`으로 돌린다(다른 패키지 매니저는 빠른 시작을 본다. 설치 전에 `npx monti`를 돌리면 다른 패키지를 받는다). 기존 Next.js(App Router) 앱에 Monti를 더한다. 앱을 읽고, 몇 가지를 묻고, Monti가 새로 만드는 파일을 적고, (확인을 받은 뒤) 패키지를 설치하고, 남은 일을 번호를 붙여 쉬운 말로 적어 준다. **앱의 파일 셋을 고치고 어떤 파일을 어떻게 고쳤는지 요약의 "Changed:" 목록에 한 줄씩 적어 준다.** `next.config`의 export를 `withCms(...)`로 감싸고, 루트 레이아웃 `<html>`에 `suppressHydrationWarning`을 달고, `.gitignore`에 `.env.local`과 `.monti/`를 더한다. 이에 대해서는 묻지 않는다. 안전하게 바꿀 수 없는 모양의 파일(함수를 export하는 설정, `<html>`이 없는 레이아웃 등)은 건드리지 않고, 이유와 함께 남은 일 목록에 넣는다. `.env.local`은 쓰지 않는다. 묻지 않고 파일을 덮어쓰지 않고, 다시 돌려도 안전하다.

**알아내는 것:** App Router 폴더(`app/` 또는 `src/app/`), 패키지 매니저(락 파일이나 `packageManager`), TypeScript, 개발 포트(`dev` 스크립트), 이미 있는 `next.config`의 모양, `.env.local`을 빠뜨린 `.gitignore`, 루트 레이아웃 `<html>`의 `suppressHydrationWarning`(모두 적어 줄 내용을 맞추는 데만 쓴다), Markdown·MDX 폴더(`content/`, `posts/`, `_posts/`, `blog/` 등). 그 폴더의 front matter 키가 시작용 `post` 컬렉션의 모양이 되고(아래 "front matter에 맞춘 모양" 참고). `pages/`만 있는 앱은 이유를 알리고 멈춘다.

**질문**(각각 플래그가 있다. 아래 표):

| 질문 | 고르는 것 | 기본값 |
| --- | --- | --- |
| 언어 | 언어 코드, 기본 언어가 먼저. 콘텐츠에 `hello.ko.mdx`와 `hello.en.mdx` 같은 파일 이름이나 `ko/`, `en/` 같은 언어 폴더가 있으면 그 언어를 제안하고, 기본 언어는 짝이 없는 파일을 가진 언어(없으면 첫 번째)다. `--yes`는 그대로 쓴다 | 찾은 언어, 없으면 `en` |
| 이미지 저장소 | S3 호환(S3·R2·MinIO. 설정은 `S3_*`), 또는 없음 | 없음 |
| 부가 기능 | AI 글쓰기, git 동기화(Bareun은 묻지 않는다) | 없음 |
| 블록 | 가벼운 기본 묶음(`callout`, `collapsible`, `tabs`, `code-ref`, `color`), 전부, 없음, 또는 `callout`, `collapsible`, `tabs`, `columns`, `code-explorer`, `mermaid`, `chart`, `tooltip`, `code-ref`, `color` 중에서 고르기. `mermaid`와 `chart`는 별도 진입점에서 오고, 고른 경우에만 라이브러리(`mermaid`, `recharts`)가 따라온다 | 기본 |
| 관리자 경로 | `/studio` 같은 경로 | `/studio` |
| 블록 문법 | "Markdown에서 블록을 어떻게 쓰나요?": `:::callout` 같은 `:::` 블록(디렉티브 문법, `@monti-cms/syntax-directive`. 설정에 `mdx({ syntax: [directiveSyntax()] })`가 들어간다), 또는 일반 MDX만 | 블록을 설치하면 디렉티브 문법, 아니면 일반 MDX |
| 로그인 | "관리자에 어떻게 로그인할까?": 이메일과 비밀번호(내장, 다른 서비스 불필요) 또는 GitHub(GitHub OAuth 앱 필요). "없음" 선택지는 없다 | 이메일과 비밀번호 |
| 설치 | 패키지가 빠져 있으면 찾아낸 패키지 매니저의 설치 명령을 그대로 보여 주고 "돌릴까요?"를 묻는다 | 예 |

**쓰는 파일**(새 파일만 쓴다. 이미 있는 파일은 건너뛰고 알려 주며, 그러겠다고 하거나 `--overwrite`를 줄 때만 바꾼다):

| 내용 | 파일 |
| --- | --- |
| 하나뿐인 설정: 고른 기능마다 한 줄과 짧은 주석, 그다음 데이터베이스·로그인·저장소. 프리셋 뒤에 숨기는 것이 없다. 줄을 지우면 기능이 빠진다 | `monti.config.ts` |
| 스키마 파일: 시작용 `post` 컬렉션(콘텐츠를 찾으면 그 front matter대로), 언어, 시간대, 관리자 경로, 관리자 스키마 설정이 쓰는 것과 같은 모양으로 쓴다 | `monti.schema.ts` |
| 관리자 화면: 레이아웃(미리 만든 관리자 스타일시트를 불러온다)과 페이지 | `app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx` |
| 관리자 API와 로그인(`/api/monti/v1/*`, `/api/monti/auth/*`) | `app/api/monti/[...path]/route.ts` |
| 고른 기능이 읽는 모든 변수와, 변수마다 짧은 주석(무엇이고 어디서 얻는지: 데이터베이스 URL, `MONTI_SECRET`을 만드는 `openssl rand -base64 32`, `S3_*` 값). 컴퓨터에서 지금 필요한 값이 먼저 오고, `SITE_URL`·`AUTH_TRUST_HOST`·`DATABASE_SCHEMA`는 "When you deploy (not needed on your computer)" 아래에 주석 처리되어 한 문장씩 설명이 붙는다. `DATABASE_URL` 옆에는 `sslmode=require` 대신 `sslmode=verify-full`을 쓰라는 안내가 있다. 자리표시자만 있고 비밀은 없으므로 커밋해도 안전하다 | `.env.example` |

`src/`를 쓰는 앱이면 설정 파일을 `src/`에, 라우트를 `src/app/` 아래에 만든다. Monti가 만드는 Next 파일은 셋이다: 관리자 레이아웃, 관리자 페이지, API 라우트. 레이아웃은 일부러 따로 둔다. Next는 동적 세그먼트(`[[...path]]`)의 값이 바뀔 때마다 그 아래 트리 전체를 다시 마운트하므로, 레이아웃을 페이지 안에 두면 화면을 옮길 때마다 관리자(내비게이션·쿼리 캐시·테마 프로바이더)가 다시 마운트된다. 한 세그먼트 위에 두어야 계속 마운트된 채로 남는다.

**파일을 쓴 뒤에는** 찾아낸 패키지 매니저(`--package-manager`로 바꾼다)의 설치 명령을 그대로 보여 주고, 돌릴지 묻고(기본은 예, `--yes`는 묻지 않고 받아들인다), 돌린다. `--no-install`은 설치하지 않고 그 명령을 목록에 적는다. 거기서 멈춘다. **데이터베이스를 띄우지 않고, `monti db:setup`을 돌리지 않고, 스타일을 설치하지 않고, 페이지를 더하지 않고, 내 파일을 고치지 않고, `pnpm-workspace.yaml`을 건드리지 않는다.** 설치가 실패해도 파일은 그대로 남고, 요약은 "Monti를 더했다"고 하지 않고 일부만 됐다고 하면서 실패한 단계와 설치 명령을 그대로 알려 준다. `monti init`을 다시 돌리면 이어서 한다(있는 파일은 그대로 둔다).

요약은 남은 일을 번호 붙은 단계로, 복사할 내용 그대로, 앱에 필요한 것만 보여 준다:

1. 설치 명령(돌리지 않았을 때만. 앱에 TypeScript가 없으면 그 짧은 안내가 앞에 온다),
2. `next.config` 변경과 `<html>`의 `suppressHydrationWarning`. init이 직접 하지 못한 것만, 이유와 정확한 변경과 함께 나온다. 직접 고쳤으면 "Changed:"에 파일과 변경이 적히고, 이미 되어 있는 파일은 그대로 두고 "이미 있음"으로 적는다. `next.config`가 없으면 `next.config.ts`를 만든다,
3. `cp .env.example .env.local`을 하고 채워 넣기, `MONTI_SECRET`을 만드는 명령(`openssl rand -base64 32`, 또는 한 줄짜리 `node -e` 명령)과 함께,
4. `monti db:setup`("Monti의 표를 데이터베이스에 만든다(처음 한 번)"),
5. `monti doctor`(위 단계 중 빠진 것이 있으면 알려 준다),
6. `pnpm dev`, 그다음 관리자 주소(`/studio`) 열기.

그 뒤에 해당하는 안내가 붙는다: git-sync 대상, 그리고 로그인에 대한 한 항목이다. **이메일과 비밀번호**(기본)이면 배포한 직후 관리자를 열어 첫 관리자를 만들라는 것이고(또는 운영 데이터베이스를 가리키게 해서 내 컴퓨터에서 앱을 프로덕션 모드로 돌려 미리 만든다. `next dev`에서는 로그인 없이 관리자라서 그 화면이 나오지 않는다), 비밀번호를 잊었을 때는 `monti admin:reset-password`다. **GitHub**이면 홈페이지·콜백 URL과 함께 OAuth 앱을 만들고 `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `MONTI_ADMIN_GITHUB_ID`를 채우라는 것이다. 어느 쪽이든 `monti.config.ts`에는 이미 `auth: auth({ providers: [...] })` 줄이 있고 `@monti-cms/auth`는 설치돼 있다.

**질문 없이.** 플래그를 준 질문은 묻지 않는다. `--yes`, `--json`이거나 터미널이 없으면(CI) 아무것도 묻지 않고, 모든 질문이 플래그나 기본값을 쓴다. `--json` 출력은 JSON 문서 하나(`ok`, `created`, `changed`, `skipped`, `overwritten`, `steps`, `notes`, `next` 등)이고, 오류는 `{ "ok": false, "error": "..." }`다. 종료 코드는 성공 0, 단계 실패나 잘못된 입력 1, 취소 130이다.

```sh
pnpm exec monti init                 # 대화형
pnpm exec monti init --yes           # 전부 기본값: 가벼운 블록 묶음, /studio, 묻지 않고 설치
pnpm exec monti init --yes --json --locales ko,en --storage s3 --extras ai,git-sync --blocks default,mermaid
pnpm exec monti init --dry-run --yes # 쓰고 돌릴 일만 보여 준다
pnpm exec monti init --no-install    # 파일만 쓰고 설치 명령을 적어 준다
```

| 플래그 | 뜻 | 기본값 |
| --- | --- | --- |
| `--yes`, `-y` | 질문 없이. 답이 없는 질문은 기본값이고, 설치도 묻지 않고 돌린다 | |
| `--json` | 결과를 JSON으로 출력(`--yes`를 포함) | |
| `--dry-run` | 쓰지도 돌리지도 않고 계획만 보인다 | |
| `--site-url <url>` | 공개 사이트 주소. `.env.example`의 `SITE_URL` 예시 값이다 | `http://localhost:<개발 포트>` |
| `--locales <목록>` | 언어 코드, 기본 언어가 먼저(하나면 `--locale <코드>`도 같다) | 콘텐츠 파일 이름이나 폴더에서 찾은 언어, 없으면 `en` |
| `--time-zone <시간대>` | 사이트의 날짜와 예약 발행에 쓰는 IANA 시간대 | 이 컴퓨터의 시간대(읽을 수 없으면 `UTC`). 어느 쪽인지 요약에 나오고, `monti.schema.ts`의 `timeZone`(또는 관리자의 스키마 설정)으로 바꾼다 |
| `--storage <s3\|none>` | 이미지 저장소 | `none` |
| `--extras <목록>` | `ai`, `git-sync`, `none` | `none` |
| `--blocks <목록>` | `default`(가벼운 묶음), `all`, `none`, 블록 이름(`default,mermaid`는 가벼운 묶음에 더한다) | `default` |
| `--admin-path <경로>` | 관리자 경로(영문자·숫자·`-`·`_`. `/`와 `/api` 아래는 안 된다) | `/studio` |
| `--directive-syntax` (`--no-directive-syntax`) | 블록을 `:::` 블록(디렉티브 문법)으로 쓸지(또는 일반 MDX로 둘지)를 묻지 않고 정한다 | 묻는다. 블록을 설치하면 예 |
| `--login <password\|github>` | 관리자 로그인 방법: 내장 이메일·비밀번호 로그인 또는 GitHub | `password` |
| `--overwrite` | 다른 내용인 기존 파일을 바꾼다 | 그대로 둔다 |
| `--no-install` | 패키지를 설치하지 않고, 설치 명령을 남은 일 목록에 적는다 | |
| `--package-manager <이름>` | `npm`, `pnpm`, `yarn`, `bun` | 찾아낸 것 |

**기본 블록은 가볍다.** 기본 묶음은 `callout`, `collapsible`, `tabs`, `code-ref`, `color`다. `mermaid`는 `node_modules`를 약 26 MB 늘리고 브라우저 스크립트도 커서 직접 고를 때만 들어간다. `chart`는 recharts와 d3를 더해서 마찬가지다. `--blocks all`로 고르거나, 기본 묶음 옆에 이름을 적는다(`--blocks default,mermaid`). 무거운 블록은 진입점이 따로 있고(`import { chart } from "@monti-cms/blocks/chart"`, `import { mermaid } from "@monti-cms/blocks/mermaid"`) 그 라이브러리는 `@monti-cms/blocks`의 선택적 peer라서, 고르지 않은 앱은 둘 다 설치하지 않고 아무것도 불러오지 않는다. `@monti-cms/blocks` 자체는 가볍게 남는다. `monti init`은 맞는 진입점에서 import를 쓰고, 고른 블록의 라이브러리만 설치한다.

**콘텐츠에서 찾는 언어.** `hello.ko.mdx` + `hello.en.mdx` 같은 파일 이름(두 글자 언어 코드)이나 형제 언어 폴더(`content/ko`, `content/en`은 한 묶음의 글로 합친다)가 사이트의 언어가 된다. `--yes`에서는 그 언어를 로케일로 쓰고, 기본 언어는 짝이 없는 파일(번역되지 않은 원본)을 가진 언어이거나 첫 번째다. 대화형에서는 제안하는 답이 된다. `--locales`가 항상 이기고, 파일이 알려 줬을 값은 알림에 적는다.

**front matter에 맞춘 모양.** `monti init`은 콘텐츠 폴더를 찾으면 front matter를 읽어 시작용 스키마를 만든다. `tags`(`keywords`, `topics`도)는 아이템 컬렉션 `tag`와 관계 필드 `tagIds`가 된다. `category`는 컬렉션 `category`와 필드 `categoryId`가 된다(목록 `categories`는 `categoryIds`). `date`(와 `pubDate`, `publishDate` 등)는 항목의 발행일이라 필드를 만들지 않는다. `description`, `summary`, `excerpt`는 `summary` 역할을 가진 필드가 된다. post 컬렉션의 `path`는 콘텐츠 폴더 이름을 따른다(`content/blog`는 `/blog/:slug`, `content/posts`는 `/posts/:slug`). 맞는 종류가 없는 나머지 키는 그대로 텍스트 필드가 된다.

**도움말.** `monti --help`는 머리말과 모든 명령을 보여 주고, `monti <명령> --help`(예: `monti init --help`)는 그 명령의 도움말만 보여 준다.

**관리자 경로는 `admin.path`(스키마 파일 또는 사이트 설정)와 라우트 폴더가 같아야 한다.** `monti init`은 둘을 함께 맞춘다. 나중에 바꿀 때는 둘을 함께 바꾼다. 관리자 API 경로(`/api/monti/v1`)는 바뀌지 않는다.

**안전.** init이 이미 있는 파일에서 고치는 것은 위의 세 가지뿐이다. 쓰는 파일은 모두 프로젝트 밖의 경로(`..` 경로, 절대 경로, 밖으로 나가는 심볼릭 링크)를 거부하는 한 곳을 지난다. 모든 질문에 답하기 전에는 아무것도 쓰지 않으므로 Ctrl+C로 멈추면 프로젝트는 그대로다. 쓰다가 실패하면 오류가 이미 쓴 파일을 알려 주고(되돌리지 않는다) `monti init`을 다시 돌리라고 안내한다. 다시 돌리면 그 파일들은 그대로 둔다.


### 3. 컬렉션 고치기

사이트의 데이터는 `monti.schema.ts`에 있고, `monti.config.ts`가 그것을 불러와 코드가 필요한 것을 더한다("스키마 파일"). 관리자 화면은 인스턴스에서 사이트를 JSON 스냅샷으로 받으므로 스키마 파일에는 비밀 값이 없고, `monti.config.ts` 자체는 서버 전용이다. 만들어진 시작점은 이렇다.

```ts
// monti.schema.ts
import { defineSchema } from "@monti-cms/core";

export default defineSchema({
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			icon: "file-text",
			fields: {
				title: { kind: "text", label: "Title", required: true, max: 200 },
				slug: { kind: "slug", label: "Slug", from: "title", required: true },
				summary: { kind: "text", label: "Summary", role: "summary", multiline: true, fillFromBody: true },
			},
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	timeZone: "UTC",
	site: { name: "My site" },
});
```

```ts
// monti.config.ts
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema";

export const cms = defineConfig({
	schema, // 데이터는 monti.schema.ts에 그대로 둔다
	plugins: [], // 기능마다 한 줄, 모두 인자 없이 동작한다: mdx(), seo(), callout(), ...
	database: postgres(), // DATABASE_URL, DATABASE_SCHEMA
	// auth: auth({ providers: [password()] }), // 로그인: password()(내장) 또는 github(). 없으면 `next dev`에서만 들어갈 수 있다
	// storage: <아무 패키지의 어댑터>, // 미디어 올리기. 없으면 관리자가 미디어 메뉴를 숨긴다
});
```

여기서 `defineConfig`는 `@monti-cms/core/server`의 것이다. 사이트 옵션(`schema`·`plugins`·`blocks`·`site`·`admin`·`codeBlock`·`media`·`seed` …)과 서버 옵션(`database`·`auth`·`storage`·`secret` …)을 한 객체로 받아 CMS 인스턴스를 돌려준다("CMS 인스턴스" 절). 플러그인과 어댑터는 모두 인자 없이 동작하고 관례적인 환경 변수를 읽는다(아래를 본다). 명시한 옵션이 항상 이긴다.

컬렉션 이름(`post`)은 DB에 저장되므로 운영 중에 바꾸지 않는다. `kind`는 `document`(본문·초안·발행) 또는 `item`(태그 같은 작은 항목), `path`는 공개 주소로 본문 내부 링크와 미리보기 주소에 쓰고, 제목 필드는 `role: "title"`을 가진 필드(없으면 이름이 `title`인 필드)다.
`layout`·`list`를 적지 않으면 필드 순서대로 그리고 기본 목록 컬럼을 쓴다("컬렉션"). 규칙은 아래 "스키마 파일"과 "설정"을 본다.

`monti.config.ts`가 CMS 인스턴스를 만들며 서버에서만 읽힌다. 서버 옵션은 저장소·미디어·로그인 연결과 비밀 값이다.
연결은 처음 쓸 때 만들고 환경 변수도 값이 처음 필요할 때 읽으므로, 빌드 중에는 환경 변수가 비어 있어도 된다. 이미지 올리기를 쓰려면 `@monti-cms/storage-s3`를 설치하고 그 저장소를 `storage`로 넣는다(미디어를 쓰는 사이트만, AWS SDK는 함께 설치된다):

```ts
import { s3Storage } from "@monti-cms/storage-s3";

storage: s3Storage(), // AWS S3, Cloudflare R2(S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com, S3_REGION=auto), MinIO 등 S3 API 저장소. S3_* 변수를 읽는다
```

변수 이름과 옵션은 패키지 README(`packages/storage-s3`)에 있다.

다른 저장소는 `@monti-cms/core/adapters`의 `MediaStore` 계약을 구현한 `MediaAdapter`(`{ name, createStore() }`)를 넣는다.

### 4. 환경 변수, `monti db:setup`, `monti db:migrate`

`.env.local`에 둔다.

| 이름 | 뜻 |
| --- | --- |
| `DATABASE_URL` | Postgres 연결 주소(`postgres()`가 읽는다) |
| `DATABASE_SCHEMA` | 선택. 스키마 이름(없으면 `public`). 다른 앱과 같이 쓰는 데이터베이스면 표가 섞이지 않게 따로 둔다. `monti db:setup`이 없으면 만든다. `monti init`은 묻지 않고, `.env.example`에 주석 처리된 줄로 둔다 |
| `MONTI_SECRET` | 임의의 긴 값(예: `openssl rand -base64 32`). 하나뿐인 비밀 값이다. 로그인 세션은 이 값에서 만든 키로 서명하고, 플러그인이 저장하는 값(AI 서비스 키, git-sync 토큰)도 이 값에서 만든 키로 암호화한다(`defineConfig({ secret })`에도 같은 값을 줄 수 있다). 바꿀 때는 옛 값을 `previousSecrets`에 남긴다("비밀 값") |
| `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET` | (`monti init --login github`은 `.env.example`에 적어 둔다.) GitHub 로그인(`auth: auth({ providers: [github()] })`, `@monti-cms/auth` 필요)을 쓸 때만. GitHub OAuth 앱(`github()`가 읽는다). 콜백 주소는 `<사이트 주소>/api/monti/auth/callback/github`. `next dev`에서는 필요 없다 |
| `MONTI_ADMIN_GITHUB_ID` | 관리자 GitHub 숫자 ID. 여럿이면 쉼표로 구분한다(`github()`가 읽는다). `next dev`에서는 필요 없다 |
| `SITE_URL` | 선택. 사이트의 공개 URL(`site.url`). 환경마다 다르다. 코드나 스키마 파일의 `site.url`이 있으면 그쪽이 이긴다 |
| `AUTH_TRUST_HOST` | 선택. `X-Forwarded-Host`를 덮어쓰는, 직접 운영하는 프록시(nginx, 로드 밸런서) 뒤에서 돌 때만 `true`. Vercel·Netlify·Cloudflare Pages 같은 플랫폼은 알아서 감지한다("호스트 신뢰" 참고) |

**SSL.** `DATABASE_URL`은 쓴 그대로 `pg` 드라이버에 넘긴다. `sslmode=require`(`prefer`, `verify-ca`도)이면 드라이버가 앱이 시작할 때마다 긴 SECURITY WARNING을 출력한다. 알림일 뿐이다. 지금은 드라이버가 그 모드들을 `verify-full`(암호화, 인증서 확인)로 읽으므로 연결은 안전하고, 다음 메이저 버전에서 libpq의 의미로 바뀔 예정이다. `monti doctor`가 이를 쉬운 말로 설명하고(`database/url`) 한 줄짜리 해결책을 알려 준다: URL에 `sslmode=verify-full`을 적는다(같은 보안, 알림 없음). libpq의 의미(`require`에서 인증서를 확인하지 않음)를 원할 때만 `uselibpqcompat=true`를 더한다.

옵션에 명시한 값이 항상 이 환경 변수보다 앞서고, 다른 이름에서 값을 짐작하지 않는다. 필요한 값이 없으면 변수 이름을 알려 주는 오류가 난다(환경 변수는 값이 처음 쓰일 때 읽으므로 환경 변수 없이 빌드해도 실패하지 않는다). 개발용 로그인을 위한 변수는 없다. `next dev`에서는 저절로 켜진다("개발용 로그인 우회").

```sh
pnpm exec monti db:setup     # 처음 한 번: Monti의 표를 만든다
pnpm exec monti db:migrate   # Monti를 올린 뒤: 표를 최신 모양으로 맞춘다
```

`monti db:setup`은 빈 데이터베이스에 스키마(`DATABASE_SCHEMA`가 없는 스키마를 가리키면)와 Monti의 표를 만든다. 첫 줄에 어디에 만드는지(`Creating Monti's tables in host:port/db, schema "public"…`), 마지막 줄에 몇 개를 만들었는지(`Done: created N tables.`) 알려 준다. Monti의 표가 이미 있으면 아무것도 바꾸지 않고 그렇게 말한다(`Monti is already set up in this database (schema "public"). After updating Monti, run `monti db:migrate`.`, 종료 코드 0). 스키마에 다른 앱의 표만 있으면 Monti의 표만 더하고 다른 표는 건드리지 않았다고 말한다.

`monti db:migrate`는 패키지를 올린 뒤에 쓴다. 아직 적용하지 않은 마이그레이션(플러그인 표 포함)을 적용한다. 여러 번 돌려도 결과가 같다. `Bringing Monti's tables up to date with this version…`와 대상으로 시작하고, `Applied N steps, M already up to date.`로 끝나며, 적용할 것이 없으면 `Already up to date.`라고 한다. 아직 아무것도 설정하지 않았으면 `monti db:setup`을 먼저 돌리라고 알려 주고 종료 코드 1로 끝난다. 스크립트와 테스트에서 쓰는 `cms.migrate()`는 빈 데이터베이스에도 표를 만든다.
본체 변경은 번호 붙은 단계로 `cms_migrations`에 남아 아직 돌지 않은 단계만 돌고(한 트랜잭션), 같은 스키마에 동시에 돌려도
하나씩 돈다. 플러그인은 한 번만 할 일을 `storage.once(이름, 단계)`로 맡긴다("플러그인 저장소").
Monti의 이전 시험판이 만든 데이터베이스(`cms_migrations`에 이 버전에 없는 단계가 있는 것)는 올리지 않는다. `monti db:migrate`·`monti db:setup`·`cms.migrate()`·`monti doctor`는 "This database was created by an older pre-release of Monti and cannot be upgraded"라는 메시지와 "recreate it (run `monti db:setup` on a fresh schema or an empty database)"라는 해결 방법으로 거절하며, 그 안의 어떤 것도 바꾸지 않는다.

- 환경 파일: 기본으로 `.env.local`·`.env`(있는 것만)를 읽는다. 셸에서 준 값이 이기고 앞 파일이 뒤 파일을 이긴다.
  `--env-file <파일>`(여러 번)로 고르고 `--no-env-file`이면 읽지 않는다.
- 파일: 설정 파일(인스턴스를 `cms`로 내보내는 모듈, `export const cms = …` 또는 default export)은 `--config <파일>` → `MONTI_CONFIG_PATH` → `./monti.config.ts`·`./src/monti.config.ts` 순서로 찾는다.
- `monti doctor`는 설정 전체를 점검하고 잘못된 것을 어떻게 고치는지 알려 준다. `"use client"` 파일이 설정에 닿지 않는지도 본다("문제 해결: `monti doctor`" 참고).
- 직접 만든 스크립트에서는 인스턴스를 불러와 부른다: `import { cms } from "./monti.config"; await cms.migrate(); await cms.close();`
  (`tsx --env-file=.env.local script.ts`로 돌린다. 인스턴스가 사이트 설정을 가지고 있어서 따로 이을 것이 없다).

### 5. 실행

`pnpm dev`로 띄우고 관리자 경로를 연다(`monti init`으로 만든 설정은 `/studio`. 설정의 기본값은 `/admin`이다. "설정"의 `admin.path` 참고).

### 로그인 경로

로그인 API는 기본으로 관리자 API 라우트가 함께 받는다(`/api/monti/auth/*`). 그래서 로그인 라우트 파일이 따로 없다.
예전처럼 `/api/auth/*`를 쓰는 앱(이미 등록한 OAuth 콜백 주소를 바꾸지 않으려는 앱)은 경로를 고르고 라우트 파일을 둔다.

```ts
// monti.config.ts
auth: auth({ providers: [/* … */], basePath: "/api/auth" }),

// app/api/auth/[...auth]/route.ts
import { cms } from "../../../../monti.config";
export const { GET, POST } = cms.authHandlers;
```

`basePath`가 기본값이 아니면 관리자 API 라우트는 `/api/monti/auth/*`를 받지 않는다(404).

### 선택 의존성

CMS 패키지의 선택 의존성(블록 확장의 `mermaid`·`recharts`)은 그 기능을 쓸 때만 설치한다. 둘은 별도 진입점(`@monti-cms/blocks/mermaid`, `@monti-cms/blocks/chart`)이라서, import하지 않는 앱은 불러오지도 않는다. `recharts` 없이 `chart()`를(`mermaid` 없이 `mermaid()`를) import하면 번들러가 패키지 이름이 든 "module not found" 오류로 멈춘다. 그 패키지를 설치하고(`pnpm add recharts`) 개발 서버를 다시 띄운다.

### 직접 잇기 (`monti init` 없이)

`monti init`이 쓰고 적어 주는 일을 손으로 하려면: `monti.config.ts`(`export const cms = defineConfig({ … })`)를 만들고, `next.config.ts`를
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
import { chart } from "@monti-cms/blocks/chart"; // `pnpm add recharts`가 필요하다
import { mermaid } from "@monti-cms/blocks/mermaid"; // `pnpm add mermaid`가 필요하다

export const cms = defineConfig({
	// …
	plugins: [callout(), tabs(), tooltip(), chart(), mermaid()], // 블록마다 한 줄: 한 줄을 지우면 그 블록이 없어진다
});
```

```ts
import "@monti-cms/blocks/styles.css"; // 관리자 레이아웃에서 "@monti-cms/admin/styles.css" 뒤에(공개 페이지 스타일은 `@monti-cms/blocks/render.css`)
```

블록은 저마다 별도의 플러그인 함수이고 인자 없이 동작한다: `callout()`·`collapsible()`·`tabs()`·`columns()`·`codeExplorer()`·`mermaid()`·`chart()`·`tooltip()`·`codeRef()`·`color(options?)`. `mermaid()`와 `chart()`는 무거운 둘이라 배럴이 아니라 `@monti-cms/blocks/mermaid`와 `@monti-cms/blocks/chart`에서 오므로, 쓰지 않는 앱은 그 라이브러리를 불러오지도 설치하지도 않는다. 전부 한꺼번에 더하는 `blocks()`는 없다. 글자 위에 겹치는 인라인 마크 `tooltip()`·`codeRef()`·`color()`는 `plugins`에 적은 순서대로 저장된다.

자세한 것은 `@monti-cms/blocks`의 README.

### AI 플러그인 (선택)

```sh
pnpm add @monti-cms/ai
```

```ts
// monti.config.ts
import { ai } from "@monti-cms/ai";

export const cms = defineConfig({
	// …
	// 기본 기능(주소·요약·태그 추천 등)이 필드 종류·역할·관계 대상으로 저절로 붙는다. 바꾸거나 끌 것만 `actions`에 적는다.
	plugins: [ai({ siteDescription: "기술 블로그" })],
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

`monti db:migrate`처럼 앱을 불러온 뒤(env 파일, 그다음 `monti.config.ts`) 본체의 검사(설정, 스키마, 데이터베이스, 비밀 값, 로그인 설정, Next 파일)를 돌려 각각을 `ok`, `warn`, `FAIL`로 보여 준다. **경고와 실패마다 무엇이 잘못됐는지, 어디(파일, 환경 변수, 옵션)인지, 어떻게 고치는지**를 쉬운 말로 적는다. 앞의 문제 때문에 돌릴 수 없는 검사는 `skip`이다. 검사가 하나라도 실패하면 종료 코드가 1이다(경고는 바꾸지 않는다). 아무것도 바꾸지 않고, 비밀 값은 찍지 않는다.

```text
  FAIL  database/migrations   3 of 24 migrations are pending (0022_content_hash, 0023_events, 0024_x)
                              where: schema "public" (table cms_migrations)
                              fix:   run `monti db:migrate`; on a deployed site run it as a step of the deploy, before the new version starts
```

- `--json`은 도구와 CI를 위해 `{ ok, cwd, summary: { ok, warn, fail, skip }, checks: [{ id, group, title, status, message, where?, fix? }] }`를 찍는다. `id`는 `<그룹>/<검사>`다.
- `--only <목록>`은 이름 붙인 그룹이나 id만 돌린다(`config`, `database`, `database/migrations`, `auth`). `monti doctor --only config`는 데이터베이스 없이 CI에서 돌릴 수 있는 검사다: 설정이 불러와지는지, 클라이언트 컴포넌트가 설정을 import하지 않는지.
- `--env-file <파일>`, `--no-env-file`, `--config <파일>`은 `monti db:migrate`와 같다.

출력 순서대로 검사하는 것:

| 그룹 | 검사 |
| --- | --- |
| `config` | env 파일, `.env.local`이 `.gitignore`에 있는지, 설정 파일을 찾았는지, 불러와지고 인스턴스를 내보내는지, **Monti가 스스로 정한 값과 그 출처**(`config/automatic`), **미디어 저장소를 만들 수 있는지**(`config/storage`: `S3_*` 값이 빠지면 여기서 실패한다. 공개 화면은 주소를 만들 수 없는 이미지를 아무 말 없이 "사용할 수 없음"으로 그리기 때문이다), **`"use client"` 파일이 설정이나 다른 서버 전용 모듈을 import하지 않는지**(`monti check:boundary`를 대신한다) |
| `schema` | `schema/file`: 스키마 파일을 찾았고, 읽히며, 올바른지(문제마다 경로). 파일에 코드가 있으면 그 사실도 알려 주며, 그러면 관리자 스키마 화면은 읽기 전용이다 |
| `database` | `DATABASE_URL`이 있고 Postgres URL인지, 데이터베이스에 닿는지(틀린 호스트·포트·비밀번호·데이터베이스 이름을 구분한다), `DATABASE_SCHEMA`가 있는지, **미적용 마이그레이션이 몇 개인지**(`monti db:migrate`) |
| `secrets` | `MONTI_SECRET`이 있고 충분히 강한지, 옛 `CMS_SECRET`·`AUTH_SECRET`이 아직 있지만 쓰이지 않는지 |
| `auth` | 설정에 로그인이 있는지(없으면 개발에서는 경고, 프로덕션이나 알려진 호스팅 플랫폼에서는 실패이고, GitHub 로그인을 더하는 방법이 붙는다), 이메일·비밀번호 로그인이면 관리자 계정이 아직 없을 때의 경고(관리자를 열어 첫 관리자를 만든다), GitHub이면 본체가 아는 값만: GitHub 클라이언트 id와 시크릿(`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`), `MONTI_ADMIN_GITHUB_ID`에 관리자가 있는지(숫자 id가 아니라 로그인 이름을 쓴 항목을 짚는다), `SITE_URL`, 호스트 신뢰 결과와 이유, OAuth 앱에 **등록할 콜백 URL**(`SITE_URL`에서 만든다) |
| `next` | 관리자 경로에 Next 파일 셋이 있고 알맞은 컴포넌트를 쓰는지(`admin.path`와 맞지 않는 폴더면 그 폴더를 짚는다), `next.config`가 `withCms`를 쓰는지, 관리자 주소 |

패키지가 던지는 오류도 같은 말투를 쓴다: 없는 `DATABASE_URL`·`MONTI_SECRET`·GitHub id·`S3_*` 값, 꺼져 있거나 마이그레이션되지 않은 데이터베이스, 올바르지 않은 스키마 파일, 어떤 플러그인도 제공하지 않는 형식, 인스턴스를 받지 못한 Next 파일. 각각 무엇이 잘못됐는지, 어디인지, 어떻게 고치는지를 말한다(오류 메시지 한 줄 안에서 `Where:`와 `Fix:`가 각 부분을 표시한다). 실행 중에 꺼져 있거나 마이그레이션되지 않은 데이터베이스를 만난 요청은 `503`으로 답하고, 서버 로그에 전체 메시지가 남는다.

## CMS 인스턴스

`defineConfig({ … })`(`@monti-cms/core/server`)는 사이트 옵션과 서버 옵션을 서버의 모든 곳이 쓰는 인스턴스로 만든다. 인스턴스가 사이트(풀어 놓은 사이트 설정, `cms.site`)·콘텐츠 저장소·서비스·미디어 저장소·로그인 연결·
플러그인 서버 모듈·`on` 구독자·비밀 값을 가진다. 전역 상태는 없어서, 설정이 다른 인스턴스 둘이 한 프로세스에 나란히 있을 수 있다(테스트·스크립트·사이트와 DB 여러 개).
연결은 처음 쓸 때 만들므로 import나 빌드 때 인스턴스를 만들어도 어디에도 연결하지 않는다.

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import { callout } from "@monti-cms/blocks";
import schema from "./monti.schema";

export const cms = defineConfig({
	schema,                                   // 데이터는 monti.schema.ts에 그대로 둔다
	plugins: [mdx(), callout()],              // 기능마다 한 줄, 모두 인자 없이 동작한다
	database: postgres(),                     // DATABASE_URL, DATABASE_SCHEMA
	// auth: auth({ providers: [github()] }), // 선택 사항인 로그인. 없으면 `next dev`에서만 들어갈 수 있다
	// storage: <아무 패키지의 어댑터>,        // 미디어 올리기. 없으면 관리자가 미디어 메뉴를 숨긴다
});
```

나머지는 모두 이 파일에서 `cms`를 불러다 쓴다. `defineConfig`는 사이트 옵션(`schema`, 또는 `collections`와 `locales`, 그리고 `plugins`·`blocks`·`site`·`admin`·`codeBlock`·`media`·`seed` …)과 서버 옵션("서버 옵션" 절)을 받는다. `database`는 필수이고 나머지는 선택이다.

공개된 `defineConfig`는 `@monti-cms/core/server`의 것 하나뿐이다. `@monti-cms/core`(루트 진입점)는 더 이상 `defineConfig`를 내보내지 않는다. 낮은 수준 API인 `@monti-cms/core/testing`의 `createCms({ config, server })`(`server`는 `CmsServerConfig`)는 `@monti-cms/core`의 `defineSite`로 만든 사이트 설정을 받으며, 테스트와 도구가 이것을 쓴다. `defineServerConfig`는 없어졌다.

`site.url`은 관례대로 `SITE_URL` 환경 변수에서 읽는다. 코드의 `site.url`이나 스키마 파일의 `site.url`이 정하면 그쪽이 이긴다.


| 어디서 | 코드 |
| --- | --- |
| 관리자 API 라우트(`app/api/monti/[...path]/route.ts`) | `export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);` (`@monti-cms/nextjs`의 `createRouteHandler`, `cms.handle(request)`의 Next 어댑터) |
| 다른 호스트의 관리자 API | `cms.handle(request)`: 표준 `Request`를 받아 `Response`를 돌려준다 |
| 관리자 레이아웃·페이지 | `<CmsAdminLayout cms={cms}>…</CmsAdminLayout>`, `<CmsAdminPage cms={cms} {...props} />`, 레이아웃 파일의 `export const generateMetadata = () => cmsAdminMetadata(cms);`(`@monti-cms/nextjs/admin`) |
| 사이트 페이지(서버 컴포넌트·sitemap·RSS) | `cms.read.getEntry(…)`·`cms.read.listEntries(…)`·`cms.read.getTranslations(…)`·`cms.read.getPreview(…)`(`format: "mdx"`를 넘기면 본문을 그 형식의 글로도 받는다. `entry.body`, "형식" 절) |
| 공개 미디어와 링크 | `entry.refs`(`entry.doc`에 쓰인 미디어의 URL과 내부 링크의 주소. `<CmsContent cms={cms} entry={entry} />`가 그린다), `cms.read.mediaUrl(mediaId)` |
| 저장소·설정 | `cms.store()`·`cms.contentService()`·`cms.bulkService()`·`cms.mediaStore()`·`cms.plugin(플러그인이름)`·`cms.apiKeys`·`cms.auth()`·`cms.authHandlers`·`cms.isMediaConfigured` |
| 스크립트·명령줄 | `cms.migrate()`·`cms.close()` |
| 플러그인 라우트 | `adminRoute(async ({ request, params, auth, cms }) => …)`: 라우트는 자신을 맡은 인스턴스를 받는다 |
| 사이트 | `cms.site`: 컬렉션과 그 규칙·언어·URL·블록·코드 블록 설정·관리자 주소와 언어("사이트 설정은 인스턴스에 속한다") |
| 테스트 | `@monti-cms/core/testing`의 `fakeCms({ config, store, verifyAdmin, … })`: 테스트가 준 부품 위에 만든 진짜 인스턴스(`config`를 주지 않으면 영어 사이트 하나짜리 최소 설정) |

HTTP 계층은 표준 웹 `Request`와 `Response`로 동작한다.
관리자 API, 로그인 연결, 공개 API, 플러그인 라우트에는 `NextRequest`, `NextResponse`, `request.nextUrl`을 쓰지 않는다.
`cms.handle(request)`가 요청 하나를 처리하고(`/api/monti/` 뒤의 경로는 URL에서 읽는다), `@monti-cms/nextjs`의 `createRouteHandler(cms)`는 그 위에 얹은 얇은 Next 어댑터다.
플러그인 라우트(`adminRoute`)는 표준 `Request`를 받는다. 쿼리는 `new URL(request.url).searchParams`로 읽고, 응답은 `Response.json(…)`으로 만든다.
코어는 Next.js에서 아무것도 가져오지 않는다. 호스트가 대 주는 것은 로그인 연결로 들어온다. `CmsAuth.requestHeaders()`(처리 중인 요청의 헤더, 개발용 로그인 우회와 `session()`이 읽는다)와 `CmsAuth.rethrow(error)`(로그인 라이브러리가 던지는 리다이렉트를 호스트까지 보낸다. `@monti-cms/auth`는 `Response`로 답하므로 필요 없다)다. Next 통합(`@monti-cms/nextjs`의 `createRouteHandler(cms)`, `CmsAdminLayout`, `CmsAdminPage`, `cmsAdminMetadata`)이 인스턴스의 호스트 쪽(`hostOf(cms).attachHost(host)`, `@monti-cms/core/internal/host`)으로 Next 요청 헤더를 인스턴스에 직접 붙이므로(`RequestHost`는 `@monti-cms/core/server`에서 온다. `AuthCreateContext`에는 `host: RequestHost`가 있다) 설정에 호스트를 적지 않는다. `auth({ host })`는 Next 통합 밖에서 쓰는 명시적 재정의로 남아 있고, 붙여 둔 호스트보다 우선한다. 다른 프레임워크의 호스트는 제 것을 채운다.

읽기 API는 인스턴스에 달려 있다(`getEntry(cms, …)`가 아니라 `cms.read.getEntry(…)`). 사이트 코드가 하나만 불러오면 되고, 타입(`MetadataFor` 등)은 `@monti-cms/core/read`에 남는다.

**개발 중 다시 불러오기.** `next dev`는 고친 뒤 `monti.config.ts`를 다시 실행하고, 그러면 인스턴스를 또 만든다. 새 DB 어댑터가 연결 풀을 하나 더 열고 앞의 것은 닫지 않는다.
그래서 개발 중(`NODE_ENV=development`)에만, 같은 `id`(기본 `"default"`)로 먼저 만든 인스턴스의 DB 어댑터(와 미디어 저장소)를 새 인스턴스가 다시 쓴다.
`globalThis`의 `Symbol.for("monti.cms.dev-connections")` 항목 하나에 둔다. 나머지(저장소·서비스·로그인 연결·플러그인·훅·비밀 값)는 새 설정으로 다시 만들어서 훅과 옵션을 고치면 바로 반영된다.
DB 연결 자체를 바꾸는 것은 다시 시작해야 한다. 운영과 테스트에는 이런 캐시가 없고 인스턴스가 자기 연결만 가진다. 개발 프로세스 하나에서 인스턴스를 둘 이상 만들면 각각 `id`를 준다: `createCms({ id: "reports", config, server })`.

### 사이트 설정은 인스턴스에 속한다

인스턴스는 사이트 설정을 값으로 받아 가진다(`defineConfig`가 사이트 옵션으로 만들고, 직접 만든 설정은 `createCms({ config })`로 넘긴다). 설정 별칭도, 설정에서 뽑아 만든 모듈 수준 상수도 없으므로 모듈을 불러올 때 설정을 알고 있다고 가정하는 곳이 없고, 한 프로세스가
사이트를 여럿 가질 수 있다. `createSite(config)`(`@monti-cms/core/site`)는 설정을 `Site`로 푼다: `LOCALES`·`DEFAULT_LOCALE`·`COLLECTIONS`·`schemaOf(이름)`·`storedFields(이름)`·`contentPath(…)`·`parseInternalLink(…)`·`adminHref(…)`·`BLOCKS`·
`CODE_LINE_EFFECTS`·`pluginOptions(id)`·`createTranslator(messages)`와, 전에는 설정을 읽어 상수와 함수로 내보내던 나머지다. 인스턴스는 `Site`를 `cms.site`로 가진다
(`cms.site.config`는 설정 객체 그대로다). 설정이 필요하던 모든 곳은 인스턴스에서 받는다:

| 곳 | 사이트를 받는 데 |
| --- | --- |
| 저장소·서비스·읽기 API·HTTP 핸들러·플러그인·로그인 연결·`monti db:migrate` | 인스턴스: `createCms`가 `cms.site`를 넘긴다(`createStore({ site })`·`createContentService(store, { site })`·`createRead({ site })`·`AuthCreateContext.site` …) |
| 관리자 화면 | `<CmsAdminLayout cms={cms}>`가 화면을 `<SiteProvider config={cms.site.snapshot()}>`로 감싸고, 클라이언트 컴포넌트는 `useSite()`·`useTranslator(messages)`(`@monti-cms/core/site`)로 읽는다. 브라우저는 설정 파일을 불러오지 않는다 |
| 공개 렌더러 | `<CmsContent cms={cms} entry={entry} />`와 `renderDocument(doc, { site: cms.site })`: 사이트가 어떤 블록·마크·코드 펜스가 있는지, 줄 효과와 하이라이트 테마, 더해지는 플러그인 컴포넌트를 정한다 |
| 직접 짠 코드 | 서버에서는 `cms.site`, 클라이언트 컴포넌트에서는 `useSite()`. 사이트가 필요한 도우미는 매개변수로 받는다 |

**브라우저로 가는 것.** `site.snapshot()`은 설정을 일반 데이터로 만든 것이다. 컬렉션·언어·`site`·`admin`·`timeZone`·`media`·`editor`·`codeBlock` 설정, 모든 블록(플러그인 블록 포함), 플러그인마다 `name`·`nav`·`options`·`contributes`를 JSON으로 담는다. 플러그인의 `options`나
`contributes` 안의 함수, 함수인 `admin.messages` 문구(문자열은 간다), 플러그인의 `server`·`admin`·`render`·`formats`·`checkConfig`는 가지 않는다. 관리자 레이아웃이 플러그인의 관리자 모듈을 서버에서 불러 그 프로바이더를 직접 그린다. 브라우저에 필요한 `options` 값은 JSON으로 둔다.

**타입.** 타입은 넘긴 설정을 따라가며 등록 단계가 없다. `defineConfig({ … })`(와 `createCms({ config })`)는 `Cms<typeof config>`를 돌려주므로 `cms.read.listEntries({ collection: "post" })`는 컬렉션 이름과 각 컬렉션의 메타데이터를 알고(`MetadataFor<"post", typeof config>`, `CollectionName<typeof config>`),
설정에 없는 컬렉션은 타입 오류다. 라이브러리 타입이 인스턴스를 볼 수 없는 곳에서는 설정 타입을 준다: `DocumentComponentsFor<typeof config>`나 `DocumentComponentsOf<typeof cms>`가 `<CmsContent>`의 `components`(블록 이름과 블록마다의 속성 props)를 타입으로 정하고, AI 플러그인의 동작 이름도 같은 식으로 설정 타입을 받는다.
읽는 값은 발행된 항목 기준으로 타입이 정해진다. `required` 필드는 `entry.metadata`에서 선택 값이 아니다(`post.metadata.title`은 `string`이다). 발행하려면 그 값이 있어야 하기 때문이다(`PublishedMetadataFor`). 쓰는 값도 같은 설정으로 타입이 정해진다. `cms.contentService().createDraft({ collection: "post", … })`는 글의 메타데이터를 알고, 글에는 본문이 필요하며(`doc`, 또는 `format`과 함께 `body`) 항목 컬렉션(태그)에는 필요 없다. `{ summary: undefined }`는 "값 없음"이다. 서비스의 모든 쓰기는 `{ entry, warnings }`를 돌려준다("훅 계약"). 그냥 `Cms`나 `Site`는 어떤 설정의 인스턴스든 가리키고 이름은 `string`이다. 설정이 다른 인스턴스 둘은 따로 타입이 정해진다. 데이터를 스키마 파일에 두는 사이트는 `defineSchema`에서 같은 타입을 얻는다("스키마 파일").

### 서버 전용 설정

`monti.config.ts`에는 데이터베이스와 로그인 설정이 있으므로 서버만 불러올 수 있다. 관리자도 불러오지 않는다. 관리자 레이아웃(`<CmsAdminLayout cms={cms}>`, 서버 컴포넌트)이 브라우저에 사이트의 JSON 스냅샷(`cms.site.snapshot()`)을 넘기고, 관리자의 클라이언트 컴포넌트는 `useSite()`로 읽는다.

- `defineConfig`는 `window`가 있는 곳에서 실행되면 오류를 던진다. 실수가 설정을 브라우저로 보내기 전에 첫 로드에서 드러난다.
- `monti doctor`의 `config/boundary` 검사는 빌드 없이 소스를 읽어, `"use client"` 파일이 import를 따라가 `monti.config.ts`에 닿거나 `@monti-cms/core/server`·`@monti-cms/auth`·`@monti-cms/nextjs/auth`를 불러오면 실패한다. 타입만 가져오는 import는 세지 않는다. CI에서는 `monti doctor --only config/boundary`를 돌린다(데이터베이스가 필요 없다). `monti check:boundary`는 없어졌다.
- `withCms`(`next.config.ts`)는 `next dev`를 시작할 때 한 번 같은 검사를 하고 경고한다.
- 사이트의 값이 필요한 클라이언트 컴포넌트는 `useSite()`를, 타입이 필요하면 `import type`을 쓴다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/core` | 테스트·도구·스키마 코드 | `defineSite`(사이트 설정만 다루는 쪽, `schema`와 함께. 여기에는 `defineConfig`가 없고 앱은 `/server`의 것을 쓴다)·`defineSchema`·`defineCollection`·`fields`·`defineBlock`·`definePlugin`, `parseSchemaFile`, `SchemaFile` 타입 |
| `@monti-cms/core/internal/schema-change` | 설정 화면, 명령줄. Monti 패키지 내부용이며 안정성을 약속하지 않는다 | `diffSchema`, `checkSchemaChange`, `suggestTransforms`, `planSchemaChange`, `applySchemaChange`("스키마 바꾸기") |
| `@monti-cms/core/internal/schema-edit` | 설정 화면(서버 쪽). Monti 패키지 내부용이며 안정성을 약속하지 않는다 | `schemaEditAccess`(누가 스키마 파일을 쓸 수 있나), `readSchemaScreen`, `previewSchemaEdit`, `saveSchemaEdit`, `printSchemaFile`, `parseSchemaLiteral`("관리자에서 스키마 편집하기") |
| `@monti-cms/core/server` | `monti.config.ts`, 서버 코드(크론 스크립트·사이트 테스트 포함), 플러그인의 서버 쪽 | `defineConfig`(사이트·서버 옵션을 한꺼번에 받아 인스턴스를 돌려준다)·`postgres`, `Cms` 타입, 서비스·이벤트·훅 타입(`ContentService`·`WriteHooks`·`AfterCommitHook`·`DeferDelivery`), 스냅샷 도우미. 플러그인용으로 `defineServerPlugin`, 라우트 틀(`adminRoute`가 라우트에 `cms` 인스턴스를 넘긴다), 오류(`CmsError`), 플러그인 저장소와 로그가 있다. `server-only`를 쓰지 않아 Next 밖에서도 불러온다(그냥 `tsx`). 브라우저 코드에서는 절대 불러오지 않는다. 저장소 모듈은 처음 쓸 때 불러온다 |
| `@monti-cms/core/adapters` | 데이터베이스·미디어 저장소·로그인 어댑터를 만드는 코드 | 저장소 포트(`ContentStore`와 그것을 이루는 저장소들, 이벤트 outbox)·`DatabaseAdapter`·`MediaAdapter`와 그것이 만드는 `MediaStore`·`AuthAdapter`와 로그인 타입. 사이트 설정은 어댑터를 이름으로 고를 뿐이다(`postgres()`·`storage`·`auth`). 경로가 실행하는 로그인 검사는 `@monti-cms/core/adapters/auth`에 있다 |
| `@monti-cms/nextjs` | `app/api/monti/[...path]/route.ts` | `createRouteHandler(cms)` |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms` |
| `@monti-cms/nextjs/admin` | 관리자 라우트 파일 | `CmsAdminLayout`·`CmsAdminPage`·`cmsAdminMetadata(cms)`·`NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `monti.config.ts` | `nextHost`(로그인의 Next 쪽. 사이트에는 필요 없고 Next 통합이 붙인다) |
| `@monti-cms/auth` | `monti.config.ts` | `auth({ providers, devBypass?, basePath?, host? })`, `LoginProvider` 타입 |
| `@monti-cms/auth/github` | `monti.config.ts` | `github({ clientId?, clientSecret?, admins? })`(주지 않으면 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·`MONTI_ADMIN_GITHUB_ID`를 읽는다) |
| `@monti-cms/admin` | 플러그인의 관리자 모듈 | `defineAdminPlugin({ pages, components, slots })`("플러그인") |
| `@monti-cms/core/render` | 공개 화면(서버 컴포넌트) | `CmsContent`(`<CmsContent cms={cms} entry={entry} />`), `renderDocument(doc, { site, … })` → `{ content, toc, unknown }`, `DocumentComponentsFor<typeof config>`·`DocumentComponentsOf<typeof cms>`, `tableOfContents(doc)`, 컴포넌트 props 타입("저장된 문서 그리기"). MDX 글은 `@monti-cms/mdx/render`의 `renderMdx`가 그린다. 사이트 CSS에 `@import "@monti-cms/core/render.css";` |
| `@monti-cms/core/read` | 공개 화면(타입) | `ReadEntry`·`MetadataFor` 등 `cms.read`의 타입. `cms.read`가 공개본을 읽는다(`getEntry`·`listEntries`·`getTranslations`·`getPreview`: 관계·주소·옛 주소 이동·원문 대체) |
| `@monti-cms/core/site` | 브라우저와 서버 모두(화면 코드·공개 페이지) | 저장소가 돌려주는 데이터 모양(`Entry`·`Folder`·`ListEntriesItem` 등), `createSite`·`Site`·`SiteProvider`·`useSite`·`useTranslator`, API 모양과 설정이 필요 없는 컬렉션·언어·주소·블록·스키마 도우미(설정에 기대는 것은 `Site`의 멤버다), 그리고 문서의 텍스트: `toPlainText(site, doc)`(읽는 사람에게 보이는 글)와 `documentText(site, doc, { code, media, hidden })`(코드·이미지 텍스트·숨은 텍스트까지 담는다. 검색이나 일반 텍스트 내보내기용) |
| `@monti-cms/core/code-block` | 공개 렌더러·편집기 | 코드 블록 주석 모델 |
| `@monti-cms/core/document` | 본문을 고치거나 살피는 화면·플러그인 | `StoredDocument` 타입과, 표기법을 모르고 문서만으로 일하는 도우미: 블록 ID(`assignBlockIds`, `isBlockId`, `withoutBlockIds`), `canonicalDocument`, `readStoredDocument`, `emptyStoredDocument`, `unparsedDocument`, 링크·이미지·표 도우미, 저장 코드 블록 모델. 글 표기를 읽거나 쓰는 것은 없다. 관리자 편집기와 AI가 여기서 불러온다 |
| `@monti-cms/core/format` | 형식을 더하는 플러그인 | `defineFormat`, `CmsFormat` 인터페이스와 그 맥락·문제 타입, `createFormatRegistry`("형식" 절). 사이트 설정을 읽지 않으므로 플러그인이 어디서든 불러와도 된다 |
| `@monti-cms/core/front-matter` | 마크다운 파일을 읽고 쓰는 도구(git-sync) | `parseFile`(YAML 프런트매터와 본문, YAML 오류의 줄 번호 포함)과 `composeFile` |
| `@monti-cms/core/notation` | 형식·문법 확장 패키지 | 표기가 기대는 도우미만 담은 가벼운 진입점: 코드 주석 문법(`resolveCommentSyntax`·`formatAnnotationComment`)과 표 도우미(`formatTableWidths`·`parseTableWidths` 등). 이것들은 여기에만 있고 `@monti-cms/core/document`와 `@monti-cms/core/code-block`은 다시 내보내지 않는다. `@monti-cms/mdx`가 문법 확장용으로 다시 내보낸다 |
| `@monti-cms/core/ai-contract` | AI 기능을 더하는 플러그인 | 타입만 있다. `@monti-cms/ai`가 구현하는 AI 기능·검사·기여(`AiContribution`)의 모양이라, 플러그인이 AI 플러그인에 의존하지 않고 기능을 쓴다 |
| `monti`(명령줄, 패키지 `bin`) | 터미널 | `monti init`(파일 만들기)·`monti doctor`(설정을 점검하고 잘못된 것을 어떻게 고치는지 알려 줌, "문제 해결")·`monti db:migrate`(표 만들기)·`monti admin:reset-password`(이메일·비밀번호 로그인 관리자의 비밀번호 새로 정하기)·`monti events:retry`(때가 된 내구성 entry 이벤트 전달)·`monti <플러그인>:<명령>`(플러그인이 더하는 명령, "플러그인")·`monti schema:extract`(TypeScript 설정을 스키마 파일로 옮기기)·`monti schema:diff`와 `monti schema:apply`(스키마 변경 점검과 적용) |
| `@monti-cms/core/internal/cli` | 명령줄 도구. Monti 패키지 내부용이며 안정성을 약속하지 않는다 | `runCli(argv, { cwd, log, error })`(모든 `monti` 명령, 종료 코드를 돌려준다)·`runDoctor`·`initProject`·`addComponents`·`migrate`·`runImport`·`loadSchemaFile`·`findSchemaFile`·`extractSchema`(명령 `monti`의 코드) |
| `@monti-cms/core/internal/host` | 프레임워크 통합·관리자 UI·명령줄. Monti 패키지 내부용이며 안정성을 약속하지 않는다 | `hostOf(cms)`와 `CmsHost` 타입: 호스트만 쓰는 인스턴스 멤버(`attachHost`·`authGateway`·`isHostTrusted`, 불러온 플러그인과 그 경로·기능, 쓰기 훅, `schemaFile`·`forSchema`·`reloadSchema`·`decisions`·`databaseState`·`setup`). 공개 `Cms` 타입에는 이것들이 없다 |
| `@monti-cms/core/testing` | 테스트 | `testServer()`(`{ server, drop }`: 자기 스키마 위에 둔 진짜 인스턴스를 위한 `database`와 `auth` 옵션, ["구독자와 플러그인 테스트하기"](#구독자와-플러그인-테스트하기)), `fakeCms`(테스트가 준 부품 위의 인스턴스)·격리 스키마 DB·예시 데이터, `createCms`(낮은 수준 API: 사이트 설정과 `CmsServerConfig`를 받아 인스턴스를 돌려준다). MDX 글이 필요한 도우미는 `@monti-cms/mdx/testing`에 있다 |

## 패키지 빌드

저장소 안에서는 소스(`src`)를 바로 쓴다. 배포 묶음은 `pnpm build:packages`로 `dist`를 만들고 `pnpm pack`이
`publishConfig.exports`(dist)로 묶는다. `pnpm example:pack`은 묶음을 `examples/blog/vendor`에 넣는다.

## 본문 문법

코어는 본문을 문서로 저장하며 글 표기를 읽거나 쓰지 않는다. 표기는 **형식**("형식" 절)이고, MDX는 [`@monti-cms/mdx`](../mdx/README.ko.md) 패키지의 형식이다. 기본으로 쓰는 표기(줄바꿈·표·이미지·JSX 블록), 표기를 더하는 *문법 확장*
(`:::callout`은 `@monti-cms/syntax-directive`, Shiki 코드 표기는 `@monti-cms/syntax-shiki`), 확장을 만드는 법은 그 README에 있다. 문법 확장은 코어의 설정 키가 아니라 `plugins`의 `mdx({ syntax })`에 나열한다.

#### 저장된 본문

모든 본문(항목의 작업본·발행본, 번역이 확인한 기준 원문, 본문 템플릿)은 버전이 있는 **문서**(`entry_bodies.doc`·`body_templates.doc`, 해석한 본문을 JSON으로 담은 것)로 저장한다. 문서가 유일한 원본이며 그 옆에 글을 따로 쓰지 않고, `mdx` 열도 없다.
이미 가진 내용을 다른 표기로 저장하면 아무것도 바뀌지 않는다(새 버전도 생기지 않는다). 원문 패널(`mdx()` 플러그인이 준다)에 입력한 글은 브라우저에서 문서로 읽히고, 저장되는 것은 그 문서다.
문서가 될 수 없는 본문(글이 해석되지 않거나, 머리말이 있거나, 다시 읽었을 때 같지 않은 본문)은 **`unparsed`** 문서로 저장된다. 노드 하나 `{ "type": "unparsed", "attrs": { "format": "mdx", "source": "<받은 글 그대로>" } }`이고, 글은 그대로 보존된다. 초안은 이 상태로 둘 수 있고 편집기는 소스로 보여 주며, 발행은 `unparsed_body` 문제로 막힌다. 거절된 이유(글의 줄·칸을 담은 `mdx_error`, `frontmatter_present`)는 함께 알려 준다.

**무엇을 검사하나.** 코어는 글이 아니라 저장된 문서를 검사하고, 해시를 만들고, 검색한다. 그래서 본문은 어떻게 쓰였든 어떤 경로로 왔든 똑같이 다뤄진다. 대상은 `prepareSnapshot`과 `validateForPublish`(블록 속성의 필수·모르는·잘못된 값, 참조, 내부 링크, 이미지 출처, 각주, 코드 줄 링크, 표 병합, 글에 남은 번역 안내), 내용 해시(`computeContentHash(metadata, doc)`. 값은 전과 같다. 블록 ID를 뺀 문서를 키 순서대로 정렬해 해시한다)
, 검색용 글자와 발췌(`documentText(doc, options)`, `bodyExcerpt(doc, maxLength)`), 번역 도구(`withTranslationHints`, `compareStructure`, `diffSources`는 문서를 받는다)다. 글로 받은 본문은 먼저 그 형식으로 문서로 읽고, 문서로 받은 본문은 그대로 쓴다(글 조각과 끝의 빈 문단만 정해진 모양으로 맞춘다).
발견한 것의 위치는 그것이 든 블록이다. 문제의 `position`은 `{ blockId }`이고(읽히지 않은 글은 그 글의 `{ line, column }`을 대신 가진다), 본문 참조 위치는 `{ "type": "body", "blockId" }`다.

**코드 블록.** 코드 블록은 주석을 뺀 코드와 데이터로 둔 주석(줄 효과, 글자 효과, 정규식 규칙)으로 저장하고, 글 형식이 Monti 주석으로 되돌려 쓴다. 글을 읽는 다른 도구에서도 주석이 그대로 보인다.

**블록 ID.** 문서의 모든 블록은 본문 안에서 유일한 `id`(소문자 영숫자 8자)를 가진다. 블록 ID는 버전이 달라져도 어느 블록이 어느 블록인지 알려 주는 값이며, 글 형식에는 쓰이지 않고 콘텐츠 해시에도 들어가지 않으므로 변경으로 취급되지 않는다.
글로 저장한 본문은 바꾸기 전 버전에서 ID를 물려받는다. 똑같이 읽히는 블록은 ID를 그대로 가지고, 수정한 블록, 둘로 나눈 블록, 옮긴 블록도 마찬가지다(나눈 문단은 앞부분이 ID를 가진다). 짝이 없는 블록은 새 ID를 받고, API로 보낸 문서는 담고 있는 ID를 그대로 유지한다.
관리자 편집기는 표기법을 거치지 않고 문서 자체로 일한다. 편집하는 동안 블록마다 ID를 유지하고, 저장할 때 늘 문서를 보내므로 블록 ID가 정확히 유지된다. 원문 패널에 쓴 글은 브라우저에서 읽어 그 글이 읽히는 문서로 바꾸고, 그 블록은 위와 같이 바꿔 치우는 본문과 짝지어진다. 템플릿을 항목에 적용하면 템플릿 문서를 새 블록 ID로 복사한다(ID는 본문 하나 안에서만 유일하고, 번역·비교 화면이 ID로 블록을 짝짓기 때문이다).
관리자는 이 ID로 블록을 가리킨다. 발행 검증 문제와 참조 위치는 해당 블록을 알려 주고(`position.blockId`) 시각 편집기에서 그 블록으로 이동한다. 번역 화면은 번역할 때 확인한 원문과 지금 원문을 블록 단위로 비교하며, 자리만 옮긴 블록은 이동으로 보여 준다. AI 번역은 번역할 블록을 ID로 찾는다.
**원문 연결.** 번역본의 블록은 자신을 만든 원문 블록의 ID인 `sourceId`도 가진다. 새 번역본을 만들면 안쪽 블록까지 모든 블록이 복사해 온 원문 블록에 연결된다. 연결은 블록의 `id`와 함께 유지되고 함께 빠진다(글 형식에 쓰이지 않고 해시에 들어가지 않으며, 본문을 다시 읽을 때 ID와 함께 물려받는다. 나눈 블록은 앞부분이 가지고, 새 블록과 복사한 블록은 갖지 않는다). 번역 화면은 이 연결로 블록을 짝지어, 쓰고 있는 블록의 원문 블록을 바로 옆에 둔다. 맞는 연결이 없는 블록은 종류로 짝짓는다. 원문 블록의 ID가 바뀌면 그 연결은 그냥 맞지 않게 된다.



- **선택 칸용 항목 검색.** `GET /api/monti/v1/entries/search?collection=…&query=…&locale=…&publishedOnly=true&limit=20`은 선택 칸이 쓰도록 한 컬렉션의 항목을 제목으로 찾는다(관리자의 관계 필드는 전체 목록을 불러오지 않고 이렇게 검색한다). `{ items: [{ id, title, slug, status }] }`를 돌려주며 제목이 잘 맞는 순서다(제목이 같은 것, 질의로 시작하는 제목, 질의로 시작하는 낱말이 있는 제목, 질의를 포함한 제목, 질의를 포함한 슬러그). 최대 `limit`개(기본 20, 최대 50)이고 휴지통은 찾지 않는다. `id`를 되풀이하면 검색 대신 그 항목들을 id로 찾는다. 저장소 포트는 `searchEntries`(`ListStore`)다.
- **관리자 항목 API.** `POST /api/monti/v1/entries`와 `PATCH /api/monti/v1/entries/:id`는 본문을 `doc`(항목의 `working.doc`·`published.doc`로 읽은 문서 JSON) 또는 `body`(글)와 그것을 읽는 `format`으로 받는다("형식" 절). `mdx`는 없다. 문서와 글을 함께 보내거나, 형식 없이 글만 보내거나, 올바른 저장 문서가 아닌 값을 보내면 `400 invalid_input`이다. 아무것도 없으면 새 항목은 빈 본문이고, 패치는 지금 본문을 그대로 둔다.
  읽은 `doc`을 그대로 되돌려 보내면 아무것도 바뀌지 않는다. `GET /api/monti/v1/entries/:id?format=<이름>`은 `working`과 `published`(번역이면 원문도)에 `body`(문자열)를 더한다. 그 형식으로 쓴 글이며, 다시 가져올 수 있게 쓴다. `GET /api/monti/v1/meta`는 크기 한도를 `limits.textBytes`(어떤 형식이든 글)와 `limits.docBytes`로, 인스턴스의 형식을 `formats`(`{ name, label, mimeType, extension, canImport }`)로 알려 준다. 관리자 편집기는 늘 `doc`을 보낸다.
- **템플릿 API와 템플릿.** 본문 템플릿은 항목 본문처럼 문서다. `body_templates.doc`이 유일한 원본이고 `mdx` 열은 없다. `POST /api/monti/v1/templates`와 `PATCH /api/monti/v1/templates/:id`는 `{ name, doc }` 또는 `{ name, body, format }`을 받고(둘 다 없으면 빈 템플릿이고, 패치는 본문을 그대로 둔다) `doc`을 돌려주며 `mdx`는 주지 않는다. `GET`의 `?format=<이름>`은 템플릿마다 `body`를 더한다. 형식이 거절한 글은 형식의 발견 사항과 함께 `422 format_import_failed`다. 템플릿에는 항목 초안과 달리 문서가 아닌 글을 담아 둘 자리가 없기 때문이다.
  관리자 템플릿 관리 화면과 편집기의 템플릿 메뉴는 문서로 일한다. 템플릿을 적용하면 그 문서를 새 블록 ID로 항목에 복사한다. 시드 템플릿(사이트 설정의 `seed.templates`)은 `{ id, name, doc }` 또는 `{ id, name, body, format }`이다. 글은 새 저장소를 처음 채우는 마이그레이션이 그 형식으로 읽고, 설치된 어떤 플러그인도 읽지 못하는 시드는 그 형식을 알리는 메시지와 함께 마이그레이션을 멈춘다(`mdx`라면 `@monti-cms/mdx`를 설치한다). 이미 데이터가 있는 저장소는 이 때문에 멈추지 않는다.
- **관리자 내보내기**(`GET` 또는 `POST /api/monti/v1/export`)는 형식 버전 6이다. 백업(`scope=admin`)에는 복원에 필요한 값도 들어 있다(manifest의 글마다 `trashedAt`·`changedBy`·`changedAt`, `media.json`의 기록마다 `folderId`·`original`·`defaultAlt`·`defaultCaption`). 보관 파일은 문서를 담는다. 본문마다 `working.doc.json`·`published.doc.json`, `doc`이 있는 `templates.json` 항목, `doc`이 있는 공개 내보내기의 `published.json`이며, 다이제스트가 이를 포함한다. MDX는 따로 없다. `format=<이름>`(쿼리, 또는 `POST` 본문의 `format`)을 주면 본문마다 `working.<확장자>`·`published.<확장자>`로, 템플릿은 `body`로 그 형식의 글도 쓰고 `manifest.format`이 그 형식을 알려 준다. 관리자 보관 파일의 글은 다시 가져올 수 있게 쓴다(풀 수 없는 항목 링크는 id를 유지한다). 공개 보관 파일의 글은 읽는 사람을 위한 것이다(공개된 항목만 담고, 공개되지 않은 대상은 링크가 아니다). 모르는 형식은 `400 unknown_format`이다.
  `ids`(쿼리에서는 쉼표 목록, `POST` 본문에서는 배열)는 내보내기를 그 글들로 제한하며, 항상 번역 묶음 전체로 넓혀진다. 이때 보관 파일에는 그 글이 속한 폴더(상위 폴더 포함), 그 글의 주소, 본문이 참조하는 미디어 기록(`references.json` 기준)만 담기고 템플릿과 환경설정은 없다. `scope=public`이면 선택한 글 중 발행된 것만 담긴다. 이런 보관 파일의 `manifest.selection`은 `{ ids }`, 사이트 전체면 `null`이다. 형식이 쓰지 못하는 본문이 있어도 내보내기는 중단되지 않는다. 그 본문의 JSON 문서는 남고 글 파일만 빠지며, `manifest.notWritten`에 `{ id, state, reason }`이 기록되고(모두 썼으면 빈 목록) 응답 헤더 `X-Monti-Export-Not-Written`에 개수가 담긴다. 파일 이름은 `monti-export-<scope>-<timestamp>.zip`이고 헤더는 `X-Monti-Export-Digest`, `-Scope`, `-Files`, `-Not-Written`이다.
  `GET` 또는 `POST /api/monti/v1/export/summary`(관리자 전용)는 같은 `scope`, `ids`, `format`을 받아 보관 파일에 담길 개수를 돌려준다. `entries`, `addedByTranslations`(번역 묶음 확장으로 더해진 글), `notPublished`(공개용에서 빠지는 글), `notFound`(어떤 글과도 맞지 않는 id), `templates`, `folders`, `addresses`, `media`다. 미디어 파일은 보관 파일에 담기지 않고 기록만 담긴다.
- **글 가져오기**(`POST /api/monti/v1/import/entries`, 관리자 전용. 설정 > 데이터 > 글 가져오기)는 이미 있는 사이트에 일반 쓰기 흐름을 거쳐 **새** 글로 가져온다. 올리는 파일은 최대 50 MB인 `multipart/form-data` zip이다(`/v1/meta`의 `limits.importBytes`. 더 크면 `413 payload_too_large`). 이 요청은 `admin-upload` 경로다(다른 관리자 경로와 같은 같은 출처·관리자 확인을 거치고 multipart 본문을 받는다). zip은 두 가지 중 하나다. **이 버전의 내보내기**(`manifest.json`과 `entries/<collection>/<id>/…`이며 위의 구조대로 읽는다. 글마다 `published` 사본이 있으면 그것을, 없으면 `working` 사본을 읽는다), 또는 front matter에 `title`과 `slug`가 있는 **`.md` / `.mdx` 파일 묶음**(slug가 없으면 파일 이름을 쓰고, `locale`은 없어도 된다. 한 폴더에서 slug가 같은 파일은 한 글의 여러 언어다)이다. 글 파일이 들어 있는 폴더가 그 컬렉션이다. 글 파일은 읽을 수 있는 형식이 설치돼 있어야 한다(`.mdx`는 `@monti-cms/mdx`. `.md`는 확장자가 `md`인 형식이 있으면 그것을, 없으면 MDX 형식을 쓴다). 없으면 `400 invalid_input`으로 거절한다.
  가져오는 것은 **문서 컬렉션 글의 제목, slug, 본문**뿐이다. 항목 컬렉션(카테고리·태그·시리즈)은 이유와 함께 건너뛰고, 그 밖의 값과 폴더·템플릿·주소·환경설정·미디어 기록은 가져오지 않으며 컬렉션마다 목록으로 알려 준다("가져오지 않는 필드". 가져온 글에서 비어 있는 대상 컬렉션의 필수 필드도 함께). 본문은 내보내기의 글 파일 확장자가 설치된 형식의 것이면 그 글에서 가져오고(경로로 쓴 링크는 쓸 때 이 사이트의 글로 풀린다), 아니면 `<state>.doc.json`에서 가져오는데 이때 id로 된 링크는 보관 파일의 id에서 새 글의 id로 바꾼다(가져오지 않는 글을 가리키는 링크는 그대로 두고 알린다). 웹 주소가 있는 이미지는 쓴 그대로 두고, 이 사이트에 없는 미디어 파일을 가리키던 이미지는 본문에서 뺀다. 둘 다 "내 미디어 밖의 이미지"로 센다. 보관 파일의 컬렉션은 `mapping`이 달리 정하지 않으면 이름이 같은 컬렉션으로 간다. 그 컬렉션과 언어에서 이미 쓰는 slug는 글을 건너뛰고(`slug_exists`) 덮어쓰지 않는다. 번역 묶음은 유지한다. 기본 언어의 원문을 먼저 만들고 거기서 번역을 만들며, 원문을 건너뛰었으면 번역도 건너뛴다.
  폼 필드는 `file`, `mode`(`preview` 또는 `run`), `mapping`(JSON. 보관 파일의 컬렉션 → 이 사이트의 컬렉션 또는 `null`), `publish`(`true`)다. `mode=preview`는 아무것도 쓰지 않고 컬렉션과 가는 곳, 글마다 제목·slug·언어·가는 곳·`body`(`{ kind: "text", format }` 또는 `{ kind: "json" }`)·건너뛴 이유·참고, `fieldsNotImported`, `counts`(`imported`, `skipped`, `conflicts`, `publishable`, `outsideImages`, `keptLinks`, `otherFiles`)를 답한다. `mode=run`은 글로 가는 링크가 그 글이 생겨야 풀리므로 세 단계로 한다. 초안을 모두 만들고, 본문을 모두 저장하고, (`publish`면) 보관 파일에서 발행돼 있던 글을 발행한다. 전부 아니면 전무가 아니다. 글마다 `create`·`body`·`publish` 단계(`done`, `skipped`, `failed`. 이유는 `code`와 `text`를 가진 `reason`)와 새 `id`, `warnings`, 그리고 `outcome`(`imported`, 뒤 단계가 실패해 초안이 남으면 `draft`, `skipped`, `failed`)을 답한다.
- **백업 복원**(`POST /api/monti/v1/import/restore`, 관리자 전용. 설정 > 데이터 > 백업 복원)은 **전체 관리자 백업**(`scope=admin`이고 선택이 없는 이 버전의 내보내기)을 **빈** 사이트에 있던 그대로 되돌린다. 글 가져오기와 같은 크기 제한(`limits.importBytes`)을 쓰는 `admin-upload` 경로다. `GET /api/monti/v1/import/restore`는 `{ empty, entries, folders, media }`를 돌려줘서, 관리자 화면이 파일을 고르기 전에 카드를 끌 수 있다. 글, 폴더, 미디어 기록이 하나도 없으면 빈 사이트다(기본으로 심어 둔 템플릿은 있어도 된다). 비어 있지 않으면 실행은 `409 conflict`이고, 일부만 고른 보관 파일이나 공개 보관 파일은 글 가져오기를 안내하는 메시지와 함께 거절한다(`400 invalid_input`).
  있던 그대로 돌아오는 것: 글의 id, 버전, 상태(초안·발행·보관·휴지통), 만든·고친·발행·휴지통에 넣은 시각, 마지막으로 고친 사람, 언어, 번역 묶음과 번역 상태, 작업본과 발행본의 본문·메타데이터, 참조. 모든 주소(현재·이전·예약 주소이므로 옛 URL이 계속 이어진다). id와 트리가 그대로인 폴더. id, 저장 키, 대체 텍스트, 캡션, 폴더가 그대로인 미디어 기록. 보관 파일의 템플릿은 id를 지켜 더하고, 사이트에 심어 둔 템플릿은 그대로 둔다. id나 이름(대소문자 무시)이 이미 있는 템플릿은 건너뛰고 이유와 함께 알려 준다. 돌아오지 않는 것도 응답에 적는다. 관리자 환경설정(사용자에게 속한 것이고 백업에는 사용자가 없다), 계정, API 키, AI 연결, 이벤트 기록, 플러그인이 따로 보관하는 데이터다. 미디어 파일은 백업에 없고 기록만 있다. 사이트에 저장소가 있으면 파일이 없는 미디어를 경고로 알리고(거절하지는 않는다), 저장소가 없으면 파일을 확인하지 않았다고 알린다.
  폼 필드는 `file`과 `mode`(`preview` 또는 `run`)다. 쓰기 전에 백업 전체를 현재 스키마에 맞춰 확인한다. 모든 본문은 저장과 같은 검사(`prepareSnapshot`)를, 발행된 글의 발행본은 발행과 같은 검사(`validateForPublish`)를 거치며, 대상·미디어·주소는 보관 파일 안의 것을 기준으로 본다. 컬렉션, 언어, 폴더, 미디어 기록, 번역의 원문, 참조 대상이 모두 있어야 한다. 문제가 하나라도 있으면 복원을 거절하고, 일부만 복원하지 않으며, 문제를 글마다 알려 준다. 플러그인의 `beforeSave`·`beforePublish` 구독자는 실행하지 않는다. `mode=preview`는 아무것도 쓰지 않고 `ready`, `isBackup`, `empty`, `counts`(상태별 글 수, `translations`, `folders`, `media`, `addresses`, `aliases`, `templatesAdded`, `templatesSkipped`), `problems`, `warnings`, `notRestored`를 돌려준다. `mode=run`은 모든 것을 한 번의 데이터베이스 트랜잭션으로 쓰고(`store.restoreArchive`. 검색용 텍스트와 참조 색인도 채우며, 테이블 잠금 아래에서 사이트가 비어 있는지 한 번 더 확인한다), 전부 쓰거나 전혀 쓰지 않는다. 응답은 개수, 경고, `notRestored`다. 복원은 **콘텐츠 이벤트를 남기지 않으므로**, 글 이벤트를 구독하는 플러그인에는 알리지 않는다.
- **공개 읽기 API와 공개 내보내기**는 문서를 돌려준다. `cms.read.getEntry` / `listEntries` / `getPreview`는 `entry.doc`(저장된 문서. 목록에서는 `body: true`일 때만, 아니면 `null`)과 `entry.refs`
  (`{ media: { [mediaId]: { url, width?, height?, file? } | { failure } }, links: { [entryId]: { path, title, locale } } }`: 그 문서의 이미지, 파일, 내부 링크를 그리는 데 필요한 값. 문서가 쓰는 것만 들어 있고, `collectRefs(doc)`가 id 목록을 준다)를 담는다.
  문서의 링크는 `{ entryId }`(내부) 또는 `{ href, title? }`(외부)다. `entryId`는 번역 그룹 id(원문 항목의 id. 관계 필드가 담는 id와 같다)라서, `refs.links`는 읽는 사람의 언어로 된 주소와 제목을 주고 번역이 없으면 원문 것을 준다.
  가리키는 글이 공개되지 않았으면 `refs.links`에 없고 링크는 일반 글자로 그려진다. 주소(slug)를 바꿔도 저장된 문서는 그대로다. 링크는 관계 필드처럼 참조다. 항목의 참조에 블록 단위로 기록되고, 없는 항목(또는 아무도 쓰지 않는 주소)을 가리키는 링크는 발행을 막는다(`unresolved_internal_link`). 공개되지 않았거나 휴지통에 있는 항목을 가리키는 링크는 경고만 한다(`unpublished_internal_link`). 가리키는 글이 공개될 때까지 페이지는 그 링크를 일반 글자로 그리므로, 서로 링크한 글은 어떤 순서로 발행해도 된다.
  글 주소로 쓴 링크(`[x](/posts/slug)`. 어떤 형식이든 문서든)는 그 주소를 가진 항목이 있으면 쓸 때 id 링크로 바뀐다. 주소를 가진 항목이 없으면 쓴 그대로 남고 발행을 막는다.
  `entry.mdx`는 없다. `format: "mdx"`를 넘기고 `entry.body`(`{ format, text }`, "형식" 절)를 읽는다. `GET /api/monti/v1/public/entries/:collection/:slug`는 `doc`과 `refs`를 돌려주고, `?format=<이름>`이면 `body: { format, text }`도 준다(모르는 형식은 `400 invalid_input`). 목록에는 없다.
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

플러그인은 서버 모듈로 형식을 준다. `defineServerPlugin({ formats: ({ cms, plugin }) => hugo })`이고, 플러그인 문맥을 받아 형식 하나 또는 그 목록을 돌려주는 함수다(플러그인 옵션에 따라 달라지는 형식은 `cms.site.pluginOptions(...)`로 옵션을 읽는다). 같은 이름이 두 번 나오면 인스턴스가 플러그인을 불러올 때 실패한다. `cms.formats()`가 한 인스턴스의 목록이고, `GET /api/monti/v1/meta`가 이를 `formats`로 알려 준다.

**문서 모델.** 노드는 `paragraph`, `heading`(`attrs.level`), `bulletList`와 `orderedList`(각각 블록을 담은 `listItem` 노드를 가진다), `blockquote`, `codeBlock`, `image`, `table`, `horizontalRule`, `hardBreak`, `text`다. 텍스트 노드에는 `marks`(`bold`, `italic`, `code`, `attrs.href`가 있는 `link` 등)가 붙는다. 플러그인의 블록은 블록 이름을 딴 노드이고, 블록의 속성은 `attrs`에 들어간다(`{ type: "notice", attrs: { level: "warn" }, content: [...] }`). `emptyStoredDocument()`(`@monti-cms/core/document`)가 `content`를 채워 넣을 문서이고, 그 텍스트는 `toPlainText(site, doc)`나 `documentText(site, doc, options)`(`@monti-cms/core/site`)가 준다. 양방향을 모두 갖춘 형식은 [커스텀 형식 레시피](../../docs/recipes/custom-format.md)에 있다.

**형식이 받는 것.** 두 방향 모두 `ctx.locale`, `ctx.blocks`(사이트의 본문 블록), `ctx.codeLineEffects`를 받는다. `export`는 `ctx.purpose`(`"read"`: 읽는 쪽이 글을 쓰므로 데이터베이스 밖에서도 통하는 주소가 필요하다. `"sync"`: 다시 가져올 글이므로 양방향 형식은 돌려받는 데 필요한 것을 유지한다), `ctx.link(entryId)`(링크가 가리키는 항목의 지금 주소 `{ url, title, locale }`, 없으면 `null`), `ctx.media(mediaId)`(`{ url, width?, height?, filename, mimeType, byteSize }` 또는 `null`), 문서가 말하는 대로 쓰지 못한 것을 알리는 `ctx.report(issue)`도 받는다. 코어가 `export`를 부르기 전에 문서의 모든 링크와 미디어를 풀어 두므로, 이 조회는 모두 동기식이다.
`import`는 글이 말하는 문서를 돌려준다. 블록 ID나 문서 버전은 신경 쓰지 않는다. 코어가 모든 블록에 ID를 달고(글이 바꾸는 본문과 짝지어서, 바뀌지 않은 블록은 ID를 유지한다) 문서를 정해진 모양으로 맞춘다. 경고는 `blockIndex`로 돌려준 문서의 블록을 가리킬 수 있고, 코어가 그것을 블록 ID로 바꾼다.

**코어가 모든 형식에 해 주는 것.**
- *내보내기:* 내부 링크는 **가리키는 항목의 실제 경로**(`ctx.link(entryId)`. MDX라면 `[x](/en/posts/slug)`)로 쓰고 `entry:<id>`로는 쓰지 않는다. 그래서 파일이 Astro·Hugo·git 동기화에서 통하고, 대상의 slug가 바뀌면 경로가 따라간다(문서는 바뀌지 않는다). 대상이 없거나 공개되지 않은 링크는 읽는 사람을 위한 글(`read`)에서는 빠지고(글자는 남는다), 다시 가져올 글(`sync`)에서는 id를 유지한다(MDX는 `entry:<id>`). 등록된 이미지는 `read`에서는 공개 URL이고 `sync`에서는 `mediaId`를 유지한다.
- *가져오기:* 이 사이트 콘텐츠의 주소로 쓴 링크(`/posts/slug`. 언어 접두사가 있어도 없어도)는 그 주소를 가진 항목이 있으면 항목 id 링크가 되고, `src`가 등록된 미디어 파일의 공개 URL인 이미지는 그 파일(`mediaId`)이 된다. 아무도 갖지 않은 것은 쓴 그대로 남는다(아무도 쓰지 않는 주소는 발행할 때 `unresolved_internal_link`로 알려 준다). 형식이 내보낸 글을 가져오면 같은 id로 돌아온다.
- *검사와 저장*은 코어의 일이다. 형식이 돌려준 문서는 바로 보낸 문서처럼 검사하고 저장한다(`prepareSnapshot`, `before…` 구독자, 내용 해시, 참조). 그래서 형식은 코어 규칙을 넘어갈 수 없다. 형식이 거절한 글(`ok: false`)도 사라지지 않는다. 초안은 그 글을 `unparsed` 문서(`{ "type": "unparsed", "attrs": { "format", "source" } }`)로 두고 형식이 발견한 것을 문제로 알려 주며, 고칠 때까지 발행은 막힌다("저장된 본문" 절).

**`format` 옵션.**

| 어디 | 어떻게 |
| --- | --- |
| `cms.read.getEntry`·`listEntries`(`body: true`일 때)·`getPreview` | `format: "mdx"`가 `entry.body = { format, text }`를 더한다. 링크는 읽는 사람이 보는 경로(공개되지 않은 대상은 링크가 아니다)이고 이미지는 공개 URL이다. 모르는 형식은 `unknown_format` 코드의 `ServiceError`를 던진다 |
| `GET /api/monti/v1/public/entries/:collection/:slug` | `?format=mdx`가 `body: { format, text }`를 더한다 |
| `POST /api/monti/v1/entries`·`PATCH /api/monti/v1/entries/:id`·`cms.contentService()`(만들기·저장·일괄) | 본문은 `{ doc }` 또는 `{ body, format }`이고 둘을 함께 보낼 수 없다 |
| `GET /api/monti/v1/entries/:id` | `?format=mdx`가 `working.body`와 `published.body`(문자열)를 더한다 |
| `/api/monti/v1/templates` | `{ name, doc }` 또는 `{ name, body, format }`. `GET`의 `?format=`은 `body`를 더한다 |
| `GET` 또는 `POST /api/monti/v1/export` | `format=mdx`는 본문을 그 형식의 파일로도 쓴다. `ids`는 그 글과 번역으로 제한한다 |
| `POST /api/monti/v1/import/entries` | 내보내기의 글 파일을 설치된 형식으로 읽고(경로로 쓴 링크는 쓸 때 풀린다), `.md` / `.mdx` 파일은 확장자로 읽는다 |

| 오류 코드 | 상태 | 언제 |
| --- | --- | --- |
| `unknown_format` | 400(공개 API: `invalid_input`) | 그 형식을 주는 플러그인이 없다 |
| `format_not_importable` | 400 | 쓰기만 되는 형식으로 쓰려 했다 |
| `format_import_failed` | 422 | 형식이 예외를 던졌거나 문서가 아닌 것을 돌려줬다(그 메시지는 로그에만 남는다). 또는 템플릿의 글이 거절됐다(`issues`가 글 안의 위치를 담는다) |
| `format_export_failed` | 500(공개 API: 503 `unavailable`) | 형식이 예외를 던졌다 |
| `body_too_large` | 413 | `limits.textBytes`(2 MiB)를 넘는 글, 또는 `limits.docBytes`(8 MiB)를 넘는 문서 |



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
  `{ code, message?, params? }[]`(또는 그것의 프로미스)를 돌려준다. 결과는 **경고**이며 막지 않는다. 각 경고는 `position.blockId`에 그 블록의 id를, `params.block`에 블록 이름을 담고, 저장·발행 응답에서 글 옆의 `warnings`로 돌아오며, 편집기는 그 블록 아래에 보여 준다. 검사가 예외를 던지면 `block_validate_failed` 경고가 되고 쓰기는 계속된다.
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
- 공개 화면의 코드 펜스 블록은 `renderDocument`/`CmsContent`가 문서에서 바로 그린다. 블록에 등록된 컴포넌트(플러그인 `render` 모듈의 `defineRender` 표나 사이트의 `components`)를 쓰므로 렌더 체인에 따로 넣을 것이 없다.
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
			editor: { background: "bg-monti-primary/10" }, // 편집기 표시(관리자 색은 `monti-*`, 어두운 테마는 `monti-dark:`): background·wavy(물결 밑줄 색)·marker({ text, className })
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

본문마다 글쓴이가 더할 수 있는 블록과 마크를 제한할 수 있다. 컬렉션의 `body`를 객체로 쓴다. `monti.schema.ts`에도, 코드의 `defineCollection`에도 같은 모양이다.

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

const result = await cms.read.getEntry({ collection: "post", slug, locale }); // { status: "found" | "redirect" | "not_found", entry }
if (result.status !== "found") return; // "redirect": result.path로 308 이동시킨다
const { entry } = result; // 문서와 refs
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
  모르는 컨테이너는 안의 내용을 보이고 모르는 리프는 아무것도 그리지 않는다. 개발 중에는 기본 fallback이 숨겨진 `<span data-monti-unknown>`을 남긴다. `strict: true`면 대신 던진다(테스트, 미리보기 화면).
  저장된 문서가 아닌 값은 빈 본문으로 그리고 로그를 남긴다.
- **컴포넌트**는 층층이 합쳐진다: 코어 기본값, 블록 확장의 컴포넌트(플러그인 `render` 모듈의 기본 내보내기. `@monti-cms/core/render`의 `defineRender({ blocks, marks, codeTags })`), 사이트의 `components` 순이다. 노드마다 속성 타입이 하나씩 있고
  (`ParagraphProps`, `id`가 있는 `HeadingProps`, `ListProps`, `CodeBlockProps`, 해석된 `src`가 있는 `ImageProps`, `FileProps`, `TableProps`·`TableRowProps`·`TableCellProps`, `MathProps`,
  `FootnoteRefProps`·`FootnotesProps`, `HardBreakProps`), 코어 마크(`link`, `bold`, `italic` …)마다 하나, 코드 블록 안 요소용 `codeTags`(`fold`, `collapse`, `Tooltip`)가 있다.
  모든 컴포넌트는 `ctx`(`locale`과 고정 문구 `labels`; 순수 JSON이라 클라이언트 컴포넌트로 넘길 수 있다)도 받고, 블록 컴포넌트는 `blockId`, `node`, `items`도 받는다.
- **블록은 블록 이름으로 등록하고 속성은 평평한 props로 받는다.** props 타입은 사이트 설정에서 나온다: `blocks: { callout: ({ variant, title, children }) => … }`,
  `marks: { tooltip: ({ content, children }) => … }`. `components`의 타입(`DocumentComponentsOf<typeof cms>`, 또는 `DocumentComponentsFor<typeof config>`)은 `monti.config.ts`의 `blocks`와 플러그인의 `blocks`로 만들어진다
  (`defineBlock`이 속성을 리터럴로 보존하므로 `variant`는 `"note" | "tip" | …`이다). 불리언 속성은 늘 불리언이고, 기본값이 있는 값과 필수 문자열은 늘 있으며,
  선택지에 없는 값은 기본값으로 바뀐다. 코드 펜스 블록(`mermaid`, `chart`)은 코드를 `source`로 받는다.
- **렌더러는 하나.** 제목 앵커는 `github-slugger`를 따르고, 각주는 처음 참조한 순서로 번호가 붙고, 같은 Shiki 흐름이 코드(줄 효과, 글자 효과, 줄 이름표)를 그리며,
  블록 수식은 KaTeX `htmlAndMathml`이다. 표는 표 컴포넌트가 그리고(스크롤 래퍼와 `monti-table-*` 클래스), 블록 KaTeX 출력은 `<div class="monti-math">` 안에 들어가며, 이미지는 `refs`를 거친다.

## 플러그인

`monti.config.ts`의 `plugins`에 한 번 적는다(예: AI 플러그인 `@monti-cms/ai`의 `ai()`). 플러그인은 모두 인자 없이 동작하는 함수다(`mdx()`·`seo()`·`ai()`·`@monti-cms/blocks`의 블록마다 `callout()` 같은 함수·`gitSync()`). `targets` 없는 `gitSync()`는 플러그인만 등록하고, `targets`에 저장소를 적기 전에는 아무것도 동기화하지 않는다. `plugins`의 순서는 순서가 중요한 곳에서 그대로 쓰인다(훅은 그 순서로 돌고, 인라인 마크 `tooltip()`·`codeRef()`·`color()`가 겹칠 때는 그 순서로 저장된다).

```ts
import { definePlugin } from "@monti-cms/core";

export const myPlugin = () =>
	definePlugin({
		name: "my-plugin",
		options: {}, // JSON 값. 서버·브라우저가 함께 읽는다
		blocks: [], // 플러그인이 더하는 본문 블록(`defineBlock`, "본문 블록")
		nav: [{ path: "my", label: "내 화면", icon: "plug" }], // 관리자 사이드바의 페이지: <관리자 경로>/tools/my (`label`은 `(site) => 글`이어도 되며 관리자 언어를 따른다. `group: "writing"`이면 템플릿 옆 글쓰기 묶음에, 기본값 `"site"`이면 접혀 있는 사이트 관리 묶음에 놓인다)
		keySlots: [{ id: "key", service: "Acme", label: (site) => site.createTranslator(messages)("keyLabel") }], // 플러그인에 필요한 API 키("API 키 저장소")
		checkConfig: ({ collections }) => {}, // 사이트 설정을 만들 때 부른다
		// 서버 쪽은 한곳에: 서버에서만 읽는 자기 모듈. 기본 내보내기가 `defineServerPlugin({ ... })`이다.
		server: () => import("my-plugin/server"), // 경로·훅·형식·명령·migrate·keyUses·features
		admin: () => import("my-plugin/admin"), // `export default defineAdminPlugin({ pages, components, slots, Provider })`(@monti-cms/admin): 화면·블록 뷰·공급자
		render: () => import("my-plugin/render"), // `export default defineRender({ blocks: { name: Component } })`(@monti-cms/core/render): 플러그인 블록의 공개 컴포넌트("저장된 문서 그리기")
	});
```

부분은 읽는 쪽별로 묶여 있다. 두 쪽이 `options`·`blocks`·`nav`·`keySlots`·`validate`·`contributes`를 읽고, 서버가 `server`를, 관리자가 `admin`을, 공개 페이지가 `render`를 읽는다. 개념마다 자리가 하나다. 훅은 `server`에만, API 키 칸은 `keySlots`에만 둔다.

- 서버 쪽(`server`)은 브라우저 묶음에 들어가지 않게 패키지 `exports`의 `browser` 조건으로 빈 진입점을 준다.
- `server.formats`는 형식(문서를 써 내고 읽어 올 수 있는 표기, "형식" 절)을 더한다. `CmsFormat` 하나 또는 그 목록을 돌려주는 함수(`formats: () => myFormat`)이고, 인스턴스가 형식이 처음 필요할 때 부른다.
- `checkConfig`는 컬렉션·언어·블록 정의와 모든 플러그인(`plugins`)을 받아 찾은 문제(`{ path, code, message }`, `@monti-cms/core`의 `IssueList`·`pathOf`)를 돌려준다. `defineSite`가 설정의 다른 문제와 함께 하나의 `ConfigError`로 알린다. 역할을 쓰는 확장은 여기서 필드 종류를 확인한다.
- `admin`과 `render`는 모듈의 기본 내보내기로 타입이 정해진다. 다른 종류의 모듈(또는 이름 붙은 내보내기만 있는 모듈)을 넘기면 타입 검사에서 걸린다.
- `contributes`는 다른 플러그인에 더하는 것이고, 타입은 `PluginContributions`다: `ai`(AI 플러그인 `@monti-cms/ai`의 기능), `layout`(플러그인이 자기 필드를 놓는
  속성 패널 탭), `fieldSets`(스키마 화면이 내놓는 필드 묶음). `contributes: { ai: { actions: { … } } }`는 AI 플러그인이 있으면 그 기능을 더하고 없으면 쓰이지 않으므로,
  확장은 받는 플러그인을 몰라도 기능을 더할 수 있다(블록 확장의 다이어그램 만들기, SEO 확장의 검색 제목 추천). 자기만의 것을 받는 플러그인은 모듈 보강으로 키를 더하고
  (`declare module "@monti-cms/core" { interface PluginContributions { search?: SearchContribution } }`), 그것을 주는 플러그인은 그 타입으로 검사된다.
- 플러그인은 자기 `options`를 타입 있는 id로 사이트에서 읽는다: `export const MY_PLUGIN: PluginId<"my-plugin", MyOptions> = { name: "my-plugin" }`를 한 번 두면
  `site.pluginOptions(MY_PLUGIN)`이 `MyOptions | undefined`다.
- 서버 쪽 `routes`는 본체 경로(`/api/monti/v1/*`)에 없는 주소를 받는다. 본체 경로와 같은 표(`{ pattern, module, access? }`)이고, 라우터가 핸들러보다 먼저 같은 출처 검사와 관리자 로그인 확인을 한다.
  인증을 빠뜨려도 열린 경로가 되지 않는다. 로그인 없이 받아야 하는 경로만 기본값 `admin` 대신 다른 `access` 종류(GET 전용 `public-read`, 브라우저 폼 `same-origin-form`, 토큰을 쓰는 크론 `admin-or-bearer`, 웹훅 `signed`)를 쓰고, 라우터가 그 종류의 검사를 적용한다. 검사를 핸들러에 맡기는 것은 `signed`뿐이다(`publicRoute(...)` 핸들러). 핸들러는 `adminRoute(async ({ request, params, auth, cms }) => …)`이고, 그 입력 객체가 핸들러의 유일한 시그니처이고, 테스트는 `@monti-cms/core/testing`의 `callRoute(handler, { request, cms, params })`로 부른다.
  `migrate`는 `monti db:migrate`가 본체 표 다음에 부른다.
- 같은 출처 검사는 `Host`·`site.url`의 호스트를 받고, `X-Forwarded-Host`의 첫 값은 호스트를 신뢰할 때만 받는다("호스트 신뢰"). `Host`를 바꾸는 프록시 뒤라면 `site.url`을 적거나 호스트를 신뢰한다.
- **반응**(쓰기 전에 돌아 바꾸거나 막을 수 있는 `entry.beforeValidate`·`beforeSave`·`beforePublish`, 커밋 뒤의 내구성 `entry` 이벤트, `keySlot.changed`)은 플러그인 서버 모듈의 `on`이고, 서버 설정의 `on`과 모양이 같으며 서버 설정의 것 다음에 플러그인 순서대로 돈다. "이벤트(`on`)"를 본다. 서버 모듈은 한 가지로만 쓴다. `server: () => import("./server")`이고 기본 내보내기가 `ServerPlugin`이다(`export default defineServerPlugin({ routes, on, ... })`, `@monti-cms/core/server`에서 가져오며 타입만 확인한다). 처음 필요할 때 서버에서만 읽는다. 구독자가 둘뿐이어도 인라인 꼴은 없다. 플러그인 팩토리는 사이트 설정이 import하는 모듈에 있고, 플러그인 목록으로 사이트를 만드는 클라이언트 코드는 그 모듈을 번들에 넣으므로, 거기 쓴 것은 브라우저에 닿을 수 있다. 반응만 하는 플러그인도 `options`는 필요 없다: `definePlugin({ name: "audit", server: () => import("./server") })`.
- 내구성 구독자의 `run(event, { cms, plugin })`은 인스턴스와 플러그인 문맥을 받는다. 그래서 자기 저장소·스토어·형식이 필요한 구독자가 따로 상태를 두지 않아도 된다. 전달은 아웃박스에서 하며(재시도, 최소 한 번, "이벤트 전달") `event.once(run)`은 이벤트마다 일을 한 번만 돌린다.
- 서버 쪽 `commands`는 명령줄 명령을 더한다. `monti <플러그인 이름>:<명령> [옵션]`이 `monti db:migrate`처럼 앱을 불러오고(`--env-file`, `--no-env-file`, `--config`) `command.run({ cms, plugin, args, log, error })`를 돌려 그것이 돌려주는 코드로 끝난다. 명령은 `options`(`{ 이름: { type: "string" | "boolean", description } }`)를 선언하고, `--help`가 그것을 나열한다. `monti git-sync:pull`이 그중 하나다.
- 직접 만든 관리자 컴포넌트도 플러그인이다. `admin` 모듈을 주고 그 default export에서 `defineAdminPlugin({ components })`(`@monti-cms/admin`)로 컴포넌트를 선언하면 관리자가 그것을 적용한다. `admin-components.tsx` 파일은 더 이상 없다. `examples/blog/plugins/word-list/`가 예시다:

  ```ts
  export const wordList = () => definePlugin({ name: "word-list", admin: () => import("./admin") });
  // ./admin.tsx ("use client"): export default defineAdminPlugin({ components: { textCheckers: [wordListChecker] } })
  ```

- `@monti-cms/core/server`의 `exportBodyText(cms, { format, doc, locale, scope? })`는 저장된 문서를 인스턴스의 형식으로 다시 가져올 수 있게(`purpose: "sync"`, 링크는 대상의 실제 경로) 텍스트로 쓴다. 관리자 내보내기와 같다. 본문을 다른 곳에 두는 플러그인을 위한 것이다.
- 플러그인의 라우트·`on` 구독자·명령과 그 밖의 서버 콜백은 **스코프**를 받는다. 자신을 맡은 인스턴스(`cms`: `cms.store()`·`cms.mediaStore()`·`cms.site`)와 플러그인 자기 문맥(`plugin`: `plugin.storage`·`plugin.secrets`·`plugin.key(id)`·`plugin.once`)이다. 그래서 플러그인 코드는 자기 이름을 적지 않고 전역 상태도 두지 않는다. 라우트 핸들러는 `{ request, params, auth, cms, plugin }`을, `on` 구독자는 자기 인자 다음에 `{ cms, plugin }`을, `migrate`·`features`는 `{ cms, plugin }`을, `keyUses`는 `(refs, { cms, plugin })`을 받고, 명령의 문맥에는 인자와 함께 `cms`와 `plugin`이 있다. 다른 코드는 `cms.plugin("<플러그인 이름>")`으로 플러그인 문맥을 얻는다. `adminRoute`·`publicRoute` 등 라우트 틀은 `@monti-cms/core/server`에 있다.
- `cms.plugin("my-plugin")`은 플러그인이 인스턴스 하나에 대해 갖는 것이다. `storage`, `secrets`, `apiKeys`, 그리고 `once(key, factory)`: 값(`cms.site`로 만든 스토어나 클라이언트)을 한 번 만들고, 개발 중 스키마를 다시 불러오면 처음부터 다시 만든다. 그래서 낡은 사이트를 쥐고 있지 않는다. 이런 객체를 인스턴스를 키로 하는 모듈 수준 `WeakMap`에 두지 않는다.
- 모든 플러그인 패키지가 쓰는 작은 도구 가운데 `pluginLog(이름)`·`pluginError(이름, 메시지)`(플러그인이 남기고 던지는 것의 접두어를 하나로)는 `@monti-cms/core/server`에서, 나머지는 `@monti-cms/core`에서 온다. `emptyServerPlugin`(패키지 `server.browser.ts`의 기본 내보내기), `envValue(env, 이름)`·`WHERE_TO_SET_ENV`(환경 변수를 읽고 어디에 두는지 알려 줌), `resolveTextCheckerLimits`(글 검사기의 한도).

### 플러그인을 패키지로 배포하기

사이트 폴더 안에 있는 플러그인은 더 할 일이 없다. 패키지로 배포하는 플러그인은 파일 하나와 export 조건 하나로 서버 쪽을 브라우저 번들 밖에 둔다.
플러그인 목록으로 사이트를 만드는 클라이언트 코드는 플러그인 팩토리를 번들에 넣고, 번들러는 브라우저가 부르지 않는 `server: () => import("my-plugin/server")`도
따라가기 때문이다.

```jsonc
// package.json
"exports": {
	".": "./src/index.ts",
	"./server": { "browser": "./src/server.browser.ts", "default": "./src/server.ts" }
}
```

```ts
// src/server.browser.ts
export { emptyServerPlugin as default } from "@monti-cms/core";
```

코어가 아닌 패키지가 `browser` 조건 없이 `./server`를 내보내면 패키지 빌드(`scripts/build-package.mjs`)가 멈춘다.

### 비밀 값

비밀 값은 하나, `MONTI_SECRET`(또는 `defineConfig({ secret })`)이다. `AUTH_SECRET`과 `CMS_SECRET`을 대신하며 이 둘은 더 이상 읽지 않는다. 비밀 값 자체는 누구에게도 건네지 않고, HKDF-SHA256으로 만든 파생 키만 쓴다.

- 로그인 세션 서명 키: 로그인 연결이 받는 비밀 값(`AuthCreateContext.secrets`, 예약된 범위 `auth`)의 `deriveKey("session")`. `MONTI_SECRET`이 없으면 로그인은 `MONTI_SECRET`을 이름으로 알리는 오류로 실패한다.
- 플러그인마다의 암호화 키: `plugin.secrets`, 아래를 본다.

#### 플러그인 비밀 값

플러그인은 마스터 비밀 값을 받지 않는다. 인스턴스가 이 값에서 플러그인마다 키를 하나씩 만들고(HKDF-SHA256, info 문자열은 `monti:plugin:<플러그인 이름>:v1`), 그 키로만 동작하는 API를 플러그인에 건넨다.

```ts
const secrets = plugin.secrets;             // 플러그인의 라우트·훅·명령 안에서(그 밖에서는 `cms.plugin("my-plugin").secrets`)
secrets.available;                          // 비밀 값(MONTI_SECRET 또는 `secret`)이 없으면 false
const stored = secrets.encrypt("sk-live-1234");   // "mk1:<키 id>:<iv>:<tag>:<body>", AES-256-GCM, 텍스트 열에 그대로 저장해도 된다
secrets.decrypt(stored);                    // "sk-live-1234". 이 플러그인의 값이 아니거나, 모르는 secret으로 만들었거나, 깨졌으면 null
secrets.isCurrent(stored);                  // 이전 secret으로 만든 값이면 false: 풀어서 다시 암호화한다
secrets.deriveKey("signing");               // 다른 용도(HMAC, 해시)용 32바이트 키. 플러그인과 용도마다 다르다
```

- 플러그인끼리는 키가 서로 무관하므로, 한 플러그인이 다른 플러그인의 값을 풀 수 없고, 한 플러그인의 테이블에서 읽은 값으로는 마스터 비밀 값도 다른 플러그인의 데이터도 알 수 없다. 플러그인 코드는 여전히 같은 서버 프로세스에서 돌므로 이것은 플러그인이 저장하는 값을 서로 나누는 장치이지 샌드박스가 아니다.
- 값마다 만든 키의 id가 붙어 있어(`mk1:<키 id>` 접두어), `decrypt`는 모든 secret을 시도하지 않고 맞는 것을 바로 고른다.
- 교체: 새 값을 `MONTI_SECRET`(또는 `secret`)에, 옛 값들을 `previousSecrets`에 둔다(`previousSecrets: [process.env.OLD_MONTI_SECRET]`. 항목이 설정하지 않은 환경 변수여도 되고, 그런 항목은 무시한다). `decrypt`는 현재 secret을 먼저, 그다음 이전 secret들을 시도하고, `encrypt`는 항상 현재 secret을 쓴다. 플러그인은 `isCurrent`가 false인 값을 다시 저장할 때 새로 암호화한다. 그 secret으로 저장된 값을 모두 다시 암호화한 뒤에만 `previousSecrets`에서 뺀다.
- `cms.server`는 `secret`과 `previousSecrets`를 뺀 서버 설정이다.
- `MONTI_SECRET`을 바꾸면 로그인 세션 키도 바뀌어 모두 한 번 다시 로그인한다. `previousSecrets`는 저장된 값을 계속 읽게 할 뿐 옛 로그인 세션을 살려 주지는 않는다.

#### API 키 저장소

외부 서비스용 키(AI 제공자, 맞춤법 검사기, GitHub 토큰)는 플러그인마다 따로 두지 않고 `cms.apiKeys`에 한 번만 둔다. 키마다 이름이 있고, 예약된 저장소 범위 `core-keys`에 core 자신의 키로 암호화해서 저장하며, 관리자(도구 > API 키)에는 이름과 끝 네 글자만 보인다.

```ts
const key = await cms.apiKeys.add({ name: "Anthropic", value });          // 또는 addNamed({ baseName: "Anthropic", value }) -> 이름이 있으면 "Anthropic 2"
const id = await cms.apiKeys.choose(choice, { baseName: "Anthropic" });    // 폼이 보낸 값: { use: "saved", keyId } | { use: "new", value } | { use: "none" }
const value = await cms.apiKeys.read(id);                                  // 서버에서만. 키가 지워졌거나 풀 수 없으면 null
await cms.apiKeys.setUses("my-plugin", [{ ref: "item:42", keyId: id }]);   // 플러그인의 어느 항목이 키를 쓰는지, 전체를 통째로 바꾼다
await plugin.key("key").read();                                           // 플러그인이 선언한 슬롯(`keySlots`)에 정해진 키
await cms.apiKeys.findOrAdd({ baseName: "GitHub", value });                // 값이 같은 키, 없으면 새 키
await cms.transaction(async (tx) => { /* tx.apiKeys.choose(...)와 tx.storage("my-plugin") 쓰기: 모두 남거나 모두 사라진다 */ });
```

- 플러그인은 키의 **id**만 들고 있고 값은 서비스를 부를 때 `read`로 읽는다. 이름을 바꾸거나 값을 바꿔도 id는 같으므로 그 키를 쓰는 곳이 모두 따라간다.
- `setUses`는 관리자가 키를 어디서 쓰는지 아는 방법이다. 글자가 아니라 **참조**(`ref`, `connection:<id>` 같은 바뀌지 않는 값)를 받는다. 항목이 바뀔 때마다(연결 저장·삭제 등) 부른다. 관리자에 보이는 글자는 키를 읽을 때 `ServerPlugin`의 `keyUses(cms, refs)`가 만든다. `ref`마다 관리자 언어(`cms.site.createTranslator`)로, 항목의 지금 이름을 담은 라벨을 돌려주고, 더는 없는 항목은 `null`을 돌려주어 그 사용을 지운다. `keyUses`가 없는 플러그인은 플러그인 이름으로 보인다.
- **키 슬롯**: 정해진 키 하나가 필요한 플러그인(맞춤법 검사기 등)은 플러그인 정의에 `definePlugin({ keySlots: [{ id: "key", service: "Bareun", label: (site) => site.createTranslator(messages)("keyLabel") }] })`로 선언하고(`service`는 슬롯에 넣은 키가 저장되는 언어와 무관한 이름으로, `Bareun`, 있으면 `Bareun 2`이며 이전 작업도 같은 이름을 쓴다. `label`은 표시용이고 관리자 언어를 따르도록 site를 받는 함수로 쓴다), `plugin.key("key").read()`로 읽는다. 슬롯의 서버 모듈의 `on: { keySlot: { changed: [({ slot }, { cms, plugin }) => …] } }`는 플러그인의 슬롯에 키가 정해지거나 슬롯이 비워져 저장된 뒤에 한 번 불린다(토큰을 기다리던 동기화가 여기서 다시 시작한다. `slot`은 슬롯 id다). `cms.transaction` 안에서 한 변경에는 불리지 않는다. 도구 > API 키는 설치된 플러그인의 슬롯을 모두 보여 준다. 키가 정해졌으면 그 키의 "사용 중" 줄에 이름이 나오고, 비어 있으면 저장된 키를 고르거나 새 키를 넣는 줄(새 키는 지정과 같은 트랜잭션으로 저장)이 나오며, 정해진 슬롯은 키 줄 메뉴에서 뺄 수 있다. 관리자는 `PUT /v1/api-keys/slots`에 `{ plugin, slot, key }`(`key`는 `choose`가 받는 값, `{ use: "none" }`은 비운다)를 보낸다. 플러그인 페이지도 부를 수 있다. 설치되지 않은 플러그인의 슬롯은 보이지 않고 사용으로 세지도 않는다.
- **한 번에 저장**: `cms.transaction(work)`는 `work`를 데이터베이스 트랜잭션 하나로 돌린다(Postgres: 어느 플러그인 저장소와 키 저장소든 한 번의 `BEGIN`/`COMMIT`. 데이터베이스 어댑터의 `transaction` 포트). 안에서 `tx.apiKeys.choose(...)`로 키를 만들고 `tx.storage("my-plugin")`으로 그 키를 가리키는 항목을 쓰면, 저장이 실패해도 남는 키가 없다. 안에서 `once`는 쓸 수 없다.
- `cms.apiKeys.remove(id, { expectedVersion, force? })`는 키와 쓰이던 곳을 한 트랜잭션으로 지우고, 쓰는 곳이 있으면 `force`가 없는 한 `key_in_use`(`details.uses`)로 실패한다. `force`면 쓰던 곳은 키를 찾지 못해 멈춘다. 관리자 API(`DELETE /v1/api-keys/<id>?expectedVersion=&force=true`)는 이를 부르고 `204`로 답한다.
- 키 이름은 대소문자를 가리지 않고 유일하며, 저장소가 쓸 때 이를 지킨다. `cms.apiKeys.view()`가 `GET /v1/api-keys`와 `PUT /v1/api-keys/slots`의 답이다.
- 서버 `secret`이 없으면 저장할 수 없다(`secret_not_configured`). 더는 나열되지 않은 비밀 값으로 만든 키는 `readable: false`로 나온다.
- 경로: `GET/POST /v1/api-keys`, `PATCH/DELETE /v1/api-keys/<id>`. 어느 응답에도 값은 없다.

### 플러그인 저장소

플러그인은 자기 데이터(설정, 글마다의 동기화 상태, 캐시한 결과)를 자기 표나 데이터베이스 드라이버가 아니라 인스턴스의 플러그인 저장소에 둔다.
`plugin.storage`(플러그인 콜백 밖에서는 `cms.plugin("<플러그인 이름>").storage`)는 그 플러그인으로 범위가 정해진 저장소다. 이름 붙은 컬렉션에 문자열 키로 JSON 문서를 두고, 문서마다 버전이 있다.

```ts
const settings = plugin.storage.collection<{ endpoint: string }>("settings");
await settings.get("default");                                                       // { key, value, version, createdAt, updatedAt } 또는 null
const saved = await settings.set("default", { endpoint: "https://…" }, { expectedVersion: 0 });   // 0이면 만든다
await settings.set("default", { endpoint: "https://…/v2" }, { expectedVersion: saved.version }); // 바꾼다
await settings.list({ prefix: "team-" });                                            // 키 순서
await settings.delete("default", { expectedVersion: saved.version + 1 });
```

- 쓰기는 기대하는 버전을 적는다. 저장된 버전이 다르면 저장된 버전(없으면 0)을 담은 `CmsError`(코드 `conflict`)로 실패하므로, 두 편집자가 모르는 새 덮어쓰지 못하고 동시에 쓰는 둘 중 하나만 이긴다. 없는 문서를 지우면 `not_found`다.
- 플러그인과 컬렉션 이름은 소문자 낱말이다(`ai`, `action-overrides`). 값은 JSON이다. JSON으로 저장되고 파싱되어 돌아오므로 `Date`는 ISO 문자열이 되고 `undefined`는 거절된다(`invalid_input`).
- 마이그레이션 훅은 `ServerPlugin.migrate({ cms, plugin })`이고 `monti db:migrate`가 본체 표 다음에 부른다. `plugin.storage.once(이름, 단계)`는 `단계`를 한 번만 돌리고(`cms_migrations`에 `plugin:<플러그인>:<이름>`으로 남고, 동시에 불러도 한 번이며, 던지면 남지 않는다) 돌았는지를 돌려준다. `단계`는 `PluginMigration`을 받는다. 단계의 트랜잭션 안에서 쓰는 컬렉션이 들어 있다.
- Postgres 어댑터는 문서를 본체 표 `plugin_documents`에 둔다(본체 마이그레이션이 만든다). 다른 어댑터의 저장소도 똑같이 동작해야 한다. `src/plugin/__test__/storage-contract.ts`가 그 계약이고, Postgres와 `@monti-cms/core/testing`의 `createMemoryPluginStorage()`로 돌린다. `fakeCms`는 이를 기본으로 쓴다(`fakeCms({ storage })`로 바꾼다).
- 플러그인 API에는 데이터베이스 드라이버 타입이 없다. `PluginDatabase`·`cms.database()`·`withTransaction`은 없어졌고, `@monti-cms/core`와 `@monti-cms/core/server`는 `pg`의 어떤 것도 내보내지 않는다.

### 오류와 응답

서버가 돌려주는 모든 오류는 `{ "error": { "code", "message", "fix"?, "detail"?, "issues"?, "details"? } }` 한 모양이고, 상태 코드는 한 표(`ERROR_STATUS`, `ErrorCode` 타입과 함께 `@monti-cms/core/server`에서 내보냄)에서만 정해집니다. 라우트나 플러그인은 그 표의 코드로 `new CmsError(message, code, options?)`를 던지며, 다른 곳에서 상태를 정하지 않습니다.

응답은 사람이 읽을 글과 개발자가 읽을 글을 나눕니다. 관리자 라우트에서 `message`(무슨 일인지)와 `fix`(어떻게 하면 되는지)는 관리자 언어로 나갑니다. 둘은 오류의 `notice`(`{ what, fix? }`)에서 오고, 없으면 `cms.core.errors` 사전에 있는 코드의 글에서 옵니다. `CmsError`에 넘긴 `message`는 개발자용 글(영어, ID나 값을 담아도 됨)이고 `detail`로 나가며, 관리자 화면은 이것을 "자세히" 안에서만 보여 줍니다. 그러니 라이브러리나 다른 서비스가 쓴 글은 notice에 넣지 말고, 직접 만든 사전의 글을 넣으세요.

```ts
throw new CmsError("401 invalid x-api-key", "service_unavailable", {
  notice: { what: t("keyRefused"), fix: t("checkKey") },
});
```

`issues`는 콘텐츠에서 찾은 문제(거부된 쓰기)이고, `details`는 기계가 읽는 추가 정보(`conflict`일 때 서버가 가진 버전, `key_in_use`일 때 키를 쓰는 곳)입니다. 성공은 `ok(body)`이고, 삭제는 본문 없는 `204`(`deleted()`)로 답합니다.

이슈의 글도 서버가 씁니다. 관리자 라우트에서는 오류의 이슈 하나하나와 쓰기의 경고(`{ entry, warnings }`, 일괄 작업의 각 항목)마다 `text`(무엇이 잘못됐는지, 관리자 언어)와, 자리가 있으면 `where`(본문 글의 줄·칸이나 필드 경로)가 `code`, 그리고 편집기가 문제로 이동할 때 쓰는 위치(`path`, `position.line/column/blockId`)와 함께 갑니다. 관리자 화면은 `text`를 그대로 보여 줍니다. 글은 코드에 따라 `cms.core.issues` 사전에서 오고, 사전에 없는 코드는 이슈의 `message`를 그대로 보여 줍니다. 요청 값이 검사를 통과하지 못하면 라이브러리의 문장 대신 zod 이슈 코드(`invalid_type`, `too_big` 등)로 글을 고르므로, 이 코드 이름들은 이미 쓰이고 있습니다. 브라우저가 스스로 찾은 이슈에는 `@monti-cms/core/site`의 `issueText(site, issue)`가 같은 글을 줍니다.

## 서버 옵션

서버 옵션은 사이트 옵션과 함께 하나의 `defineConfig({ … })` 호출에 들어간다("CMS 인스턴스" 절). 서버에서만 읽힌다. 옵션을 주지 않으면 어댑터가 관례적인 환경 변수를 읽고, 명시한 옵션이 항상 이긴다.

| 항목 | 뜻 |
|---|---|
| `database` | 필수. 콘텐츠 저장소. `postgres()`는 `DATABASE_URL`과 `DATABASE_SCHEMA`를 읽고, `postgres({ connectionString, schema })`는 코드에서 정한다 |
| `auth` | 선택. 없으면 아무도 로그인할 수 없다. `next dev`에서는 개발 로그인으로 내 컴퓨터에서 관리자에 들어가고, 배포된 관리자는 로그인이 설정되지 않았다고 답한다(`monti doctor`는 개발에서 경고하고 프로덕션에서 실패한다). 관리자 로그인. `@monti-cms/auth`의 `auth({ providers: [github()], host?, devBypass?, basePath? })`. `github()`는 `AUTH_GITHUB_ID`·`AUTH_GITHUB_SECRET`·`MONTI_ADMIN_GITHUB_ID`(GitHub 숫자 ID 하나, 또는 쉼표로 구분한 여럿)를 읽고, `github({ clientId, clientSecret, admins })`는 코드에서 정한다. `basePath`는 로그인 API 경로(기본 `/api/monti/auth`, "로그인 경로")다. 세션 서명 키는 비밀 값에서 만든다("비밀 값"). `host`는 Next 통합 밖에서 쓰는 명시적 재정의다(`hostOf(cms).attachHost`가 붙인 호스트보다 우선한다). Next.js 앱에서는 적지 않는다. 개발 우회가 켜진 `next dev`에서는 GitHub 앱이 없어도 로그인을 시도할 때만 오류가 나고, 로그인이 필요한 서버에서는 로그인 연결을 만들 때 오류가 난다 |
| `secret` | 선택. 하나뿐인 비밀 값. 없으면 `MONTI_SECRET` 환경 변수. 로그인 세션과 플러그인이 암호화해 두는 값(AI 서비스 키, git-sync 토큰)이 이 값에서 만든 키를 받는다. 비밀 값 자체는 누구도 받지 않는다("비밀 값"). |
| `previousSecrets` | 선택. `secret`이 바뀌기 전의 값들(항목이 정의되지 않은 환경 변수 값이어도 된다). 이 값으로 암호화한 저장 값도 계속 읽히고, 다시 저장할 때 `secret`으로 새로 암호화된다. 그래서 `secret`을 바꿔도 저장된 키를 다시 넣지 않아도 된다. |
| `trustHost` | 선택. `Host`·`X-Forwarded-Host`를 믿을지("호스트 신뢰"). 기본값은 `AUTH_TRUST_HOST` 환경 변수, 없으면 알려진 프록시 플랫폼이 감지되거나 개발일 때 켬, 그 밖에는 끔 |
| `publicApi` | 선택. 공개 JSON API(`/api/monti/v1/public/entries`·`/entries/:collection/:slug`, 로그인 없이 공개본만, 캐시 안 함). `{ collections, filters?: { 질의이름: 관계필드 }, toJson?(entry, { body }) }` |
| `on` | 선택. 서버가 반응할 것: `entry.beforeValidate`·`beforeSave`·`beforePublish`(쓰기 전, 바꾸거나 막을 수 있다)와 커밋 뒤의 내구성 `entry` 이벤트(`published`·`changed` 등: 캐시 갱신·웹훅·검색 색인. 각각 `{ name, run }`이고 두 번째 인자로 스코프 `{ cms }`를 받으며, 실패하면 다시 시도하므로 반복되면 안 되는 일은 `event.once`로 감싼다). "이벤트(`on`)"와 "이벤트 전달"을 본다. 플러그인도 `on`을 둘 수 있다 |
| `events` | 선택. 내구성 `entry` 이벤트 전달을 다시 시도하고 보관하는 방식: `{ maxAttempts?, backoffMs?(attempt), retrySecret? }`. "이벤트 전달"을 본다 |

다른 저장소·로그인을 쓰려면 `DatabaseAdapter`·`MediaAdapter`(`storage`로)·`AuthAdapter`를 직접 만들어 넣는다. 낮은 수준의 `createCms({ config, server })`는 같은 옵션을 `CmsServerConfig`로 받고(`storage` 대신 `media`) 사이트 설정은 따로 받는다.

### 호스트 신뢰

`Host`와 `X-Forwarded-Host`는 클라이언트가 직접 보낼 수 있어서, 운영에서는 기본적으로 믿지 않는다. 믿는다는 것은 두 가지다. 로그인 콜백 주소를 요청의 호스트로 만들고, 같은 출처 검사가 `X-Forwarded-Host`의 첫 값을 받는다.

순서는 이렇다. `trustHost` 옵션이 가장 앞서고, 그다음 `AUTH_TRUST_HOST` 환경 변수(`true`·`1` 또는 `false`·`0`), 그다음 알려진 프록시 플랫폼이 감지되거나(환경 변수 `VERCEL`·`NETLIFY`·`CF_PAGES`·`RENDER`·`RAILWAY_ENVIRONMENT`·`FLY_APP_NAME`·`K_SERVICE` 중 하나가 있을 때) 개발·테스트일 때(그곳의 호스트는 `localhost`다) **자동으로 켜진다**. 그 밖의 운영 환경에서는 꺼진다. 켜지 않은 운영 서버에서는 로그인이 `UntrustedHost` 오류로 실패한다(이 옵션들을 알려 주는 경고도 남긴다).

- 보안상 주의: 켜 두면 프록시가 `X-Forwarded-Host`를 덮어쓰지 않는 한 클라이언트가 로그인 콜백 주소를 만드는 호스트를 고를 수 있다. 위의 플랫폼은 덮어쓴다.
- 직접 운영하는 프록시(nginx, 로드 밸런서)는 감지되지 않는다. `trustHost: true` 또는 `AUTH_TRUST_HOST=true`로 켜고, 그 프록시가 `X-Forwarded-Host`를 덮어쓸 때만 그렇게 한다.
- 그렇지 않으면 `AUTH_URL`에 사이트의 공개 주소를 적는다. 로그인이 쓰는 출처가 고정되므로 호스트를 믿지 않아도 로그인이 된다. 같은 출처 검사에는 `site.url`을 적어 공개 호스트를 받게 한다.

### 이메일과 비밀번호 로그인

`auth: auth({ providers: [password()] })`(`password`는 `@monti-cms/auth/password`에서 온다)는 다른 서비스가 필요 없는 로그인이다. `monti init`이 기본으로 이것을 쓴다. 계정은 Monti 데이터베이스, 곧 인스턴스의 플러그인 저장소에 있다(`monti db:migrate`가 표를 만들고, 따로 할 설정은 없다). 비밀번호는 scrypt(`node:crypto`, 계정마다 salt)로 해시한다. 모든 계정이 관리자이고, 세션은 GitHub 때와 같은 서명된 쿠키다(키는 `MONTI_SECRET`에서 만든다).

- **첫 관리자**는 관리자 자신의 화면에서 만든다. 계정이 하나도 없는 동안 로그인 화면(`<관리자 경로>/login`, 관리자가 보내 주는 곳)이 이메일·비밀번호·확인 칸이 있는 "첫 관리자 만들기"를 보여 주고, 만든 뒤 바로 로그인시킨다. 설정 코드는 없다. 계정이 하나라도 생기면 그 화면은 닫히고, 서버도 그 요청을 거절한다(화면만 가리는 것이 아니다). 그래서 이 화면으로 두 번째 관리자를 더할 수 없다. 배포한 직후 관리자를 열어 만든다. 또는 운영 데이터베이스를 `DATABASE_URL`로 가리키게 하고 내 컴퓨터에서 앱을 프로덕션 모드(`next build`, `next start`)로 돌려 미리 만든다. `next dev`에서는 로그인 없이 관리자이므로 그 화면이 나오지 않는다.
- **로그인**은 이메일·비밀번호 입력 칸이다. 한 이메일로 연달아 실패하면(1분에 5번) 그 1분 동안 나머지 시도를 거절한다.
- **비밀번호를 잊었을 때:** `monti admin:reset-password [--email <이메일>]`이 이메일(주지 않았다면)과 새 비밀번호를 두 번 묻고, `monti.config.ts`의 데이터베이스에 쓴다. 메일은 보내지 않는다. 이미 로그인한 세션은 만료(8시간)될 때까지 유효하다.
- 관리자 계정이 아직 없으면 `monti doctor`가 경고한다(`auth/admin-accounts`).

### 개발용 로그인 우회

`next dev`(`NODE_ENV=development`)에서는 방문자를 로그인 없이 첫 번째 관리자로 보며, 이것이 **기본값**이다. 따로 정할 변수는 없다(`CMS_DEV_AUTH_BYPASS`는 없어졌다). `auth({ devBypass: false })`로 끈다. 스테이징 서버가 실수로 열리지 않도록 다음처럼 제한한다.

- `NODE_ENV`가 `development`여야 한다. 운영에서는 절대 켜지지 않고, 다른 모드에서 `devBypass: true`를 주면 무시하고 경고를 남긴다.
- 배포된 서버처럼 보이면 안 된다. 호스팅 플랫폼 변수(`VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`, `AWS_EXECUTION_ENV`, `AWS_LAMBDA_FUNCTION_NAME`, `KUBERNETES_SERVICE_HOST`, `DYNO`)가 있거나 `AUTH_URL`이 공개 주소를 가리키면 거부한다. 이때 서버는 시작을 거부하고(로그인 연결을 처음 쓸 때 오류를 던진다) 이유를 알려 준다. `devBypass`를 정하지 않았다면 그런 곳에서는 우회가 그냥 꺼져 있고, 배포된 것처럼 보이는 프로세스에 `devBypass: true`를 명시하면 시작을 거부한다.
- 요청마다 내 컴퓨터에서 온 것이어야 한다. `Host`가 `localhost`·`*.localhost`·`127.0.0.0/8`·`::1`이고, `X-Forwarded-Host`와 `X-Forwarded-For`가 있으면 그것도 루프백이어야 한다. 그 밖의 요청은 평소처럼 로그인해야 하고, 경고를 한 번 남긴다. `hostOf(cms).authGateway.isDevBypassActive()`(호스트 쪽, `@monti-cms/core/internal/host`)가 같은 검사를 한다(비동기).

## 이벤트(`on`)

모든 콘텐츠 쓰기는 본체 서비스의 한 파이프라인을 지난다: 만들기, 저장, 발행(하나 또는 일괄), 복제, 번역본 만들기, 메타데이터·폴더 일괄 변경.
플러그인과 서버 설정은 무슨 일이 일어날 때 반응할 것을 `on` 한 필드에, 대상과 이벤트로 중첩한 객체로 적는다: `on: { entry: { beforeSave: [...], published: [{ name, run }] } }`. `defineConfig({ on })`과 `defineServerPlugin({ on })`의 모양이 같고, 타입이 곧 참고 문서다(자동완성이 대상, 이벤트 순으로 보여 준다). 이벤트는 규칙 하나로 구분한다. `before…` 이벤트는 동작 안에서 일어나기 전에 돌고 그 동작을 바꾸거나 막을 수 있다. 과거형 이벤트는 일이 끝난 뒤의 알림이며 절대 막지 않는다.

| 이벤트 | 언제 | 쓰기를 바꾸거나 막을 수 있나 | 모양 |
|---|---|---|---|
| `entry.beforeValidate` | 본체가 데이터를 준비하기 전 | 데이터를 바꾼다: `{ metadata, doc, slug? }`를 돌려준다 | 함수 목록 |
| `entry.beforeSave` | 본체 준비 뒤, 모든 쓰기 | 막는다: 실패(와 경고)를 더한다 | 함수 목록 |
| `entry.beforePublish` | 본체 준비 뒤, 발행과 항목 복원 | 막는다: 실패(와 경고)를 더한다 | 함수 목록 |
| `entry.created`·`saved`·`published`·`archived`·`unarchived`·`trashed`·`restored`·`deleted` | 커밋 뒤, 변경 종류마다 하나 | 아니다: 변경은 그대로이고 예외는 나중에 다시 시도한다 | `{ name, run }` 목록(내구성) |
| `entry.changed` | 커밋 뒤, 모든 종류(`event.kind`가 알려 준다) | 아니다 | `{ name, run }` 목록(내구성) |
| `keySlot.changed`(플러그인만) | 플러그인의 슬롯에 키를 지정하거나 비워서 저장됨 | 아니다 | 함수 목록(즉시) |

`before…` 구독자는 요청 안에서 커밋 전에 하나씩 차례로 돈다: 서버 설정의 목록이 먼저, 그다음 각 플러그인의 목록을 설정 순서대로, 목록 안에서는 적힌 순서다. 내구성 구독자는 이벤트 아웃박스의 구독자 하나로, 자기 전달 상태와 재시도를 가지며 키는 `<owner>:<name>`이다. 목록에 적힌 종류만 전달받고(`entry.published`는 발행된 변경만, `entry.changed`는 전부), 아웃박스는 나머지 종류에는 전달 행을 만들지 않는다. 구독자 함수는 자기 인자를 받고 마지막에 스코프를 받는다: 서버 설정은 `{ cms }`, 플러그인은 `{ cms, plugin }`이다. 플러그인의 다른 서버 콜백(`routes`·`commands`·`formats`·`features`·`keyUses`·`migrate`)은 전처럼 선언하며 이벤트가 아니다. 요청에 답하거나 꼭 거쳐야 하는 단계이지 반응이 아니기 때문이다.

타입(`ServerEvents`·`PluginEvents`·`EntryEvents`·`EntrySubscriber`·`BeforeValidate`·`BeforeSave`·`BeforePublish`·`KeySlotChanged`·`WriteHookContext`·`WriteData`·`ValidationHookContext`·`ValidationResult`·`WriteOperation`)은 `@monti-cms/core/server`에서 내보낸다.

```ts
import { defineConfig } from "@monti-cms/core/server";

export const cms = defineConfig({
	// schema, plugins, database, auth, ...
	on: {
		entry: {
			// 데이터를 바꿀 수 있다. 본체 준비 전에 돈다. 준비할 데이터를 돌려준다(아무것도 안 돌려주면 그대로).
			beforeValidate: [
				({ operation, collection, entryId, locale, slug, metadata, doc }) => ({
					metadata: { ...metadata, title: String(metadata.title ?? "").trim() },
					doc,
					slug: slug?.toLowerCase(), // 선택: `slug`를 빼면 주소는 그대로 둔다
				}),
			],
			// 쓰기를 막을 수 있다. 본체 준비 뒤, 모든 쓰기에서 돈다. 실패는 쓰기를 막고, 경고는 결과와 함께 돌아간다.
			beforeSave: [
				({ metadata, snapshot }) => ({
					issues: String(metadata.title ?? "").includes("TODO")
						? [{ code: "title_has_todo", path: "title", message: "Remove TODO from the title before saving." }]
						: [],
				}),
			],
			// 같은 방식, 발행에서만.
			beforePublish: [({ metadata }) => ({ warnings: metadata.summary ? [] : [{ code: "no_summary", path: "summary" }] })],
			// 내구성, 커밋 뒤. 이름은 바꾸지 않는다(전달 상태가 `server:revalidate`로 남는다). `published` 아래에 적으면 발행된 변경만 받는다.
			published: [{ name: "revalidate", run: (event, { cms }) => revalidate(cms.site, event.collection, event.publishedSlug) }],
		},
	},
});
```

| 단계 | 하는 일 |
|---|---|
| 1 | 입력 만들기: 요청에서, 또는 저장된 초안에서(발행·일괄) |
| 2 | `entry.beforeValidate`. 차례대로(설정의 목록이 먼저, 그다음 각 플러그인의 목록을 설정 순서대로, 목록 안에서는 적힌 순서). 각 구독자는 앞의 결과를 받는다 |
| 3 | 본체 준비: 정규화·참조 수집·본체 검증. **항상, 바뀐 데이터에 대해 돈다** |
| 4 | 블록마다 `validate`(경고만), 이어서 `entry.beforeSave`: 실패와 경고를 더한다 |
| 5 | 발행(그리고 다시 발행되는 항목 복원)에서 `entry.beforePublish`: 실패와 경고를 더한다 |
| 6 | 저장소 커밋. 글 하나에 트랜잭션 하나(일괄은 항목마다 커밋) |
| 7 | 내구성 entry 이벤트(`created`·`saved`·`published` … `changed`). 아웃박스에서 하나씩 따로 전달한다 |

- `operation`은 `create`·`save`·`publish`·`duplicate`·`translate`·`restore`다. 메타데이터·폴더 일괄 변경은 항목마다 `save`, 일괄 발행은 항목마다 `publish`다.
  글을 만드는 중에는 `entryId`가 없다. `slug`는 이 쓰기가 항목에 주는 주소다(주소를 주지 않으면 `null`이며, `metadata`의 필드에는 들어 있지 않다). `metadata`와 `doc`(저장 문서 형태의 본문, 문서가 될 수 없는 초안은 `unparsed` 노드 하나)은 복사본이라, `beforeValidate`가 돌려주지 않으면 바꿔도 아무 일도 없다. `beforeValidate`는 `{ metadata, doc }`를 돌려주고, 주소를 바꾸려면 `slug`도 돌려준다. 돌려준 값은 코어가 그래도 정규화하고 검사한다.
  `beforeSave`와 `beforePublish`는 준비된 `snapshot`(복사본)도 받는다.
- 보관·보관 해제·휴지통·삭제는 내용을 바꾸지 않으므로 2~5단계를 건너뛰고 내구성 이벤트만 부른다. 항목(record)을 복원하면 다시 발행되므로 `restore`로 3~5단계를 거친다(`beforeSave`와 `beforePublish`가 돌아서 휴지통에 넣었다 복원하는 식으로 발행 제한을 피할 수 없다. 내용이 그대로이므로 `beforeValidate`는 돌지 않는다). 다른 글의 복원은 초안으로 돌려놓을 뿐이라 아무 구독자도 돌지 않는다.
- 구독자는 DB 트랜잭션 밖에서 돌고 DB 클라이언트를 받지 않는다. 비동기여도 된다. 저장소 내부 옵션 `beforePublishCommit`(트랜잭션 클라이언트를 받는다)은 이 계약에 들지 않고 그대로다.
- 발행하는 중에 `beforeValidate`가 초안을 바꾸면 그 변경은 발행과 함께 한 트랜잭션으로 저장된다(내구성 이벤트에는 그 글의 `saved` 변경 다음에 `published` 변경이 온다. 바뀐 것이 없는 발행은 `published`만 온다). 만들거나 저장하면서 바로 발행하는 경우(항목)도 같게 `created` 또는 `saved`, 그다음 `published`로 알린다.
- `beforeSave`나 `beforePublish`가 더하는 이슈는 `{ code, path?, message?, params? }`다. `path`는 편집기가 이슈를 보여 줄 필드(`"slug"`, `"title"`)이고, `message`는 사람이 읽는 문구다. 코어(`cms.core.issues`)에 문구가 없는 `code`는 `message`가 그대로 보이므로 꼭 써 두고, zod 이슈 코드(`invalid_type`, `custom` 등)와 같은 이름은 쓰지 않는다. 거부된 쓰기가 던지는 `ServiceError`는 이를 `issues`로 담고, 자신의 `message`에는 그 내용을 나열한다(`validation_failed: The slug "A" must be lowercase (slug)`).
- `before…` 구독자가 예외를 던지거나 계약에 맞지 않는 값을 돌려주면 쓰기는 `hook_failed`(HTTP 500)로 실패한다. 오류의 `issues[].params`에 이벤트 이름과 소유자(`server` 또는 `plugin:<이름>`)가 들어가고, 아무것도 저장되지 않는다. `beforeSave` 실패는 `validation_failed`, `beforePublish` 실패는 `publish_validation_failed`(HTTP 422)이며, 더한 이슈가 초안 자체의 이슈 옆에 붙는다.
- 내구성 구독자의 `run`은 이벤트를 받는다. id·상태·주소·`version`·`contentHash`·`eventId`, 커밋된 글을 읽는 `read()`(본문 자체는 아니다), `once(run)`이고, 두 번째 인자로 스코프도 받는다(`{ cms }`, 플러그인의 구독자는 `{ cms, plugin }`). 전달은 아웃박스에서 하며 최소 한 번, 글마다 순서대로, 실패하면 다시 시도한다. "이벤트 전달"을 본다.
- **쓰기가 돌려주는 것.** `cms.contentService()`의 모든 쓰기(`createDraft`·`saveDraft`·`createTranslation`·`duplicate`·`publish`·`restore`)는 `{ entry, warnings }`로 끝난다. 지금의 글과, 쓰기가 찾은 경고(코어, 블록, `before…` 구독자가 낸 것)다. 경고는 글에 섞이지 않으며, 없으면 빈 목록이다. 관리 API도 같은 모양으로 답하고(`POST /entries`·`PATCH /entries/:id`·`POST /entries/:id/publish`·`/restore`·`/duplicate`·`/translations`), 일괄 결과의 항목은 쓰기에 경고가 있으면 `warnings`를 담는다. 보관·보관 해제·휴지통은 경고를 낼 `before…` 구독자가 없는 저장소 호출이라 글을 돌려준다.

계약(각각 `src/services/__test__/write-hooks.test.ts`와 `write-pipeline.test.ts`에 시험이 있다):

1. **바뀐 데이터도 본체를 거친다.** 정규화·참조 수집·검증이 `beforeValidate`의 결과에 대해 돌아서, 변환으로 본체 검사를 피할 수 없다.
2. **추가 검증은 실패를 더할 수만 있다.** `beforeSave`와 `beforePublish`가 돌려준 이슈와 경고는 본체의 것에 더해진다. 구독자는 스냅샷의 복사본을 받으므로 본체 이슈를 지우거나 낮출 수 없고, 발행의 본체 무결성 검사(참조·미디어·링크·필수 값)는 항상 돈다.
3. **커밋 전의 실패는 쓰기를 막는다.** 본체 준비 실패, `before…` 구독자가 더한 실패, 그 예외는 아무것도 저장하지 않고 내구성 이벤트도 부르지 않는다.
4. **내구성 구독자의 실패는 끝난 쓰기를 되돌리지 않는다.** 기록하고 다시 시도하며, 다른 구독자는 따로 전달된다. 이벤트는 쓰기의 트랜잭션에서 쓰이므로 롤백된 쓰기는 이벤트를 남기지 않는다.
5. **일괄은 모든 항목에 같은 구독자를 적용한다.** 항목마다 파이프라인 전체를 돌고, 결과나 오류(`hook_failed`·`validation_failed` 등)는 항목별로 돌아간다.

## 이벤트 전달(내구성 `entry` 이벤트)

내구성 `entry` 이벤트(`created`·`saved`·`published` … `changed`)는 아웃박스에서 전달되므로, 구독자가 실패하거나 프로세스가 멈춰도 사라지지 않는다.

- **아웃박스.** 변경과 같은 트랜잭션에서 저장소가 `cms_events`(마이그레이션 `0022_events`)에 행을 넣는다. 열은 `id`, `kind`(`created`·`saved`·`published`·`archived`·`unarchived`·`trashed`·`restored`·`deleted`), `entry_id`, `collection`, `locale`, `content_hash`, `version`, `occurred_at`, 그리고 상태와 주소를 담은 `payload`다. 롤백된 변경은 이벤트를 남기지 않고, 커밋된 변경에는 항상 이벤트가 있다. 만들거나 저장하면서 바로 발행하면 이벤트가 둘 생긴다(`created`/`saved`, 그다음 `published`). `entries`로 가는 외래 키가 없어서 삭제의 이벤트는 글보다 오래 남는다. 원본의 번역본에 미치는 변경은 변경을 가한 글 하나로 한 번만 알린다(`translationGroupId`가 묶음을 가리킨다).
- **구독자.** 내구성 `on.entry` 목록의 `{ name, run }` 하나하나가 구독자이고 키는 `<owner>:<name>`이다. 설정의 것은 `server:revalidate`, 플러그인의 것은 `plugin:git-sync:sync`처럼 된다. 키는 바뀌지 않는 값이고 `cms_event_deliveries`의 전달 상태(이벤트와 구독자마다 한 행: `state`, `attempts`, `last_error`, `next_attempt_at`)의 키가 되므로, 구독자 이름과 구독자가 있는 플러그인의 이름은 바꾸지 않는다. 한 소유자의 두 구독자는 따로 전달·재시도·포기되어, 하나가 실패해도 다른 하나를 붙잡지 않는다. 이름은 영어 소문자·숫자·`-`이고 소유자 안에서 겹치지 않는다(모든 `entry` 목록을 통틀어서다. 구독자는 적힌 종류만 전달받으므로 한 이름을 두 종류 아래에 적으면 거부되고, 여러 종류가 필요하면 `entry.changed`를 쓴다).
- **새 구독자.** 나중에 생긴 구독자는 생긴 뒤에 커밋된 이벤트부터 받고, 그 전의 기록은 받지 않는다.
- **전달.** 커밋 뒤에 변경을 만든 프로세스가 같은 호출 안에서 바로 각 구독자에게 보내므로 지연은 이전과 같다. 실패는 기록하고 점점 길어지는 간격(15초에서 시작해 두 배씩, 최대 1시간. `events.backoffMs`로 바꾼다)으로 나중에 다시 시도하며, `events.maxAttempts`번(기본 8) 시도하고도 실패하면 전달이 데드레터(`dead`)가 된다. 쓰기는 되돌리지 않고, 다른 구독자도 막지 않는다.
- **최소 한 번, 글마다 순서대로.** 이벤트는 두 번 이상 전달될 수 있다(일을 하고 나서 실패한 구독자, 끝나지 못한 시도). 그래서 **구독자는 멱등이어야 한다.** `event.eventId`는 시도마다 같고, "이미 했다"는 표시는 `event.once`(아래)가 대신 남겨 준다. 한 글의 이벤트는 커밋 순서로 전달된다. 같은 글의 앞선 이벤트가 대기 중이거나 전달 중이거나 실패해 아직 죽지 않았다면 뒤의 이벤트는 기다린다. 죽었거나 닫은 전달은 순서를 붙들지 않으므로, 죽은 것을 손으로 다시 보내면 뒤의 이벤트보다 늦게 도착할 수 있다. 글을 내보내는 구독자는 글의 현재 상태를 읽고 `version`을 비교한다. 다른 글의 이벤트는 서로 상관없다.
- **한 번만 하기.** `await event.once(run)`은 이벤트와 구독자마다 `run`을 한 번만 돌리고 돌았는지를 알려 준다. 앞선 시도가 `run`을 끝냈다면 건너뛰고 `false`를 돌려준다. `run`이 예외를 던지면 표시하지 않으므로 다시 시도할 때 또 돈다. 표시는 `run`이 끝난 뒤에 쓰므로, 둘 사이에서 프로세스가 죽을 때만 일이 반복된다. 메시지를 보내거나 API를 부르는 구독자에게 필요한 멱등 코드는 이것이 전부다. 표시는 이벤트의 전달 행에 있어서 같은 정리로 이벤트와 함께 지워진다(90일 뒤). 반복해도 해가 없는 일에는 `once`가 필요 없다.
- **커밋된 글 읽기.** `event.read()`는 글의 현재 상태(`Entry`: `working`과, 발행된 뒤에는 `published`가 각각 `{ metadata, doc, … }`로 있고, `publishedSlug`·`workingSlug`·`version`도 있다. `Entry`는 `@monti-cms/core/site`에서 내보낸다)를, 삭제됐다면 `null`을 돌려준다. 주소가 든 메시지를 만들 때는 `cms.site.contentPath(collection, slug)`(경로, 컬렉션에 경로가 없으면 `null`)와 `cms.site.config.site?.url`(출처, `SITE_URL`에서 온다)을 쓴다. `event.version`과 `event.contentHash`가 이 이벤트가 어떤 변경인지 알려 준다. `read().version`이 더 크면 그 글의 뒤 이벤트가 이어서 온다. 형식(format)으로 글을 내보내는 구독자(git-sync)는 글을 읽어 형식을 거치고, 이미 더 새 버전을 썼다면 이벤트를 건너뛴다.
- **미루기.** 아직 준비되지 않은 구독자(이벤트를 묶는 중이거나, 요청 제한이 언제 풀리는지 아는 경우)는 `{ retryAt: Date }`을 돌려주거나 `new DeferDelivery(retryAt)`을 던진다(`@monti-cms/core/server`). 전달은 `pending`으로 돌아가 `retryAt`에 다시 도래한다. **실패가 아니다.** 로그를 남기지 않고, 이벤트 화면에 나오지 않고, 실패 배지에 들지 않고, 시도 횟수를 쓰지 않으며(`attempts`가 하나 되돌아가므로 몇 번을 미뤄도 그 시도 그대로다) dead letter가 될 수도 없다. 그 글의 뒤 이벤트 순서는 계속 잡고 있다. `cms.events.retry()`는 `deferred`가 몇 개인지 돌려주고, `retry({ all: true })`는 아직 때가 안 된 미뤄진 전달도 시도한다. git-sync가 묶음 창에 이것을 쓴다.

```ts
// slack/server.ts, 플러그인의 `server` 모듈(`definePlugin({ name: "slack", server: () => import("./server") })`)
import { defineServerPlugin } from "@monti-cms/core/server";

export default defineServerPlugin({
	on: {
		entry: {
			published: [
				{
					name: "post", // 전달 상태는 `plugin:slack:post`로 남는다
					run: async (event, { cms }) => {
						// 최소 한 번 전달된다. `once`는 이 이벤트에 대해 한 번만 돌리고, 예외로 끝난 시도는 다시 시도할 때 또 돈다.
						await event.once(async () => {
							const entry = await event.read(); // 커밋된 글, 삭제됐다면 null
							await postToSlack(entry, cms.site.contentPath(event.collection, event.publishedSlug));
						});
					},
				},
			],
		},
	},
});
```

### 워커 없이 다시 시도하기

사이트가 서버리스 함수에서 돌 수 있으므로 백그라운드에서 도는 것은 없다. 다시 시도는 다음에서 시작한다.

- **같은 프로세스의 다음 쓰기.** 쓰기는 자기 이벤트를 보낸 뒤 때가 된 재시도를 최대 5건, 프로세스마다 10초에 한 번까지 함께 돌린다.
- **`cms.events.retry({ all?, limit? })`.** 때가 된 전달을 보낸다(`all`이면 아직 때가 안 된 실패도, 죽은 것은 손으로만). 커밋과 전달 사이에 프로세스가 멈춰 전달 행이 없는 이벤트도 보낸다. `{ delivered, failed, dead }`를 돌려준다. `cms.events.list()`·`counts()`·`retryDelivery({ eventId, subscriber })`·`dismiss({ eventId, subscriber })`는 관리자 화면이 쓴다.
- **`monti events:retry [--all] [--limit <n>]`.** `monti db:migrate`처럼 설정 파일을 불러와 `cms.events.retry()`를 부른다. 크론 작업이나 CI 일정에서 돌린다.
- **`POST /api/monti/v1/events/retry[?all=1&limit=100]`.** URL만 부를 수 있는 스케줄러(예: Vercel 크론)를 위한 길이다. 관리자 세션을 받고, 설정에 `events.retrySecret`이 있으면 `Authorization: Bearer <retrySecret>`도 받는다(환경 변수에 두고, `cms.server`에는 들어가지 않는다).

```ts
defineConfig({
	// ...
	events: { retrySecret: process.env.CMS_EVENTS_SECRET, maxAttempts: 8 },
});
```

커밋된 모든 변경은 구독자가 있든 없든 이벤트 로그에 기록된다(전달이 없는 이벤트는 "기록됨 (구독자 없음)"으로 보이고, 요청에서 온 변경이면 작업자도 담긴다). 90일(옵션이 아닌 고정 기간)이 지난 이벤트는 같은 쓰기 쪽 정리에서 프로세스당 시간당 한 번 이하로 전달과 함께 지워지며, 아직 기다리는 전달이 있으면 남는다. `pending`·`delivering`·`failed`·`dead` 전달은 전달되거나 무시될 때까지 이벤트를 붙들고 있다. 관리자의 **이벤트 기록**(도구 > 이벤트 기록: 설정 기본 경로에서는 `/admin/events`, `monti init` 뒤에는 `/studio/events`)은 모든 이벤트를 전달 상태와 함께 보여 주는 로그이며, 실패한 전달과 죽은 전달은 마지막 오류와 함께 보여 주고 하나씩 다시 시도하거나 닫을 수 있게 하며, 사이드바의 이벤트 기록 항목이 그 수를 보여 준다.

## 구독자와 플러그인 테스트하기

복사본이 아니라 진짜 쓰기 파이프라인에서 테스트한다. `@monti-cms/core/testing`의 `testServer()`는 `defineConfig`에 넘길 `database`와 `auth` 옵션을 돌려준다. `CMS_TEST_DATABASE_URL`(테스트용 데이터베이스이며 운영 DB는 절대 안 된다) 안에 자기만의 스키마를 가진 Postgres 어댑터와, 모든 요청이 로그인한 관리자인 로그인이다. `cms.migrate()`가 표를 만들고 `drop()`이 스키마를 지우므로 테스트끼리 서로의 데이터를 보지 않는다.

```ts
import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";

const test = testServer();
const cms = defineConfig({ schema, plugins: [myPlugin()], on, ...test.server });

beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});

it("refuses a bad slug", async () => {
	const draft = cms.contentService().createDraft({ collection: "post", slug: "Bad", metadata: { title: "A" }, body: "Hi.", format: "mdx" });
	await expect(draft).rejects.toMatchObject({ code: "validation_failed" });
});
```

`cms.handle(new Request(url))`은 관리자와 같은 검사를 거쳐 플러그인의 경로를 실행하고, `cms.events.retry({ all: true })`는 기다리는 내구성 entry 이벤트를 전달하며, `@monti-cms/core/internal/cli`의 `runCli(["doctor"], { cwd, log, error })`는 폴더에서 `monti doctor`를 실행하고 종료 코드를 돌려준다. 인스턴스가 몇 가지 부품 위에서만 필요한 코드라면 `fakeCms({ store, … })`가 더 가볍다. 플러그인의 화면은 브라우저와 비슷한 환경에서 테스트한다. `createSite(defineSite({ schema, plugins }))`로 사이트를 만들고(`defineConfig`는 서버 전용이라 `window`가 있는 곳에서는 실행을 거부한다) 화면을 `<SiteProvider site={site}>`로 감싼다. 레시피가 이 모두를 끝에서 끝까지 보여 준다.

## 스키마 파일

사이트 루트(또는 `src/`)의 `monti.schema.ts`는 사이트 설정 중 순수 데이터인 부분을 담는다. 컬렉션과 필드·레이아웃, 언어와 기본 언어, 시간대, 데이터로 쓸 수 있는 `site` 설정, `admin`(경로·언어·문자열 문구 바꾸기), 시드 템플릿(저장된 문서, 또는 글과 그 형식), 데이터 변환(`migrations`, "스키마 바꾸기" 참고)이다.
기본 export가 `defineSchema`에 넘긴 객체 리터럴 하나인 TypeScript 파일이다. `defineSchema`는 const 제네릭을 쓰는 타입 있는 항등 함수라서 컬렉션·필드·언어 이름이 `defineConfig`의 타입으로 흘러가고, 틀린 `kind`나 옵션 값은 파일 안에서 타입 오류가 된다.

```ts
// monti.schema.ts
import { defineSchema } from "@monti-cms/core";

export default defineSchema({
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true, max: 200 },
				slug: { kind: "slug", label: "Address", from: "title", required: true },
				categoryId: { kind: "relation", label: "Category", to: "category", required: true },
				stage: { kind: "select", label: "Stage", options: { idea: "Idea", done: "Done" }, defaultValue: "idea" },
			},
			layout: [{ fields: ["title", "slug"] }, { group: "Classification", fields: ["categoryId", "stage"] }],
		},
		category: {
			label: "Category",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
			},
		},
	},
	locales: [{ code: "en", name: "English" }, { code: "fr", name: "Français" }],
	defaultLocale: "en",
	timeZone: "Europe/Paris",
	site: { name: "My blog", localePrefix: "always" },
	admin: { path: "/studio" },
});
```

**형식.** 각 부분은 같은 이름 빌더의 옵션 객체에 `kind`를 붙인 모양이다. 컬렉션은 `defineCollection`이 받는 값(`label`, `kind`, `body`, `fields`, `path`, `icon`, `layout`, `list`)이고, 필드는 `fields.<kind>`가 받는 값에 `kind`를 더한 것이다. 필드 객체는 평범한 리터럴로 둔다. 필드 종류는 `text`, `slug`, `relation`(`many`, `ordered`, `createInline`, `publishedOnly`, `allowUnpublished`),
`select`(`options`와 `defaultValue`), `media`(`accept: "image" | "file"`, 이미지 필드), `conditional`(`discriminant` 선택 필드와 선택값마다 보이는 `values`), `backlink`, `view`로, `fields.*`가 가진 종류를 모두 쓸 수 있다. 지금 `fields.*`에는 날짜·불리언·숫자 종류가 없어 파일에도 없다. 날짜는 텍스트 필드에 둔다.
`defineSchema`의 타입이 에디터에서 틀린 `kind`나 잘못 쓴 옵션 값을 알려 준다. 모르는 추가 키는 런타임의 엄격한 검사가 잡고, 존재하는 컬렉션을 가리키는 관계처럼 컬렉션 사이의 규칙도 설정을 읽을 때 검사한다.
**모르는 옵션은 오류다.** 형식에 없는 키(철자가 틀린 옵션, 없앤 옵션)는 경로와 함께 알리고, 가까운 키가 있으면 그것을 알려 준다.

**읽기.** `monti.config.ts`가 모듈을 가져와 그 기본 export를 `defineConfig`에 넘긴다. `import`는 번들러가 빌드에 담아 주므로 운영에서는 읽기 전용이다. 스크립트와 `monti` 명령은 파일을 tsx로 읽는다(`bin/monti.mjs`가 등록한다).

```ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import schema from "./monti.schema";

export const cms = defineConfig({
	schema,
	plugins: [mdx()],
	database: postgres(),
	auth: auth({ providers: [github()] }),
});
```

낮은 수준 `createCms({ config: defineSite({ … }), server })`는 `@monti-cms/core`의 `defineSite`로 만든 사이트 부분만 받는다(데이터베이스도 로그인도 없고, 테스트와 도구용이다. `@monti-cms/core`는 더 이상 `defineConfig`를 내보내지 않는다). `createCms`·`createSite`와 나머지는 사이트 설정을 다른 설정과 똑같이 받으므로, 제 파일을 가진 여러 사이트가 한 프로세스에 함께 있을 수 있다. 올바르지 않은 파일은 시작할 때 모든 문제를 경로와 함께 알리고 멈춘다:

```text
monti.schema.ts is not valid:
  collections.post.fields.title.kind: a field needs a "kind" of text, slug, relation, select, media, conditional, backlink or view
  collections.post.workflow: is not an option (known: label, kind, fields, path, icon, layout, body)
  locales[1].name: must be a string (got number)
Fix: correct the lines above; `monti doctor` checks the files again.
```

**파일과 코드 설정을 합치는 법.** 코드는 파일에 더하고 환경마다 다른 값을 덮어쓸 수 있지만, 파일의 데이터를 조용히 바꾸지는 않는다.

| 부분 | 규칙 |
| --- | --- |
| `collections` | 파일의 컬렉션 뒤에 코드로 쓴 것(`defineCollection`)을 더한다. 같은 이름이 둘 다 있으면 오류 |
| `locales`, `defaultLocale` | 파일에만 둔다. 코드에도 쓰면 오류 |
| `site`, `admin` | 키마다 코드 값이 이긴다. `undefined`로 둔 키(비어 있는 환경 변수)는 파일 값을 그대로 둔다. `site.url`은 보통 코드에 둔다 |
| `timeZone` | 코드 값이 이긴다 |
| `seed.templates` | 파일의 템플릿 뒤에 코드의 템플릿 |
| `plugins`, `blocks`, `codeBlock`, `media`, `editor` | 코드에만 있다 |

**코드에 남는 것.** 코드가 필요한 모든 것: 플러그인(문법 확장·형식·AI 동작 포함), 컴포넌트가 딸린 블록 정의, 훅과 서버 옵션(데이터베이스·저장소·로그인·비밀 값), `codeBlock`(줄 효과에 이름표와 함수가 있다), `media`, 함수인 옵션. `site.url`은 환경마다 달라서 코드에 남는다.

**필드를 더하는 플러그인.** `seoFields()` 같은 것은 평범한 필드 객체를 돌려주므로 그 필드는 이미 평범한 데이터다. 파일에는 보통 필드로 적히고(`monti schema:extract`가 해 준다), 플러그인(`seo()`)은 `plugins`에 남아 전처럼 역할로 필드를 확인한다.
형식에 따로 "플러그인 필드"는 없다. 코드로 쓴 컬렉션은 계속 `seoFields()`를 펼칠 수 있다. 파일의 이름표는 한 언어의 글이다(`monti schema:extract --locale`로 고른다).

### TypeScript 설정 옮기기: `monti schema:extract`

`monti schema:extract`는 `monti.config.ts`(그것이 내보낸 `cms`)나 default export가 `defineSite(...)`인 옛 방식 `cms.config.ts`를 읽어(`--config <파일>`, 코드로 쓴 설정은 전과 같이 동작한다) 데이터 부분을 `monti.schema.ts`(`--out <파일>`, 있는 파일을 바꾸려면 `--overwrite`, 플러그인이 주는 이름표의 언어는 `--locale <코드>`)에 쓰고, 코드에 남는 것을 알려 준다.
설정 파일은 고치지 않고, 거기에 넣을 얇은 설정을 보여 준다:

```text
Wrote monti.schema.ts (5 collections, 2 locales, 3 seed templates).

Stays in code (monti.config.ts):
  - site.url: differs per environment, so it is read from `SITE_URL` by convention (no line in code)
  - plugins: mdx, callout, ..., seo, ai (code; the fields they add to collections are in the schema)
```

그다음 설정 파일의 컬렉션·언어·`defaultLocale`·`timeZone`·`seed`와 `site`·`admin`의 데이터 부분을 `schema`로 바꾸고 `plugins`와 나머지는 둔다. 결과를 다시 읽으면 같은 사이트가 된다(테스트가 기준 설정을 꺼냈다가 다시 읽어 견준다).

### 스키마 바꾸기: `monti schema:diff`와 `monti schema:apply`

스키마를 고치다 보면 필드나 선택지를 지우는 일은 흔하다. 데이터가 깨지지는 않는다(지운 필드나 선택지의 저장된 값은 "고아 값"으로 남는다. 발행할 때 경고하고, 공개 읽기는 숨긴다). 그리고 직접 말하지 않는 한 아무것도 지워지지 않는다. 명령 둘과 함수 몇 개가 변경을 **안전하고 설명 가능하게** 만든다. 저장하기 전에 변경이 어떤 글에 닿는지 보여 주고, 선언한 데이터 변환을 돌리고, 각 글이 어느 스키마로 쓰였는지 기록한다.

**적용된 스키마.** 데이터베이스는 마지막으로 적용한 스키마(`monti schema:apply`)를 기억한다. 데이터 모델(컬렉션, 필드, 선택지, 언어, 허용 블록)을 `schema_state` 표에 JSON 스냅샷으로 둔다. 이 스냅샷이 모든 diff의 옛 쪽이다. 저장된 데이터가 마지막으로 맞춰진 기준이 바로 이것이기 때문이다(저장소의 브랜치나 태그는 이것과 다를 수 있다). 한 번도 적용하지 않은 저장소는 **기준선**에 있다. 첫 `schema:apply`는 스키마를 기록할 뿐 어떤 글도 바꾸지 않는다. 그래서 기존 블로그의 이전 경로는 `monti schema:extract` 다음에 변환 없이 `monti schema:apply`를 돌리는 것이고, 이는 아무것도 바꾸지 않는다.

**변환**은 스키마 파일의 `migrations`에, 그것이 속한 스키마 곁에 둔다. 각 변환은 `id`(영원한 이름이다. 한 번 돌면 `schema:<id>`로 `cms_migrations`에 기록되어 `storage.once`처럼 다시 돌지 않고, 적용된 변환은 기록으로 목록에 남는다), `op`, 그리고 변경**후** 스키마의 이름을 가진다.

```json
{
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

**변환이 쓰는 방식.** 모든 변환은 쓰기 규칙(`prepareSnapshot`, `before…` 구독자는 제외)을 거친다. 바뀐 메타데이터를 검사하고, 내용 해시, 검색용 글자, 메타데이터 참조(이름이 바뀌거나 지워진 관계·미디어 필드는 참조를 옮기거나 지우므로 삭제 검사가 계속 맞다)를 거기서 다시 계산한다. 작업본과 발행본은 한 트랜잭션에서 같은 방식으로 다시 쓰고, 글과 본문의 `version`과 `updated_at`은 전의 데이터 이전처럼 그대로 둔다. 발행하지 않은 변경이 있던 글은 그대로 있고, 없던 글은 그대로 없다. 변환된 본문에는 새 버전이 찍힌다. 실행은 이전이 쓰는 잠금을 잡으므로 둘이 동시에 적용해도 각 변환은 한 번만 돈다.

**명령.**

두 명령은 TypeScript 스키마 파일을 tsx로 읽는다.

- `monti schema:diff [--schema <파일>] [--check]`(읽기 전용)는 앱의 스키마를 적용된 스키마와 견주어, 모든 변경을 닿는 글과 그 결과와 함께 보여 준다. 고아 값으로 남음, 변환이 다시 씀, `dropField`가 지움, 채우기 전에는 발행할 수 없음 등이다. `--check`를 주면 적용할 것이 있을 때 1로 끝난다.
- `monti schema:apply [--schema <파일>] [--dry-run]`은 저장소를 이전하고(`monti db:migrate`), 아직 돌지 않은 변환을 돌리고, 스키마를 기록한다. 여러 번 돌려도 같다. `--dry-run`은 되돌리는 트랜잭션 안에서 모든 것을 돌리고 아무것도 쓰지 않는다.

```text
$ monti schema:diff
Changes (3):
  - post.summary renamed to excerpt [transform 2026-10-rename-summary]: 12 entries ("Hello", "Notes", ...); rewritten by its transform
  - post.stage option "draft" removed [transform 2026-10-merge-draft]: 4 entries ("WIP", ...); rewritten by its transform
  - post.legacy removed (text): 2 entries ("Old post", ...); values kept as orphans (hidden from the public read; publishing warns)
Transforms to run (2): 2026-10-rename-summary, 2026-10-merge-draft
```

**API(설정 화면이 부르는 것).** `@monti-cms/core/internal/schema-change`는 인스턴스의 저장소와 사이트 위에서 도는 평범한 함수를 내보낸다.

| 함수 | 주는 것 |
| --- | --- |
| `diffSchema(old, new, { transforms })` | `{ changes, renameHints }`. 변경은 `collection_added`, `collection_removed`, `collection_kind_changed`, `body_changed`, `allowed_changed`, `field_added`, `field_removed`, `field_renamed`, `field_type_changed`, `field_required_changed`, `field_locale_changed`, `field_moved`, `option_added`, `option_removed`, `option_renamed`, `locale_added`, `locale_removed`, `default_locale_changed` 중 하나다. `renameField`나 `mapOption` 변환은 제거와 추가의 쌍을 이름 바꾸기로 바꾸고, 변환이 맡는 변경에는 `handledBy`가 붙는다. `changeKey(change)`는 목록용 안정된 키, `describeSchemaChange(change)`는 영어 한 문장이다. 순수 함수 |
| `checkSchemaChange(store, diff, { site, transforms, sampleSize })` | 변경마다 `entries`(글은 한 번만 센다), id와 제목의 `sample`, `consequence`, 그리고 `checked` 여부. 저장된 본문을 한 번 읽고 아무것도 쓰지 않는다. 허용 블록 변경과 분기 안의 필수 필드를 점검하려면 새 스키마의 `site`가 필요하다 |
| `suggestTransforms(change, { options, renameTo })` | 변경에 맞는 변환(삭제, 이름 바꾸기, 남은 선택지마다의 매핑, 기본값). id는 없고, 화면이 제안하는 데 쓴다 |
| `planSchemaChange({ site, store, migrations })` | 적용된 스키마와의 diff, 남은 변환, `problems`. 읽기 전용 |
| `applySchemaChange({ site, store, migrations, dryRun })` | 계획을 실행한다. 돈 것, 변환마다 바뀐 글과 본문 수, 이름 바꾸기의 `conflicts`를 돌려준다. 실패하면 `SchemaChangeError`를 던지고 아무것도 바꾸지 않는다 |
| `applyTransforms`, `checkTransforms` | 순수한 조각. 글 하나의 메타데이터를 변환에 통과시키는 것, 변환을 스키마에 견주어 확인하는 것 |

저장소 쪽은 `SchemaChangeStore` 포트(`readSchemaState`, `appliedSchemaTransforms`, `scanBodies`, `applySchemaChange`)이고 `ContentStore`의 일부다.

### 관리자에서 스키마 편집하기 (개발 서버 전용)

관리자에는 `monti.schema.ts`를 편집하는 스키마 설정(`<관리자 경로>/settings/collections`, 사이드바 맨 아래 설정. 언어·사이트·관리자 탭도 여기에 속한다)이 있다. 위의 API 위에 얇게 얹은 화면이다. diff, 영향 점검, 변환은 같고, 파일을 대신 써 준다.

**누가 쓸 수 있나.** 개발 모드로 도는 서버(`NODE_ENV=development`, `next dev`가 설정한다)이면서 스키마 파일이 있고, 쓸 수 있으며, 순수 리터럴일 때만이다(아래). 판단은 화면이 아니라 서버가 한다(`@monti-cms/core/internal/schema-edit`의 `schemaEditAccess(cms)`). 운영에서는 `PUT /api/monti/v1/schema`와 `POST /api/monti/v1/schema/preview`가 **403 `schema_read_only`**(`reason`은 `production`, `no_schema_file`, `not_writable`, `has_code`)로 답하고, 화면은 짧은 설명과 함께 스키마를 읽기 전용으로 보여 준다. `GET /api/monti/v1/schema`는 어디서나 된다(운영 서버는 파일을 읽기만 한다). 모든 경로는 관리자 API의 다른 경로처럼 관리자가 필요하고, 쓰는 경로는 같은 출처도 확인한다.

**경로** (`/api/monti/v1/schema`, `cms.handle()`이 처리한다):

| 경로 | 하는 일 |
| --- | --- |
| `GET` | 파일의 내용과 `hash`, 쓸 수 있는지(`access`, `has_code`일 때는 `detail`도), 파일에 주석이 있는지(`comments`), 파일이 맞지 않을 때의 `issues`(경로 포함), 적용된 버전, 설정이 코드로 더한 컬렉션, 본문 목록에 쓸 수 있는 블록과 서식 이름 |
| `POST /preview` | 본문 `{ schema, transforms?, renames? }`. 편집을 점검하고 아무것도 쓰지 않는다. `valid`와 `issues`(경로와 메시지), 변경마다의 `impacts`(영향받는 글 수, id와 제목 표본, 결과), `decisions`(저장된 값을 여러 방법으로 다룰 수 있는 변경과 `suggestTransforms`의 선택지, 적용 중인 선택), 기록될 `transforms`와 그 `problems` |
| `PUT` | 본문 `{ schema, transforms?, renames?, baseHash }`. 편집을 저장한다(아래). `baseHash` 뒤로 파일이 바뀌었으면 `409 schema_conflict`, `issues`와 함께 `400 invalid_schema`, `422 invalid_transforms`, `500 schema_apply_failed`(파일은 썼고 데이터베이스는 바뀌지 않았다) |

`transforms`는 작성자의 선택이고 id가 없다(서버가 `<op>-<컬렉션>-<필드>`로 이름 붙인다). 빼면 서버가 결정마다 고른다. 화면이 `renames`로 알려 준 이름 바꾸기(작성자가 이름을 바꾼 필드나 선택지)는 이름 바꾸기, 매핑이나 삭제는 그 값을 가진 **저장된 글이 없을 때만**(값을 지우게 되는 삭제는 작성자 대신 고르지 않는다), 기본값은 값이 있을 때만이다. 선택이 없으면 값은 전처럼 고아로 남는다.

**저장이 하는 일, 순서대로** (처음 실패에서 멈춘다):

1. 편집한 내용에 파일 형식과 `defineConfig`의 규칙을, 변환에는 그 스키마와의 맞음을 확인한다. 편집을 시작한 뒤 디스크의 파일이 바뀌었으면(해시) 저장을 거절한다.
2. 변환을 개발 데이터베이스에서 시험 실행한다. 다시 쓸 수 없는 글이 있으면 파일을 건드리기 전에 저장이 멈춘다.
3. 고른 변환을 `migrations`에 붙인 스키마 데이터로 `monti.schema.ts` 전체를 찍어서 쓴다.
4. 개발 데이터베이스에 `applySchemaChange`를 돌린다(표가 없으면 먼저 만든다). 스키마를 적용된 것으로 기록하는 것도 이때다.
5. 돌고 있는 인스턴스가 새 스키마로 돌게 한다(`hostOf(cms).reloadSchema(schema)`). 그다음 화면이 관리자 페이지를 다시 불러온다.

**프린터.** 파일은 항상 같은 결과를 내는 프린터(`@monti-cms/core/internal/schema-edit`의 `printSchemaFile`)가 쓴다. import 한 줄, `export default defineSchema({ ... });`, 데이터의 키 순서, 탭, 마지막 쉼표, 이름으로 쓸 수 있는 키는 따옴표 없이, 문자열은 큰따옴표다. 짧은 목록과 단순한 값만 든 작은 객체는 한 줄에 두고, 나머지는 항목마다 한 줄이다. **파일의 주석은 저장할 때 사라진다**(파일에 주석이 있으면 화면이 안내를 보여 준다).

**화면이 쓸 수 있을 때.** 파일이 순수 리터럴일 때만이다. `defineSchema` import, `export default defineSchema(<객체 리터럴>)`, 그리고 그 밖에는 아무것도 없는 파일이다(다른 import, 식별자, 전개, 함수 호출, 계산된 키, 템플릿 식이 없다). 주석, 작은따옴표, 마지막 쉼표, 손으로 맞춘 모양은 받아들인다(`parseSchemaLiteral`이 그 부분집합을 읽는다). 파일에 코드가 있으면 화면은 이유 `has_code`로 읽기 전용이 되고, "monti.schema.ts contains code, so the admin cannot rewrite it; edit the file instead" 메시지와 처음 나온 코드의 줄을 보여 주며, 쓰기 경로는 `reason: "has_code"`인 403 `schema_read_only`로 답한다.

**돌고 있는 인스턴스가 스키마를 받는 방법.** `defineConfig({ schema })`로 만든 인스턴스는 다른 스키마로 설정을 다시 만드는 방법과 스키마 파일의 경로를 기억한다(`hostOf(cms).schemaFile()`. 작업 폴더의 `monti.schema.ts` 또는 `src/monti.schema.ts`를 찾거나, `createCms`에 `schemaFile`로 준다). `hostOf(cms).reloadSchema(schema)`는 스키마 데이터를 받아 사이트, 저장소, 서비스, 읽기 API, 핸들러를 **그 자리에서** 바꾼다(같은 `cms` 객체이고 데이터베이스 연결은 공유한다). 개발 모드에서만 하고, 운영에서는 아무것도 하지 않는다. 운영 서버는 빌드할 때의 스키마로 돈다. `monti.schema.ts`를 손으로 고치면 개발 서버의 핫 모듈 리로드가 받는다(`monti.config.ts`가 스키마를 가져오므로 Next가 `monti.config.ts`를 다시 평가한다). 관리자가 저장하면 돌고 있는 인스턴스에 `hostOf(cms).reloadSchema(schema)`를 부른다. 확인되지 않는 스키마는 한 번 알리고, 인스턴스는 마지막으로 좋았던 스키마를 쓴다. 그래서 `next dev`를 다시 켜지 않아도 관리자가 저장한 변경을 보여 준다. `hostOf(cms).forSchema(schema)`는 어떤 스키마에 대한 다른 인스턴스를 설치하지 않고 만든다. 설정 화면이 편집을 점검하는 데 쓴다.

화면은 컬렉션(이름표, 아이콘, 종류, 공개 주소, 본문과 허용 블록·서식·제목 단계), 모든 종류의 필드와 그 옵션(추가, 삭제, 이름 바꾸기, 순서 바꾸기, 필수와 언어, 선택지, 조건부 분기), 배치 묶음, 목록 열, 언어와 시간대를 편집한다. 일반 데이터지만 거의 바뀌지 않는 것(`site`, `admin`, `seed`, 기록된 `migrations`)은 편집하지 않고 보여 주기만 하며, 파일에서 고친다. 코드(`monti.config.ts`)에 적은 컬렉션은 파일에 없으므로 화면이 편집할 수 없다고 알려 준다.

## 설정

`codeBlock`·`media`·`editor`를 뺀 이 표의 항목은 스키마 파일에 대신 적을 수 있고("스키마 파일"), `plugins`와 `blocks`는 언제나 코드다. 아래 규칙은 어느 쪽이든 같다.

| 항목 | 뜻 |
|---|---|
| `collections` | 컬렉션 이름 → `defineCollection` 정의. 이름은 DB에 저장되므로 운영 중에 바꾸지 않는다. |
| `locales` | 콘텐츠 언어 목록(`code`, `name`, 관리자 화면 이름 `label`). |
| `defaultLocale` | 기본 언어(번역의 원본). 기본 주소 방식에서는 공개 주소에 언어 접두사가 붙지 않는다. |
| `site.url` | 공개 사이트 주소. 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다. 환경 변수에서 읽어도 된다. |
| `site.aliases` | 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). |
| `site.name` | 관리자 화면에 보이는 사이트 이름. 없으면 `site.url`의 호스트 이름. |
| `site.home` | 관리자 사이드바의 `사이트 보기` 아이콘 단추(사이트 이름 옆)가 여는 주소. 경로나 전체 주소. 기본 `/`. |
| `site.localePrefix` | 공개 주소에 언어를 붙이는 방식. `except-default`(기본: 기본 언어는 그대로, 다른 언어는 `/{code}`)·`always`(모든 언어에 `/{code}`)·`never`(붙이지 않음). 검색 미리보기·초안 미리보기·`localizePath`가 따른다. |
| `site.previewPath` | 초안 미리보기 주소 앞부분(예: `/preview`). 없으면 미리보기 단추가 없다. |
| `site.previewLocaleParam` | 미리보기 주소에 언어를 넘기는 쿼리 이름(기본 `locale`, 기본 언어가 아닐 때만 `?locale=en`). `false`면 `localePrefix` 규칙대로 경로에 넣는다(`/preview/en/posts/a`). |
| `admin.path` | 관리자 화면 경로(설정의 기본값은 `/admin`이고, `monti init`은 `/studio`로 적는다). 앱의 관리자 라우트 폴더와 같아야 한다. `/`나 `/api` 아래는 안 된다. 화면 안 링크·로그인 이동·플러그인 화면 주소가 따른다. |
| `seed.templates` | 첫 마이그레이션이 저장소를 만들 때 한 번 넣는 본문 템플릿. `{ id, name, doc }`(저장된 문서) 또는 `{ id, name, body, format }`(글과 그것을 읽는 형식, "형식" 절). |
| `codeBlock.lineEffects` | 코드 블록 줄 효과 더하기·바꾸기("코드 블록 줄 효과"). |
| `codeBlock.omitLineEffects` / `features` / `themes` / `languages` | 편집기의 줄 효과·도구 감추기, 강조 테마, 언어 더하기("코드 블록 도구 끄기·테마·언어"). |
| `media` | 올릴 수 있는 미디어. `maxImageBytes`(기본 10MB)·`maxPixels`(기본 4천만)·`maxFileBytes`(기본 50MB)와 받을 형식 `imageTypes`(jpeg·png·webp·gif·avif 가운데)·`fileTypes`(pdf·zip·txt·md·csv·json 가운데, 빈 목록이면 첨부 파일을 받지 않음). 업로드 API·관리자 파일 고르기 창·`/v1/meta`가 따른다. |
| `editor.widths` | 편집기 본문 폭 메뉴의 단계: `{ label, width }`의 목록이고 `width`는 CSS 길이(`"720px"`, `"48rem"`)다. 메뉴는 이 순서대로 보여 주고 편집기는 첫 단계에서 시작한다. "전체"(폭 제한 없음, 이름은 관리자 언어를 따른다)는 항상 맨 끝에 붙는다. 공개 페이지의 본문 폭에 맞추고, 휴대폰 폭(`{ label: "모바일", width: "375px" }`)을 더해 글이 어떻게 접히는지 확인한다. 없으면 메뉴에는 "보통"(`48rem`)과 "전체"만 있다. 이름표는 비어 있지 않고 서로 달라야 하며, CSS 길이가 아닌 폭은 설정을 읽을 때 오류다. 고른 단계는 사이트별로 브라우저가 기억하고, 설정에서 사라진 단계는 첫 단계로 돌아간다. |
| `admin.locale` | 관리자 화면 언어와 날짜·숫자 표기(BCP 47, 예: `en`·`ko-KR`). 없으면 사이트 기본 언어(`defaultLocale`). 시각은 `timeZone`으로 보인다. |
| `admin.messages` | 화면 문구 덮어쓰기: 이름공간 → 키 → 문구. 본체 블록 이름표는 `"cms.blocks"`(`image.label`처럼 `<블록>.label`), 코드 블록 효과는 `"cms.code-block"`, 검사 오류 문구는 `"cms.core"`·`"cms.translation"`, 오류 코드마다의 문구는 `"cms.core.errors"`, 본체가 더 자세히 알리는 오류 문구(확장자를 바꿀 수 없는 파일 이름, 할 수 없는 상태 변경 등)는 `"cms.core.notices"`이다(MDX를 읽을 때의 문구는 `@monti-cms/mdx`의 `"cms.mdx"`). |
| `admin.templates` | `false`면 관리자에서 본문 템플릿을 감춘다: 편집기의 템플릿 메뉴, 설정 > 템플릿 탭(그 주소는 404). 기본 `true`. 저장된 템플릿은 그대로 남는다. |
| `admin.translations` | `false`면 관리자에서 번역 UI를 감춘다: 편집기의 언어 탭, 목록의 언어 열·필터, 항목 패널의 언어 탭. 기본 `true`. 언어가 하나인 사이트는 이 값과 상관없이 보이지 않는다. |

### 컬렉션

- **종류(`kind`).** `document`(문서)는 본문을 쓰고 초안과 공개본을 나눠 명시적으로 발행한다. `item`(항목)은 작은 폼에서 저장하면
  곧바로 공개 값에 반영한다(발행·보관·번역본이 없고, 언어별 값은 `translations`에 둔다). 본문(`body`)은 없으면 문서만 쓴다. `body`를 객체로 쓰면 본문이 허용하는 블록·마크·제목 단계를 제한한다("본문별 허용 블록·마크").
- **배치(`layout`).** 없으면 필드 선언 순서대로 한 묶음이다. 플러그인은 제 필드를 제 탭에 둔다(탭 참고).
- **목록 열.** 스키마에 속하지 않는다. 열은 각 관리자가 목록 화면의 컬럼 설정에서 고르고, 계정마다 저장된다. 고르기 전에는 기본 열이 보인다. 문서는 제목·상태·언어(언어가 둘 이상일 때)·분류 필드(항목 컬렉션을 가리키는 관계)·수정일·발행일, 항목은 제목·주소(주소 필드가 있을 때)·언어·상태·수정일.

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
  정하고 필드 종류를 플러그인 `checkConfig`에서 확인한다(예: SEO 확장의 `seoTitle`·`ogImage`·`noindex`).
- **미디어 필드.** `fields.media({ label, accept?: "image" | "file" })`는 미디어 라이브러리의 파일 하나를 고르고 미디어 ID를
  글자로 저장한다. 값은 미디어 사용처(`entry_references`, 종류 `media`)에 잡혀 미디어 화면의 "사용처"·"사용하지 않음" 거르기에
  보이고, 쓰고 있는 파일은 지울 수 없다. 미디어 ID가 아닌 값은 `invalid_metadata_value`, 빈 값(`""`)은 고르지 않은 것이다.

- **필수 필드(`required: true`).** 문서 컬렉션은 발행할 때, 항목 컬렉션은 저장할 때 비어 있으면 막는다. 초안 저장은 막지 않는다.
  제목 필드(`title` 역할이 있는 필드, 없으면 이름이 `title`인 텍스트 필드)는 `required`를 어떻게 쓰든 항상 필수다. 검사에서 `required: true`로 취급한다.
  예전 값 `required: "publish"`는 없앴다(`true`를 쓴다). 아직 쓰는 설정은 안내 메시지와 함께 실패한다.
- **필드 값 오류.** 오류 코드는 필드와 상관없이 같다. 필수값이 비면 `missing_field`(주소는 `null_slug`), 글자 수가 `max`를
  넘으면 `field_too_long`이다. 문제(`issues`)의 `path`에 필드 이름, `message`에 필드 이름표가 담긴다(제목도 같다). 관계 대상
  컬렉션이 다르면 `invalid_reference_collection`이다. 빈 본문(`empty_body`)은 본문을 쓰는 컬렉션(`body`)만 막는다.
- **본문에서 채우기.** 텍스트 필드에 `fillFromBody: true`(160자) 또는 `fillFromBody: { maxLength }`를 두면 발행할 때 비어 있으면
  본문 앞부분의 일반 글자로 채운다(본문이 있는 컬렉션만, 필드 `max`를 넘지 않는다). 본체 함수는 `bodyExcerpt(doc, maxLength)`다. 글자는 저장된 문서에서 뽑으므로 본문이 어떤 표기로 쓰였든 상관없다. 문단·제목·목록 항목·표 칸·블록 본문과 블록의 글자 속성(콜아웃 제목)이 대상이고, 코드·수식·이미지는 뺀다. 본문 검색용 글자도 같은 방식으로 만들며, 코드와 이미지 대체글·캡션은 남긴다.
- **여러 줄 입력.** `multiline: true`인 텍스트 필드는 여러 줄 입력이고 `rows`(기본 2)로 처음 줄 수를 정한다.
- **쓸 수 없는 필드 이름.** 메타데이터에서 본체가 따로 쓰는 키(`translations`)는 필드 이름으로 쓸 수 없다.
- **탭.** `layout` 묶음에 `tab: "이름"`을 두면 편집 화면 속성 칸에 그 이름의 탭이 생긴다(1~20자). 탭은 묶음에만 있고 필드에는 `tab`이 없다.
  필드 묶음을 주는 플러그인(예: SEO 확장의 `seoFields()`)은 `contributes`의 `layout` 키로 자리를 정한다: 탭 이름과 그 필드의 역할·보기 이름
  (`{ tab: "SEO", roles: [...], views: [...] }`, 타입은 `PluginPlacement`). 그 필드는 사이트의 `layout`이 뭐라 하든 그 탭에 그려지고,
  설정 화면에는 거기에 잠긴 것으로 보인다. 첫 탭은 `tab`이 없는 묶음을 담는 기본 탭이다. 보이는 제목은 기본적으로 관리자의 문구("속성")이며, 컬렉션 스키마의 `defaultTab: "이름"`으로 원하는 제목을 지정할 수 있다. `site.panelGroupsOf(collection)`·`site.panelTabsOf(collection)`·`site.panelTabOf(collection, path)`가
  속성 칸, 항목 칸, 설정 화면이 함께 쓰는 하나뿐인 묶음 계산이다. 문서의 제목은 편집 화면의 제목줄이라 속성 칸에는 그리지 않는다.
- **보기 필드.** `fields.view({ view: "이름" })`은 값을 저장하지 않고 그 자리에 화면을 그리는 필드다. 화면은 관리자 확장이
  `fieldViews`로 등록한다(예: SEO 확장의 `search`). 등록한 화면이 없으면 아무것도 그리지 않는다.
- **입력 바꾸기.** `input: "이름"`은 관리자 확장이 `fieldInputs`로 등록한 입력을 가리킨다. 등록이 없으면 종류의 기본 입력이다.
  `inputOptions`(JSON 값)는 그 입력에 넘길 설정이고 본체는 읽지 않는다(예: 권장 글자 수).

```ts
fields: {
	title: fields.text({ label: "Title", required: true }),
	slug: fields.slug({ label: "Slug", from: "title" }),
	excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, rows: 3, fillFromBody: { maxLength: 200 } }),
	hero: fields.media({ label: "Hero image" }),
	credit: fields.text({ label: "Credit" }),
},
layout: [
	{ fields: ["title", "slug", "excerpt"] },
	{ group: "Image", tab: "Media", fields: ["hero", "credit"] }, // 탭은 묶음에 이름을 붙인다
],
```

`defineConfig`는 관계 필드가 없는 컬렉션을 가리키거나, 기본 언어가 목록에 없거나, 제목 필드가 없거나, 주소 필드가 둘 이상이거나,
역할이 겹치거나 `summary`나 `title`이 텍스트 필드가 아니거나, 탭 이름이 1~20자가 아니거나, `from`·`fillFromBody`가 필드와 맞지 않거나,
필드 이름이 `translations`이거나, 컬렉션 종류가 없거나, `admin.path`·`site.localePrefix`·`site.previewLocaleParam`·`site.home`
모양이 틀리면 앱이 뜰 때 바로 오류를 낸다.

복제(`POST /api/monti/v1/entries/:id/duplicate`)는 본문에 `{ title }`을 받으면 복제본 제목을 그 값으로 둔다(관리자 화면은 원본
제목에 "(복사)"를 붙여 보낸다). 없으면 원본 제목 그대로다. 본체는 붙일 말을 정하지 않고, 복제본도 다른 쓰기와 같은 쓰기 파이프라인을 지난다.

## 레시피

확장 지점마다 코드(CI가 타입 검사를 한다)가 있는 짧은 페이지가 [`docs/recipes`](../../docs/recipes/README.md)에 있다. 발행할 때 Slack 메시지 보내기, 나만의 블록(정의, 편집기 뷰, 공개 컴포넌트, 검사), 관리자 필드 화면 직접 만들기, 저장 전 슬러그 규칙, 나만의 형식, 공개 사이트의 타입 있는 읽기, 플러그인의 관리자 페이지, 엄격한 404/308 프록시다. 페이지마다 필요한 개념과 코드가 나온다.

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
