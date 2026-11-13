# 예제 블로그

Next.js 블로그에 Monti를 [`@monti-cms/next`](../../packages/next)가 말하는 대로 붙였다. 글(`/posts/:slug`), 메모(`/notes/:slug`),
카테고리(`/categories/:slug`)가 있고, 한국어가 원문이며 영어와 일본어 번역이 있다(`/en/…`, `/ja/…`). 저장소의 흐름 테스트(`pnpm test:e2e`)가
이 앱에서 돈다. 그래서 여기 보이는 것이 테스트되는 것이다.

## 띄우기

```sh
cp .env.example .env.local      # DATABASE_URL(Postgres)과 MONTI_SECRET
pnpm --filter @monti-cms/admin build:styles   # 이 저장소 안에서만: 관리자 화면의 스타일은 빌드한 파일이다
pnpm db:setup                   # 표 만들기
pnpm dev                        # http://localhost:3000, 관리자는 /admin
```

`pnpm dev`는 개발 서버다. 이 컴퓨터에서는 관리자 화면이 로그인 없이 열리고, 설정을 고치면 `monti.schema.ts`에 써진다.
`pnpm build && pnpm start`는 운영 사이트다. 로그인을 묻고(첫 방문에서 관리자를 만든다) 구조가 잠긴다. 빌드할 때 첫 화면과 글 목록을
그리므로 데이터베이스가 있어야 한다.

## 어디에 무엇이 있나

| 파일 | 하는 일 |
|---|---|
| `monti.schema.ts` | 사이트의 구조: 컬렉션, 필드, 공개 주소, 언어. 값만 있다. 관리자 화면이 이 파일을 고쳐 쓴다 |
| `monti.config.ts` | 사이트가 Monti를 돌리는 법: 데이터베이스, 로그인, 미디어 파일을 두는 곳 |
| `lib/monti.ts` | Monti를 한 번 연다. `monti`는 관리자 API가, `reader`는 페이지가 쓴다 |
| `app/admin/page.tsx` | 관리자 화면. 폴더 이름이 주소다 |
| `app/admin/api/[...path]/route.ts` | 관리자 API, 미디어 파일, 미리보기 켜고 끄기 |
| `app/(site)/…` | 사이트의 페이지(한국어). 번역은 `app/(site)/[locale]/…` |
| `site/pages.tsx` | 그 페이지들이 그리는 것 |
| `app/site.css` | 사이트의 모양. 관리자 화면에 걸리지 않게 모두 `.site` 아래에 있다 |

미디어 파일은 이 컴퓨터의 `.monti/files`에 둔다(`MONTI_FILES`로 옮긴다). `MONTI_STORAGE=off`면 저장소 없이 돈다. `MONTI_WEBHOOK`에 주소를 적으면 모든 이벤트를 그 주소로 보낸다(검색 색인, 배포 훅). 실패한 전송은 관리자 화면의 활동 기록에 있고 거기서 다시 보낸다. `MONTI_REFRESH_DOWN`은 흐름 테스트만 쓴다: 그 값이 가리키는 파일이 있는 동안 캐시된 페이지를 새로 고치는 일이 실패한다(`lib/monti.ts`).
