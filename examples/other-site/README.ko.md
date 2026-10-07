# 예시 앱: other-site

[English](README.md) | 한국어

`@monti-cms/core`를 블로그와 다른 컬렉션(Article·Topic·Author)·필드·언어(영어)로 붙인 최소 Next 앱이다. 블록 확장(`@monti-cms/blocks`)에서
차트만 설치하고 사이트 블록(`quote-card`·코드 펜스 `map`)을 더했다. SEO 필드는 SEO 확장(`@monti-cms/seo`)의 `seoFields`를
다른 이름·`Search` 탭으로 넣었다. MDX는 `@monti-cms/mdx`(`mdx()` 플러그인: `mdx` 형식과 관리자 원문 패널)가 맡는다. 패키지는 저장소의 소스가 아니라 **빌드한 묶음**(`vendor/*.tgz`)으로 설치한다.

```sh
# 저장소 루트에서: 패키지를 빌드해 vendor/에 묶는다
pnpm example:pack

# 이 폴더에서
pnpm install --ignore-workspace
cp .env.example .env.local   # CMS_DATABASE_URL 등을 채운다
pnpm db:migrate               # = monti migrate
pnpm dev                     # http://localhost:3000/studio
```

pnpm 12는 esbuild 설치 스크립트를 허락하지 않으면 설치를 멈춘다. 이 폴더를 저장소 밖으로 복사해 `pnpm-workspace.yaml`에 `allowBuilds: { esbuild: true }`를 적고 `pnpm install`로 설치한다(`--ignore-workspace`를 붙이면 그 설정을 읽지 않는다). 저장소가 쓰는 pnpm 10은 경고만 한다.

`CMS_DEV_AUTH_BYPASS=1`이면 `next dev`에서 내 컴퓨터(`localhost`)가 보낸 요청은 로그인 없이 관리자 화면을 연다. 배포된 서버처럼 보이면 거부한다. 프록시 뒤나 Vercel에 배포할 때 로그인하려면 `AUTH_TRUST_HOST=true`가 필요하다(본체 README "호스트 신뢰").

## 파일

`monti init --admin-path /studio`가 만드는 모양에 이 사이트의 컬렉션·확장을 더했다.

| 파일 | 내용 |
| --- | --- |
| `cms.config.ts` | 컬렉션·블록·확장(`plugins`의 `mdx()`·차트 블록·`seo()`). 블로그와 다르게 관리자 경로 `admin.path: "/studio"`, 주소 규칙 `site.localePrefix: "always"`(모든 언어에 `/en`), 미리보기 언어는 경로(`previewLocaleParam: false`) |
| `cms.server.ts` | CMS 인스턴스: DB·GitHub 로그인 서버 설정 위의 `createCms`(`monti init` 그대로, `githubAuth`는 `@monti-cms/nextjs/auth`에서 온다). 관리자·API 라우트·사이트 페이지(`cms.read.*`)가 모두 여기서 `cms`를 불러온다 |
| `app/components/site-blocks.tsx` | 사이트 블록(`quote-card`, `map`)의 공개 컴포넌트. 블록 정의에서 타입이 정해지는 `DocumentComponentsOf<typeof cms>`로 쓰고 `<CmsContent cms={cms} components={...} />`에 넘긴다 |
| `app/(admin)/studio/` | 관리자 화면(`[[...path]]/page.tsx`·`layout.tsx`, `@monti-cms/nextjs/admin` 사용. 레이아웃이 미리 만든 `@monti-cms/admin/styles.css`와 `@monti-cms/blocks/styles.css`를 불러온다)과 맞춤법 검사 확장 예시(`admin-components.tsx`) |
| `components/monti/blog-theme/`와 `app/(site)/[locale]/blog/` | 블로그 목록과 글 페이지. 이 폴더에서 `pnpm exec monti add blog-theme --registry ../../registry/r`로 소스를 설치했습니다. 명령은 라우트 파일을 `app/(site)/blog/`에 쓰지만, 이 사이트는 `/en/...` 주소를 쓰므로 `[locale]` 아래로 옮겼고 페이지는 거기서 `params.locale`을 읽습니다. 설치 뒤에 고친 파일은 `components/monti/blog-theme/theme.config.ts` 하나로, 컬렉션(`article`), 주제 관계(`topicIds`), `components: siteComponents`입니다. 명령을 다시 실행하면 라우트 파일이 `app/(site)/blog/`에 또 써지니 그 사본은 지우세요 |
| `components/monti/article-body/` | 글 본문. 이 폴더에서 `pnpm exec monti add article-body --registry ../../registry/r`로 소스를 설치해 글 페이지가 씁니다(`blog-theme`도 함께 가져옵니다). 자유롭게 고쳐도 되며, 고친 파일은 `--overwrite` 없이는 `monti add`가 덮어쓰지 않습니다(코어 README의 "소스로 쓰는 컴포넌트"). 가져올 때 쓰는 `@/*` 별칭이 `tsconfig.json`에 있습니다 |
| `showcase/` | "CMS elements" 샘플 글(`*.mdx`)과, `pnpm preview:example`이 그 글을 미리보기 DB에 넣으려고 돌리는 `seed.ts` |
| `app/api/cms/[...path]/route.ts` | 관리자 API와 로그인(`/api/cms/auth/*`). `@monti-cms/nextjs`의 `createRouteHandler(cms)`가 맡는다. 로그인 라우트 파일이 따로 없다 |
| `app/globals.css` | 공개 사이트 자신의 스타일: typography를 쓴 Tailwind와 패키지의 공개 페이지 스타일(`@monti-cms/core/render.css`, `@monti-cms/blocks/render.css`). 관리자 줄이 없다. 관리자 스타일은 미리 만들어져 관리자 안으로 한정되므로 사이트에 Tailwind 설정이 필요 없다 |

GitHub 로그인을 쓰려면 OAuth 앱의 콜백 주소를 `http://localhost:3000/api/cms/auth/callback/github`로 둔다.

## 저장소 안에서 확인하기

운영 DB를 쓰지 않는다. 테스트 DB(`CMS_TEST_DATABASE_URL`)에 `cms_preview_*` 스키마를 만들어 쓰고 끝나면 지운다.

```sh
export CMS_DATABASE_URL="$CMS_TEST_DATABASE_URL" CMS_SCHEMA=cms_preview_example CMS_DEV_AUTH_BYPASS=1 AUTH_SECRET=local-only
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
cd examples/other-site && pnpm exec next dev -p 3997
```

이 명령은 테스트 DB(저장소 `.env.local`의 `CMS_TEST_DATABASE_URL`, 없으면 실행을 거부한다)의 `cms_preview_example` 스키마만 쓴다. 이 폴더의 `.env.local`을 쓰고, `showcase/*.mdx` 글을 앱의 쓰기 경로(만들기, 저장, 발행)로 넣는다: `cms-elements`, 그 글이 링크하는 `cms-elements-details`, 발행하지 않은 초안 하나. 공개 주소(`/en/blog/cms-elements`)와 관리자 편집 주소(`/studio/entries/<id>/edit`)를 출력한다. 개발 서버는 띄우지 않는다. 3997 포트가 사용 중이면 `--port <n>`으로 다른 포트의 주소를 받는다. 샘플은 코어 요소와 이 사이트가 설치한 블록(차트, `quote-card`, `map`)을 담는다. 미디어 파일은 여기에 설정하지 않은 저장소가 필요해서, 샘플에는 `public/showcase/`의 이미지만 있고 첨부 파일은 없다.

공개 페이지 체크리스트:

- [ ] 글의 모든 요소가 그려진다: h2~h4 제목, 굵게, 기울임, 취소선, 인라인 코드, 밑줄, 위·아래 첨자, 링크, 강제 줄바꿈, 중첩 순서·비순서·할 일 목록, 인용, 구분선, 정렬이 있는 표, 코드 블록(제목, 강조, 포커스, 추가·삭제 줄, 경고, 오류, 노트, 접기), 수식, 이미지, 각주, 차트, 인용 카드, 지도.
- [ ] 같은 것이 두 번 보이지 않는다(블록, 각주, 캡션이 반복되지 않는다).
- [ ] 요소 자리에 대체 상자, 날것의 MDX, 오류 문구가 없다.
- [ ] 다크 모드에서 읽을 수 있다: 시스템 테마를 바꿔 글자, 표 테두리, 코드 줄, 차트를 확인한다.
- [ ] 두 번째 글로 가는 링크 둘이 모두 열리고, 그 글이 되돌아 링크한다.
- [ ] 발행하지 않은 초안은 공개 사이트에서 404다.

관리자 에디터(`/studio/entries/<id>/edit`) 체크리스트:

- [ ] 에디터가 글의 모든 블록을 열고, 어떤 블록도 날것이나 해석하지 못한 글로 보이지 않는다.
- [ ] 블록(목록 항목, 코드 주석, 차트, 인용 카드)을 고쳐 저장하면 되고, 발행한 뒤 공개 페이지가 같다.
- [ ] 에디터도 다크 모드에서 읽을 수 있다.

`next dev`가 이 폴더에 만드는 `AGENTS.md`·`CLAUDE.md`는 저장소에 넣지 않는다.
