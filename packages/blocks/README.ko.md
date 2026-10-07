# @monti-cms/blocks

[English](README.md) | 한국어

`@monti-cms/core`의 블록 확장. 본문 블록과 글자 꾸밈을 필요한 것만 플러그인으로 설치한다.

| 블록 | 플러그인 | 저장 문법 | 공개 화면 컴포넌트 |
| --- | --- | --- | --- |
| 콜아웃 | `callout()` | `<Callout variant="tip" title="…">…</Callout>` | `Callout` |
| 접기 | `collapsible()` | `<Collapsible title="…">…</Collapsible>` | `Collapsible` |
| 탭 | `tabs()` | `<Tabs>` 안에 `<Tab label="…">` 2~8개 | `Tabs`·`Tab` |
| 단 나누기 | `columns()` | `<Columns widths="60,40">` 안에 `<Column>` 2~4개 | `Columns`·`Column` |
| 코드 탐색기 | `codeExplorer()` | `<CodeExplorer open="src/app/page.tsx">` 안에 ` ```ts title="src/app/page.tsx" ` 코드 펜스 | `CodeExplorer` |
| Mermaid | `mermaid()` | ` ```mermaid ` | `Mermaid` |
| 차트 | `chart()` | ` ```chart ` | `Chart` |
| 툴팁 | `tooltip()` | `<Tooltip content="설명">글자</Tooltip>` | `Tooltip` |
| 코드 연결 | `codeRef()` | `<CodeRef to="c1">글자</CodeRef>`(코드 줄 이름표 `// @line anchor {..} id="c1"`) | `CodeRef` |
| 글자색 | `color({ palette? })` | `<Color fg="#…" fgDark="#…" bg="#…" bgDark="#…">글자</Color>` | `Color` |

표준 MDX(JSX 요소)로 저장한다. 디렉티브 표기(`:::callout{…}`, `:tooltip[글자]{…}`)를 쓰는 사이트는 설정 `plugins`의 `@monti-cms/mdx`가 주는 `mdx({ syntax })`에 `@monti-cms/syntax-directive`의 `directiveSyntax()`를 추가해 읽고 쓴다.

## 설치

```ts
// monti.config.ts
import { callout, chart, codeExplorer, codeRef, collapsible, color, columns, mermaid, tabs, tooltip } from "@monti-cms/blocks";
import { defineConfig } from "@monti-cms/core/server";

export const cms = defineConfig({
	// …
	plugins: [
		// 블록마다 한 줄: 원하는 것만 적고, 한 줄을 지우면 그 블록이 없어진다. 모두 인자 없이 쓸 수 있다.
		callout(),
		collapsible(),
		tabs(),
		columns(),
		codeExplorer(),
		mermaid(),
		chart(),
		// 인라인 꾸밈이 겹칠 때는 이 순서로 저장된다.
		tooltip(),
		codeRef(),
		color(), // color({ palette: [...] })로 색 선택 목록을 정한다
	],
});
```

전부 한 번에 넣는 함수는 없다. 블록마다 플러그인이 따로 있고, 설정의 목록이 곧 사이트가 가진 블록 목록이다. 같은 플러그인을 두 번 넣으면 설정 오류다.

스타일시트는 둘이고 앱에 Tailwind가 필요 없다.

```tsx
// 관리자 레이아웃: 블록 편집 화면용(미리 만든 것, 관리자 안으로 한정된다. 관리자 것과 같은 방식으로 만든다. `@monti-cms/admin` README의 "스타일" 참고)
import "@monti-cms/admin/styles.css";
import "@monti-cms/blocks/styles.css";
```

```css
/* 사이트 전역 CSS: 기본 공개 컴포넌트(`cms-block-*`), 글자색 규칙, 콜아웃·차트 기본 색 */
@import "@monti-cms/blocks/render.css";
```

- 코드 탐색기: 파일 트리와 고른 파일의 코드를 보여 주는 블록으로, 프로젝트의 여러 파일을 보여 주는 글에 쓴다. 일반 코드 펜스를 담고 각 펜스의 `title`이 그 파일의 경로라서,
  트리는 경로로 만들어지고 손으로 그리지 않는다. 제목만 있고 코드가 없는 펜스는 트리에만 보이는 파일이고, `/`로 끝나는 제목은 폴더이며, `open`은 처음 보여 줄 파일이다
  (없으면 첫 파일). 모든 파일은 평범한 코드 블록으로 남아(줄 효과·접기·복사·코드 연결이 그대로 된다) 페이지 HTML에 전부 들어 있고(화면에서만 숨긴다),
  그래서 자바스크립트가 없는 독자·피드·검색 엔진은 제목 붙은 코드 블록이 이어진 것으로 본다. 디렉티브 표기는 `:::code-explorer{open="src/app/page.tsx"}` 안에 펜스를 넣는다.
  편집기: 블록 위쪽에 파일 목록이 보이고(경로를 누르면 그 파일로 커서가 가고, 커서가 있는 파일은 표시된다) 그 아래 코드 블록을 그 자리에서 편집한다
  (경로는 코드 블록 자체의 제목 칸). 블록 도구줄은 파일(`src/new-file.ts`, 있으면 번호를 붙인다)·폴더 추가, 처음 보여 줄 파일 고르기, 블록 삭제를 준다.
  슬래시 메뉴는 `src/index.ts` 코드 블록 하나가 든 블록을 넣는다.
- 검사: 차트 블록은 자체 파서로, Mermaid 블록은 `mermaid.parse`로(`mermaid`가 설치되어 있을 때만, 쓰기 파이프라인에서 서버가 돌린다) 블록의 `validate` 자리로 문법을 검사한다(`@monti-cms/core` README의 "블록"). 틀린 블록은 저장·발행 때 경고이며 막지 않고, 편집기는 그 블록 아래에 보여 준다.
- 편집기: 콜아웃·접기·탭·단·코드 탐색기는 편집 화면이 함께 온다(관리자 테마 색, `styles.css`). Mermaid·차트는 코드 입력 칸과 미리보기로
  편집한다. 미리보기는 이 확장이 그리고(선택 의존성 `mermaid`·`recharts`를 앱이 설치한다. 미리보기를 열 때만 불러온다),
  사이트가 `fencePreviews`(`@monti-cms/admin`)로 같은 이름을 넣으면 그것이 이긴다. 차트 색은 CSS 변수 `--chart-1`~`--chart-5`이고
  앱이 정하지 않으면 `render.css`의 기본값이다(편집기 미리보기도 앱의 `--chart-N`을 같은 기본값과 함께 `--cms-chart-N`으로 쓴다).
- 글자 꾸밈: 툴팁은 서식 도구(링크 뒤)·글자 버블·슬래시 메뉴, 글자색은 서식 도구(글자 꾸밈 뒤)·글자 버블, 코드 연결은 글자 버블
  (문서에 코드 블록이 있을 때)과 커서를 둔 연결의 설명·다시 연결·해제를 준다(`@monti-cms/admin` README의 "글자 꾸밈").
  코드 줄 이름표·코드 블록 줄 메뉴의 "본문 연결"·잇기 안내 줄·마우스를 올린 줄 강조는 본체 코드 블록 기능이고, 이 확장의
  `to` 속성(`codeAnchor`)으로 이 꾸밈을 쓴다. 코드 블록 안 글자 툴팁(`// @char Tooltip`)은 본체 코드 블록 기능이다.
- 공개 화면의 코드 연결: 이름표는 문서에서 하나뿐이고, 연결은 코드 블록 하나(그 이름표가 있는 첫 블록)로만 이어진다. 글자에 마우스를 올리거나 포커스를 두면 연결된 줄이 강조되고,
  그 줄이 화면 밖이면 글자 옆에 작은 미리보기(최대 8줄과 코드 블록 제목)도 뜬다(`role="tooltip"`, 벗어나거나 포커스를 잃거나 Esc면 사라진다). 누르면 그 줄로 스크롤한다.
  이름표를 가리키는 첫 글자가 연결된 첫 줄 끝에 되돌아가기 버튼(`↩`)을 붙이고, 누르면 그 글자로 스크롤해 잠시 강조한다(`data-focused`).
- 글자색 고르기 목록은 `color({ palette })`(없으면 기본 8색 `defaultTextPalette(t)`). 본문에는 헥스 값이 저장되므로 목록을 바꿔도
  이미 쓴 글은 그대로다. 공개 화면은 `@monti-cms/blocks/color`의 `cleanTextColor`·`textColorProps`로 그리고, 색은
  `render.css`의 `.cms-color`가 테마에 맞춰 고른다(편집기는 `styles.css`에 같은 규칙이 있다).
- 공개 화면: 각 확장이 기본 공개 컴포넌트를 준다(플러그인 `render`가 `{ documentComponents }`를 돌려주며, `@monti-cms/core/render`의 `renderDocument`와 `CmsContent`가 자동으로 쓴다).
  탭 전환·툴팁·코드 연결·Mermaid·차트는 브라우저에서 움직이는 부분만 `"use client"` 파일로 나뉜다. Mermaid·차트는 선택 의존성
  `mermaid`·`recharts`를 앱이 설치해야 그려지고(서버·불러오기 전에는 원문), 사이트 언어(`locale`)에 맞춰 콜아웃 기본 제목·접기
  기본 제목·차트 오류 문구가 나온다. 모양은 `render.css`의 `cms-block-*` 클래스(Tailwind 없이)이다. 코드 펜스 블록(`mermaid`·`chart`)은 코드를 `source`로 받는다. 단 너비는 `@monti-cms/blocks/columns`의 `parseColumnWidths`·`columnsGridTemplate`로,
  차트 문법·크기는 `@monti-cms/blocks/chart`의 `parseChartDsl`·`normalizeChartDsl`·`resolvePieGeometry`로 읽는다.
- 각 확장의 render 모듈은 `documentComponents(context)`만 내보낸다(MDX 모양의 기본 내보내기와 MDX 컴포넌트 표는 없어졌다). `renderDocument`가 합치는 표이며(블록 이름별 `blocks`와 평평한 속성 props, `tooltip`·`code-ref`·`color`용 `marks`,
  코드 태그 `Tooltip`), 탭과 코드 탐색기는 자식 요소의 props가 아니라 저장된 노드(`items`)에서 자식을 읽는다.
  사이트는 `renderDocument(doc, { components: { blocks: { callout: … } } })`(`CmsContent`와 `renderMdx`의 같은 `components` 옵션도 된다)로 바꿀 수 있고, props 타입은 사이트 설정의 블록 정의에서 나온다.
- 모양 바꾸기: 앱이 `:root`에 변수(`--cms-callout-note`·`-tip`·`-info`·`-warning`·`-danger`, `--chart-1`~`5`)를 정한다. `render.css`와 `styles.css`의 기본값은 `:where()`로 감싸 있어 앱의 값이 이긴다.
- 이미 쓴 블록의 플러그인을 빼면 그 블록은 저장 문법에서 빠져 다시 저장할 때 일반 글로 바뀐다.

플러그인 없이 정의만 쓰려면(예: 테스트) `@monti-cms/blocks/definitions`의 정의를 설정의 `blocks`에 넣는다.

## AI 기능 (선택)

`@monti-cms/ai`를 쓰는 사이트에는 `mermaid()`·`chart()`가 AI 기능을 저절로 더한다(플러그인 `contributes.ai`). 설정에 적지 않는다.

| 블록 | 기능 이름 | 붙는 곳 |
| --- | --- | --- |
| `mermaid()` | `diagramDraft` · `diagramEdit` | 다이어그램 만들기(슬래시 메뉴) · 고치기(블록 손잡이 옆) |
| `chart()` | `chartDraft` · `chartEdit` | 차트 만들기 · 고치기 |

바꾸거나 끌 때만 같은 이름으로 적는다.

```ts
import { mermaidAi } from "@monti-cms/blocks/mermaid/ai";

aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), chartEdit: false } });
```

블록 확장은 AI 플러그인 코드를 불러오지 않는다(타입만 읽는다). AI 플러그인이 없는 사이트에서는 기여가 쓰이지 않는다.

두 기능은 결과 문법을 코드 검사(`mermaidSyntax`·`chartSyntax`)로 본다. 같은 검사를 다른 기능의 `checks`에 넣어 쓸 수 있다.
개발 전용 가짜 연결(`CMS_AI_FAKE=1`)에는 기능 정의의 `fake`로 문법 검사를 통과하는 답을 준다(만들기는 예시 블록, 고치기는
원래 블록에 한 줄을 더한 것).
차트 지시문에는 차트 문법 설명(`chartSyntaxGuide()`)이 들어간다. 차트 문법은 `@monti-cms/blocks/chart`의
`parseChartDsl`·`normalizeChartDsl`이 읽는다. 문법 오류는 줄 번호와 코드(`code`)·값(`values`)만 주고, 글은 쓰는 쪽이 `chartErrorLine`과
문구 사전(`chartMessages`)으로 만든다(공개 화면은 글 언어, 편집기는 관리자 언어).

## 새 블록 만들기

이 패키지의 블록도 사이트가 만드는 블록과 같은 방법으로 만든다. 블록 정의(`defineBlock`) 하나와, 필요하면 편집 화면이다.

```ts
// 정의: 저장 문법·속성·편집 방식
export const bannerBlock = defineBlock({ name: "banner", syntax: { kind: "container", directive: "banner" }, … });

// 플러그인: 블록과 관리자 화면 쪽(선택)
export const banner = () =>
	definePlugin({ name: "banner", options: {}, blocks: [bannerBlock], admin: () => import("./banner/admin") });

// banner/admin.ts: 편집 화면(useBlockEditor와 Content로 만든 blockViews)을 넣는 공급자
export default defineAdminPlugin({ Provider: BannerProvider });
```

편집 화면이 없으면 관리자 화면의 기본 상자로 편집한다. 메뉴 아이콘(`editor.icon`)이 관리자 패키지의 기본 아이콘에 없으면
공급자에서 `icons`로 등록한다(이 패키지의 블록은 모두 그렇게 한다). 번역할 속성(제목·탭 이름)에는 `translatable: true`를 단다. 자세한 것은 `@monti-cms/core` README의 "본문 블록"과
`@monti-cms/admin` README의 "블록 편집 화면".

## 개발

```bash
pnpm --filter @monti-cms/blocks test:run
pnpm --filter @monti-cms/blocks typecheck
```
