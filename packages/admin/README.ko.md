# @monti-cms/admin

[English](README.md) | 한국어

`@monti-cms/core`의 관리자 화면(Next.js App Router). 목록·편집기(tiptap)·미디어·본문 템플릿·휴지통·로그인 화면을 준다.
플러그인(예: `@monti-cms/ai`)이 화면·사이드바 항목·필드 옆 버튼·편집 화면 동작을 더한다.
화면은 본체의 관리자 API(`/api/cms/v1/*`)만 부른다. 설치하지 않고 같은 API로 화면을 직접 만들어도 된다.

## 붙이기

설치·라우트·스타일은 `@monti-cms/core` README의 "빈 Next 앱에 설치"를 따른다(`monti init`이 관리자 라우트·스타일 줄을 만든다).

- **관리자 경로.** 기본 `/admin`이고 사이트 설정 `admin.path`로 바꾼다(예: `/studio`). 앱의 관리자 라우트 폴더
  (`app/(admin)/studio/[[...path]]/page.tsx`·`layout.tsx`)가 같은 경로여야 한다. 화면 안 링크·로그인 이동(`<관리자 경로>/login`)·
  플러그인 화면 주소가 이 경로를 따른다. 화면 코드는 `@monti-cms/core/client`의 `adminHref("/media")`·`adminEntryEditHref(id)`로
  주소를 만든다. 관리자 API(`/api/cms/v1`)는 바뀌지 않는다.
- **사이트 보기.** 사이드바 아래 `사이트 보기`는 `site.home`(기본 `/`)을 연다. 관리자 화면이 다른 호스트에 있으면 전체 주소를 적는다.
- **미리보기.** 편집 화면 `미리보기`는 `site.previewPath` 뒤에 공개 경로를 붙이고 언어는 `site.previewLocaleParam`(기본
  `?locale=`)으로 넘긴다. 검색 미리보기의 주소는 `site.localePrefix`를 따른다.

## 사이트 컴포넌트 넣기

필드 입력·블록 편집 화면·코드 펜스 미리보기는 확장이 넣고 사이트가 더하거나 바꾼다(예: 블록 확장의 Mermaid·차트는 기본
미리보기를 준다). 클라이언트 컴포넌트에서 넣는다. 사이트의 공급자를 관리자 레이아웃 안쪽에 두면 같은 이름은 사이트 것이 이긴다.

```tsx
"use client";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";

const components = {
	fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
	fieldInputs: { color: ColorInput }, // fields.text({ input: "color" })인 필드를 이 입력으로 그린다
	blockEditors: { notice: NoticeEditor }, // 더한 블록의 속성·본문 상자({ definition, values, setValue, content })
	blockViews: { banner: BannerView }, // 더한 블록의 편집 화면 전체(Tiptap NodeView). blockEditors보다 먼저 쓴다
};

export function SiteAdminComponents({ children }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
```

아무도 넣지 않은 펜스는 원문을 그대로 보인다.

### 아이콘

블록 정의의 `editor.icon`, 플러그인 사이드바 항목의 `icon`, 컬렉션의 `icon`, 코드 줄 효과의 `icon`은 lucide 이름이다.
관리자 패키지에는 자주 쓰는 아이콘만 있으므로, 다른 이름은 같은 공급자의 `icons`로 등록한다. 없는 이름은 기본 아이콘(퍼즐·플러그 등)으로
보인다.

```tsx
import { Eye } from "lucide-react";

const components = { icons: { eye: Eye } };
```

플러그인은 관리자 쪽 `Provider` 안에서 등록한다(`@monti-cms/blocks`의 각 블록, `@monti-cms/ai`가 예시). 서버 레이아웃은
컴포넌트를 브라우저로 넘길 수 없어 플러그인 정의가 아니라 클라이언트 공급자로 등록한다.

## 속성 칸

편집 화면 오른쪽 속성 칸은 컬렉션 정의대로 입력을 그린다. 입력은 필드 종류로 정한다: 텍스트·선택·관계, 미디어 필드
(`fields.media`)는 미디어 고르기(`accept: "file"`이면 파일 올리기)다. 필드 이름이나 역할로 입력을 바꾸지 않는다.
`input`으로 등록한 입력을 고르면 그 입력이 먼저다. 본체에는 이름 붙은 입력이 없다. 여러 줄 텍스트(`multiline: true`)는
`rows`(기본 2)만큼의 여러 줄 칸이다(예전 `input: "auto-summary"`는 `multiline: true, rows: 3`으로 바꾼다).

`fieldInputs`에는 컴포넌트(입력 전체를 바꾼다) 또는 조각(`FieldInputParts`, 기본 입력을 두고 일부만 바꾼다)을 등록한다.
조각은 지금 입력 중인 값(`form`)을 읽을 수 있다.

```tsx
const components = {
	fieldInputs: {
		// 비었을 때 쓸 값을 안내 문구로, 글자 수를 이름표 줄 오른쪽에
		"meta-title": { placeholder: ({ form }) => form.title, Aside: ({ value }) => <span>{String(value ?? "").length}</span> },
		// 입력 줄 없이 이름표 줄의 스위치만(`Input: null`)
		"hide-switch": { Input: null, Aside: HideSwitch },
	},
};
```

필드나 `layout` 묶음의 `tab`마다 속성 칸에 탭이 생긴다(없으면 `속성` 탭, 묶음의 `tab`이 먼저). 보기 필드
(`fields.view({ view })`)는 그 자리에 `CmsAdminComponentsProvider`의 `fieldViews`(`{ 이름: ({ collection, form, entry }) => … }`)로
등록한 화면을 그린다. 등록한 화면이 없으면 아무것도 그리지 않는다. 미디어 ID로 미리보기를 그리는 화면은
`@monti-cms/admin/media`의 `MediaThumbnail`·`useMediaUrl`을 쓴다(SEO 확장 `@monti-cms/seo`의 검색 미리보기가 예시다).
날짜·시각은 사이트 설정의 `timeZone`으로, 표기는 `admin.locale`(기본 `ko-KR`)로 보인다. 관계 입력의 안내 문구는 대상 컬렉션의
이름표를 쓴다(예: "게시글 고르기"). 항목 컬렉션(`kind: "item"`)의 항목은 목록의 작은 폼으로 연다. 미디어 사용처처럼 여러
컬렉션을 가리키는 곳은 `<관리자 경로>?collection=<컬렉션>&open=<ID>`로 그 항목 칸을 열고, `<관리자 경로>/entries/<ID>/edit`로 열어도
그 주소로 보낸다. 목록 컬럼 설정에 저장된 이름 중 지금 컬럼이 아닌 것은 버린다(예전 이름을 짐작해 바꾸지 않는다).

## 블록 편집 화면

설정의 `blocks`나 블록 확장 플러그인이 더한 블록(`editor.view: "node"`)은 관리자 화면이 정의에서 편집기 노드(`cms` + 파스칼
이름, 예: `cmsNotice`)·변환·슬래시 메뉴 삽입·끌기 규칙을 만든다. 편집 모양만 넣으면 된다.

- 아무것도 넣지 않으면 지시자 블록은 속성 입력과 본문을 담은 상자, 코드 펜스 블록은 코드 입력 칸과 미리보기다.
- `blockEditors`는 기본 틀 안의 속성·본문 모양을, `blockViews`는 틀까지 포함한 화면 전체를 바꾼다.
- `blockViews` 화면을 만드는 도구(속성 값 읽고 쓰기·자식 위치·입력 칸·도구 줄·노드 이름)는 `@monti-cms/admin/blocks`에 있다.
  `@monti-cms/blocks`의 콜아웃·탭 화면이 예시다.

## 글자 꾸밈

블록 확장의 글자 꾸밈(`syntax.kind: "text"`, `editor.view: "mark"`, 예: `@monti-cms/blocks`의 툴팁·코드 연결·글자색)은 관리자
화면이 정의에서 편집기 마크(`cms` + 파스칼 이름, `addedMarkName("tooltip")` → `cmsTooltip`)와 저장 문서 변환을 만든다. 본체
편집기는 꾸밈 이름을 모르고, 확장이 `CmsAdminComponentsProvider`의 `marks`(블록 이름 → `EditorMarkExtension`)로 준 것만 그린다.

```tsx
import type { EditorMarkExtension } from "@monti-cms/admin/editor";

const note: EditorMarkExtension = {
	inclusive: false, // 꾸밈 끝에 이어 친 글자가 꾸밈을 이어받는가(기본 false)
	render: (attrs) => ({ class: "underline decoration-wavy" }), // span에 더할 HTML 속성
	toolbar: { group: "format", priority: 3, Button: NoteButton, MenuItems: NoteMenuItems }, // format: 글자 꾸밈 뒤, link: 링크 뒤
	bubble: { group: "link", order: -1, Button: NoteBubbleButton }, // 글자를 골랐을 때 버블 버튼(링크 앞)
	detail: NoteDetail, // 커서가 꾸밈 안에 있을 때 버블 내용(설명·수정·해제)
	insertActions: [{ id: "note", title: "메모", description: "…", keywords: ["note"], run: (editor, range) => {} }], // 슬래시 메뉴
};
const components = { marks: { note } };
```

- 버블 버튼·내용은 `{ editor, inCode, openPanel, closePanel, act }`를 받는다. `openPanel({ label, size, content })`은 버블 안에
  입력 칸을 펼친다. 같은 모양을 내려면 `@monti-cms/admin/editor`의 `BubbleButton`·`MarkTextForm`·`MarkTextPopover`·
  `removeInlineMark`·`allowsMark`를 쓴다.
- HTML로는 `span[data-cms-mark="이름"]`과 속성마다 `data-mark-<속성>`이다. 저장 문서(CmsNode)의 mark 이름은 블록 이름이고
  속성은 정의의 속성만 남긴다(`markAttrsOf`).
- 속성에 `codeAnchor: true`가 있는 꾸밈은 코드 블록 줄 이름표를 가리킨다(`CODE_ANCHOR_REF`). 코드 블록의 줄 메뉴 "본문 연결"·
  잇기 안내 줄·마우스를 올린 줄 강조(`data-code-ref`)·연결 끊김 표시가 이 꾸밈을 쓰고, 그런 꾸밈이 없으면 숨는다. 버블에서 쓰는
  잇기 명령(`findAnchor`·`startLinkFromText`·`unlinkRef`)도 같은 진입점에 있다.
- 코드 블록 안 글자 툴팁(코드 펜스 주석 `// @char Tooltip`)은 본체 코드 블록 기능이라 본문 툴팁과 따로다(마크 `codeTooltip`).
- 코드 블록 도구는 사이트 설정 `codeBlock`(`@monti-cms/core` README)을 따른다. `omitLineEffects`와 `features`(`rules`·`fold`·`tooltip`·`textStyles`)는 줄 효과·정규식 규칙·접기·툴팁·
  코드 안 굵게·기울임·취소선·밑줄을 줄 메뉴·규칙 패널·버블·툴바·단축키에서 감추고, `themes`와 `languages`는 강조 테마와 언어 목록을 정한다.
  꺼진 도구를 이미 쓰는 본문은 그대로 열리고 저장해도 바뀌지 않으며, 그 효과는 계속 보여 지울 수 있다.

## 글 검사(맞춤법 등)

본체는 검사기를 하나도 갖지 않고 버튼·밑줄·결과 창만 그린다. 사이트·확장이 검사기(유료 API, 브라우저에서 도는 npm 패키지
등)를 만들어 확장점 `textCheckers`에 넣으면, 글의 언어를 검사하는 검사기마다 도구 모음 버튼(이름 `label`, 아이콘 `icon`)이
생기고 결과는 물결 밑줄·결과 창·목록으로 보인다. 여러 확장이 검사기를 넣으면 모두 모인다. 검사기가 없으면 아무것도 보이지 않는다.
바른 검사기는 `@monti-cms/bareun`이다.

```tsx
"use client";
import { defineTextChecker } from "@monti-cms/core/client";
import type { CmsAdminComponents } from "@monti-cms/admin";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "금지어 검사", // 도구 모음 버튼 이름
	icon: "ban", // lucide 이름이나 컴포넌트. 없으면 맞춤법 아이콘
	locales: ["ko"], // 없으면 모든 언어
	limits: { maxChars: 10_000, maxSegments: 50 }, // 넘으면 나눠 보낸다
	// auto: true, // 입력을 멈추면 바뀐 문단만 저절로 검사(기본은 끔)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components: CmsAdminComponents = { textCheckers: [myChecker] };
```

- 검사 단위는 문단(제목·목록 항목·표 칸 등 글이 든 블록) 하나다: `{ id, text, locale }`. 결과의 `start`·`end`는 그 문단 안의
  UTF-16 위치(JS 문자열 인덱스, `end` 미포함)다.
- 코드 블록·수식·코드 펜스 블록·블록 속성은 보내지 않는다. 인라인 코드와 주소는 `￼` 한 글자로 바꿔 보내고, 그 글자에 걸친
  결과는 버린다. 링크는 글자만 보낸다.
- 검사기 버튼은 고른 글자가 있으면 그 범위에 걸친 문단만, 없으면 문서 전체를 그 검사기로 검사한다. 결과는 물결 밑줄로 보이고,
  밑줄을 누르면 설명·바꿀 글 후보·"무시"가 뜬다. 버튼 옆 숫자를 누르면 결과 목록이다. 결과 범위 안을 고치면 그 결과는 사라진다.
- 같은 검사기·언어·글자의 문단은 다시 보내지 않는다(편집 화면을 여는 동안). 다시 검사하거나 화면을 닫으면 진행 중인 요청을
  `signal`로 끊는다.
- `auto: true`는 유료·호출 제한 API면 비용이 들 수 있어 기본으로 끈다. 켜면 입력을 1.5초 멈춘 뒤, 연 뒤로 바뀐 문단만 보낸다.

### 키가 필요한 API

API 키는 브라우저에 두지 않는다. 브라우저는 `remoteTextChecker`로 사이트 경로에 `{ segments }`를 보내고, 경로가 키로 API를
불러 `{ issues }`를 돌려준다. `textCheckRoute`는 관리자 로그인·같은 출처를 확인하고 요청 크기(기본 100문단·20,000자)를 막는다.

```ts
// 관리자 컴포넌트(브라우저)
import { remoteTextChecker } from "@monti-cms/core/client";
const checker = remoteTextChecker({ id: "bareun", label: "바른", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts(서버)
import { textCheckRoute } from "@monti-cms/core/plugin/server";
export const POST = textCheckRoute({
	limits: { maxChars: 20_000 },
	check: async (segments, { signal }) => callProvider(segments, process.env.MY_API_KEY, signal), // TextIssue[]
});
```

### 검사기를 붙일 때

- 위치 단위가 다르면 검사기 쪽에서 UTF-16으로 바꾼다. 바이트(UTF-8)·코드 포인트·문장 기준 위치를 그대로 쓰면 이모지·한글 뒤에서
  밑줄이 어긋난다.
- 바른(Bareun): 요청에 `encoding_type: UTF16`을 주면 `begin_offset`·`length`를 그대로 쓸 수 있다. 중첩 결과(`nested`)는 펼친다.
- LanguageTool·Yahoo 같은 위치 기반 API: 문단을 이어 보낼 때는 돌아온 위치를 문단별로 다시 나눈다. 요청 크기·분당 호출 한도는
  `limits`와 서버 경로에서 맞춘다.
- textlint: `range`(`[start, end]`)를 그대로 쓴다. `fix.text`는 후보로 쓰되 `fix.range`가 표시 범위보다 넓을 수 있다.
- hunspell 계열(nspell·typo-js): 낱말 단위라 `Intl.Segmenter({ granularity: "word" })` 등으로 낱말을 나눠 검사하고 위치를 직접
  센다. 띄어쓰기·문법은 보지 못한다.
- 위치 없이 틀린 낱말만 주는 검사기는 문단 글자에서 낱말을 찾아 위치를 정한다(같은 낱말이 여럿이면 차례대로).

`examples/other-site`의 `app/(admin)/studio/admin-components.tsx`가 브라우저에서 도는 작은 금지어 검사기 예시다.

밑줄 스타일은 `@monti-cms/admin/styles.css`에 들어 있다.

## 플러그인 화면

플러그인 정의의 `admin`이 불러오는 모듈은 `defineAdminPlugin()`(`@monti-cms/admin/plugins`)을 기본 내보내기로 준다.

```ts
export default defineAdminPlugin({
	pages: { my: MyPage }, // <관리자 경로>/my(기본 /admin/my, 클라이언트 컴포넌트). 로그인 확인은 관리자 화면이 한다
	Provider: MyProvider, // 관리자 화면 전체를 감싼다. 안에서 CmsAdminComponentsProvider로 입력·편집 화면 확장을 더한다
});
```

편집 화면 확장(`editorExtensions`)은 툴바 끝 요소·블록 손잡이 옆 동작·선택 영역 메뉴·슬래시 메뉴 동작을 더하는 훅이다. 필드 옆·본문 이미지·미디어·코드 블록
자리에는 `SlotRegistryProvider`(`@monti-cms/admin/slots`)로 동작을 붙인다.

화면을 관리자와 같은 모양으로 만들 때는 확장용 묶음 `@monti-cms/admin/kit`을 쓴다. 단추·입력 칸·대화상자·메뉴·표 같은 부품,
`cn`, 확인 대화상자(`useConfirm`), 플러그인 화면 틀(`AdminShell`), 아이콘 찾기(`useIconByName`), `useDebounced`, 글 입력값 타입
(`EntryForm`·`EntryData`)이 들어 있다. 관리자 내부 파일 경로(`ui/*`·`screens/*`)는 공개하지 않는다.

| 진입점 | 내용 |
|---|---|
| `@monti-cms/admin` | 사이트 컴포넌트 넣기(`CmsAdminComponentsProvider`)·속성 칸·목록 칸 타입 |
| `/next` | 관리자 레이아웃·페이지(앱 라우트에서 내보낸다) |
| `/editor` | 편집기 확장 도우미(버블·슬래시 메뉴·코드 블록 잇기) |
| `/blocks` | 블록 편집 화면 도우미 |
| `/plugins` | `defineAdminPlugin` |
| `/slots` | 화면 자리에 동작 붙이기 |
| `/media` | 미디어 고르기·미리보기 |
| `/api` | 관리자 API 부르기(`cmsFetch`) |
| `/kit` | 확장용 부품·도우미 묶음 |
| `/styles.css` | 관리자 스타일 |

## 스타일

관리자 화면의 CSS는 **Tailwind 4**를 선택 피어 요건으로 한다(`package.json`에 피어로 적지는 않는다). 관리자 화면을 쓰는 앱만 Tailwind 4가 필요하고,
`@monti-cms/core` 본체와 읽기·공개 렌더만 쓰는 앱에는 필요 없다. 미리 만든(prebuilt) CSS는 주지 않는다. 앱의 Tailwind가 관리자 화면 클래스를 직접 만들므로
앱에 `tailwindcss`·`@tailwindcss/postcss`(Tailwind 4), `tw-animate-css`, `@tailwindcss/typography`가 있어야 한다.

`@monti-cms/admin/styles.css`가 주는 것(모두 `cms` 이름표가 붙어 앱의 이름과 겹치지 않는다):

- **색 이름.** `bg-cms-background`·`text-cms-muted-foreground`·`border-cms-border` 같은 `cms-*` 색(값은 `--cms-*` 변수). 앱의 shadcn
  이름(`bg-background` 등)과 변수(`--background` 등)는 건드리지 않는다. `--cms-*`는 관리자 화면이 있는 문서에만 걸린다.
- **변형.** `cms-dark:`는 `html`(또는 상위 요소)의 `.dark` 또는 `[data-theme="dark"]`일 때, `cms-horizontal:`·`cms-vertical:`은 Base UI의
  `data-orientation`일 때다. 앱의 `dark`·`data-horizontal` 정의와 따로 논다. 앱이 어떤 테마 방식(클래스·`data-theme`)을 쓰든 관리자 화면의
  어두운 테마가 따라간다.
- **그 밖에.** 배포 묶음의 Tailwind 클래스 찾기(`@source`), 테두리·포커스 윤곽 기본색, 관리자 문서의 둥글기(`--radius*`) 값(Tailwind 기본
  이름이라 관리자가 있는 문서에서만 바뀐다).

`CmsAdminLayout`의 선택 속성으로 관리자가 두는 공급자를 끌 수 있다. 사이트가 이미 `next-themes` 공급자나 `sonner` `Toaster`를 두었다면 겹치지 않게 끈다.

```tsx
<CmsAdminLayout themeProvider={false} toaster={false}>
	{children}
</CmsAdminLayout>
```

- `themeProvider`(기본 `true`): 관리자 화면이 `next-themes` 공급자(`attribute="class"`)를 두고, 테마를 자기만의 저장 키 `monti-admin-theme`에 보관한다. 그래서 관리자에서
  테마를 바꿔도 사이트의 테마는 바뀌지 않는다. 관리자를 떠날 때는 `html`의 `dark`·`light` 클래스와 `color-scheme`을 관리자가 뜨기 전 상태로 되돌린다
  (사이트 자신의 테마는 건드리지 않고, 같은 루트 레이아웃의 공개 화면이 어둡게 남지도 않는다). 끄면 사이트의 공급자가 `html`에 붙이는
  `.dark`·`[data-theme="dark"]`를 따르며, 관리자의 테마 토글은 사이트의 테마를 바꾼다.
- `themeStorageKey`(기본 `monti-admin-theme`): 관리자 테마를 담는 `localStorage` 키. `themeProvider`를 켰을 때만 쓴다.
- `toaster`(기본 `true`): 관리자 화면이 `sonner`의 `Toaster`를 둔다. 끄면 사이트의 `Toaster`에 관리자 알림이 뜬다(같은 `sonner`를 쓸 때).

## 개발

```bash
pnpm --filter @monti-cms/admin test:run        # 예시 블로그 설정 + 다른 사이트 설정
pnpm --filter @monti-cms/admin test:other-site # 다른 사이트 설정(`../core/test/other-site.config.ts`)만
```

화면 테스트는 블로그와 다른 사이트 설정으로도 돈다(`vitest.othersite.config.ts`, 본체 README "개발"). 컬렉션·필드·블록 이름과
이름표는 테스트에 적지 말고 설정에서 읽는다(예: `src/screens/__test__/any-site-screens.test.tsx`).
