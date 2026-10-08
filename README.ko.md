# Monti

[English](README.md) | 한국어

개발 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것이다. 이탈리아어로 "산들"이라는 뜻이기도 하다.

## 빠른 시작: 기존 Next 앱에 Monti 더하기

Next.js(App Router) 앱 폴더에서 실행한다.

```sh
# 공개 릴리스 전에는 @monti-cms/core를 먼저 릴리스 번들로 설치한다("설치" 참고)
# pnpm
pnpm add @monti-cms/core
pnpm exec monti init

# npm
npm install @monti-cms/core
npx monti init

# yarn
yarn add @monti-cms/core
yarn monti init

# bun
bun add @monti-cms/core
bunx monti init
```

앱을 살펴본 뒤(App Router, `src/` 여부, 패키지 매니저, TypeScript, Tailwind, 이미 있는 Markdown·MDX `content/` 폴더) 몇 가지를 묻고, 읽고 고칠 수 있는 파일을 그대로 적어 준다. `monti.config.ts`(기능마다 한 줄, 줄마다 주석), `monti.schema.json`(시작용 `post` 컬렉션. 콘텐츠가 있으면 front matter를 따른다), Next 파일 셋(`app/studio/layout.tsx`, `app/studio/[[...path]]/page.tsx`, `app/api/cms/[...path]/route.ts`), `.env.example`, `.env.local`(만든 `MONTI_SECRET`과 직접 입력한 값만)이다. 패키지를 설치하고, `next.config.ts`를 `withCms`로 감싸고(바뀐 내용을 diff로 보여 준다), DB에 닿으면 `monti migrate`를 돌린 뒤, 남은 일을 정확한 값과 함께 쉬운 말로 적어 주고, 동작하지 않을 때를 위해 `monti doctor`를 가리킨다.

- **질문:** 데이터베이스(URL, 로컬 Docker Postgres, 나중에), GitHub 로그인, 언어, 이미지 저장소(S3·R2·MinIO 또는 없음), 부가 기능(AI 글쓰기, git 동기화), 본문 블록, 관리자 경로(기본 `/studio`), 블로그 테마 페이지 설치 여부.
- **질문 없이:** 모든 질문에 플래그가 있고, `--yes`는 기본값을 쓴다. CI와 AI 도구를 위해 `--json`은 결과를 JSON으로, `--dry-run`은 하게 될 일만 보여 준다. `monti init --help`나 [core README](packages/core/README.ko.md)의 "`monti init`"을 본다.
- **안전:** 묻지 않고 파일을 덮어쓰지 않고, 프로젝트 밖에는 쓰지 않으며, 중간에 멈추면 무엇을 썼는지 알려 준다. 단계(설치, 테마, typography 플러그인, 테이블)가 실패하면 "Monti를 추가했다"고 하지 않고, 실패한 단계와 일을 끝낼 정확한 명령을 순서대로 적는다. `monti init --resume`은 끝나지 않은 단계만 다시 돌린다.
- **pnpm 12:** esbuild의 설치 스크립트를 허락할 때까지 설치를 멈춘다. `pnpm-workspace.yaml`에 `allowBuilds:`와 `esbuild: true`를 적는다(키를 두 번 쓰지 않는다). `monti init`이 확인하고 diff와 확인을 거쳐 고친다.
- **언어:** `hello.ko.mdx` + `hello.en.mdx` 같은 파일 이름(또는 `ko/`, `en/` 폴더)이 사이트 언어가 된다. `--yes`에서는 그대로 쓰고, 기본 언어는 짝이 없는 파일을 가진 언어다.
- **기존 글:** Markdown·MDX 폴더가 있으면 끝에서 `monti import <폴더>`를 권한다. 기본 본문 블록은 가벼운 묶음이고, `mermaid`와 `chart`는 직접 고를 때만 들어간다(`--blocks all`). 둘은 `@monti-cms/blocks/mermaid`와 `@monti-cms/blocks/chart`에서 오고, 고른 경우에만 `mermaid`와 `recharts`가 따라오므로 고르지 않은 앱은 둘 다 불러오지도 설치하지도 않는다.

공개 릴리스 전에는 `@monti-cms/core`를 먼저 릴리스 번들로 설치하고("설치" 참고), 나머지는 `monti init`이 설치한다. `monti`는 언제나 `@monti-cms/core`를 설치한 뒤에 돌린다. 설치 전의 `npx monti`는 관계없는 다른 패키지를 받는다. 모든 명령을 담은 짧은 안내는 core README의 [빠른 시작](packages/core/README.ko.md#빠른-시작-기존-next-앱)이다.

## 문제 해결: `monti doctor`

동작하지 않는 것이 있으면 앱 폴더에서 이것을 돌린다.

```sh
pnpm exec monti doctor
```

설정 전체를 점검하고 검사마다 `ok`, `warn`, `FAIL`로 보여 준다. 경고와 실패마다 무엇이 잘못됐는지, 어디(파일이나 환경 변수)인지, 어떻게 고치는지를 적는다: 설정 파일과 스키마 파일, `DATABASE_URL`과 데이터베이스에 닿는지·마이그레이션됐는지(미적용 마이그레이션이 몇 개인지, `monti migrate`), `MONTI_SECRET`, GitHub 로그인(등록할 콜백 URL, 관리자 id, `SITE_URL`), Next 파일 셋, 옛 두 파일 설정에서 남은 것(정확한 이름 바꾸기 단계와 함께), 플러그인이 더한 검사(git-sync 토큰과 웹훅, S3 값, AI 연결, MDX 문법 확장). `--online`은 git-sync 저장소와 S3 버킷도 확인하고, `--json`은 도구를 위해 결과를 찍으며, 검사가 실패하면 종료 코드가 1이다. 패키지가 던지는 오류도 같은 내용을 같은 말투로 알려 준다. [core README](packages/core/README.ko.md)의 "문제 해결: `monti doctor`"를 본다.

## 관리자 화면 직접 고치기

대부분의 사이트는 관리자에 무언가를 더하는 방식으로 바꾼다. 필드 타입, 블록, 플러그인 화면이 그렇다([core README](packages/core/README.ko.md)의 "플러그인"). 그걸로 모자랄 때는 관리자를 직접 손에 쥐는 길이 두 가지 있다. 어느 쪽이 맞는지는 얼마나 남겨 두고 싶은지에 달렸다.

두 길의 원칙은 같다. 사용자가 만지는 것(화면, 에디터, 블록)은 열고, core가 지키는 것(저장소, 마이그레이션, 쓰기 파이프라인)은 닫는다. 직접 만든 관리자도 저장은 core를 거치므로 그 부분은 계속 업그레이드를 받는다.

### 길 1: 훅으로 관리자를 새로 만든다

`@monti-cms/admin/hooks`(실험적)는 UI 없이 에디터를 상태와 명령으로 준다. `useEntryEditor`(불러오기, 복구 사본, 저장, 발행, 상태 변경, 충돌), `useField`(폼 필드 하나), `useBlockEditor`와 `Content`·`BlockFrame`(블록의 뷰), `blockViews`(블록 뷰 등록)가 있다. 훅은 토스트를 띄우거나 대화상자를 열거나 이동하지 않으므로 화면은 전부 직접 그린다. 기본 관리자도 같은 훅 위에 있다. `monti add`로 설치하는 레지스트리 항목(예: `entry-editor`, `article-body`)은 내 것이 되는 예제이니 출발점으로 쓸 수 있다.

```tsx
"use client";
import { EntryEditorProvider, useEntryEditor, useField } from "@monti-cms/admin/hooks";

function TitleInput() {
	const title = useField("title");
	return <input {...title.inputProps} value={String(title.value ?? "")} onChange={(event) => title.setValue(event.target.value)} />;
}

export function MyEntryEditor({ adminId, entryId }: { adminId: string; entryId: string }) {
	const editor = useEntryEditor({ adminId, target: { mode: "edit", entryId } });
	if (editor.load.status !== "ready") return null;
	return (
		<EntryEditorProvider editor={editor}>
			<TitleInput />
			<button type="button" onClick={() => void editor.save()}>
				저장
			</button>
		</EntryEditorProvider>
	);
}
```

레이아웃이나 편집 흐름이 다른 관리자, 또는 화면 하나만 직접 만들고 싶을 때 고른다. 복사하는 것이 없으므로 나머지 관리자는 계속 업데이트된다. 자세한 설명은 [admin README](packages/admin/README.ko.md)를 본다.

### 길 2: `monti eject`로 설치된 관리자를 고친다

```sh
pnpm exec monti eject @monti-cms/admin --dry-run   # 무엇을 쓰는지만 보여 주고 바꾸지 않는다
pnpm exec monti eject @monti-cms/admin             # 먼저 묻는다. --yes면 묻지 않는다
```

`monti eject <package>`는 UI 패키지의 소스를, 설치된 버전 그대로 내 저장소에 복사하고 앱이 그 복사본을 쓰게 한다. 그 뒤로는 내 코드처럼 고치고, 고치면 다음 새로고침에 바로 보인다.

- **eject할 수 있는 것:** UI 패키지인 `@monti-cms/admin`, `@monti-cms/blocks`, `@monti-cms/seo`, `@monti-cms/ai`. `seo`와 `ai`는 관리자 부분과 서버 부분이 한 패키지라서 통째로 가져온다. core, auth, mdx, nextjs, 저장소 패키지와 그 밖의 데이터 패키지는 이유와 함께 거절한다. 저장소, 마이그레이션, 쓰기 파이프라인은 계속 업그레이드를 받아야 하기 때문이다. 목록은 `packages/core/src/cli/eject/allowlist.ts` 한 파일에 있다.
- **어디에 놓이나:** `packages/monti-admin/`(`monti-blocks`, `monti-seo`, `monti-ai`)에 워크스페이스 패키지로 놓인다. 워크스페이스 패키지는 어느 패키지 매니저든 실시간으로 연결하고 그 패키지의 의존성도 설치해 주는 유일한 형태이고, `packages/`는 사이트의 나머지와 함께 버전 관리 아래에 있다. 패키지 이름은 그대로라서 import는 바뀌지 않고, `@monti-cms/admin`이 필요한 다른 Monti 패키지도 내 복사본을 쓴다.
- **앱에서 바뀌는 것:** `package.json`의 의존성이 `workspace:*`(npm과 yarn classic은 `*`)가 되고, 폴더가 `pnpm-workspace.yaml`이나 `workspaces` 필드에 더해지며, 패키지를 고정해 둔 override는 복사본을 가리키게 바뀐다. `.monti/ejected.json`에 `{ package, version, ejectedAt, directory }`가 기록되고(기록이 커밋되도록 `.gitignore`도 고친다), 패키지 매니저의 install이 돈다. `withCms`가 eject한 패키지를 앱과 함께 빌드한다. 스타일시트는 미리 빌드된 것을 `prebuilt/styles.css`로 복사해 두므로, eject한 소스에서 새로 쓴 Tailwind 클래스는 거기에 없다. 그 규칙은 내 CSS에 적는다.
- **이제부터 업데이트는 내 몫이다.** `pnpm up`은 이 패키지를 더 이상 바꾸지 않는다. `monti doctor`가 eject한 패키지를 보여 주고, 지금 쓰는 `@monti-cms/core`보다 낮은 버전에서 eject했으면 경고한다. 내 버전 이후 원본이 어떻게 바뀌었는지는 `monti eject --diff @monti-cms/admin`으로 본다(최신이 아닌 것과 비교하려면 `--to <버전|폴더|tgz>`). 내가 고친 파일도 표시해 주므로 어디를 손으로 합쳐야 하는지 알 수 있다.
- **플래그:** `--dry-run`, `--yes`, `--json`, `--no-install`. 터미널이 없고 `--yes`도 없으면 아무것도 바꾸지 않는다.

관리자는 마음에 들고 일부만 바꾸고 싶을 때 이 길을 고른다. 에디터가 일하는 방식 전체를 다시 짜고 싶다면 훅이 더 가볍다. 모노레포 전체를 포크하는 일은 `monti`가 해 주지 않는다.

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
		"@monti-cms/core": "github:monti-cms/monti#release/v0.1.0&path:/core",
		"@monti-cms/admin": "github:monti-cms/monti#release/v0.1.0&path:/admin",
		"@monti-cms/nextjs": "github:monti-cms/monti#release/v0.1.0&path:/nextjs"
	}
}
```

다른 패키지도 `path:/<폴더 이름>`만 바꿔 같은 태그로 넣는다.

MDX(`mdx` 형식, 원문 패널, 문법 확장)와 AI 확장에는 `@monti-cms/mdx`가 필요하며 같은 방식으로 설치한다. 설치 방법과 설정은 각 패키지의 README에 있다. 모두 붙인 예시 앱은 [`examples/blog`](examples/blog/README.ko.md)이며, 설정 파일은 완성된 `cms` 인스턴스를 내보내는 `monti.config.ts` 하나다.

## 레시피

Monti를 확장하는 방법을 보여 주는, 동작하고 테스트된 작은 예제들이다. 모두 문서만 보고 썼다. 발행할 때 Slack 메시지 보내기, 나만의 블록(정의, 편집기 뷰, 공개 컴포넌트, 검사), 관리자 필드 화면 직접 만들기, 저장 전 슬러그 규칙, 나만의 형식, 공개 사이트의 타입 있는 읽기, 플러그인의 관리자 페이지, 플러그인이 더하는 `monti doctor` 검사가 있다. [`docs/recipes`](docs/recipes/README.md)에서 시작하면 된다. 코드는 [`examples/recipes`](examples/recipes)에 있고, 레시피마다 끝에서 끝까지 돌려 보는 테스트가 있다.

## 개발

```sh
pnpm install          # 설치
pnpm lint             # 코드 검사 (고치려면 pnpm lint:fix)
pnpm check:korean     # 실행 코드의 한국어 문구가 문구 사전에만 있는지 검사
pnpm typecheck        # 모든 패키지 타입 검사
pnpm build            # 모든 패키지 빌드 (core → auth → storage-s3 → mdx → syntax-directive → syntax-shiki → admin → nextjs → ai → blocks → bareun → seo → git-sync)
pnpm test:run         # 테스트 (Postgres 필요)
pnpm example:check    # 패키지를 묶어 예시 앱에 설치하고 빌드까지 확인
pnpm recipes:check    # docs/recipes에 실린 코드가 examples/recipes의 코드와 같은지 확인 (pnpm recipes:docs가 페이지를 갱신)
```

커밋할 때 코드 검사(lint-staged)와 커밋 메시지 검사(commitlint)가 자동으로 돈다. 커밋 메시지는 영어로 `type(scope): subject` 꼴로 쓴다(예: `feat(core): add thing`). 범위(scope)는 `core`, `storage-s3`, `admin`, `nextjs`, `ai`, `blocks`, `mdx`, `seo`, `bareun`, `git-sync`, `syntax`, `example`, `scripts`, `ci`, `deps`, `release`, `repo` 중에서 고르고 생략해도 된다. push할 때는 lint·check:korean·typecheck가 돈다.

테스트는 `.env.local`에 테스트용 DB 주소(`CMS_TEST_DATABASE_URL`)가 있어야 전부 돈다. 테스트는 이 DB에 임시 스키마를 만들고 끝나면 지운다.

## 버전 내기

```sh
node scripts/version.mjs 0.1.0   # 모든 패키지 버전을 한 번에 바꾼다
git commit -am "chore(release): v0.1.0"
git tag v0.1.0 && git push origin main v0.1.0
```

`v*` 태그가 올라가면 배포 워크플로(`.github/workflows/release.yml`)가 패키지를 빌드·묶어 `release` 브랜치에 커밋하고 `release/v0.1.0` 태그를 붙인다.

## 라이선스

[MIT](LICENSE)
