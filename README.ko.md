# Monti

[English](README.md) | 한국어

개발 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것이다. 이탈리아어로 "산들"이라는 뜻이기도 하다.

## 패키지

| 패키지 | 하는 일 |
| --- | --- |
| [`@monti-cms/core`](packages/core/README.ko.md) | 본체. 설정, 글 저장·발행, 문서 모델, 관리자 API, 명령줄(`monti`) |
| [`@monti-cms/mdx`](packages/mdx/README.ko.md) | MDX 확장. `mdx` 형식, 관리자 원문 패널, `renderMdx`, 문법 확장 API |
| [`@monti-cms/admin`](packages/admin/README.ko.md) | 관리자 화면. 편집기, 글 목록, 미디어, 템플릿. 프레임워크에 묶이지 않고 라우터는 어댑터로 받는다 |
| [`@monti-cms/nextjs`](packages/nextjs/README.ko.md) | Next.js 어댑터. 라우트 핸들러, `next.config.ts` 연결, App Router 어댑터를 얹은 관리자 페이지·레이아웃, GitHub 로그인(NextAuth) |
| [`@monti-cms/blocks`](packages/blocks/README.ko.md) | 블록 확장. 콜아웃, 접기, 탭, 단 나누기, 코드 탐색기, Mermaid, 차트 |
| [`@monti-cms/ai`](packages/ai/README.ko.md) | AI 확장. 글쓰기·번역 같은 AI 기능 |
| [`@monti-cms/seo`](packages/seo/README.ko.md) | SEO 확장. 검색·공유 필드와 미리보기 |
| [`@monti-cms/bareun`](packages/bareun/README.ko.md) | 바른(Bareun) 맞춤법 검사 |
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

MDX(`mdx` 형식, 원문 패널, 문법 확장)와 AI 확장에는 `@monti-cms/mdx`가 필요하며 같은 방식으로 설치한다. 설치 방법과 설정은 각 패키지의 README에 있다. 모두 붙인 예시 앱은 [`examples/blog`](examples/blog/README.ko.md)다.

## 개발

```sh
pnpm install          # 설치
pnpm lint             # 코드 검사 (고치려면 pnpm lint:fix)
pnpm check:korean     # 실행 코드의 한국어 문구가 문구 사전에만 있는지 검사
pnpm typecheck        # 모든 패키지 타입 검사
pnpm build            # 모든 패키지 빌드 (core → mdx → syntax-directive → syntax-shiki → admin → nextjs → ai → blocks → bareun → seo → git-sync)
pnpm test:run         # 테스트 (Postgres 필요)
pnpm example:check    # 패키지를 묶어 예시 앱에 설치하고 빌드까지 확인
```

커밋할 때 코드 검사(lint-staged)와 커밋 메시지 검사(commitlint)가 자동으로 돈다. 커밋 메시지는 영어로 `type(scope): subject` 꼴로 쓴다(예: `feat(core): add thing`). 범위(scope)는 `core`, `admin`, `nextjs`, `ai`, `blocks`, `mdx`, `seo`, `bareun`, `git-sync`, `syntax`, `example`, `scripts`, `ci`, `deps`, `release`, `repo` 중에서 고르고 생략해도 된다. push할 때는 lint·check:korean·typecheck가 돈다.

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
