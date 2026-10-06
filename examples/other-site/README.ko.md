# 예시 앱: other-site

[English](README.md) | 한국어

`@monti-cms/core`를 블로그와 다른 컬렉션(Article·Topic·Author)·필드·언어(영어)로 붙인 최소 Next 앱이다. 블록 확장(`@monti-cms/blocks`)에서
차트만 설치하고 사이트 블록(`quote-card`·코드 펜스 `map`)을 더했다. SEO 필드는 SEO 확장(`@monti-cms/seo`)의 `seoFields`를
다른 이름·`Search` 탭으로 넣었다. 패키지는 저장소의 소스가 아니라 **빌드한 묶음**(`vendor/*.tgz`)으로 설치한다.

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
| `cms.config.ts` | 컬렉션·블록·확장. 블로그와 다르게 관리자 경로 `admin.path: "/studio"`, 주소 규칙 `site.localePrefix: "always"`(모든 언어에 `/en`), 미리보기 언어는 경로(`previewLocaleParam: false`) |
| `cms.server.ts` | DB·GitHub 로그인(`monti init` 그대로) |
| `app/(admin)/studio/` | 관리자 화면(`[[...path]]/page.tsx`·`layout.tsx`)과 맞춤법 검사 확장 예시(`admin-components.tsx`) |
| `app/api/cms/[...path]/route.ts` | 관리자 API와 로그인(`/api/cms/auth/*`). 로그인 라우트 파일이 따로 없다 |
| `app/globals.css` | Tailwind와 패키지 스타일 import만. 관리자 화면 색·변형(`cms-*`, `cms-dark` 등)은 관리자 패키지 스타일이 정하고 앱의 이름과 겹치지 않는다 |

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
