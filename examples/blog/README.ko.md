# 예시 앱: blog

[English](README.md) | 한국어

`@monti-cms/core` 위에 만든 개인 기술 블로그로, 운영자의 실제 블로그를 본떴다. 컬렉션은 Post·Memo·Category·Tag·Series(`collection` 컬렉션)이고 언어는 한국어(기본)와 영어다. 블로그가 쓰는 것을 `monti.config.ts`에 한 줄에 하나씩 모두 붙였다:
모든 본문 블록(`@monti-cms/blocks`: `callout()`·`collapsible()`·`tabs()`·`columns()`·`mermaid()`·`chart()`·`tooltip()`·`codeRef()`·`color()`·`codeExplorer()`), SEO 필드(`@monti-cms/seo`), AI 플러그인(`@monti-cms/ai`),
직접 만든 관리자 확장(단어 목록 맞춤법 검사, `plugins/word-list`), 그리고 지시문 표기로 쓰는 MDX(`@monti-cms/mdx`의 `mdx({ syntax: [directiveSyntax()] })`와 `@monti-cms/syntax-directive`, 쓰기 모드 켬이라 글 본문이 `:::callout{…}`로 저장된다).
패키지는 저장소의 소스가 아니라 **빌드한 묶음**(`vendor/*.tgz`)으로 설치한다.

```sh
# 저장소 루트에서: 패키지를 빌드해 vendor/에 묶는다
pnpm example:pack

# 이 폴더에서
pnpm install --ignore-workspace
cp .env.example .env.local   # DATABASE_URL과 MONTI_SECRET을 채운다(나머지는 운영 환경의 GitHub 로그인용)
pnpm db:migrate               # = monti migrate
pnpm dev                     # http://localhost:3000/studio
```

pnpm 12는 esbuild 설치 스크립트를 허락하지 않으면 설치를 멈춘다. 이 폴더를 저장소 밖으로 복사해 `pnpm-workspace.yaml`에 `allowBuilds: { esbuild: true }`를 적고 `pnpm install`로 설치한다(`--ignore-workspace`를 붙이면 그 설정을 읽지 않는다). 저장소가 쓰는 pnpm 10은 경고만 한다.

`next dev`는 로그인 설정이 하나도 없어도 내 컴퓨터(`localhost`)가 보낸 요청만 관리자로 로그인시킨다. 이를 켜는 변수는 없다. `next dev`에서는 기본이고, 운영 환경에서는 절대 적용되지 않으며, `auth({ devBypass: false })`로 끌 수 있다(auth README "개발용 우회"). Vercel·Netlify·Cloudflare Pages에 배포할 때는 로그인에 따로 필요한 것이 없다. 직접 운영하는 프록시(nginx, 로드 밸런서) 뒤에서는 그 프록시가 `X-Forwarded-Host`를 덮어쓸 때만 `AUTH_TRUST_HOST=true`를 둔다(본체 README "호스트 신뢰").

## 파일

`monti init --admin-path /studio`가 만드는 모양에 이 사이트의 컬렉션·확장을 더했다.

| 파일 | 내용 |
| --- | --- |
| `monti.schema.json` | 사이트의 데이터. 코어 README의 스키마 파일 형식("스키마 파일")을 따른다: 컬렉션(`post`·`memo`·`category`·`tag`·`collection`), 작업 기록 필드, SEO 필드(평범한 필드로), 레이아웃, 언어, 시간대, 시드 템플릿, 관리자 경로 `admin.path: "/studio"`, 주소 규칙 `site.localePrefix: "always"`(`/ko/posts/…`, `/en/posts/…`), 미리보기 언어는 경로(`previewLocaleParam: false`). `$schema` 링크로 에디터가 자동 완성한다 |
| `monti-env.d.ts` | 스키마 파일의 타입. `monti schema:types`가 쓴다(`next dev`가 스키마가 바뀔 때 다시 쓰고, 오래됐으면 `pnpm example:check`가 실패한다). 이것이 있어 `cms.read`와 테마가 컬렉션 이름과 컬렉션별 메타데이터를 알며 손으로 쓴 타입은 없다. 손으로 고치지 않는다 |
| `monti.config.ts` | 하나뿐인 설정 파일이자 CMS 인스턴스: `cms = defineConfig({ schema, plugins, database, auth })`를 내보낸다(`defineConfig`·`postgres`는 `@monti-cms/core/server`, `auth`·`github`는 `@monti-cms/auth`). 플러그인 목록은 기능마다 한 줄이다(지시문 표기의 `mdx`, 각 블록, `seo()`, `aiPlugin()`, `wordList()`, 꺼 둔 `gitSync()`). `site.url`은 `SITE_URL`에서 읽는다(`defineConfig`의 관례). DB·로그인·비밀 값은 환경 변수에서 온다(`.env.example`). 관리자·API 라우트·사이트 페이지(`cms.read.*`)·`monti` 명령이 모두 여기서 `cms`를 불러온다. 서버 전용이라 브라우저에서 불러오면 오류가 나고, `"use client"` 파일이 이것을 (직접 또는 다른 파일을 거쳐) 불러오면 `pnpm exec monti check:boundary`가 실패한다. `next dev`도 같은 경우에 경고한다 |
| `app/studio/` | 관리자 화면: `layout.tsx`(미리 만든 `@monti-cms/admin/styles.css`와 `@monti-cms/blocks/styles.css`를 불러오고 `CmsAdminLayout`을 그린다)와 `[[...path]]/page.tsx`(`CmsAdminPage`를 그린다). `@monti-cms/nextjs/admin`을 쓴다. 화면을 옮길 때마다 관리자가 다시 마운트되지 않도록 레이아웃을 페이지와 분리했다(nextjs README "파일") |
| `plugins/word-list/` | 관리자 확장 예시로, 직접 만든 맞춤법 검사를 플러그인으로 썼다: `index.ts`(관리자 쪽을 지정하는 `definePlugin`), `admin.ts`(`defineAdminPlugin({ Provider })`), `provider.tsx`(`CmsAdminComponentsProvider`로 관리자를 감싸는 클라이언트 컴포넌트). `monti.config.ts`의 `plugins: [...]`에 한 줄로 들어간다 |
| `components/monti/blog-theme/`와 `app/(site)/[locale]/posts/` | 글 목록과 글 페이지. 이 폴더에서 `pnpm exec monti add blog-theme --registry ../../registry/r`로 소스를 설치했습니다. 명령은 라우트 파일을 `app/(site)/blog/`에 쓰지만, 이 사이트는 `/ko/...` 주소를 쓰므로 `app/(site)/[locale]/posts/`로 옮겼고 페이지는 거기서 `params.locale`을 읽습니다. 설치 뒤에 고친 파일은 `components/monti/blog-theme/theme.config.ts` 하나로, 컬렉션(`post`), `routeBase`(`/posts`), 태그 관계(`tagIds`), 요약 필드(`summary`)입니다. 블록에는 `components`가 필요 없습니다. 플러그인이 공개 컴포넌트를 가져옵니다. 명령을 다시 실행하면 라우트 파일이 `app/(site)/blog/`에 또 써지니 그 사본은 지우세요 |
| `app/(site)/[locale]/memos/` | 메모 목록과 메모 페이지. 테마는 컬렉션 하나만 읽으므로, 같은 `cms.read` API와 `ArticleBody`로 이 작은 두 페이지를 직접 썼습니다 |
| `components/monti/article-body/` | 글 본문. 이 폴더에서 `pnpm exec monti add article-body --registry ../../registry/r`로 소스를 설치해 글 페이지가 씁니다(`blog-theme`도 함께 가져옵니다). 자유롭게 고쳐도 되며, 고친 파일은 `--overwrite` 없이는 `monti add`가 덮어쓰지 않습니다(코어 README의 "소스로 쓰는 컴포넌트"). 가져올 때 쓰는 `@/*` 별칭이 `tsconfig.json`에 있습니다 |
| `showcase/` | 샘플 콘텐츠(`*.mdx`)와, `pnpm preview:example`이 그것을 미리보기 DB에 넣으려고 돌리는 `seed.ts`: 모든 요소와 블록을 지시문 표기로 담은 "CMS elements" 글, 되돌아 링크하는 두 번째 글, 메모, 카테고리, 태그, 시리즈, 발행하지 않은 초안 하나 |
| `app/api/cms/[...path]/route.ts` | 관리자 API와 로그인(`/api/cms/auth/*`). `@monti-cms/nextjs`의 `createRouteHandler(cms)`가 맡는다. 로그인 라우트 파일이 따로 없다. `app/studio/`의 두 파일과 합쳐 관리자에 필요한 Next 파일은 세 개다 |
| `app/globals.css` | 공개 사이트 자신의 스타일: typography를 쓴 Tailwind와 패키지의 공개 페이지 스타일(`@monti-cms/core/render.css`, `@monti-cms/blocks/render.css`). 관리자 줄이 없다. 관리자 스타일은 미리 만들어져 관리자 안으로 한정되므로 사이트에 Tailwind 설정이 필요 없다 |

GitHub 로그인을 쓰려면 OAuth 앱의 콜백 주소를 `http://localhost:3000/api/cms/auth/callback/github`로 둔다.

## Git 동기화 (기본은 꺼 둠)

`monti.config.ts`에는 발행한 글과 메모를 GitHub 저장소의 파일과 양방향으로 동기화하는 `gitSync({ enabled: false, targets: [...] })`(`@monti-cms/git-sync`)가 들어 있다. 꺼 둔 상태라 예제는 토큰도 저장소도 없이 돌아가고, 관리자에 "Git 동기화" 화면도 없다. 써 보려면 다음과 같이 한다.

1. `monti.config.ts`에서 `enabled: true`로 바꾸고, `targets`에 본인 저장소(`repo`)와 필요하면 `folder`·`branch`·`mode`를 적는다. 파일 경로 기본값은 폴더 아래 `{collection}/{slug}.{locale}.{ext}`이다(예: `content/post/hello.ko.mdx`).
2. `pnpm db:migrate`를 돌리고, `MONTI_SECRET`이 설정되어 있는지 확인한 뒤(토큰은 이 값에서 파생한 키로 암호화해 저장한다) 앱을 띄운다.
3. `/studio/git-sync`의 설정 탭에서 GitHub 토큰을 저장한다(그 저장소의 Contents와 Pull requests에 읽기·쓰기 권한이 있는 세분화된 토큰). push를 받으려면 저장소의 Settings, Webhooks에서 그 화면에 나온 Payload URL, 콘텐츠 형식 `application/json`, 저장한 비밀 값, push 이벤트로 웹훅을 추가한다. 이를 위해 사이트가 GitHub에서 접근 가능해야 한다(로컬 개발에는 터널을 쓴다).
4. `pnpm exec monti git-sync:push --all`을 한 번 돌려 발행한 글을 모두 저장소에 쓴다. 그 뒤로는 발행하면 그 글의 파일이 커밋되고, 저장소에 push한 변경(또는 "지금 가져오기", `pnpm exec monti git-sync:pull`)이 사이트로 돌아온다.

파일 형식, 충돌 화면, 풀 리퀘스트 방식은 패키지 README에 있다.

## 운영자의 블로그와 다른 점

스키마 파일과 설정은 운영자 블로그의 컬렉션·필드 종류·레이아웃·SEO 필드·플러그인·시드 템플릿을 그대로 두고 라벨만 영어로 썼다(스키마 라벨은 사이트 콘텐츠이고, 이 저장소에는 라벨용 사전이 없다). 스키마 파일은 블로그의 TypeScript 설정에서 `monti schema:extract --locale en`으로 만들었다(SEO 필드는 파일 안의 평범한 필드가 되었고, 플러그인과 `site.url`은 `monti.config.ts`에 남았다). 뺀 것:

- 그 블로그만의 플러그인 `legacyListColumns()`와 `admin.legacyBackupNames`: 그 사이트의 예전 관리자 저장 설정과 예전 브라우저 복구본을 옮기는 용도다.
- 언어 목록과 이름은 블로그의 `i18n` 모듈에서 오지 않고 스키마 파일에 직접 적었고, `site.url`은 블로그처럼 `SITE_URL`에서 읽는다.
- AI 문체 가이드는 이 저장소가 설정 문구를 영어로 두므로 영어로 썼다.

## 저장소 안에서 확인하기

운영 DB를 쓰지 않는다. 테스트 DB(`CMS_TEST_DATABASE_URL`)에 `cms_preview_*` 스키마를 만들어 쓰고 끝나면 지운다.

```sh
export DATABASE_URL="$CMS_TEST_DATABASE_URL" DATABASE_SCHEMA=cms_preview_example MONTI_SECRET=local-only
# (스키마 cms_preview_example을 만든 뒤)
pnpm exec monti migrate --no-env-file
pnpm exec next dev -p 3997   # http://localhost:3997/studio
```

`next dev`가 이 폴더에 만드는 `AGENTS.md`·`CLAUDE.md`는 저장소에 넣지 않는다.

## 화면에서 확인하기

변경한 뒤에는 로컬 미리보기에서 "CMS elements" 샘플 글을 열어 눈으로 확인한다. 저장소 루트에서:

```sh
pnpm preview:example               # 패키지 묶기, 예제 설치, 스키마 초기화, 마이그레이션, 시드
pnpm preview:example --seed-only   # 같지만 묶기와 설치는 건너뜀
cd examples/blog && pnpm exec next dev -p 3997
```

이 명령은 테스트 DB(저장소 `.env.local`의 `CMS_TEST_DATABASE_URL`, 없으면 실행을 거부한다)의 `cms_preview_example` 스키마만 쓴다. 이 폴더의 `.env.local`을 쓰고, `showcase/`의 콘텐츠를 앱의 쓰기 경로(만들기, 저장, 발행)로 넣는다:
카테고리 `showcase`, 태그 `monti`·`blocks`, 글 `cms-elements`와 `cms-elements-details`(되돌아 링크한다), 발행하지 않은 초안 글 하나, 메모 `showcase-memo`, 두 글을 담은 시리즈 `showcase-series`.
발행에서 문제가 하나라도 나오면 오류로 멈춘다(두 글이 서로 링크해서 둘째가 발행되기 전에 첫째가 받는 경고 하나는 예상된 것이라 넘긴다). 공개 주소(`/ko/posts/cms-elements`, `/ko/memos/showcase-memo`)와 관리자 편집 주소(`/studio/entries/<id>/edit`)를 출력한다.
개발 서버는 띄우지 않는다. 3997 포트가 사용 중이면 다른 포트로 서버를 띄우고 `--port <n>`으로 그 주소를 받는다. 미디어 파일은 여기에 설정하지 않은 저장소가 필요해서, 샘플에는 `public/showcase/`의 이미지만 있고 첨부 파일은 없다. AI 화면(`/studio/ai`)은 API 키 없이도 그려지며, 동작을 실행하려면 AI 화면에 저장한 연결이 필요하다.

공개 페이지(`/ko/posts/cms-elements`) 체크리스트:

- [ ] 모든 요소가 그려진다: h2~h4 제목, 굵게, 기울임, 취소선, 인라인 코드, 밑줄, 위·아래 첨자, 링크, 강제 줄바꿈, 중첩 순서·비순서·할 일 목록, 인용, 구분선, 정렬이 있는 표, 코드 블록(제목, 강조, 포커스, 추가·삭제 줄, 경고, 오류, 노트, 접기), 수식, 이미지, 각주.
- [ ] 모든 블록이 그려진다: 콜아웃 다섯 종류, 접기 둘, 탭, 단, Mermaid, 차트, 툴팁, 글자색, 코드 탐색기, 코드 연결(글자에 마우스를 올리면 코드 블록의 줄이 밝아진다).
- [ ] 같은 것이 두 번 보이지 않는다(블록, 각주, 캡션이 반복되지 않는다).
- [ ] 요소 자리에 대체 상자, 날것의 MDX, 오류 문구가 없다.
- [ ] 다크 모드에서 읽을 수 있다: 시스템 테마를 바꿔 글자, 표 테두리, 코드 줄, 콜아웃, 차트를 확인한다.
- [ ] 두 글 사이와 메모로 가는 링크가 열리고, 두 번째 글이 되돌아 링크한다.
- [ ] 발행하지 않은 초안은 공개 사이트에서 404다.

관리자 에디터(`/studio/entries/<id>/edit`) 체크리스트:

- [ ] 에디터가 글의 모든 블록을 열고, 어떤 블록도 날것이나 해석하지 못한 글로 보이지 않는다. 원문 패널은 지시문 표기를 보여 준다.
- [ ] 블록(목록 항목, 코드 주석, 차트, 콜아웃)을 고쳐 저장하면 되고, 발행한 뒤 공개 페이지가 같다.
- [ ] 에디터도 다크 모드에서 읽을 수 있다.

`next dev`가 이 폴더에 만드는 `AGENTS.md`·`CLAUDE.md`는 저장소에 넣지 않는다.
