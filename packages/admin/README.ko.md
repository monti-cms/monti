# @monti-cms/admin

[English](README.md) | 한국어

`@monti-cms/core`의 관리자 화면. 목록·편집기(tiptap)·미디어·휴지통·로그인·설정 화면을 준다(설정에 스키마 편집기가 `/admin/settings/<탭>`으로 들어 있고, 도구에 템플릿·데이터·활동 기록·API 키·플러그인 페이지가 각자 주소를 가진 탭으로 있다).
프레임워크에 묶이지 않는다. Next.js에서 아무것도 가져오지 않고, 라우터는 받은 어댑터로만 닿는다("라우터 어댑터"). 지금 지원하는 호스트는 `@monti-cms/nextjs`를 통한 Next.js(App Router)다.
플러그인(예: `@monti-cms/ai`)이 도구 페이지·필드 옆 버튼·편집 화면 동작을 더한다.
화면은 본체의 관리자 API(`/api/monti/v1/*`)만 부른다. 설치하지 않고 같은 API로 화면을 직접 만들어도 된다.

## 붙이기

설치·라우트·스타일은 `@monti-cms/core` README의 "빈 Next 앱에 설치"를 따른다(`monti init`이 관리자 라우트·스타일 줄을 만든다). 관리자 라우트 파일은 `@monti-cms/nextjs/admin`의 `CmsAdminLayout`·`CmsAdminPage`를 쓴다.

- **관리자 경로.** 기본 `/admin`이고 사이트 설정 `admin.path`로 바꾼다(예: `/studio`). 앱의 관리자 라우트 폴더
  (`app/studio/[[...path]]/page.tsx`·`layout.tsx`)가 같은 경로여야 한다. 화면 안 링크·로그인 이동(`<관리자 경로>/login`)·
  플러그인 화면 주소가 이 경로를 따른다. 화면 코드는 `useSite()`(`@monti-cms/admin`)로 받은 사이트의 `site.adminHref("/media")`·`site.adminEntryEditHref(id)`로
  주소를 만든다. 관리자 API(`/api/monti/v1`)는 바뀌지 않는다.
- **미리보기.** 편집 화면 `미리보기`는 `site.previewPath` 뒤에 공개 경로를 붙이고 언어는 `site.previewLocaleParam`(기본
  `?locale=`)으로 넘긴다. 검색 미리보기의 주소는 `site.localePrefix`를 따른다.

## 사이트 컴포넌트 넣기

필드 입력·블록 편집 화면·코드 펜스 미리보기는 확장이 넣고 사이트가 더하거나 바꾼다(예: 블록 확장의 Mermaid·차트는 기본
미리보기를 준다). 사이트는 자기 플러그인으로 넣는다. 플러그인이 관리자 쪽을 지정하면 관리자가 그것을 불러온다(`app/`에 따로 둘 파일은 없다). 관리자 쪽은 더할 것을
**선언**하고(`defineAdminPlugin({ components })`) 관리자가 그것을 적용한다. 따로 써야 할 프로바이더는 없다. 같은 이름이면 확장의 것보다 사이트의 것이 이긴다(뒤에 오는 플러그인이 이긴다).

```ts
// plugins/site-admin/index.ts
import { definePlugin } from "@monti-cms/core";

export const siteAdmin = () => definePlugin({ name: "site-admin", admin: () => import("./admin") });
```

```tsx
// plugins/site-admin/admin.tsx: 기본 내보내기가 관리자 쪽이다
"use client";
import { defineAdminPlugin } from "@monti-cms/admin";

export default defineAdminPlugin({
	components: {
		fencePreviews: { chart: () => import("./chart").then((m) => m.Chart) }, // ({ source }) => ReactNode
		fieldInputs: { color: ColorInput }, // fields.text({ input: "color" })인 필드를 이 입력으로 그린다
		blockViews: { notice: NoticeView, image: SiteImageView }, // 모든 블록의 편집 화면(기본 image·file·math 포함). 화면은 props를 받지 않고 useBlockEditor()를 부른다
	},
});
```

그런 다음 `monti.config.ts`의 `plugins`에 `siteAdmin()`을 넣는다. `examples/blog/plugins/word-list`와 `examples/blog/plugins/site-callout`이 그 예다. 아무도 넣지 않은 펜스는 원문을 그대로 보인다.

- **코드를 둘 곳.** 관리자는 모듈을 서버에서 불러와 그 선언을 그대로 브라우저에 넘긴다. 모듈을 `"use client"`로 두거나(가장 간단하다: 컴포넌트도 그 안에 둔다), 평범한 모듈로 두고 컴포넌트는 `"use client"` 모듈에서 가져온다. 평범한 관리자 모듈 안에 쓴 함수는 브라우저로 갈 수 없어 거기서 실패한다.
- **사이트에 따라 달라지는 컴포넌트.** 사이트 설정(플러그인 옵션, 관리자 언어)에서 나오는 컴포넌트는 `components: (site) => ({ … })`처럼 사이트를 받는 함수로 준다. 관리자가 보여 주는 사이트로 브라우저에서 돈다.
- **슬롯과 프로바이더.** `slots`는 화면 슬롯에 동작을 붙인다(`SlotSource`, 아래 "화면 슬롯"). `Provider`는 자기 React 문맥이 필요한 플러그인(부품끼리 나누는 상태 등)만 쓴다. 대부분은 필요 없다.

### 아이콘

블록 정의의 `editor.icon`, 플러그인 페이지의 `icon`, 컬렉션의 `icon`, 코드 줄 효과의 `icon`은 IBM Carbon 아이콘 이름이다(`document`, `warning--alt`, `text--highlight`. `spark`는 어시스턴트의 ✦).
관리자 패키지에는 자주 쓰는 아이콘만 있으므로, 다른 이름은 같은 `components`의 `icons`로 등록한다. 없는 이름은 기본 아이콘(퍼즐·플러그 등)으로
보인다.

```tsx
import { View } from "@carbon/icons-react";

export default defineAdminPlugin({ components: { icons: { view: View } } });
```

`@monti-cms/blocks`의 각 블록과 `@monti-cms/ai`도 같은 방식으로 선언한다.

## 본문은 저장 문서

편집기는 글이 아니라 저장 문서(`StoredDocument`)로 일한다. JSON 문서가 본문의 유일한 원본이다. 편집기로 불러오고 저장하는 길에는 어떤 표기법(MDX든 다른 것이든)도
끼지 않는다.

- `CmsEditor`는 `doc`을 받고, 바뀔 때마다 `onChange(doc)`를 부른다. 문서가 블록에 준 id가 그대로 담긴다. 편집기 자신이 만든 것이 아닌 `doc`이 오면 편집기가 보이는 것을 바꾼다
  (같은 내용에 id나 키 순서만 다른 문서는 그대로 둔다). `@monti-cms/admin/editor`의 `storedToTiptap(doc)`·`tiptapToStored(json)`이 바로 바꿔 준다. 편집 화면이 없는 노드나
  문서로 읽지 못한 본문(`unparsed` 노드 하나)은 읽기 전용 상자(`cmsOpaqueBlock`)에 통째로 담아 아무것도 잃지 않는다.
- `CmsEditor`는 `allowed`(컬렉션 `body`의 객체 형태: `blocks`, `marks`, `headings`. 편집 화면은 컬렉션의 것을 넘긴다)도 받는다. 그러면 그것만 보여 주고 받아들이며(슬래시 메뉴, 블록 메뉴, 서식 카드, 입력 규칙, 단축키, 붙여넣기), 이미 다른 것이 들어 있는 본문도 그대로 열리고 저장된다. `@monti-cms/core` README의 "본문별 허용 블록·마크"를 본다.
- 편집 화면의 폼은 본문을 `form.doc`으로 든다(초안, 브라우저 복구본, 충돌 비교가 모두 문서를 본다. 내용으로 비교하므로 블록 id와 키 순서는 따지지 않는다). 그 전에 본문을 MDX 글로 `form.mdx`에 담아
  저장한 복구본도 그대로 되살린다. 이런 복구본은 `unparsed` 문서로 보관되고, 원문 패널(`@monti-cms/mdx`의 `mdx()` 플러그인)이 열려 있으면 다시 읽는다.
- `DocPreview`(`@monti-cms/admin/editor`)는 번역 화면이 원문을 보이고 AI가 결과를 보이는 문서 읽기 전용 보기다.
  번역 화면의 원문 열은 쓰고 있는 블록을 따라간다. 커서가 있는 블록과 짝지어진 원문 블록(원문 연결로 짝짓는다. 코어의 "원문 연결" 참고)이 같은 높이에 오고 둘 다 표시된다. 스크롤만 할 때는 번역본 가운데 줄을 따라간다. 콜아웃, 접기, 인용 안에서는 안쪽 블록까지 내려가고, 번역본에서 상자를 접으면 원문 상자도 접힌다.

### 원문 패널

문서 도구(본문 오른쪽 위의 버튼 줄. 본문 위에 툴바는 없다)의 원문 토글은 본문을 어떤 표기법의 글로 고친다. 표기법은 플러그인의 것이다. **원문 패널**이 등록되어 있을 때만 토글이 보이고, 등록은 다른 사이트 컴포넌트와 같은 공급자로 한다
(`useAdminComponents().sourcePanels`). 여러 개면 먼저 등록한 것을 쓴다.

```tsx
// `@monti-cms/mdx`의 `mdx()` 플러그인이 대신 등록해 주는 것:
const components = {
	sourcePanels: [{ format: "mdx", label: "MDX 원문", Panel: MdxPanel }],
	formats: { mdx: mdxFormat }, // 브라우저가 읽고 쓸 수 있는 형식(`BrowserFormat`). `useFormat("mdx")`로 찾는다
};
```

`Panel`은 `SourcePanelProps`를 받는다. `doc`(본문), `onChange(doc, issues)`(글이 바뀜: 그 글이 읽히는 문서와 글에서 찾은 것. 읽을 수 없는 글은 `unparsed` 노드 하나에 담은 문서로 돌려주고
찾은 것은 `issues`에 담는다), `focusBlock`(캐럿을 둘 블록의 id. 발행 문제를 따라갈 때), 화면이 필요로 하는 덤으로 `readOnly`와 `onComposing(composing)`(IME 조합이 끝나야 저장한다)이다.
패널은 브라우저에서 읽으므로 틀린 곳이 쓰는 동안 바로 보인다. `BrowserFormat`은 맥락(사이트 블록, 언어)을 묶어 둔 형식이다. `export(doc): string`과 `import(text)`(`{ ok: true, doc, warnings }` 또는
`{ ok: false, issues }`)가 있고 둘 다 동기다. 관리자에는 자체 패널이 없다. MDX 원문 패널과 `mdx` 브라우저 형식은 `@monti-cms/mdx`(`@monti-cms/mdx/admin`)가 주고, `mdx()` 플러그인의 관리자 공급자가 등록한다. 이 플러그인이 없으면 원문 토글도 없다. 패널의 문구는 이름공간 `cms-mdx.source`에 있다.
`SOURCE_ERROR_ID`(`@monti-cms/admin`)는 패널이 발견한 것을 보이는 요소의 id이고, `useLinkPaths`(`@monti-cms/admin`)는 패널에 글 링크의 경로를 준다. `mdxBrowserFormat`은 `@monti-cms/admin/editor`에서 더는 내보내지 않는다.

### 글 링크

글로 가는 링크는 그 글의 id만 들고 있으므로 편집기가 가는 곳을 찾아 보인다. 링크 버블과 링크 폼이 글의 제목과 주소를 보이고(글이 없어졌거나 찾지 못하면 그렇게 알린다), 링크를 열면 글이 발행됐을 때는 사이트의
그 글 쪽으로, 아니면 관리자의 그 글 편집 화면으로 간다. 링크 폼에 주소를 직접 적으면 글 링크를 그 주소로 바꾼다.

## 속성 칸

편집 화면 오른쪽 속성 칸은 컬렉션 정의로 만든 읽기 목록이다. 이름표 아래에 값이 있고, 값을 누르면 그 자리에서 입력이 열린다(Enter·Esc·줄을 벗어나면 닫힌다). 입력은 필드 종류로 정한다: 텍스트·선택·관계, 미디어 필드
(`fields.media`)는 미디어 고르기(`accept: "file"`이면 파일 올리기)다. 필드 이름이나 역할로 입력을 바꾸지 않는다.
`input`으로 등록한 입력을 고르면 그 입력이 먼저다. 본체에는 이름 붙은 입력이 없다. 여러 줄 텍스트(`multiline: true`)는
`rows`(기본 2)만큼의 여러 줄 칸이다(예전 `input: "auto-summary"`는 `multiline: true, rows: 3`으로 바꾼다).

`fieldInputs`에는 컴포넌트(입력 전체를 바꾼다) 또는 조각(`FieldInputParts`, 기본 입력을 두고 일부만 바꾼다)을 등록한다.
조각은 지금 입력 중인 값(`form`)을 읽을 수 있다. `Aside`는 필드가 열려 있는 동안 이름표 줄에 보이고, `Empty`는 값이 비었을 때 목록이 대신 읽어 주는 말("제목과 같음"처럼 따르는 값)이다.
컴포넌트 하나로 등록한 입력은 제 값을 직접 그리므로 목록에서도 늘 열려 있다.

```tsx
const components = {
	fieldInputs: {
		// 비었을 때 쓸 값을 안내 문구로, 글자 수를 이름표 줄 오른쪽에
		"meta-title": { placeholder: ({ form }) => form.title, Aside: ({ value }) => <span>{String(value ?? "").length}</span> },
		// 비었을 때 따르는 값을 말하기
		"meta-title": { Empty: () => <>제목과 같음</> },
		// 입력 줄 없이 이름표 줄의 조각만(`Input: null`)
		"hide-switch": { Input: null, Aside: HideSwitch },
	},
};
```

`layout` 묶음의 `tab`마다 속성 칸에 탭이 생긴다(첫 탭은 `tab`이 없는 묶음을 담고, SEO 필드처럼 플러그인이 두는 필드는 제 탭을 가진다). 묶음은 core가 계산하고(`site.panelGroupsOf`), 설정 화면의 필드 트리도 같은 묶음으로 그린다. 보기 필드
(`fields.view({ view })`)는 그 자리에 플러그인 `components`의 `fieldViews`(`{ 이름: ({ collection, form, entry }) => … }`)로
선언한 화면을 그린다. `form`은 편집 중인 항목이고 `form.doc`은 지금 편집 중인 본문(저장 문서 형태, `toPlainText(site, form.doc)`가 그 텍스트를 준다)이라, 계산한 값이 입력을 따라 바뀐다. `entry`는 서버가 마지막으로 저장한 상태다. 등록한 화면이 없으면 아무것도 그리지 않는다. 미디어 ID로 미리보기를 그리는 화면은
`@monti-cms/admin/kit`의 `MediaThumbnail`을 쓴다(SEO 확장 `@monti-cms/seo`의 검색 미리보기가 예시다).
날짜·시각은 사이트 설정의 `timeZone`으로, 표기는 `admin.locale`(기본 `ko-KR`)로 보인다. 관계 입력의 안내 문구는 대상 컬렉션의
이름표를 쓴다(예: "게시글 고르기"). 항목 컬렉션(`kind: "item"`)의 항목은 목록의 작은 폼으로 연다. 미디어 사용처처럼 여러
컬렉션을 가리키는 곳은 `<관리자 경로>?collection=<컬렉션>&open=<ID>`로 그 항목 칸을 열고, `<관리자 경로>/entries/<ID>/edit`로 열어도
그 주소로 보낸다. 목록 컬럼 설정에 저장된 이름 중 지금 컬럼이 아닌 것은 버린다(예전 이름을 짐작해 바꾸지 않는다).

## 탐색과 설정

사이드바에는 머리 줄(사이트 이름, 사이트를 여는 링크, 접기 버튼. 버튼이나 ⌘B로 64px 아이콘 사이드바로 접히며, 접히면 아이콘에 마우스를 올릴 때 이름과 숫자가 툴팁에 나오고, 전달 실패가 있으면 도구 아이콘에 점이 붙고, 폴더는 숨는다. 접은 상태는 이 브라우저에 기억된다)과 그 아래 **콘텐츠**(컬렉션마다 하나, 그다음 미디어. 열려 있는 컬렉션이나 미디어는 그 아래에 폴더를 펼친다. 맨 위 폴더와 열린 경로에 놓인 폴더들이다)가 있고, 맨 아래 줄 아래에 **휴지통**(개수가 붙는다), **도구**(실패한 전달 개수가 붙는다), **설정**, 그리고 화면 모드(시스템·라이트·다크, 고르기 전에는 시스템) 아이콘 단추 하나가 있다. 사이드바는 이동만 한다. 폴더는 목록에서 만들고 이름을 바꾸고 지운다. 좁은 화면에서는 서랍이며 접히지 않는다. 화면마다 주소가 따로 있다.

| 화면 | 주소 | 내용 |
|---|---|---|
| 사이트·언어·컬렉션·파일·관리자 | `<관리자 경로>/settings`(사이트 탭으로 열린다. `site`·`locales`·`collections`·`file`·`admin`) | 설정, 스키마 편집기(아래). 초안을 이 탭들이 함께 쓰고, 다른 탭에 다녀와도 남는다. |
| API 키(도구의 탭) | `<관리자 경로>/tools/api-keys` | 중앙 키 저장소. 이름 붙은 키마다 한 줄로 가린 끝자리와 쓰는 곳을 보여 주고, 추가·이름 바꾸기·값 바꾸기·지우기를 한다(쓰는 중인 키는 먼저 묻고 멈추는 곳을 보여 준다). 키는 서버 `secret`으로 암호화하고 값은 브라우저로 돌아오지 않는다. 플러그인이 필요하다고 선언한 키(`keySlots`, 맞춤법 검사기 등)는 한 줄씩 나온다. 비어 있으면 "키 넣기"(저장된 키를 고르거나 새 키를 넣음)가 있고, 정해진 슬롯은 그 키의 "사용 중" 줄에 나오며 줄 메뉴에서 뺀다. AI 연결과 플러그인의 키 슬롯은 각자 화면에서 저장된 키를 고르거나 새 키를 넣는다(같은 요청으로 여기에 저장된다). |
| 템플릿(도구의 탭) | `<관리자 경로>/tools/templates` | 본문 템플릿. 한 줄에 이름, 제목들, 고친 날, 복제·지우기 메뉴가 있고 헤더에 "템플릿 추가"가 있다(`admin.templates`가 `false`면 404). |
| 템플릿 하나 | `<관리자 경로>/templates/new`, `<관리자 경로>/templates/<id>/edit` | 도구 페이지 밖의 템플릿 한 장짜리 페이지. 이름 아래에 본문이 있고, 고친 곳이 생기면 헤더에 "저장 안 됨"과 저장 버튼(⌘S)이 나오며, 상태 줄에 글자 수가 있다. 돌아가기 링크는 템플릿 탭으로 간다. |
| 데이터(도구의 탭) | `<관리자 경로>/tools/data` | 백업, zip 하나로 글 가져오기(빈 사이트에 전체 백업이면 복원 시트가 열린다). |
| 활동 기록(도구의 탭) | `<관리자 경로>/tools/events` | 이벤트 전달. 탭에 실패한 전달 개수가 붙는다. |
| 플러그인 페이지마다 하나(도구의 탭) | `<관리자 경로>/tools/<경로>` | 플러그인의 `nav` 항목과 `pages` 항목(예: `ai`). 기본 탭들 뒤의 탭으로 나온다. |

`<관리자 경로>/settings`는 첫 탭으로, `<관리자 경로>/tools`는 도구의 첫 탭으로 간다.

## 스키마 화면

`<관리자 경로>/settings/collections`(사이드바: 설정 > 컬렉션. 편집기는 사이트·언어·파일·관리자 탭에도 걸쳐 있다)는 개발 서버에서, 파일이 평범한 데이터인 동안(`defineSchema` import와 `export default defineSchema({ ... })`뿐, 그 밖의 코드는 없음) `monti.schema.ts`를 다시 쓴다. 그 밖에서, 그리고 코드가 들어 있는 파일(import, 전개, 함수 호출)에서는 이유와 함께 읽기 전용으로 보여 준다. 저장하면 파일 전체를 다시 쓰므로 파일의 주석은 사라진다(화면이 알려 준다). 코어의 `GET/PUT /api/monti/v1/schema`와 `POST /api/monti/v1/schema/preview` 경로의 화면이다(누가 쓸 수 있는지, 저장 순서, 돌고 있는 인스턴스가 다시 읽는 방법은 `@monti-cms/core` README의 "관리자에서 스키마 편집하기"를 본다).

- **컬렉션**: 이름표, 아이콘, 종류, 공개 주소, 본문, 허용하는 블록·서식·제목 단계(목록마다 스위치가 있다. 끄면 모두 허용하고, 켜면 사이트가 아는 이름마다 체크박스가 나온다). 모든 종류의 필드는 그 자리에서 펼쳐진다. 이름, 종류, 이름표, 도움말, 필수, 언어, 종류별 옵션(텍스트 길이와 줄 수, 주소의 기준, 관계의 대상, 미디어 종류, 역참조의 관계, 뷰 이름), 선택의 선택지(이름표, 기본값, 순서), 조건부 필드의 선택마다 딸린 필드를 고친다. 필드는 손잡이를 끌어 순서를 바꾸고(키보드로도 된다: Space, 화살표, Space) 지울 수 있고, 여기서 이름을 바꾼 필드는 그 이름을 쓰던 배치, 목록 열, 주소 기준을 따라간다. 배치 묶음(제목, 탭, 접힘, 순서 있는 필드)과 목록 열은 순서 있는 목록으로 편집한다. 새 필드는 텍스트, 선택, 미디어, 다른 컬렉션 연결 가운데 고르고, 종류를 고르면 그 설정이 바로 나온다. 연결은 입력 모양도 미리보기로 보여준다. 선택은 선택지마다 다른 필드를 보일 수 있고, 여러 개를 고르는 연결은 상대 컬렉션에도 보이게 할 수 있으며, 공개 주소를 켜면 주소 필드가 없을 때 함께 생긴다.
- **언어**: 콘텐츠 언어(저장된 언어의 코드는 저장되는 값이라 새 언어만 코드를 정한다), 기본 언어, 시간대.
- **파일**: 이 화면이 편집하지 않는 파일의 부분(사이트·관리자·시드 설정과 기록된 `migrations`).
- **변경 검토**는 무엇이든 쓰기 전에 대화상자를 연다. 모든 변경과 그 변경이 건드리는 글, 글로 가는 링크인 표본, 편집의 문제와 JSON 경로, 그리고 저장된 값을 다루는 방법이 둘 이상인 변경(지우거나 이름을 바꾼 필드, 지운 선택지, 필수가 된 필드)마다 선택지(값 두기, 이름 바뀐 필드로 옮기기, 지우기, 지운 선택지를 다른 것으로 바꾸기, 비어 있는 글 채우기)를 보여 준다. 기본값은 서버가 정한다(작성자가 한 이름 바꾸기는 이름 바꾸기로 제안하고, 글이 값을 가진 삭제는 고르지 않는다). **저장하고 적용**은 파일, 타입, 개발 데이터베이스를 쓰고 페이지를 다시 불러와 사이드바, 폼, 목록이 새 스키마로 그려지게 한다.

운영 서버(또는 스키마 파일에 쓸 수 없는 서버)는 쓰는 경로에 403으로 답하므로, 화면은 스키마를 보여 주고 왜 편집할 수 없는지만 알려 준다. 화면은 너비 750px 안팎에서도 쓸 수 있다. 컬렉션 목록은 편집기 위의 한 줄이 되고 폼은 한 열이다. 화면의 글은 `cms-admin.schema` 메시지 사전(`en`, `ko`)에 있고 다른 사전처럼 덮어쓸 수 있다.

## 블록 편집 화면

설정의 `blocks`나 블록 확장 플러그인이 더한 블록(`editor.view: "node"`)은 관리자 화면이 정의에서 편집기 노드(`cms` + 파스칼
이름, 예: `cmsNotice`)·변환·슬래시 메뉴 삽입·끌기 규칙을 만든다. 편집 모양만 넣으면 된다.

- 아무것도 넣지 않으면 지시자 블록은 속성 입력과 본문을 담은 상자, 코드 펜스 블록은 코드 입력 칸과 미리보기다.
- `blockViews`가 블록 편집 화면을 등록하는 유일한 자리이고, 더한 블록과 기본 `image`·`file`·`math` 블록 모두 여기에 등록한다
  (`blockViews.image`를 등록하면 이미지 화면을 다시 그린다). 등록한 화면은 틀까지 포함해 그 블록의 기본 화면을 대신한다.
- 화면은 props를 받지 않는다. `useBlockEditor()`로 자기 블록을 읽고 쓰고, 컨테이너의 편집 가능한 중첩 본문은 `<Content />`로 그리며,
  `<BlockFrame>`으로 감싼다. 모두 `@monti-cms/admin`에 있고 Tiptap·ProseMirror 타입이 필요 없다. 도구 줄·설정 팝오버·속성 입력 칸 같은 화면 부품(`ContainerToolbar`·`ToolbarButton`·`BlockSettings`·`AttributeInput`)도 거기 있다.
  `@monti-cms/blocks`의 콜아웃·탭·단·접기·코드 탐색기 화면이 예시다.
- `blockEditors`와 `CustomBlockEditorProps`는 없어졌다. `content`는 `<Content />`가 되고, `values`·`setValue`는 `useBlockEditor().values`·`.setValue`가 되며,
  `editable`·`selected`도 같은 객체의 값이다. 예전 기본 틀이 해 주던 감싸기는 `<BlockFrame>`으로 직접 한다.
  Tiptap 타입을 받던 편집 화면 도우미(`useContainerValues`·`valuesOf`·`withValue`·`childPos`·`focusInside`·`selectContainer`·`useSelectedChildIndex`·`useEditorEditable`)는
  더 내보내지 않고 `useBlockEditor()`가 대신한다. `BLOCK_NODE_VIEWS`는 `BLOCK_NODES`로 바뀌었다(옛 이름은 없앴다).

```tsx
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin";

function NoticeView() {
	const block = useBlockEditor<{ level: string }>();
	return (
		<BlockFrame>
			<button type="button" contentEditable={false} onClick={() => block.setValue("level", "warn")}>
				{block.values.level}
			</button>
			<Content />
		</BlockFrame>
	);
}
```

## 글자 꾸밈

블록 확장의 글자 꾸밈(`syntax.kind: "text"`, `editor.view: "mark"`, 예: `@monti-cms/blocks`의 툴팁·코드 연결·글자색)은 관리자
화면이 정의에서 편집기 마크(`cms` + 파스칼 이름, `addedMarkName("tooltip")` → `cmsTooltip`)와 저장 문서 변환을 만든다. 본체
편집기는 꾸밈 이름을 모르고, 확장이 자기 `components`의 `marks`(블록 이름 → `EditorMarkExtension`)로 준 것만 그린다.

```tsx
import type { EditorMarkExtension } from "@monti-cms/admin/editor";

const note: EditorMarkExtension = {
	inclusive: false, // 꾸밈 끝에 이어 친 글자가 꾸밈을 이어받는가(기본 false)
	render: (attrs) => ({ class: "underline decoration-wavy" }), // span에 더할 HTML 속성
	formatItems: [noteFormat], // 서식 카드 ⋯ 아래의 줄(아래 설명)
	detail: NoteDetail, // 커서가 꾸밈 안에 있을 때 버블 내용(설명·수정·해제)
	insertActions: [{ id: "note", title: "메모", description: "…", keywords: ["note"], run: (editor, range) => {} }], // 슬래시 메뉴
};
const components = { marks: { note } };
```

- 서식 카드에는 사이트가 더한 꾸밈의 버튼이 따로 없다. 꾸밈마다 카드 `⋯` 아래의 한 줄이다(`formatItems`, 타입 `EditorFormatItem`): `id`(사이트에서
  유일), `label`(문자열, 또는 고른 글에 따라 바뀌면 편집기를 받는 함수. "툴팁 넣기"·"툴팁 고치기"처럼), `icon`, `isAvailable(props)`(코드 안처럼 꾸밈이
  안 되는 자리에서는 false. 남는 줄이 없으면 `⋯`도 그리지 않는다), `isActive(editor)`(줄 끝에 ✓), `run(props)`. `props`는
  `{ editor, inCode, openPanel, closePanel, act }`이다. `openPanel({ label, size, content })`은 카드 안에 입력 칸을 펼치고 `closePanel`은 닫는다.
  `runFormatItem(id)`(`@monti-cms/admin/editor`)는 고른 글에 그 줄을 id로 실행한다. 샘플 글자를 먼저 고르는 슬래시 메뉴 항목처럼 다른 곳에서 부를 때 쓴다.
  커서가 꾸밈 안에 있을 때의 내용(`detail`)은 같은 `props`에 `mark`를 더해 받는다. 거기서 카드와 같은 모양을 내려면 `@monti-cms/admin/editor`의
  `BubbleButton`·`MarkTextForm`·`removeInlineMark`·`allowsMark`를 쓴다.
- HTML로는 `span[data-monti-mark="이름"]`과 속성마다 `data-mark-<속성>`이다. 저장 문서(CmsNode)의 mark 이름은 블록 이름이고
  속성은 정의의 속성만 남긴다(`markAttrsOf`).
- 속성에 `codeAnchor: true`가 있는 꾸밈은 코드 블록 줄 이름표를 가리킨다(`CODE_ANCHOR_REF`). 코드 블록의 줄 메뉴 "본문 연결"·
  잇기 안내 줄·마우스를 올린 줄 강조(`data-code-ref`)·연결 끊김 표시가 이 꾸밈을 쓰고, 그런 꾸밈이 없으면 숨는다. 버블에서 쓰는
  잇기 명령(`findAnchor`·`startLinkFromText`·`unlinkRef`)도 같은 진입점에 있다.
- 코드 블록 안 글자 툴팁(코드 펜스 주석 `// @char Tooltip`)은 본체 코드 블록 기능이라 본문 툴팁과 따로다(마크 `codeTooltip`).
- 코드 블록 도구는 사이트 설정 `codeBlock`(`@monti-cms/core` README)을 따른다. `omitLineEffects`와 `features`(`rules`·`fold`·`tooltip`·`textStyles`)는 줄 효과·정규식 규칙·접기·툴팁·
  코드 안 굵게·기울임·취소선·밑줄을 줄 메뉴·규칙 패널·서식 카드·단축키에서 감추고, `themes`와 `languages`는 강조 테마와 언어 목록을 정한다.
  꺼진 도구를 이미 쓰는 본문은 그대로 열리고 저장해도 바뀌지 않으며, 그 효과는 계속 보여 지울 수 있다.

## 글 검사(맞춤법 등)

본체는 검사기를 하나도 갖지 않고 버튼·밑줄·결과 창만 그린다. 사이트·확장이 검사기(유료 API, 브라우저에서 도는 npm 패키지
등)를 만들어 확장점 `textCheckers`에 넣으면, 글의 언어를 검사하는 검사기마다 문서 도구의 버튼(이름 `label`, 아이콘 `icon`)이
생기고 결과는 물결 밑줄·결과 창·목록으로 보인다. 여러 확장이 검사기를 넣으면 모두 모인다. 검사기가 없으면 아무것도 보이지 않는다.
검사기는 플러그인의 관리자 쪽으로 등록한다("사이트 컴포넌트 넣기" 참고). 예제 블로그의 `word-list` 플러그인이 작은 예다.

```tsx
"use client";
import { defineTextChecker } from "@monti-cms/core";
import type { AdminComponents } from "@monti-cms/admin";

const myChecker = defineTextChecker({
	id: "my-words",
	label: "금지어 검사", // 버튼 이름
	icon: "flag", // Carbon 아이콘 이름이나 컴포넌트. 없으면 맞춤법 아이콘
	locales: ["ko"], // 없으면 모든 언어
	limits: { maxChars: 10_000, maxSegments: 50 }, // 넘으면 나눠 보낸다
	// auto: true, // 입력을 멈추면 바뀐 문단만 저절로 검사(기본은 끔)
	check: async (segments, { signal }) => [
		// { segmentId, start, end, message, suggestions: [], severity: "error" | "warning" | "info", ruleId?, category?, source?, url? }
	],
});

const components: AdminComponents = { textCheckers: [myChecker] };
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
// 플러그인의 관리자 쪽(브라우저)
import { remoteTextChecker } from "@monti-cms/core";
const checker = remoteTextChecker({ id: "speller", label: "맞춤법", locales: ["ko"], url: "/api/text-check" });

// app/api/text-check/route.ts(서버)
import { textCheckRoute } from "@monti-cms/core/server";
import { cms } from "@/monti.config";
export const POST = textCheckRoute({
	cms, // 앱의 라우트 파일은 관리자 확인에 쓸 인스턴스를 적는다
	limits: { maxChars: 20_000 },
	check: async (segments, { signal }) => callProvider(segments, process.env.MY_API_KEY, signal), // TextIssue[]
});
```

### 검사기를 붙일 때

- 위치 단위가 다르면 검사기 쪽에서 UTF-16으로 바꾼다. 바이트(UTF-8)·코드 포인트·문장 기준 위치를 그대로 쓰면 이모지·한글 뒤에서
  밑줄이 어긋난다.
- LanguageTool·Yahoo 같은 위치 기반 API: 문단을 이어 보낼 때는 돌아온 위치를 문단별로 다시 나눈다. 요청 크기·분당 호출 한도는
  `limits`와 서버 경로에서 맞춘다.
- textlint: `range`(`[start, end]`)를 그대로 쓴다. `fix.text`는 후보로 쓰되 `fix.range`가 표시 범위보다 넓을 수 있다.
- hunspell 계열(nspell·typo-js): 낱말 단위라 `Intl.Segmenter({ granularity: "word" })` 등으로 낱말을 나눠 검사하고 위치를 직접
  센다. 띄어쓰기·문법은 보지 못한다.
- 위치 없이 틀린 낱말만 주는 검사기는 문단 글자에서 낱말을 찾아 위치를 정한다(같은 낱말이 여럿이면 차례대로).

`examples/blog`의 `plugins/word-list`가 브라우저에서 도는 작은 금지어 검사기 예시이며, 플러그인(`index.ts`, 검사기와 그 선언이 든 `admin.tsx`)으로 등록한다.

밑줄 스타일은 `@monti-cms/admin/styles.css`에 들어 있다.

## 플러그인 화면

플러그인 정의의 `admin`이 불러오는 모듈은 `defineAdminPlugin()`(`@monti-cms/admin`)을 기본 내보내기로 준다.

```ts
export default defineAdminPlugin({
	pages: { my: MyPage }, // `nav` 항목 "my"의 페이지: <관리자 경로>/tools/my(기본 /admin/tools/my, 클라이언트 컴포넌트). 로그인 확인은 관리자 화면이 한다
	components: { fieldViews: { "my-view": MyView } }, // 필드 입력·보기, 블록 뷰, 꾸밈, 편집기 확장, 글 검사기, 아이콘 등("사이트 컴포넌트 넣기")
	slots: [mySlotSource], // 화면 슬롯에 붙일 동작
	// Provider: MyProvider, // 자기 React 문맥이 필요한 플러그인만
});
```

페이지는 클라이언트 컴포넌트이고 도구 페이지의 탭으로, 기본 탭들 뒤에 나온다. 이름은 플러그인 정의의 `nav` 항목(`{ path: "my", label }`)이 정하고, 페이지는 본문만 그린다(사이드바와 도구 제목, 탭은 관리자가 이미 둔다). 동작이 있는 페이지는 그 동작을 자기 본문에 둔다. 플러그인 API는 `useAdminFetch()`(`@monti-cms/admin`)로 부른다. `adminFetch("/v1/<플러그인>/<경로>", init)`는 `/api/monti` 뒤의 경로를 받고, 실패하면 `CmsApiError`를 던지며 그 `message`가 보여 줄 문구다. 관리자의 사이트가 그 문구의 언어를 정하고, 설정 화면 미리보기에서 쓰기를 막는다. 컴포넌트 밖에서는 `adminFetch(site, path, init)`이 사이트를 직접 받는다.

```tsx
"use client";
import { useAdminFetch } from "@monti-cms/admin";
import { useQuery } from "@tanstack/react-query";

export function StatsPage() {
	const adminFetch = useAdminFetch();
	const stats = useQuery({ queryKey: ["post-stats"], queryFn: ({ signal }) => adminFetch<{ published: number }>("/v1/post-stats/summary", { signal }) });
	return <div>{stats.data?.published}</div>;
}
```

부르는 경로는 플러그인 경로(`adminRoute`, `@monti-cms/core` README의 "플러그인")다.

편집 화면 확장(`editorExtensions`)은 문서 도구(본문 오른쪽 위의 버튼 줄)의 요소·블록 메뉴의 동작·서식 카드와 슬래시 메뉴의 동작을 더하는 훅이다. 필드 옆·본문 이미지·미디어·코드 블록
자리에는 `defineAdminPlugin`의 `slots`로 동작을 붙인다(`SlotSource` 타입과 슬롯 부품은 `@monti-cms/admin/slots`에 있다).

화면을 관리자와 같은 모양으로 만들 때는 확장용 묶음 `@monti-cms/admin/kit`을 쓴다. 단추·입력 칸·대화상자·메뉴·표 같은 부품,
`cn`, 확인 대화상자(`useConfirm`)와 저장 안 한 변경 가드(`useUnsavedGuard`),
목록-편집 배치(`MasterDetail`·`ListPane`·`ListRow`), 편집 폼 부품(`useDraftEditor`·`EditorFooter`), 상태 부품(`Count`·
`Banner`·`LoadErrorAlert`·`FormFieldError`), `commonMessages`(저장·취소·다시 시도 등), `useDebounced`, 미디어 미리보기(`MediaThumbnail`), 글 입력값 타입
(`EntryForm`·`EntryData`)이 들어 있다. Monti 패키지와 예제가 쓰는 것만 내보내며, 없는 부품은 확장이 필요로 할 때 추가한다. 색은 `--monti-success`·`--monti-warning`·`--monti-destructive` 토큰(`-soft`·`-foreground` 포함)에서 오며 원색 클래스는 쓰지 않는다.
관리자 내부 파일 경로(`ui/*`·`screens/*`)는 공개하지 않는다.

| 진입점 | 내용 |
|---|---|
| `@monti-cms/admin` | 플러그인의 관리자 코드가 쓰는 것: `defineAdminPlugin`(`pages`·`components`·`slots`·`statusCells`·`panel`), 컴포넌트 타입(`FieldViewProps`·`AdminComponents` 등), 관리자 API(`useAdminFetch`·`adminFetch`·`CmsApiError`·`errorText`·`isConflict`·`useCmsMutation`), 블록 편집 화면(`useBlockEditor`·`BlockFrame`·`Content`·`ContainerToolbar`·`ToolbarButton`·`BlockSettings`·`AttributeInput`), 편집기 훅(`useField`·`useEntryEditor` 등, 실험), 관리자 코드가 읽는 사이트(`useSite`·`useTranslator`·`toPlainText`·`Site` 등, `@monti-cms/core/site`와 같은 값). 플러그인의 관리자 코드는 이 진입점 하나와, 화면 부품이 필요하면 `/kit`만 쓴다 |
| `/host` | 프레임워크에 묶이지 않는 관리자 레이아웃·페이지(`AdminLayout`·`AdminPage`·`adminMetadata`)와 `AdminServer` 타입. `@monti-cms/nextjs` 같은 호스트 패키지가 붙인다 |
| `/router` | 라우터 어댑터: `AdminRouterProvider`, `AdminRouter` 타입, `AdminLink`, `useAdminRouter`, `useAdminPathname`, `useAdminSearchParams` |
| `/editor` | 저장 문서와 편집기(`CmsEditor`, `storedToTiptap`, `tiptapToStored`, `DocPreview`), 편집기 확장 도우미(버블·슬래시 메뉴·코드 블록 잇기) |
| `/slots` | 화면 자리에 동작 붙이기 |
| `/kit` | 확장용 부품·도우미 묶음 |
| `/styles.css` | 관리자 스타일(미리 만들어져 있어 앱에 Tailwind가 필요 없다) |

### 상태 표시줄

편집기의 맨 아래에는 장식 없는 상태 표시줄(높이 24px, 사이드바 배경, 위쪽 가는 선)이 있다. 다른 곳에 없는 것만 왼쪽부터 보여 준다. 글의 저장 상태("저장 전 변경사항", "저장됨 10:42". 누르면 저장하고, 저장이 실패한 뒤에는 다시 시도한다), 발행 전에 고칠 것("할 일 2", 없으면 "할 일 없음". `POST /api/monti/v1/entries/:id/check`로 알아내며, 글을 열 때와 저장할 때마다 다시 검사하고 발행이 거절되면 목록이 열린다), 플러그인이 채운 칸, 그리고 오른쪽 끝의 본문 글자 수(공백 제외)다. 할 일 칸은 문제마다 한 줄씩 목록으로 열고, 줄을 누르면 그 항목이나 블록으로 가며, 구분선 아래에는 이미 맞게 채운 필수 항목이 나온다. 글의 상태 이름은 머리글의 칩에, 언어는 언어 탭에 있다.

플러그인은 `defineAdminPlugin`의 `statusCells`로 이름을 붙여 칸을 채운다. 코어는 할 일 칸 다음에 칸 자리 하나를 주며, 원문 편집기와 번역 편집기 모두에 있다. 칸과 칸에서 열리는 목록은 코어 것(`@monti-cms/admin/kit`의 `StatusBarPluginCell`)이고, 플러그인은 그 안에 들어갈 것만 가져온다. 찾는 것의 이름, 찾은 항목, 동작이다. 칸 컴포넌트는 `StatusBarPluginCell`이나 `null`을 그린다. 할 말이 있는 곳에서만 보이므로, 한 언어만 검사하는 플러그인은 다른 언어에서 아무것도 그리지 않는다.

```tsx
"use client";
import { StatusBarPluginCell, useStatusBarContext } from "@monti-cms/admin/kit";

function LinksCell() {
	const { locale, entryId } = useStatusBarContext();
	const links = useBrokenLinks(entryId); // 직접 만든 쿼리: [{ id, label, where, fix }]
	if (locale !== "ko" || links.length === 0) return null; // null이면 칸도 틈도 없다
	return (
		<StatusBarPluginCell
			label="링크"
			findings={links.map((link) => ({ id: link.id, title: link.label, detail: link.where, actionLabel: "고치기", onAction: link.fix }))}
			settings={{ label: "설정", href: "/admin/tools/links" }}
			fixAll={{ label: "모두 고치기", onClick: fixAllLinks }}
		/>
	);
}

export default defineAdminPlugin({ statusCells: { links: LinksCell } });
```

칸에는 `label`과 찾은 항목 수가 보이고, `blocking`인 항목이 있으면 빨갛게 보인다. 목록에는 항목마다 한 줄이다. 제목, 어디인지 한 줄, 동작 하나이며, 줄 자체를 누르면 그 자리로 간다(`onOpen`). 구분선 아래 양쪽 끝에는 `settings`(관리자 안의 주소)와 `fixAll`이 놓인다. 칸이 사이트 설정에 달려 있으면 사이트의 함수(`statusCells: (site) => ({ ... })`)를 준다. 컴포넌트는 `"use client"` 모듈에서 가져온다. `useStatusBarContext()`는 `collection`, `entryId`, 글의 `locale`, 그리고 `textIssues`를 돌려준다. `textIssues`는 텍스트 검사기(`textCheckers`)가 본문에서 찾은 것으로, 항목마다 글자, 제안, 문단 번호와 문장, 그 자리로 가는 방법과 고치는 방법이 있고, 한꺼번에 고치는 `fixAll`도 있다. 

### 사이드 패널

플러그인은 `defineAdminPlugin`의 `panel`로 모든 화면의 오른쪽에, 글 편집기에도, 패널 하나를 더한다. `label`, `icon`, `Component`를 준다. 관리자는 화면마다 머리글에 이 패널의 버튼을 그리고, 창으로 연다(1280px보다 좁으면 화면 위에 뜨고, Ctrl 또는 Cmd와 `.`로도 열고 닫는다). 열렸는지는 이 브라우저에 기억한다. 지금은 패널을 하나만 보여 주며, 여럿이면 나중에 등록한 플러그인의 것을 쓴다. 이름이 사이트 설정에 달려 있으면 사이트의 함수(`panel: (site) => ({ ... })`)를 준다. 이 함수와 컴포넌트는 `"use client"` 모듈에서 가져온다. 컴포넌트는 자기 틀을 직접 그리고(`/kit`의 `SidePanel`이 고정된 너비, 머리글, 스크롤되는 본문, 아래에 고정된 바닥을 준다. `width`는 `side`, `panel`, `assistant`) 패널을 닫을 `onClose`를 받는다.

```tsx
export default defineAdminPlugin({ panel: { label: "메모", icon: StickyNote, Component: NotesPanel } });
```

컴포넌트는 `useScreenContext()`로 관리자가 어디에 있는지 읽는다. `screen`(`entries`·`entry`·`media`·`settings`·`other`), `collection`, 열린 글의 `entryId`, 글 목록에서는 고른 행의 `selectedIds`(고른 것이 없으면 빈 배열)다. 글 편집기에서는 `useOpenEditor()`가 열린 편집기도 돌려준다. `readEntry()`는 저장하지 않은 변경까지 폼이 지금 들고 있는 글을, `readSelection()`은 고른 글자와 커서가 있는 블록(블록 id 포함)을 준다. 둘 다 부른 때의 편집기를 읽는다. 다른 화면에서 `useOpenEditor()`는 `null`이다.

### 라우터 어댑터

화면과 훅은 프레임워크를 가져오지 않는다. 라우터에서 필요한 것은 모두 호스트 패키지가 `AdminRouterProvider`(`@monti-cms/admin/router`)에 주는 객체 하나, `AdminRouter`에서 온다.

| 항목 | 뜻 |
|---|---|
| `Link` | 사이트 안 주소로 가는 링크 컴포넌트(`<a>` props, 문자열 `href`). 프레임워크에 있으면 클라이언트 이동을 한다 |
| `navigate(href, { scroll? })` | 그 주소로 가고 기록을 하나 더한다 |
| `replace(href, { scroll? })` | 지금 기록을 그 주소로 바꾼다. 쿼리만 바꾸는 목록은 `scroll: false`를 넘긴다 |
| `usePathname()` | 훅: 지금 주소의 경로 |
| `useSearchParams()` | 훅: 지금 주소의 쿼리(읽기 전용 `URLSearchParams`) |

관리자 안에서는 같은 진입점의 `AdminLink`·`useAdminRouter()`·`useAdminPathname()`·`useAdminSearchParams()`를 쓴다. 제공자 밖에서는 이유를 알리는 오류가 난다. 플러그인 화면도 이것을 쓴다(AI 플러그인이 이렇게 경로를 읽는다).

서버 화면이 필요로 하는 리다이렉트와 404는 `AdminServer`(`{ redirect(href): never; notFound(): never }`)로 `AdminPage`(`@monti-cms/admin/host`)에 넘긴다.
`@monti-cms/nextjs/admin`이 `next/link`·`next/navigation`과 Next의 `redirect`·`notFound`로 둘 다 만든다. 다른 프레임워크의 호스트는 제 것을 주고 `AdminLayout`을 `AdminRouterProvider` 안에 그린다.
테스트가 경계를 지킨다. 관리자의 소스 파일은 `next/*`를 가져올 수 없다.

### 편집기 훅 (실험)

글 편집기 훅(`useField`·`useEntryEditor`와 그 타입)은 실험 단계이고, 설치형 컴포넌트에서 충분히 써 보기 전까지 마이너 릴리스에서 바뀔 수 있다.
훅은 상태와 결과만 돌려준다. 토스트를 띄우거나 확인 대화상자를 열거나 화면을 옮기지 않으므로, 사이트가 그 위에 자기 화면을 그릴 수 있다.
기본 관리자 화면도 같은 훅 위에 만들어져 있다. 명령은 예상할 수 있는 실패에서 던지지 않고 `EditorResult`(`{ ok: true, value }` 또는 `{ ok: false, error }`)를 돌려주며,
분기는 `EditorError.code`(`conflict`·`session_expired`·`offline`·`validation`·`invalid_state` …)로 한다.

`useSlotActions(request)`는 화면 자리 하나에 붙은 동작과 실행 상태(`idle`·`running`·`error`), `run`·`cancel`을 준다. 실행은 끝나는 즉시 결과를
`request.apply`로 바로 넣는다(`replace` 동작은 글 또는 첫 후보, `append` 동작은 모든 후보). 받을지 말지 고르는 결과는 없고 ⌘Z로 되돌린다.
실행 상태는 자리·대상·컬렉션·범위가 같은 훅끼리 공유하고, 컴포넌트가 사라져도 남는다. `useSlot`(`@monti-cms/admin/slots`)이 그 위에 만든 기본 "채우기" 동작이다.
대상이 비었으면 "채우기", 값이 있으면(`request.filled`) "다시", 도는 동안은 "쓰는 중…"으로 보인다.

`useField(name)`은 폼 필드 하나의 `value`·`setValue`·`assisted`(어시스턴트가 채운 값을 아직 아무도 고치지 않았고 저장도 안 했다. 파란색으로 보인다)·`error`/`errors`·`readOnly`(`readOnlyReason`: `disabled` 또는 `locked`)와,
라벨·입력·오류 문구를 잇는 id(`ids`·`inputProps`), `useSlotActions`에 넘길 `slotRequest`를 준다. `EntryFormProvider` 아래에서만 쓸 수 있다.
편집 화면의 속성 패널과 레코드 패널이 하나씩 제공하고, 폼 상태를 따로 가진 화면은 직접 제공할 수 있다
(`collection`·`form`·`setForm`·`issues`·`disabled`·`entryId`·`locale`·`entry`·`locked`). 컴포넌트는 자기 필드가 바뀔 때만 다시 그려지므로
한 필드에 입력해도 다른 필드는 다시 그려지지 않는다. 기본 필드 화면(`SchemaFields`)도 같은 훅 위에 만들어져 있다.

`useBlockEditor()`는 블록 화면(`blockViews`에 등록한 컴포넌트)에서 쓰는 훅이고, 다른 곳에서 부르면 던진다. 블록의 속성 값 `values`와
`setValue`·`setValues`(되돌리기 한 번), 코드로 쓴 블록(수식·코드 펜스)의 `source`와 `setSource`, `editable`·`selected`·`focusedChild`(커서가 있는 자식),
`select`·`focus({ child, at })`·`remove`·`textAround`(블록 앞뒤 글, AI 맥락용)를 준다. 컨테이너의 자식 `children`은 `addChild`·`removeChild`·`moveChild`·`setChildValue`로 다루며,
`definition.children.min`·`max`를 지키고 범위를 벗어나면 `limit` 코드의 `EditorResult`를, 편집기가 잠겨 있으면 `read_only`를 돌려준다. `transact(tx => ...)`는 현재 문서를 읽는 여러 편집을
문서 변경 한 번(되돌리기 한 번)으로 묶는다. 예를 들어 탭 이름을 바꾸면서 그 탭을 가리키는 기본 탭도 함께 바꿀 때 쓴다. `raw`(`{ editor, node, getPos }`)는 하나뿐인 탈출구이자
Tiptap·ProseMirror 타입이 나오는 유일한 곳이며 안정적이지 않다. `<Content />`는 편집 가능한 중첩 본문을 그리고(`visibleChild`로 열린 탭처럼 자식 하나만 보인다),
`<BlockFrame />`은 선택 테두리와 마우스 올림 범위를 가진 바깥 요소다. 자식 블록은 `[data-monti-block-content]`의 첫 요소 안에 놓인다.

`useEntryEditor(options)`는 화면을 뺀 항목 편집기다. 불러오기, 브라우저 복구본, 명시적 서버 저장, 발행, 상태 변경(보관·휴지통·복원), 복구와 충돌 상태를 맡는다.
**서버 자동 저장이 아니다.** 편집하는 동안에는 브라우저에만 복구본이 남고(IndexedDB, 입력이 멈춘 뒤 기록하며 서버로 보내지 않는다),
서버 초안은 `save()`·`publish()`·상태 변경을 실행할 때만 바뀐다. 서버에 무엇이 있는지는 `saveStatus`(`saved`·`dirty`·`saving`·`local-only`·`conflict` …)가 말해 준다.
상태는 `load`(`loading`·`ready`·`error`, 항목 컬렉션이면 화면이 따라가야 할 `redirect`. 훅은 화면을 옮기지 않는다), `entry`, `form`, `saveStatus`, `saveError`,
`hasUnsavedChanges`, `publishIssues`, `recovery`(열 때 발견한 브라우저 복구본), `conflict`(다른 곳에서 먼저 저장함)다. 명령은 `setForm`, `setBody`(본문, 저장 문서), `save`, `retry`, `publish`,
`changeStatus`, `duplicate`, `deletePermanently`, `restoreRecovery`·`discardRecovery`, 충돌을 푸는 `overwriteWithMine`·`reload`이며,
충돌은 페이지를 새로고침하지 않고 그 자리에서 해결한다. 화면을 `EntryEditorProvider`로 감싸면(`useField`가 읽는 `EntryFormProvider`를 함께 제공한다)
그 아래에서 `useEntryEditorContext()`로 편집기를 읽고, 값 하나만 보고 다시 그리려면 `useEntryEditorContext((editor) => editor.saveStatus)`처럼 쓴다.
서버 호출과 복구본 저장소는 테스트를 위해 `client`·`recoveryStore` 옵션으로 바꿀 수 있다. 기본 항목 편집 화면(`EntryEditorShell`)이 이 훅 위에 만들어져 있고,
토스트·확인 대화상자·화면 이동은 그 화면이 맡는다.

## 데이터 계층과 기억하는 상태

화면은 `fetch`를 직접 부르지 않는다. 자원마다 `src/api/`에 모듈이 하나씩 있고(`entries`, `media`, `folders`, `templates`, `events`, `api-keys`, `schema`, `preferences`), 타입이 붙은 요청 함수와 쿼리 키 팩토리 하나(`entriesKeys`, `mediaKeys` 등)를 내보낸다. 플러그인 화면도 자기 `api.ts`로 같은 모양을 따른다. 쓰기는 `useCmsMutation({ fn, success, failure, invalidate, optimistic })`(`@monti-cms/admin`)로 하며, 토스트와 낙관적 갱신·되돌리기, 무효화를 이 훅이 맡는다. 오류를 글로 바꾸는 곳은 `errorText(site, error, fallback)` 하나이고, `isConflict(error)`는 오래된 값으로 쓴 충돌을 다른 실패와 가른다.

화면이 기억하는 것은 세 곳 중 하나에 둔다.

| 종류 | 위치 | 읽는 법 |
| --- | --- | --- |
| 기기별(패널 너비, 미디어 격자·목록, 본문 너비, 창 열림 여부) | 브라우저 `localStorage`, 사이트별 | `usePreference(name, codec, default)` |
| 사람별(컬렉션의 목록 열, 정렬, 쪽당 개수) | 서버 `/v1/preferences` | `api/preferences` |
| 보기별(쪽, 쪽당 개수, 필터, 검색) | 주소 | `useUrlState({ page: pageParam, ... })` |

## 스타일

관리자 화면의 CSS는 **미리 만들어져(prebuilt)** 나온다. `@monti-cms/admin/styles.css`는 패키지를 빌드할 때 Tailwind 4로 컴파일하므로 앱에는 Tailwind·`@tailwindcss/typography`·
`tw-animate-css` 설정이 필요 없고, `@source`·`@theme`·`@custom-variant` 줄도 필요 없다. 관리자 레이아웃에서 불러오거나(그러면 관리자 페이지만 이 CSS를 받는다) 아무 전역 CSS 파일에서 불러온다.

```tsx
// app/admin/layout.tsx
import "@monti-cms/admin/styles.css";
```

공개 페이지에 Tailwind 4를 쓰는 앱은 그대로 쓰면 된다. 둘은 서로 영향을 주지 않는다.

묶음을 만드는 방식과 가두는 방식(`scripts/build-styles.mjs`, `pnpm build`가 돌린다. 원본은 `styles/`):

- **범위.** 모든 선택자가 `:where(html:has(.monti-admin))`, 곧 관리자 화면이 들어 있는 문서 안으로 한정된다(명시도 0이라 클래스 힘은 Tailwind에서와 같다). 팝업이
  `body`로 옮겨 그려지므로 범위는 `.monti-admin` 요소가 아니라 문서다. `.monti-admin`이 없는 앱의 공개 페이지에는 영향이 없다.
- **리셋.** Tailwind의 preflight가 묶음에 들어 있지만 그 범위 안에서만 걸리므로 앱의 페이지를 다시 꾸미지 않는다.
- **이름.** 묶음이 선언하는 사용자 정의 속성은 모두 `--monti-`로 시작하고(Tailwind의 `--tw-*`는 `--monti-tw-*`가 되고 테마는 값으로 풀어 넣는다), 키프레임은 `monti-*`이며, 파일에는 `@layer`가 남아 있지 않다. 레이어 없는 규칙은 스타일시트가 어떤 순서로 불러와지든 앱의 레이어 규칙을 이기므로, 앱 자신의 `.hidden`·`.prose`·리셋(Tailwind `utilities`·`base` 레이어)이 관리자를 덮어쓰지 못한다. 앱의 `--radius*`와 테마 변수는 정의하지도 바꾸지도 않는다.
- **수식.** 편집기 수식 미리보기용 KaTeX 스타일과 글꼴이 들어 있다(글꼴은 `dist/fonts`로 복사해 상대 경로로 잇는다). 사이트가 관리자용으로 KaTeX CSS를 따로 불러올 필요가 없다.
- **글꼴.** Tailwind preflight처럼 관리자 문서의 `html`에는 시스템 산세리프 글꼴이 기본으로 깔린다. 앱이 `body`에 정한 글꼴이 우선한다.
- **내장 글꼴.** 관리자는 Pretendard(화면 글자, 한글과 영문. 가변 글꼴을 `unicode-range` 조각으로 나눠 두어 화면에 쓰이는 조각만 내려받는다)와 IBM Plex Mono(코드, 필드 키, 슬러그. 라틴, 굵기 400·500·600)를 `dist/fonts`에 담아 `styles.css`에서 상대 경로로 잇고 `font-display: swap`을 쓴다. 외부 서버에는 아무것도 요청하지 않는다. 글꼴 이름은 `Monti Pretendard`, `Monti Plex Mono`로 등록해 사이트가 따로 불러온 같은 글꼴과 겹치지 않는다. 두 글꼴 모두 SIL Open Font License 1.1이며 라이선스 전문은 글꼴 파일 옆(`dist/fonts/pretendard/LICENSE.txt`, `dist/fonts/ibm-plex-mono/LICENSE.txt`)에 있다.

묶음이 주는 것(모두 `monti` 이름표가 붙어 앱의 이름과 겹치지 않는다):

- **디자인 시스템, 그것만.** 속성마다 나뉜 색 역할(`bg-monti-page`, `text-monti-muted`, `border-monti-default` 등), 글자 역할(`text-monti-caption` 등), 간격·모서리·높이·너비 단계,
  그림자 셋, 굵기 네 단계다. Tailwind 자체의 팔레트·글자 크기·굵기·그림자·자간·줄 간격은 묶음에서 뺐으므로, 시스템 밖의 클래스(`text-xs`, `bg-red-500`)는
  아무 CSS도 만들지 않는다. 관리자와 1차 플러그인에 그런 클래스가 있으면 테스트가 그 자리를 짚는다. 앱의 shadcn 이름(`bg-background` 등)과 변수(`--background` 등)는 건드리지 않는다.
  `--monti-*`는 관리자 화면이 있는 문서에만 걸린다.
- **변형.** `monti-dark:`는 `html`(또는 상위 요소)의 `.dark` 또는 `[data-theme="dark"]`일 때, `monti-horizontal:`·`monti-vertical:`은 Base UI의
  `data-orientation`일 때다. 앱의 `dark`·`data-horizontal` 정의와 따로 논다. 앱이 어떤 테마 방식(클래스·`data-theme`)을 쓰든 관리자 화면의
  어두운 테마가 따라간다.
- **그 밖에.** 테두리·포커스 윤곽 기본색, `color-scheme`, 얇은 스크롤바, 포커스 윤곽선 색.

관리자 화면을 더하는 플러그인: 관리자 묶음이 자체 제공 플러그인(`@monti-cms/ai`·`@monti-cms/blocks`·`@monti-cms/mdx`·`@monti-cms/seo`, `styles/index.css`의 `@source` 줄 참고)의 소스도 함께 컴파일한다.
그래서 공유 유틸리티·`prose`·테마·리셋이 **한 파일**에만 정의된다. 이것이 핵심이다. `.prose`를 다시 정의하는 파일이 뒤에 불러와지면 관리자의 다크 변형이 정한 값을 되돌려 버린다.
따라서 `ai`·`mdx`·`seo`는 CSS를 내지 않는다. `@monti-cms/blocks/styles.css`는 유틸리티로 말할 수 없는 것(콜아웃 모양, 글자색 규칙, 기본 변수)만 담으며 관리자 파일 뒤에 불러온다.
서드파티 플러그인은 자기 클래스(`monti-` 접두 이름)만 담은 미리 만든 CSS를 내고 공유 유틸리티나 `prose`는 다시 정의하지 않는다. 같은 선택자가 두 묶음에 정의되면 한계 검사 테스트가 실패한다.
대신 관리자 파일에는 앱이 설치하지 않은 자체 제공 플러그인의 클래스도 들어 있다(몇 KB).

`CmsAdminLayout`(`@monti-cms/nextjs/admin`)은 CMS 인스턴스(`cms`, 앱의 `monti.config.ts`가 내보낸다)를 받고, 선택 속성으로 관리자가 두는 공급자를 끌 수 있다. 사이트가 이미 `next-themes` 공급자를 두었다면 겹치지 않게 끈다.

```tsx
<CmsAdminLayout cms={cms} themeProvider={false} toaster={false}>
	{children}
</CmsAdminLayout>
```

- `themeProvider`(기본 `true`): 관리자 화면이 `next-themes` 공급자(`attribute="class"`)를 두고, 테마를 자기만의 저장 키 `monti-admin-theme`에 보관한다. 그래서 관리자에서
  테마를 바꿔도 사이트의 테마는 바뀌지 않는다. 관리자를 떠날 때는 `html`의 `dark`·`light` 클래스와 `color-scheme`을 관리자가 뜨기 전 상태로 되돌린다
  (사이트 자신의 테마는 건드리지 않고, 같은 루트 레이아웃의 공개 화면이 어둡게 남지도 않는다). 끄면 사이트의 공급자가 `html`에 붙이는
  `.dark`·`[data-theme="dark"]`를 따르며, 관리자의 테마 토글은 사이트의 테마를 바꾼다.
- `themeStorageKey`(기본 `monti-admin-theme`): 관리자 테마를 담는 `localStorage` 키. `themeProvider`를 켰을 때만 쓴다.
- `toaster`(기본 `true`): 관리자 화면이 `@monti-cms/ui`의 `Toaster`를 둔다. 이 `Toaster`는 자기 id가 있고 관리자의 토스트는 그 id로 보내므로, 사이트의 `sonner` `Toaster`와 함께 있어도 서로의 토스트를 보여 주지 않고 같은 토스트가 두 번 뜨지도 않는다. 페이지가 그 `Toaster`를 직접 둘 때만 끈다.

## 관리자 테마

관리자는 디자인 시스템 하나, `@monti-cms/ui`로 만든다(이름은 그 패키지의 `styles/theme.css`, 값은 `styles/tokens.css`이고, 둘 다 `tokens/tokens.json`에서 만든다). 사이트는 그 CSS 사용자 정의 속성을 덮어써서 테마를 바꾼다. 아래 이름이 공개 계약이다.

기본값은 우선순위가 0이다(`:where(...)`). 그래서 사이트의 평범한 `:root { ... }` 규칙이 스타일시트를 어떤 순서로 불러오든 이긴다. 관리자는 `color-scheme`도 정한다(`light`, 그리고 `html`의
`.dark` 또는 `[data-theme="dark"]` 아래에서는 `dark`. 관리자가 어두운 테마를 알아보는 두 방식이다). 그래서 `light-dark()`가 모드마다 알맞은 값을 고르고, 두 모드를 한 줄에 쓸 수 있다.

### 색: 단계, 그다음 역할

이름과 값은 디자인 시스템 자체의 것이다(`packages/ui/tokens/tokens.json`). `pnpm gen:tokens`가 이 파일에서 `styles/tokens.css`와 `styles/theme.css`를 만든다. 색은 두 층이다.

1. **단계**, 원래 값이다. `--monti-gray-1`~`--monti-gray-12`(1 종이색, 페이지 바탕. 2 도구 영역. 3 알약 바탕. 4 선택된 행. 5 구분선. 6 떠 있는 면의 테두리. 7 조용한 선. 9 흐린 글자.
   10 보조 글자. 11 부드러운 글자. 12 잉크), 그리고 색 네 가지를 두 단계씩: `--monti-success-*`, `--monti-warning-*`, `--monti-danger-*`, `--monti-proposal-*`. `3` 옅은 바탕, `11` 글자다.
   강조색은 없다. 제안의 파란색은 AI 제안이 더한 것만 나타내고 다른 곳에는 쓰지 않는다.
2. **역할**, 화면이 쓰는 이름이다. 단계를 가리키는 역할은 한 번만 선언하므로, **단계 하나를 덮어쓰면 그 단계를 쓰는 모든 역할이 두 모드 모두에서 바뀐다**.

| 속성 | 역할(`--monti-…`) | 클래스 |
| --- | --- | --- |
| 바탕 | `bg-page`(목록, 에디터, 대화상자, 메뉴), `bg-tool`(사이드바, 패널, 시트, 상태 표시줄), `bg-muted`, `bg-selected`, `bg-highlight`, `bg-block`, `bg-emphasis`(검은 알약), `bg-{success,warning,danger,proposal}-muted`, `bg-danger-emphasis`, `bg-backdrop` | `bg-monti-page`, `bg-monti-tool`, … 그리고 `bg-monti-divider`(상자로 그린 1px 구분선) |
| 글자 | `fg-default`, `fg-muted`, `fg-subtle`, `fg-faint`(안내 글자와 메타만), `fg-on-emphasis`, `fg-{success,warning,danger,proposal}` | `text-monti-default`, `text-monti-faint`, … (`fill-`, `stroke-`, `caret-`도) |
| 테두리 | `border-muted`(목록 행), `border-default`(구역 선), `border-emphasis`(메뉴, 대화상자), `border-strong`(링크 밑줄), `border-contrast`(잉크 선) | `border-monti-muted`, `ring-monti-contrast`, `divide-monti-muted`, `decoration-monti-strong`. 글자 역할은 테두리, 링, 윤곽선 색으로도 쓴다(`border-monti-danger`) |
| 그림자 | `shadow-floating`(메뉴, 팝오버), `shadow-overlay`(대화상자), `shadow-sheet`(오른쪽에서 나오는 시트). 나머지는 평평하다 | `shadow-monti-floating`, `shadow-monti-overlay`, `shadow-monti-sheet` |

어두운 테마에서 자기 값을 갖는 역할은 `bg-page`와 `bg-tool`(서로 바뀐다. 도구 영역이 더 어둡다), `bg-highlight`, `bg-block`, `bg-backdrop`, `fg-on-emphasis`, 그림자다. 색은 어떤 CSS 색이든 된다.

```css
/* app/globals.css: 사이트의 아무 스타일시트나 된다. @monti-cms/admin/styles.css 앞뒤 어느 쪽이든 괜찮다 */
:root {
	/* 더 푸른 종이색: 페이지 바탕과 그 위의 모든 역할이 따라온다. */
	--monti-gray-1: light-dark(#f8faf4, #121411);
	--monti-gray-2: light-dark(#f0f3ea, #171a15);
}
```

**평범한 값은 두 모드에 다 걸린다.** 기본값은 밝은 테마와 어두운 테마 *둘 다* 우선순위가 0이라서, `:root { --monti-gray-12: #111; }`는 어두운 테마의 기본값도 바꾼다. 위처럼 `light-dark()`로 쓰거나,
`.dark, [data-theme="dark"]` 아래에서 한 번 더 정한다.

### 글자, 간격, 모서리, 글꼴

글자 역할은 크기, 줄 간격, 굵기, 자간, 글꼴을 클래스 하나로 한 번에 정한다. 크기는 px이라 사이트의 루트 글자 크기가 관리자를 키우거나 줄이지 못한다. 사이트가 덮어쓰는 토큰이 아니라 클래스다.

- `display`(36/45, 700): 에디터의 글 제목
- `page`(26/32, 700): 내용 페이지 제목
- `heading`(22/30, 700): 에디터 본문의 제목과 대화상자 제목
- `reading`(17/30, 400): 에디터 본문 글자
- `title`(16/22, 600): 패널, 시트, 설정 구역 제목
- `body`(14/20, 400): 기본 글자, 버튼, 입력 칸, 목록 행 제목
- `label`(13/18, 500): 탭, 필터, 작은 버튼
- `note`(13/20, 400): 행 제목 아래의 보조 줄
- `caption`(12/16, 400): 설명과 시간
- `meta`(12/16, 400, 고정폭): 주소, 식별자, 개수, 파일 크기
- `micro`(11/14, 400, 고정폭): 입력 칸 이름, 메뉴와 패널의 묶음 이름

| 토큰 | 정하는 것 |
| --- | --- |
| `--monti-space-2` … `--monti-space-48` | 간격 단계: 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48px (`gap-monti-12`, `px-monti-16`, `-mt-monti-4`) |
| `--monti-radius-sm`, `-md`, `-lg`, `-xl`, `-full` | 모서리 반경: 3px(표시, 체크박스), 6px(행, 타일), 8px(안쪽 상자), 12px(떠 있는 면), 알약(`rounded-monti-md`) |
| `--monti-height-*`, `--monti-width-*`, `--monti-size-icon-*` | 컨트롤과 바의 높이(`h-monti-control-md` 36, `h-monti-header` 60 …), 열, 패널, 시트의 너비(`w-monti-sidebar` 232, `w-monti-sheet` 520 …), 아이콘 크기(`size-monti-icon-md` 16) |
| `--monti-font-sans`, `--monti-font-mono` | 관리자의 글꼴: sans는 화면 틀(기본값: Pretendard, 그다음 한국어 대체 글꼴이 들어간 시스템 글꼴), mono는 코드, 식별자, 소스 화면(기본값: IBM Plex Mono, 그다음 시스템 고정폭 글꼴) |

**글자를 가운데 맞추는 건 글꼴의 몫이다.** Monti는 함께 싣는 Pretendard에 `ascent-override: 92.4%`, `descent-override: 19%`, `line-gap-override: 0%`를 건다(관리자 빌드가 쓰는 `@font-face`). 그래서 글꼴 크기에 상관없이 한글과 영문이 컨트롤 가운데에서 반 픽셀 안에 놓이고, 어떤 부품도 패딩으로 글자를 밀지 않는다. `--monti-font-sans`의 글꼴을 바꾸면, 부품에 패딩을 주지 말고 글꼴을 선언하는 곳에서 같은 방식으로 `@font-face`의 `ascent-override`, `descent-override`, `line-gap-override`로 맞춘다. `pnpm test:visual:audit`(`@monti-cms/ui`)는 글자가 가운데에서 벗어난 컨트롤을 모두 알려 준다.

확장은 키트의 `Text`, `Heading`(역할과 톤), `Stack`(간격 눈금의 px 단계로 고르는 간격: `gap={8}`)과 위의 클래스로 만든다.

### shadcn 테마 다시 쓰기

shadcn 테마가 있는 사이트는 역할이 그 테마를 가리키게 할 수 있다. shadcn은 `.dark` 아래에서 변수를 바꾸므로, 두 번째 블록 없이도 관리자가 사이트의 어두운 테마를 따른다.

```css
:root {
	--monti-bg-page: var(--background);
	--monti-bg-tool: var(--sidebar);
	--monti-bg-emphasis: var(--primary);
	--monti-fg-on-emphasis: var(--primary-foreground);
	--monti-fg-default: var(--foreground);
	--monti-fg-muted: var(--muted-foreground);
	--monti-bg-muted: var(--muted);
	--monti-bg-selected: var(--accent);
	--monti-border-muted: var(--border);
	--monti-border-default: var(--input);
	--monti-fg-danger: var(--destructive);
	--monti-radius-md: var(--radius);
}
```

shadcn에는 경고색과 성공색이 없으므로 그 둘은 관리자의 기본값을 쓴다. 사이트 변수가 채널 값만 담고 있으면(예전 `--primary: 222 47% 11%` 방식) `hsl(var(--primary))`로 감싼다.

블록은 `--monti-callout-*`와 `--monti-chart-1`~`--monti-chart-5`를 더한다(`@monti-cms/blocks` 참고). 테마를 확인하려면 관리자를 밝은 테마와 어두운 테마로 열어 본다. 설정 항목은 없다. 위 CSS가
인터페이스의 전부다.

## 개발

```bash
pnpm --filter @monti-cms/admin test:run        # 예시 블로그 설정 + 다른 사이트 설정
pnpm --filter @monti-cms/admin test:other-site # 다른 사이트 설정(`../core/test/other-site.config.ts`)만
```

화면 테스트는 블로그와 다른 사이트 설정으로도 돈다(`vitest.othersite.config.ts`, 본체 README "개발"). 컬렉션·필드·블록 이름과
이름표는 테스트에 적지 말고 설정에서 읽는다(예: `src/screens/__test__/any-site-screens.test.tsx`).
