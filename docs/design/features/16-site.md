# 16 사이트에 붙이기

상태: 설계안 (2026-11-12). 소유자 승인 전이다. 승인되면 "결정" 절을 "결정 기록"으로 옮기고 만든다.

## 한 문장

사이트 코드가 Monti를 꽂는 길이다. Next.js 사이트는 파일 세 개로 관리자 화면과 관리자 API를 올리고, 발행본을 읽어 그리고, 미리보기와 캐시 갱신을 받는다. 예제 앱 하나가 이 길로 글쓰기부터 발행까지 돌고, 뒤에 만드는 문서는 모두 이 예제 앱에서 끝까지 돌려 본다.

## 원칙

1. **사이트가 쓰는 파일은 셋이다.** Monti를 여는 파일 하나, 관리자 페이지 하나, 관리자 API 라우트 하나. 미리보기와 캐시 갱신에는 사이트가 파일을 더 만들지 않는다.
2. **주소는 한 곳에서 나온다.** 공개 주소는 `monti.schema.ts`의 컬렉션 `path`와 언어 표시(`locales.prefix`)가 정한다. 미리보기도, 캐시 갱신도, 글 속 링크도 그 주소를 쓴다. 따로 적는 "미리보기 경로"는 없다.
3. **관리자 주소는 폴더가 정한다.** Next에서 주소는 파일이 놓인 폴더다. 설정 값으로 옮길 수 없는 것을 설정에 두지 않는다.
4. **개발 서버와 운영 사이트는 어댑터가 가른다.** `next dev`이고 `monti.schema.ts`를 쓸 수 있으면 개발 서버다. 개발 서버만 구조 값을 고치고, 로그인을 건너뛴다.
5. **캐시 갱신은 한 배포 안의 일이다.** 발행 이벤트를 어댑터가 직접 받아 그 주소의 캐시를 새로 만든다. 사이트가 웹훅 주소를 만들고 비밀 값을 맞출 일이 없다.
6. **시험용 서버는 없앤다.** 흐름 테스트(L5)는 예제 앱에서 돈다. 사이트에 붙이는 길이 틀리면 흐름 테스트가 실패한다.

## 사이트가 쓰는 것

패키지는 `@monti-cms/next`다(`packages/next`). Next 16 App Router, React 19.

```ts
// lib/monti.ts
import { openSite } from "@monti-cms/next";
import config from "../monti.config";

export const { monti, reader } = openSite(config);
```

```tsx
// app/admin/page.tsx
import { AdminPage } from "@monti-cms/next/admin";
import { monti } from "@/lib/monti";

export default () => <AdminPage monti={monti} />;
```

```ts
// app/admin/api/[...path]/route.ts
import { adminRoute } from "@monti-cms/next";
import { monti } from "@/lib/monti";

export const { GET, POST, PUT } = adminRoute(monti);
```

공개 페이지는 사이트의 것이다. 어댑터는 읽는 것만 돕는다.

```tsx
// app/posts/[slug]/page.tsx
import { entryPage } from "@monti-cms/next";
import { renderDocument, tocOf } from "@monti-cms/core/render";
import { createElement } from "react";
import { reader } from "@/lib/monti";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	// 없으면 404, 주소가 바뀐 글이면 새 주소로 보낸다. 미리보기 중이면 고치는 본을 읽는다.
	const post = await entryPage(reader, { collection: "post", slug });
	const toc = post.doc ? tocOf(post.doc) : [];
	return (
		<article>
			<h1>{post.title}</h1>
			{post.doc && renderDocument(post.doc, { createElement, media: post.media, entryPath: post.entryPath })}
		</article>
	);
}
```

### 어댑터가 내놓는 것

| 이름 | 어디서 | 하는 일 |
|---|---|---|
| `openSite(config)` | `@monti-cms/next` | `openMonti`로 Monti를 열고 `reader`를 만든다. 개발 서버인지 가리고, 캐시 갱신을 받는 곳과 개발 서버의 로그인 건너뛰기를 건다. 서버 하나에 한 번만 연다(개발 서버가 모듈을 다시 읽어도 같은 것을 쓴다) |
| `adminRoute(monti)` | `@monti-cms/next` | `createAdminApi`를 Next 라우트로 올린다. 미리보기를 켜고 끄는 두 경로(`…/preview`, `…/preview/exit`)를 더한다. 처음 불릴 때 구조 파일을 맞춘다(아래 "시작할 때") |
| `AdminPage` | `@monti-cms/next/admin` | 관리자 화면을 그린다. 관리자 API의 주소는 이 페이지의 주소 아래 `api`다. 화면의 스타일(`@monti-cms/admin/styles.css`)을 싣고, 검색 엔진이 읽지 않게 한다 |
| `entryPage(reader, { collection, slug, locale? })` | `@monti-cms/next` | 글 하나를 읽는다. 없으면 `notFound()`, 옛 주소면 `permanentRedirect()`, 미리보기가 켜져 있으면 고치는 본 |
| `PreviewBar` | `@monti-cms/next` | 미리보기 중일 때만 보이는 한 줄: "미리보기 · 끝내기". 사이트가 레이아웃에 넣는다(넣지 않아도 미리보기는 된다) |

core가 더 내놓는 것:

| 이름 | 하는 일 |
|---|---|
| `SiteEntry.path` | 그 글의 공개 주소. 목록에서 링크를 만들 때 사이트가 주소를 다시 짓지 않는다 |
| `reader.entries({ collection, locale, limit?, after? })` | 목록을 나눠 읽는다 |
| `tocOf(doc, { min = 2, max = 3 })` | 제목 목록 `{ id, text, level, depth }[]` (`@monti-cms/core/render`) |
| `renderDocument`의 제목 | `id`가 붙는다. `tocOf`의 `id`와 같다 |

## 미리보기

- 편집기의 "미리보기"는 `<관리자 주소>/api/preview?token=…&path=…`를 새 탭으로 연다. `path`는 그 글의 공개 주소다(`entries.previewLink`가 준다).
- 그 경로는 표를 확인하고, Next의 초안 모드를 켜고, 표를 쿠키에 담아 `path`로 보낸다. 표가 틀렸거나 끝났으면 401이다.
- 사이트의 페이지는 그대로다. `entryPage`가 초안 모드와 쿠키의 표를 보고 고치는 본을 읽는다. 표는 그 글 하나의 것이라, 미리보기 중에 다른 글로 가면 그 글은 발행본으로 보인다.
- 아직 발행하지 않은 글은 공개 주소에 발행본이 없다. 표가 있으면 고치는 본이 나오고, 없으면 404다.
- "끝내기"(`…/preview/exit`)는 초안 모드와 쿠키를 지우고 보던 주소로 돌아간다. 표는 한 시간 뒤 스스로 끝난다(02번 문서).
- 미리보기 페이지는 캐시하지 않고, 검색 엔진이 읽지 않게 응답 머리에 `noindex`를 붙인다.

그래서 12번 문서의 "미리보기 경로", "경로에 언어 넣기", "언어 쿼리" 세 값은 없어진다. 언어는 공개 주소에 이미 있다.

## 캐시 갱신

- `openSite`가 받는 곳 하나(`plugin:next`)를 건다. 이벤트의 `paths`마다 `revalidatePath`를 부르고, 이벤트의 컬렉션에 `revalidateTag("monti:<컬렉션>")`를 부른다.
- `reader`가 읽을 때 그 컬렉션의 태그를 단다. 그래서 목록 페이지(글 목록, 태그별 목록)도 발행과 함께 새로 만들어진다. 사이트가 태그를 적지 않는다.
- 이벤트의 `paths`는 늘 공개 주소다. 지금은 네 곳(`entries.create`의 살아 있는 항목, `entries.save`, `items.saveGroup`, 글 안에서 만든 항목)이 주소가 아니라 슬러그를 넣는다. 이 문서에서 고친다.
- 번역이 발행되면 그 언어의 주소가, 원문이 발행되면 원문을 따르는 번역의 주소도 `paths`에 든다.
- 받는 곳이 실패하면 13번 문서의 다시 보내기를 그대로 따른다.

## 개발 서버와 운영 사이트

| | 개발 서버 | 운영 사이트 |
|---|---|---|
| 가르는 법 | `next dev`이고 `monti.schema.ts`를 쓸 수 있다 | 그 밖 모두 |
| 구조 값(`monti.schema.ts`) | 화면에서 고친다 | 잠긴다 |
| 로그인 | 건너뛴다(아래) | 15번 문서대로 |
| 시작할 때 | 구조 파일이 데이터베이스와 다르면 맞추고 한 줄 알린다. 고를 것이 있는 변경이면 "설정에서 검토해 주세요" | 안 따른 변경 파일이 있으면 "`monti db:migrate`를 돌려 주세요"를 서버 로그에 남긴다. 화면에는 띄우지 않는다(01번 결정) |

- "시작할 때"는 관리자 API가 처음 불릴 때다. 서버가 뜨는 순간이 아니라서 데이터베이스가 없어도 사이트 빌드는 된다.
- `monti.schema.ts`는 순수한 값이어야 한다(12번 화면 승인). 쓸 수 없으면(읽기 전용 파일 시스템) 개발 모드여도 운영 사이트처럼 잠긴다.

### 개발 서버의 로그인 건너뛰기

- 개발 서버에서는 로그인 없이 관리자로 들어온다. 로컬에서 글을 써 보려고 계정을 만들 일이 없다.
- 다음이 모두 맞을 때만이다. 하나라도 아니면 15번 문서의 로그인이 그대로 선다.
  - 개발 서버다(위 표).
  - 요청이 이 컴퓨터에서 왔다. `Host`가 `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`이고, 프록시가 붙인 `X-Forwarded-Host`와 `X-Forwarded-For`가 있으면 그것도 그렇다.
  - 호스팅 환경이 아니다(`VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `FLY_APP_NAME` 같은 변수가 없다).
- `monti.config.ts`의 `auth.devBypass: false`로 끈다. 로그인 화면을 로컬에서 써 볼 때다.
- 건너뛴 채로 들어오면 사이드바 아래에 "개발 서버 · 로그인 없이" 한 줄이 보인다. 왜 로그인이 없었는지 화면이 말한다.
- 건너뛰기는 운영 사이트에서 켤 수 없다. `devBypass: true`를 적어도 운영에서는 무시하고 서버 로그에 한 줄 남긴다.

## 관리자 주소

- 관리자 페이지 파일이 놓인 폴더가 관리자 주소다(`app/admin/page.tsx`면 `/admin`). 관리자 API는 그 아래 `api`다.
- 바꾸려면 폴더 이름을 바꾼다. 화면에서 바꾸지 않는다. 12번 문서의 "관리자 주소" 값과 그 초안 · 검토는 없어진다.
- GitHub 로그인이 돌아올 주소는 요청의 주소에서 읽는다. `createAdminApi`의 `adminPath`를 사이트가 적지 않는다.

## 본문 그리기: 제목 앵커와 목차

- 제목의 `id`는 제목 글자에서 만든다. 소문자로 바꾸고, 글자 · 숫자 · 한글 · `-` · `_`만 남기고, 빈칸은 `-`로 바꾼다. 같은 `id`가 또 나오면 `-1`, `-2`를 붙인다. 글자가 하나도 안 남으면 `section`이다.
- `tocOf`는 2단계와 3단계 제목을 준다(바꿀 수 있다). `depth`는 가장 얕은 단계에서 센 깊이다.
- 각주의 `id`(`fn-…`, `fnref-…`)와 겹치지 않는다. 제목 `id`가 `fn-`으로 시작하면 앞에 `h-`를 붙인다.
- 코드 문법 색과 복사 버튼은 17번이다(T128).

## 예제 앱

- `examples/blog`. 글(`/posts/:slug`), 메모(`/notes/:slug`), 카테고리(`/categories/:slug`), 언어 둘(한국어 원문, 영어는 주소에 `/en`). 지금 시험용 서버가 쓰는 구조와 같다.
- 페이지: 첫 화면(최근 글), 글 목록, 글, 메모, 카테고리별 글. 글에는 목차가 있다. 모양은 읽을 수 있을 만큼만 낸다. 디자인을 보이는 곳이 아니다.
- 저장소는 로컬 폴더다(`localFolderStorage`). 파일은 관리자 API의 파일 경로로 나간다.
- `pnpm dev`로 뜨고(개발 서버), `pnpm build && pnpm start`로 운영 사이트가 된다.
- 흐름 테스트(L5)는 예제 앱에서 돈다. `testing/e2e`의 작은 서버(`vite.config.ts`, `site.ts`, `main.tsx`)는 지운다. 운영 사이트로 한 번(빌드해서 띄운다), 개발 서버로만 되는 것(구조 값 고치기, 로그인 건너뛰기)은 개발 서버로 돈다.
- 사용성 드라이버(`testing/usability`)도 예제 앱을 띄운다.

## 데이터

```ts
// @monti-cms/next
export function openSite(config: MontiConfig): { monti: Monti; reader: SiteReader };
export function adminRoute(monti: Monti): Record<"GET" | "POST" | "PUT", (request: Request) => Promise<Response>>;
export function entryPage(
	reader: SiteReader,
	where: { collection: string; slug: string; locale?: string },
): Promise<PageEntry>; // 없으면 notFound(), 옛 주소면 permanentRedirect()
export type PageEntry = SiteEntry & { entryPath: (group: string) => string | undefined };

// @monti-cms/core
export type SiteEntry = {
	// … 지금 있는 것에 더해
	path: string | null; // 공개 주소. 주소가 없는 컬렉션은 null
};

// @monti-cms/core/render
export type TocItem = { id: string; text: string; level: number; depth: number };
export function tocOf(doc: Doc, range?: { min?: number; max?: number }): TocItem[];

// monti.config.ts
auth?: { password?: boolean; github?: GitHubAuth | null; devBypass?: boolean }; // devBypass: 개발 서버에서만, 기본 true
```

## 기능 목록

새 기능(`defineOperation`)은 없다. 있는 것이 바뀐다.

| 기능 | 바뀌는 것 |
|---|---|
| `entries.previewLink` | 그대로다. 화면이 `path`를 공개 주소가 아니라 관리자 API의 미리보기 경로에 실어 연다 |
| `auth.state` | 건너뛴 세션이면 `bypass: true`를 함께 준다. 화면이 "개발 서버 · 로그인 없이"를 보인다 |
| `entries.create` · `entries.save` · `items.saveGroup` | 이벤트의 `paths`가 공개 주소다 |

## 에이전트

바뀌는 것이 없다. 에이전트는 기능을 부르고, 사이트에 붙이는 길은 사람이 코드로 놓는다.

## 화면 쪽 조각

- 편집기의 "미리보기"가 여는 주소가 바뀐다(위 "미리보기").
- 사이드바 아래의 한 줄 "개발 서버 · 로그인 없이". 건너뛴 세션에서만 보인다. 누를 수 없다.
- `PreviewBar`: 사이트 쪽 부품이다. 관리자 화면의 부품을 쓰지 않고, 사이트의 스타일을 건드리지 않게 제 스타일만 가진다.

## 12번 문서에 미치는 것

16번이 정해서 12번의 설정 화면에서 빠지는 값이다. 12번을 만들 때 그 문서와 화면 지도를 고친다.

| 값 | 왜 빠지나 |
|---|---|
| 미리보기 경로, 경로에 언어 넣기, 언어 쿼리 | 미리보기가 공개 주소로 간다 |
| 관리자 주소 | 폴더가 정한다 |

남는 것: 사이트 이름, 주소에 언어 표시(구조 값), 언어 목록, 로그인.

## 결정

소유자가 정할 것이다. 각각 권하는 쪽을 본문에 적었다.

1. **관리자 주소는 폴더가 정하고, 설정 화면에서 뺀다.** 다른 길: 설정 값으로 두고 어댑터가 주소를 바꿔 준다(Next의 rewrite). 파일이 놓인 곳과 주소가 달라져 헷갈린다.
2. **미리보기는 공개 주소에서 초안 모드로 본다. 미리보기 경로 설정 셋을 뺀다.** 다른 길: 사이트가 `/preview/…` 페이지를 따로 만든다(옛 방식). 페이지를 두 벌 만들게 된다.
3. **개발 서버에서는 로그인을 건너뛰는 것이 기본이다.** 다른 길: 기본은 끄고 `devBypass: true`를 적어야 켠다.
4. **흐름 테스트를 예제 앱으로 옮기고 시험용 서버를 지운다.** 다른 길: 둘 다 둔다. 사이트에 붙이는 길이 틀려도 테스트가 모른다.
5. **패키지 이름은 `@monti-cms/next`, 예제는 `examples/blog`, Next 16.**

## 옛 코드

`9c69629f` 이전의 `packages/nextjs`(`route-handler.ts`, `admin/index.tsx`, `config.ts`), `examples/blog`(페이지 구성), `packages/core/src/adapters/auth/dev-bypass.ts`(이 컴퓨터에서 온 요청인지, 호스팅 환경인지 가리는 법), `packages/core/src/render/document/analyze.ts`(`tocOf`). 옛 미리보기는 세션으로 가렸고 지금은 표다. 옛 관리자는 주소마다 페이지였고 지금은 해시 하나다. 그래서 `previewEntry`와 `NextAdminRouter`는 되살리지 않는다.

## 끝 조건

- **16-1** 사이트가 파일 셋(`lib/monti.ts`, 관리자 페이지, 관리자 API 라우트)을 두면 관리자 화면이 뜨고, 글을 쓰고 발행하면 사이트의 공개 주소에서 보인다. 예제 앱의 흐름 테스트가 확인한다.
- **16-2** "미리보기"는 발행하지 않은 글을 그 글의 공개 주소에서 보인다. 표가 없으면 같은 주소가 404이고, 발행된 글은 표가 없으면 발행본이다. "끝내기" 뒤에는 발행본이다. 표가 틀리거나 끝났으면 미리보기가 켜지지 않는다.
- **16-3** 발행 · 보관 · 휴지통 · 복원 뒤, 운영 사이트에서 그 글의 주소와 그 글이 든 목록 페이지가 새 내용으로 보인다. 이벤트의 `paths`는 어느 기능에서나 공개 주소다.
- **16-4** 개발 서버는 구조 파일이 바뀌어 있으면 관리자 API가 처음 불릴 때 맞추고 한 줄 알린다. 운영 사이트는 안 따른 변경이 있으면 서버 로그에 `monti db:migrate`를 말하고, 구조 값은 잠긴다.
- **16-5** 개발 서버에서 이 컴퓨터로 들어오면 로그인 없이 관리자 화면이 뜨고 "개발 서버 · 로그인 없이"가 보인다. 운영 사이트, 다른 컴퓨터에서 온 요청, 호스팅 환경, `devBypass: false`에서는 로그인을 거친다.
- **16-6** 본문의 제목마다 `id`가 붙고, `tocOf`가 같은 `id`로 2 · 3단계 제목을 준다. 같은 글자의 제목 둘은 `id`가 다르고, 한글 제목의 `id`는 한글이다.
- **16-7** 옛 주소로 온 요청은 새 주소로 영구 이동하고, 없는 글은 404다. 번역이 없는 언어의 주소는 404다.
- **16-8** `testing/e2e`의 시험용 서버가 없고, `pnpm test:e2e`가 예제 앱을 띄워 돈다.
