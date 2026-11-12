# 16 사이트에 붙이기

상태: 승인 (2026-11-12, 소유자). 만드는 중이다.

## 한 문장

사이트 코드가 Monti를 꽂는 길이다. Next.js 사이트는 파일 세 개로 관리자 화면과 관리자 API를 올리고, 발행본을 읽어 그리고, 미리보기와 캐시 갱신을 받는다. 예제 앱 하나가 이 길로 글쓰기부터 발행까지 돌고, 뒤에 만드는 문서는 모두 이 예제 앱에서 끝까지 돌려 본다.

## 원칙

1. **사이트가 쓰는 파일은 셋이다.** Monti를 여는 파일 하나, 관리자 페이지 하나, 관리자 API 라우트 하나. 미리보기와 캐시 갱신에는 사이트가 파일을 더 만들지 않는다.
2. **주소는 한 곳에서 나온다.** 공개 주소는 `monti.schema.ts`의 컬렉션 `path`와 언어 표시(`locales.prefix`)가 정한다. 캐시 갱신도, 글 속 링크도 그 주소를 쓴다. 미리보기도 그 주소에서 본다. 사이트가 미리보기 페이지를 따로 만들었을 때만 컬렉션에 미리보기 주소(`previewPath`)를 적는다.
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

export default () => <AdminPage siteName="내 블로그" />;
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
| `AdminPage` | `@monti-cms/next/admin` | 관리자 화면을 그린다(`siteName`, 사이트의 블록 정의 `blocks`). 관리자 API의 주소는 이 페이지의 주소 아래 `api`다. 화면의 스타일(`@monti-cms/admin/styles.css`)을 싣고, 검색 엔진이 읽지 않게 한다(`noindex`). 화면은 브라우저에서만 그린다 |
| `entryPage(reader, { collection, slug, locale? })` | `@monti-cms/next` | 글 하나를 읽는다. 없으면 `notFound()`, 옛 주소면 `permanentRedirect()`, 미리보기가 켜져 있으면 고치는 본 |
| `previewPage(reader, { collection, slug, locale? })` | `@monti-cms/next` | 사이트가 따로 만든 미리보기 페이지가 쓴다. 미리보기를 연 사람에게만 고치는 본을 주고, 그 밖에는 `notFound()` |
| `PreviewBar` | `@monti-cms/next` | 미리보기 중일 때만 보이는 한 줄: "미리보기 · 끝내기". 사이트가 레이아웃에 넣는다(넣지 않아도 미리보기는 된다). 글자는 `labels`로, 관리자 주소는 `admin`으로 준다(기본 `/admin`) |

core가 더 내놓는 것:

| 이름 | 하는 일 |
|---|---|
| `SiteEntry.path` | 그 글의 공개 주소. 목록에서 링크를 만들 때 사이트가 주소를 다시 짓지 않는다 |
| `reader.page({ collection, locale, limit, after? })` | 목록을 나눠 읽는다: `{ entries, next }`. `next`를 다음 `after`로 주고, 마지막 쪽이면 `null`이다. `reader.entries`는 전부를 준다 |
| `reader.locales()` | 사이트의 언어: 원문 언어와 주소에 언어를 보이는 규칙 |
| `createReader`의 `schema` | 값이거나 지금의 구조를 주는 함수다. 개발 서버에서는 구조가 도는 중에 바뀐다 |
| `tocOf(doc, { min = 2, max = 3 })` | 제목 목록 `{ id, text, level, depth }[]` (`@monti-cms/core/render`) |
| `renderDocument`의 제목 | `id`가 붙는다. `tocOf`의 `id`와 같다 |

## 미리보기

- 편집기의 "미리보기"는 `<관리자 주소>/api/preview?token=…&path=…`를 새 탭으로 연다. `path`는 그 글을 미리 볼 주소다(`entries.previewLink`가 준다). 컬렉션에 미리보기 주소가 없으면 그 글의 공개 주소이고, 있으면 그 주소다.
- 그 경로는 표를 확인하고, Next의 초안 모드를 켜고, 표를 쿠키에 담아 `path`로 보낸다. 표가 틀렸거나 끝났으면 401이다.
- 사이트의 페이지는 그대로다. `entryPage`가 초안 모드와 쿠키의 표를 보고 고치는 본을 읽는다. 표는 그 글 하나의 것이라, 미리보기 중에 다른 글로 가면 그 글은 발행본으로 보인다.
- 아직 발행하지 않은 글은 공개 주소에 발행본이 없다. 표가 있으면 고치는 본이 나오고, 없으면 404다.
- "끝내기"(`…/preview/exit`)는 초안 모드와 쿠키를 지우고 보던 주소로 돌아간다. 표는 한 시간 뒤 스스로 끝난다(02번 문서).
- 미리보기 페이지는 캐시하지 않고, 검색 엔진이 읽지 않게 응답 머리에 `noindex`를 붙인다.

### 미리보기 주소

- 사이트가 미리보기 페이지를 따로 만들었으면(`app/preview/[slug]/page.tsx`) 그 주소를 컬렉션에 적는다: `previewPath: "/preview/:slug"`. 공개 주소(`path`)와 같은 모양이고 `:slug`가 꼭 든다.
- 구조 값이다. 설정 › 컬렉션 › 기본 탭의 "공개 주소" 아래 "미리보기 주소" 칸에서 고치고, 다른 구조 값처럼 변경 사항과 검토를 거쳐 `monti.schema.ts`에 써진다. 운영 사이트에서는 잠긴다.
- 본문이 있는 컬렉션(`kind: "document"`)에만 있다. 항목 컬렉션(카테고리, 태그)에는 "미리보기"가 없으므로 칸도 없다.
- 비워 두는 것이 기본이다. 비어 있으면 공개 주소에서 미리본다.
- 언어는 공개 주소와 같은 규칙으로 붙는다(`locales.prefix`: 영어 번역이면 `/en/preview/my-post`).
- 미리보기 주소의 페이지도 `entryPage`로 읽는다. 초안 모드가 꺼져 있으면(표 없이 온 요청) 그 주소는 404다. 미리보기 주소로는 발행본이 나가지 않는다.

그래서 12번 문서의 "미리보기 경로", "경로에 언어 넣기", "언어 쿼리" 세 값은 없어진다. 사이트 전체의 값 셋 대신 컬렉션마다의 값 하나다.

## 캐시 갱신

- `openSite`가 받는 곳 하나(`plugin:next`)를 건다. 사이트에 보이는 것이 바뀌는 이벤트(`entry.published`, `entry.unpublished`, `media.replaced`, `media.trashed`, `media.restored`)가 오면 사이트 전체를 새로 그리게 표시한다(`revalidatePath("/", "layout")`). 실제로 다시 그리는 것은 그 페이지를 다음에 열 때다. 저장(`entry.saved`)만으로는 아무것도 새로 그리지 않는다.
- 그 글의 주소만이 아니라 전체인 까닭: 그 글을 보이는 페이지가 그 글의 주소만이 아니다. 목록, 카테고리 이름을 보이는 글, 원문을 따르는 번역이 있다. 주소나 태그로 좁히면 사이트 개발자가 페이지마다 쓰는 데이터를 적어야 하고, 빠뜨리면 옛 내용이 남는다. 처음 안은 주소(`revalidatePath`)와 컬렉션 태그(`revalidateTag`)였다.
- 이벤트의 `paths`는 늘 공개 주소다(다른 받는 곳, 웹훅이 쓴다). 네 곳(`entries.create`의 살아 있는 항목, `entries.save`, `items.saveGroup`, 글 안에서 만든 항목)이 주소가 아니라 슬러그를 넣던 것을 고쳤다. 주소가 바뀐 항목은 옛 주소도 든다.
- 원문이 발행되면 발행된 번역의 주소도 `paths`에 든다. 번역은 원문의 블록과 값을 따라 보이기 때문이다.
- 되돌리기(`activity.undo`)가 사이트에 보이는 것을 바꾸면 이벤트를 낸다(T29): 발행을 되돌리면 앞의 발행본이 돌아오거나(`entry.published`) 사이트에서 내려가고(`entry.unpublished`), 휴지통으로 보낸 것을 되돌리면 다시 올라온다. 작업 사본만 바뀌는 되돌리기는 아무것도 내지 않는다.
- 파일을 바꾸면(`media.replace`) `media.replaced`가 나간다. 그 파일을 보이는 페이지가 다른 그림을 보인다.
- 받는 곳은 요청 안에서만 돈다(관리자 API의 라우트). 명령줄에서 다시 보낸 전송(`monti deliveries:run`)은 Next 밖이라 실패하고, 관리자 화면에서 다시 보내면 된다(13번 문서).

## 개발 서버와 운영 사이트

| | 개발 서버 | 운영 사이트 |
|---|---|---|
| 가르는 법 | `next dev`(`NODE_ENV=development`)이고 사이트 폴더의 `monti.schema.ts`를 쓸 수 있다. `monti.config.ts`의 `dev`로 바꿀 수 있다 | 그 밖 모두 |
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
- 관리자 페이지는 사이트와 같은 앱의 페이지다. 그래서 사이트의 전역 스타일(`main { max-width: … }`, `td { border: … }` 같은 태그 이름 규칙)은 관리자 화면에도 걸린다. 사이트의 스타일은 사이트의 레이아웃 아래에만 걸리게 쓴다(예제 앱의 `.site`). 관리자의 스타일은 반대로 관리자 밖을 건드리지 않게 만들어져 있다: `@monti-cms/admin/styles.css`는 `scripts/build-styles.mjs`가 만든 파일이고, 모든 규칙이 관리자가 있는 문서 안에서만 걸리고, 변수와 키프레임 이름이 모두 `monti-`로 시작하고, 글꼴 파일을 함께 싣는다.

## 본문 그리기: 제목 앵커와 목차

- 제목의 `id`는 제목 글자에서 만든다. 소문자로 바꾸고, 글자 · 숫자 · 한글 · `-` · `_`만 남기고, 빈칸은 `-`로 바꾼다. 같은 `id`가 또 나오면 `-1`, `-2`를 붙인다. 글자가 하나도 안 남으면 `section`이다.
- `tocOf`는 2단계와 3단계 제목을 준다(바꿀 수 있다). `depth`는 가장 얕은 단계에서 센 깊이다.
- 각주의 `id`(`fn-…`, `fnref-…`)와 겹치지 않는다. 제목 `id`가 `fn-`으로 시작하면 앞에 `h-`를 붙인다.
- 코드 문법 색과 복사 버튼은 17번이다(T128).

## 예제 앱

- `examples/blog`. 글(`/posts/:slug`), 메모(`/notes/:slug`), 카테고리(`/categories/:slug`), 언어 둘(한국어 원문, 영어는 주소에 `/en`). 지금 시험용 서버가 쓰는 구조와 같다.
- 페이지: 첫 화면(최근 글), 글 목록, 글, 메모, 카테고리별 글. 글에는 목차가 있다. 모양은 읽을 수 있을 만큼만 낸다. 디자인을 보이는 곳이 아니다. 언어마다 같은 페이지를 쓴다: 한국어는 주소에 언어가 없고(`app/(site)/…`), 번역은 `app/(site)/[locale]/…`이다. 사이트에 없는 언어와 원문 언어의 주소(`/ko/…`)는 404다.
- 페이지는 처음 열릴 때 그려 두고 쓴다(`generateStaticParams`가 빈 목록). 첫 화면과 글 목록은 빌드할 때 그리므로 빌드에 데이터베이스가 있어야 한다.
- 저장소는 로컬 폴더다(`localFolderStorage`). 파일은 관리자 API의 파일 경로로 나간다.
- `pnpm dev`로 뜨고(개발 서버), `pnpm build && pnpm start`로 운영 사이트가 된다.
- 흐름 테스트(L5)는 예제 앱에서 돈다. `testing/e2e`의 작은 서버(`vite.config.ts`, `site.ts`, `main.tsx`)는 지웠다. `pnpm test:e2e`는 먼저 `testing/e2e/prepare.ts`로 데이터베이스를 비우고 관리자 스타일과 예제 앱을 빌드한 뒤 서버 셋을 띄운다(`testing/e2e/servers.ts`): 운영 사이트(4173), 저장소가 없는 운영 사이트(4174), 개발 서버(4175, 로그인 건너뛰기). 서버마다 데이터베이스 스키마와 빌드 폴더가 따로다.
- 사용성 드라이버(`testing/usability`)도 예제 앱을 띄운다(`pnpm usability:server`: 씨앗 데이터를 넣고 운영 사이트로 빌드해 띄운다. 구조가 잠겨 있어 예제의 구조 파일을 고쳐 쓰지 못한다).

## 데이터

```ts
// @monti-cms/next
export function openSite(config: MontiConfig, root?: string): { monti: Monti; reader: SiteReader };
export function adminRoute(monti: Monti): Record<"GET" | "POST" | "PUT", (request: Request) => Promise<Response>>;
export function entryPage(
	reader: SiteReader,
	where: { collection: string; slug: string; locale?: string },
): Promise<PageEntry>; // 없으면 notFound(), 옛 주소면 permanentRedirect()
export function previewPage(reader: SiteReader, where: { collection: string; slug: string; locale?: string }): Promise<PageEntry>;
export type PageEntry = SiteEntry & { entryPath: (group: string) => string | undefined; preview: boolean };

// @monti-cms/core
export type SiteEntry = {
	// … 지금 있는 것에 더해
	path: string | null; // 공개 주소. 주소가 없는 컬렉션은 null
};

// 이벤트
type: … | "media.replaced"; // 파일을 바꿈

// @monti-cms/core/render
export type TocItem = { id: string; text: string; level: number; depth: number };
export function tocOf(doc: Doc, range?: { min?: number; max?: number }): TocItem[];

// monti.schema.ts: 본문이 있는 컬렉션
previewPath?: string; // "/preview/:slug". 없으면 공개 주소에서 미리본다

// monti.config.ts
auth?: { password?: boolean; github?: GitHubAuth | null; devBypass?: boolean }; // devBypass: 개발 서버에서만, 기본 true
```

## 기능 목록

새 기능(`defineOperation`)은 없다. 있는 것이 바뀐다.

| 기능 | 바뀌는 것 |
|---|---|
| `entries.previewLink` | `path`가 미리 볼 주소다: 컬렉션의 `previewPath`에 슬러그를 넣은 것, 없으면 공개 주소. 화면이 그것을 관리자 API의 미리보기 경로에 실어 연다 |
| `schema.plan` · `schema.apply` | 컬렉션의 `previewPath`를 넣고 고치고 뺀다. 바뀌면 변경 종류는 "미리보기 주소 변경"이고, 저장된 데이터는 바뀌지 않는다 |
| `auth.state` | 건너뛴 세션이면 `bypass: true`를 함께 준다. 화면이 "개발 서버 · 로그인 없이"를 보인다 |
| `entries.create` · `entries.save` · `items.saveGroup` | 이벤트의 `paths`가 공개 주소다 |
| `entries.publish` | 원문을 발행하면 발행된 번역의 주소도 `paths`에 든다 |
| `activity.undo` | 사이트에 보이는 것을 바꾸면 이벤트를 낸다(T29) |
| `media.replace` | `media.replaced` 이벤트를 낸다 |
| `entries.get` · `templates.get` | 본문이 쓰는 파일을 함께 준다(#468) |

## 에이전트

바뀌는 것이 없다. 에이전트는 기능을 부르고, 사이트에 붙이는 길은 사람이 코드로 놓는다.

## 화면 쪽 조각

- 편집기의 "미리보기"가 여는 주소가 바뀐다(위 "미리보기").
- 설정 › 컬렉션 › 기본 탭의 "미리보기 주소" 칸. 본문이 있는 컬렉션에만 있다. 만들기 전에 화면 그림으로 소유자에게 먼저 보인다.
- 사이드바 아래의 한 줄 "개발 서버 · 로그인 없이"(`SidebarNote`, "설정" 밑, 화면 모드 위). 건너뛴 세션에서만 보인다. 누를 수 없고, 접은 사이드바에는 없다.
- `PreviewBar`: 사이트 쪽 부품이다. 관리자 화면의 부품을 쓰지 않고, 사이트의 스타일을 건드리지 않게 제 스타일만 가진다.

## 12번 문서에 미치는 것

16번이 정해서 12번의 설정 화면에서 빠지는 값이다. 12번을 만들 때 그 문서와 화면 지도를 고친다.

| 값 | 왜 빠지나 |
|---|---|
| 미리보기 경로, 경로에 언어 넣기, 언어 쿼리 | 미리보기는 공개 주소에서 보고, 따로 만든 페이지의 주소는 컬렉션의 값이다(설정 › 컬렉션 › 기본) |
| 관리자 주소 | 폴더가 정한다 |

남는 것: 사이트 이름, 주소에 언어 표시(구조 값), 언어 목록, 로그인.

## 결정 기록

2026-11-12, 소유자.

1. **관리자 주소는 폴더가 정하고, 설정 화면에 두지 않는다.** Next.js에서 쓰는 것을 전제로 한다. 화면에서 값을 바꿔도 폴더는 따라 움직이지 않는다.
2. **미리보기는 공개 주소에서 초안 모드로 본다. 사이트가 미리보기 페이지를 따로 만들었으면 그 주소를 컬렉션의 구조 값(`previewPath`)으로 적는다.** 처음 안은 주소를 적을 자리를 아예 두지 않았다. 소유자: 사이트가 미리보기 페이지를 만들어 두면 그 주소를 넣을 칸이 있어야 하고, 이 CMS는 그런 값을 화면에서 고치게 한 CMS다. 그래서 `monti.schema.ts`에 직접 적는 값이 아니라 설정 화면에서 고치는 구조 값이다. 항목 컬렉션에는 두지 않는다.
3. **개발 서버에서는 로그인을 건너뛰는 것이 기본이다.**
4. **흐름 테스트를 예제 앱으로 옮기고 시험용 서버를 지운다.**
5. **패키지 이름은 `@monti-cms/next`, 예제는 `examples/blog`, Next 16.**
6. **캐시는 사이트 전체를 새로 그리게 표시한다.** 만들면서 바꾼 것이다(위 "캐시 갱신"). 소유자 확인을 기다린다.
7. **화면 두 곳**(사이드바의 "개발 서버 · 로그인 없이", 설정 › 컬렉션 › 기본의 "미리보기 주소")은 만든 화면을 소유자에게 보였고 확인을 기다린다.

## 옛 코드

`9c69629f` 이전의 `packages/nextjs`(`route-handler.ts`, `admin/index.tsx`, `config.ts`), `examples/blog`(페이지 구성), `packages/core/src/adapters/auth/dev-bypass.ts`(이 컴퓨터에서 온 요청인지, 호스팅 환경인지 가리는 법), `packages/core/src/render/document/analyze.ts`(`tocOf`). 옛 미리보기는 세션으로 가렸고 지금은 표다. 옛 관리자는 주소마다 페이지였고 지금은 해시 하나다. 그래서 `previewEntry`와 `NextAdminRouter`는 되살리지 않는다.

## 끝 조건

- **16-1** 사이트가 파일 셋(`lib/monti.ts`, 관리자 페이지, 관리자 API 라우트)을 두면 관리자 화면이 뜨고, 글을 쓰고 발행하면 사이트의 공개 주소에서 보인다. 예제 앱의 흐름 테스트가 확인한다.
- **16-2** "미리보기"는 발행하지 않은 글을 그 글의 공개 주소에서 보인다. 표가 없으면 같은 주소가 404이고, 발행된 글은 표가 없으면 발행본이다. "끝내기" 뒤에는 발행본이다. 표가 틀리거나 끝났으면 미리보기가 켜지지 않는다.
- **16-3** 발행 · 보관 · 휴지통 · 복원 · 되돌리기 · 파일 바꾸기 뒤, 운영 사이트에서 그 글의 주소와 그 글이 든 목록 페이지가 새 내용으로 보인다. 이벤트의 `paths`는 어느 기능에서나 공개 주소다.
- **16-4** 개발 서버는 구조 파일이 바뀌어 있으면 관리자 API가 처음 불릴 때 맞추고 한 줄 알린다. 운영 사이트는 안 따른 변경이 있으면 서버 로그에 `monti db:migrate`를 말하고, 구조 값은 잠긴다.
- **16-5** 개발 서버에서 이 컴퓨터로 들어오면 로그인 없이 관리자 화면이 뜨고 "개발 서버 · 로그인 없이"가 보인다. 운영 사이트, 다른 컴퓨터에서 온 요청, 호스팅 환경, `devBypass: false`에서는 로그인을 거친다.
- **16-6** 본문의 제목마다 `id`가 붙고, `tocOf`가 같은 `id`로 2 · 3단계 제목을 준다. 같은 글자의 제목 둘은 `id`가 다르고, 한글 제목의 `id`는 한글이다.
- **16-7** 옛 주소로 온 요청은 새 주소로 영구 이동하고, 없는 글은 404다. 번역이 없는 언어의 주소는 404다.
- **16-8** `testing/e2e`의 시험용 서버가 없고, `pnpm test:e2e`가 예제 앱을 띄워 돈다.
- **16-9** 컬렉션에 미리보기 주소를 적으면 "미리보기"가 그 주소로 가고, 번역은 언어 표시가 붙은 주소로 간다. 그 주소는 표 없이 오면 404다. 설정 › 컬렉션 › 기본 탭에서 고치면 검토를 거쳐 `monti.schema.ts`에 써지고, 항목 컬렉션에는 칸이 없다.
