# Monti

[English](README.md) | 한국어

개발 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것이다. 이탈리아어로 "산들"이라는 뜻이기도 하다.

## 빠른 시작: 기존 Next 앱에 Monti 더하기

Next.js(App Router) 앱 폴더에서 실행한다.

```sh
# 1. @monti-cms/core를 GitHub 주소로 추가한다(공개 릴리스 전에는 pnpm만 된다)
pnpm add "@monti-cms/core@github:monti-cms/monti#release/v0.2.0-next.1&path:/core"
# 2. init을 돌린다. 나머지 Monti 패키지는 같은 릴리스에서 설치된다
pnpm exec monti init
```

앱을 살펴본 뒤(App Router, `src/` 여부, 패키지 매니저, TypeScript, 이미 있는 Markdown·MDX `content/` 폴더) 몇 가지를 묻고, Monti가 새로 만드는 파일만, 읽고 고칠 수 있게 그대로 적어 준다. `monti.config.ts`(기능마다 한 줄, 줄마다 주석), `monti.schema.json`(시작용 `post` 컬렉션. 콘텐츠가 있으면 front matter를 따른다), Next 파일 셋(`app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx`, `app/api/cms/[...path]/route.ts`), 주석이 달린 `.env.example`(변수마다 무엇이고 어디서 얻는지)이다. 설치 명령을 보여 주고 물은 뒤에 돌린다. **이미 있는 파일은 하나도 고치지 않고**(`next.config`, 루트 레이아웃, `tsconfig.json`, `.gitignore`) `.env.local`도 쓰지 않는다. 대신 남은 일을 복사할 내용 그대로 번호를 붙여 쉬운 말로 적어 준다(`next.config`의 `withCms` 변경, `<html>`의 `suppressHydrationWarning`, `cp .env.example .env.local`, 그다음 `monti migrate`, `monti doctor`, `pnpm dev`). 데이터베이스는 건드리지 않는다.

전체 흐름:

```text
설치 → monti init → monti migrate → monti doctor → pnpm dev
```

pnpm 12라면 1단계 전에 `pnpm-workspace.yaml`에 이렇게 적는다(core가 쓰는 `tsx`가 esbuild를 가져오고, pnpm 12는 그 설치 스크립트를 허락할 때까지 설치를 멈춘다. Monti는 그 파일을 고치지 않는다).

```yaml
allowBuilds:
  esbuild: true
```

- **질문:** 언어, 이미지 저장소(S3·R2·MinIO 또는 없음), 부가 기능(AI 글쓰기, git 동기화), 본문 블록, 관리자 경로(기본 `/studio`). 로그인은 만들지 않는다. 배포하기 전에 직접 더하며(예: GitHub), `monti doctor`가 알려 준다.
- **질문 없이:** 모든 질문에 플래그가 있고, `--yes`는 기본값을 쓰고 묻지 않고 설치한다. `--no-install`은 설치하지 않고 설치 명령을 적어 준다. CI와 AI 도구를 위해 `--json`은 결과를 JSON으로, `--dry-run`은 하게 될 일만 보여 준다. `monti init --help`나 [core README](packages/core/README.ko.md)의 "`monti init`"을 본다.
- **안전:** 이미 있는 파일은 고치지 않고(이미 있는 파일은 건너뛰고 알려 준다), 묻지 않고 덮어쓰지 않고, 프로젝트 밖에는 쓰지 않으며, 중간에 멈추면 무엇을 썼는지 알려 준다. 설치가 실패하면 그렇게 말하고 설치 명령을 그대로 적어 준다. `monti init`을 다시 돌리면 이어서 하고, 있는 파일은 그대로 둔다.
- **언어:** `hello.ko.mdx` + `hello.en.mdx` 같은 파일 이름(또는 `ko/`, `en/` 폴더)이 사이트 언어가 된다. `--yes`에서는 그대로 쓰고, 기본 언어는 짝이 없는 파일을 가진 언어다.
- **블록:** 기본 본문 블록은 가벼운 묶음이고, `mermaid`와 `chart`는 직접 고를 때만 들어간다(`--blocks all`). 둘은 `@monti-cms/blocks/mermaid`와 `@monti-cms/blocks/chart`에서 오고, 고른 경우에만 `mermaid`와 `recharts`가 따라오므로 고르지 않은 앱은 둘 다 불러오지도 설치하지도 않는다.

공개 릴리스 전에는 `@monti-cms/core`를 먼저 GitHub 주소로 추가하고(위 1단계), 나머지 Monti 패키지는 `monti init`이 같은 릴리스에서(`package.json`에 적힌 ref를 그대로 써서) 설치하고, 외부 패키지는 npm에서 설치한다. `monti`는 언제나 `@monti-cms/core`를 설치한 뒤에 돌린다. 설치 전의 `npx monti`는 관계없는 다른 패키지를 받는다. 모든 명령을 담은 짧은 안내는 core README의 [빠른 시작](packages/core/README.ko.md#빠른-시작-기존-next-앱)이다.

## 조용히 하는 자동 동작은 없다

`monti doctor`가 `config/automatic`에서 Monti가 스스로 정한 것(데이터베이스와 그 출처 변수, 로그인, 개발 로그인 우회, 호스트 신뢰, `SITE_URL`, 스키마 파일)과 각 값의 출처를 보여 준다. 자동 동작마다 끄거나 바꾸는 법은 [core README](packages/core/README.ko.md)의 "Monti가 스스로 정하는 것과 끄는 법"에 있다.

## 문제 해결: `monti doctor`

동작하지 않는 것이 있으면 앱 폴더에서 이것을 돌린다.

```sh
pnpm exec monti doctor
```

설정 전체를 점검하고 검사마다 `ok`, `warn`, `FAIL`로 보여 준다. 경고와 실패마다 무엇이 잘못됐는지, 어디(파일이나 환경 변수)인지, 어떻게 고치는지를 적는다: 설정 파일과 스키마 파일, `DATABASE_URL`과 데이터베이스에 닿는지·마이그레이션됐는지(미적용 마이그레이션이 몇 개인지, `monti migrate`), `MONTI_SECRET`, GitHub 로그인 설정(등록할 콜백 URL, 관리자 id, `SITE_URL`), Next 파일 셋, Monti가 스스로 정한 값과 그 출처, `upgrade/` 검사(개편 전 설정에서 올리는 사이트만 해당하며 소유자의 블로그 마이그레이션(#93) 뒤에 지운다). `--json`은 도구를 위해 결과를 찍으며, 검사가 실패하면 종료 코드가 1이다. 패키지가 던지는 오류도 같은 내용을 같은 말투로 알려 준다. [core README](packages/core/README.ko.md)의 "문제 해결: `monti doctor`"를 본다.

## 패키지

| 패키지 | 하는 일 |
| --- | --- |
| [`@monti-cms/core`](packages/core/README.ko.md) | 본체. 설정, 글 저장·발행, 문서 모델, 관리자 API, 명령줄(`monti`) |
| [`@monti-cms/mdx`](packages/mdx/README.ko.md) | MDX 확장. `mdx` 형식, 관리자 원문 패널, `renderMdx`, 문법 확장 API |
| [`@monti-cms/admin`](packages/admin/README.ko.md) | 관리자 화면. 편집기, 글 목록, 미디어, 템플릿. 프레임워크에 묶이지 않고 라우터는 어댑터로 받는다 |
| [`@monti-cms/auth`](packages/auth/README.ko.md) | `Request`·`Response` 위의 관리자 로그인(Auth.js core). 프로바이더를 갈아 끼운다. GitHub가 들어 있다 |
| [`@monti-cms/nextjs`](packages/nextjs/README.ko.md) | Next.js 어댑터. 라우트 핸들러, `next.config.ts` 연결, App Router 어댑터를 얹은 관리자 페이지·레이아웃, 로그인의 Next 쪽 |
| [`@monti-cms/blocks`](packages/blocks/README.ko.md) | 블록 확장. 콜아웃, 접기, 탭, 단 나누기, 코드 탐색기, Mermaid, 차트 |
| [`@monti-cms/ai`](packages/ai/README.ko.md) | AI 확장. 글쓰기·번역 같은 AI 기능 |
| [`@monti-cms/seo`](packages/seo/README.ko.md) | SEO 확장. 검색·공유 필드와 미리보기 |
| [`@monti-cms/bareun`](packages/bareun/README.ko.md) | 바른(Bareun) 맞춤법 검사 |
| [`@monti-cms/storage-s3`](packages/storage-s3/README.ko.md) | S3 API 미디어 저장소(AWS S3, Cloudflare R2, MinIO). `s3Storage()` 하나, `S3_*` 환경 변수로 설정 |
| [`@monti-cms/git-sync`](packages/git-sync/README.ko.md) | Git 동기화 확장. 발행한 글을 GitHub 저장소의 파일과 양방향으로 동기화하고, 충돌 화면을 제공 |
| [`@monti-cms/syntax-directive`](packages/syntax-directive/README.ko.md) | 지시자 문법 확장. `:::callout`·`::image{…}`·`:u[글자]`를 읽고 쓴다 |
| [`@monti-cms/syntax-shiki`](packages/syntax-shiki/README.ko.md) | Shiki 코드 표기 확장. 코드 펜스의 `// [!code ++]` 등을 Monti 코드 주석으로 읽는다 |

## 지원하는 프레임워크

지금은 Next.js(App Router)만 지원한다. Next.js를 가져다 쓰는 곳은 `@monti-cms/nextjs`뿐이다. 코어는 표준 `Request`·`Response`로 말하고, 관리자는 받은 작은 어댑터로 라우터에 닿는다. 다른 프레임워크는 코어나 관리자를 고치지 않고 어댑터 패키지를 새로 만들어 붙인다. 코어 README의 "지원하는 프레임워크"를 본다.

## 설치

아직 npm에 올리지 않았다. 공개 전에는 `release` 브랜치의 배포 묶음을 GitHub 주소로 설치한다(pnpm만 된다).

```json
{
	"dependencies": {
		"@monti-cms/core": "github:monti-cms/monti#release/v0.2.0-next.1&path:/core",
		"@monti-cms/admin": "github:monti-cms/monti#release/v0.2.0-next.1&path:/admin",
		"@monti-cms/nextjs": "github:monti-cms/monti#release/v0.2.0-next.1&path:/nextjs"
	}
}
```

다른 패키지도 `path:/<폴더 이름>`만 바꿔 같은 태그로 넣는다.

MDX(`mdx` 형식, 원문 패널, 문법 확장)와 AI 확장에는 `@monti-cms/mdx`가 필요하며 같은 방식으로 설치한다. 설치 방법과 설정은 각 패키지의 README에 있다. 모두 붙인 예시 앱은 [`examples/blog`](examples/blog/README.ko.md)이며, 설정 파일은 완성된 `cms` 인스턴스를 내보내는 `monti.config.ts` 하나다.

## 레시피

Monti를 확장하는 방법을 다루는 짧은 페이지들로, 각각 작은 예시 스케치가 실려 있다(테스트된 코드는 아니다). 발행할 때 Slack 메시지 보내기, 나만의 블록(정의, 편집기 뷰, 공개 컴포넌트, 검사), 관리자 필드 화면 직접 만들기, 저장 전 슬러그 규칙, 나만의 형식, 공개 사이트의 타입 있는 읽기, 플러그인의 관리자 페이지, 엄격한 404/308 프록시가 있다. [`docs/recipes`](docs/recipes/README.md)에서 시작하면 된다.

## 개발

```sh
pnpm install          # 설치
pnpm lint             # 코드 검사 (고치려면 pnpm lint:fix)
pnpm check:korean     # 실행 코드의 한국어 문구가 문구 사전에만 있는지 검사
pnpm typecheck        # 모든 패키지 타입 검사
pnpm build            # 모든 패키지 빌드 (core → auth → storage-s3 → mdx → syntax-directive → syntax-shiki → admin → nextjs → ai → blocks → bareun → seo → git-sync)
pnpm test:run         # 테스트 (Postgres 필요)
pnpm example:check    # 패키지를 묶어 예시 앱에 설치하고 빌드까지 확인
```

커밋할 때 코드 검사(lint-staged)와 커밋 메시지 검사(commitlint)가 자동으로 돈다. 커밋 메시지는 영어로 `type(scope): subject` 꼴로 쓴다(예: `feat(core): add thing`). 범위(scope)는 `core`, `storage-s3`, `admin`, `nextjs`, `ai`, `blocks`, `mdx`, `seo`, `bareun`, `git-sync`, `syntax`, `example`, `scripts`, `ci`, `deps`, `release`, `repo` 중에서 고르고 생략해도 된다. push할 때는 lint·check:korean·typecheck가 돈다.

테스트는 `.env.local`에 테스트용 DB 주소(`CMS_TEST_DATABASE_URL`)가 있어야 전부 돈다. 테스트는 이 DB에 임시 스키마를 만들고 끝나면 지운다.

## 버전 내기

```sh
node scripts/version.mjs 0.1.0   # 모든 패키지 버전을 한 번에 바꾼다
git commit -am "chore(release): v0.1.0"
git tag v0.1.0 && git push origin main v0.1.0
```

`v*` 태그가 올라가면 배포 워크플로(`.github/workflows/release.yml`)가 패키지를 빌드·묶어 `release` 브랜치에 커밋하고 `release/v0.2.0-next.1` 태그를 붙인다.

## 라이선스

[MIT](LICENSE)
