# 17 코드 블록 도구

상태: 만드는 중 (2026-11-14). core, 사이트 그리기, MDX, 비교의 core를 만들었다. 화면은 승인 전이다. 아래 "화면에서 정할 것"을 목업으로 소유자에게 묻는다.

소유자 (2026-11-13): "코드블록은 기존에 잘 만들어뒀다가 지금 제거된거라 이전거를 살펴보면 좋을 듯". 그래서 이 문서는 `main`의 옛 코드 블록(#50 · #51 · #52 · #55)에서 시작한다. 옛 코드가 하던 일과 움직임을 그대로 두고, 지금의 본문 모양(03), 관리자 화면 규칙(`docs/design/admin`), 기능과 플러그인 자리에 맞게 옮긴다. 부분마다 "옛 코드 그대로"인지, 무엇을 왜 바꿨는지 적는다. 아래에서 "만들며 정함"이라고 적지 않은 결정은 없다: 바꾼 것은 모두 만들며 정함 (2026-11-13)이다.

## 한 문장

코드 블록에 언어, 파일 이름, 줄 효과, 글자 효과, 규칙을 주고, 본문 글자가 코드의 줄을 가리키고, 편집기와 사이트가 같은 색과 효과로 그린다.

## 범위

| 번호 | 무엇 | 이 문서의 절 |
|---|---|---|
| T77 | 편집기의 언어 고르기와 문법 색, 줄 효과(강조 · diff +/- · 포커스 · 접기 · 경고), 정규식 규칙, 코드 안 툴팁. 사이트가 도구를 켜고 끄고 테마와 언어를 고른다 | 저장 모양, 사이트 설정, 문법 색, 편집기 |
| T78 | 코드 링크(`codeRef`): 본문 글자가 코드 블록의 줄을 가리키고, 발행 전에 끊긴 링크를 찾고, 코드에서 되짚어 간다 | 코드 링크 |
| T128 | 사이트의 코드 블록: 문법 색(테마)과 복사 버튼 | 사이트 |
| T79 | 가져올 때 Shiki 표기(`// [!code ++]`)를 줄 효과로 읽고, 내보낼 때 다시 쓴다 | MDX |
| T196 | 편집기의 비교와 어시스턴트 검토 화면이 줄 효과만 바뀐 것을 잡고 보인다 | 비교와 검토 |

## 옛 코드에서 무엇이 오나

옛 코드: `packages/core/src/annotation/code-block/*`(모양, 주석 읽고 쓰기, 줄 효과 정의), `packages/core/src/mdx/stored-code-block.ts`(저장 모양), `packages/core/src/render/code/*`와 `packages/core/render.css`(사이트), `packages/admin/src/editor/code-block/*`(편집기), `packages/blocks/src/code-ref/*`(코드 링크), `packages/core/src/core/code-refs.ts`(끊긴 링크 검사), `packages/syntax-shiki`(Shiki 표기 읽기).

| 부분 | 옛 코드 | 지금 | 왜 |
|---|---|---|---|
| 코드 글자 | 저장 본문은 MDX였고, 코드 블록은 `code`와 `annotations`(줄 · 글자 · 규칙)로 따로 저장했다 | 블록의 `content`가 코드 글자다(지금처럼). 글자 효과는 다른 블록처럼 글자의 서식(`marks`)이다 | 본문이 JSON이다(03). 서식으로 두면 편집기, 에이전트의 `replaceText`, 검색 글자가 지금 코드 그대로 돈다 |
| 줄 효과 | `lines: [{ name, start, end, attrs? }]`, 0부터 세고 `end`는 들지 않는다 | 옛 코드 그대로(`attrs.lines`) | |
| 줄 효과 종류 | 강조 · 포커스 · 추가 · 삭제 · 경고 · 오류, 사이트가 더하거나 덮는다 | 옛 코드 그대로 | |
| 사이트가 더한 줄 효과의 편집기 모양 | 정의에 Tailwind 클래스(`bg-…`, 물결 밑줄 색, 줄 번호 칸 표시) | 정의에 `tone`(`neutral` · `success` · `danger` · `warning`)과 `marker` 글자 하나. 파란색(`proposal`)은 어시스턴트의 제안에만 쓴다 | 관리자 화면은 토큰만 쓴다(관리자 README). 사이트 쪽 `class`는 옛 코드 그대로 |
| 줄 접기 | `collapse` 줄 효과, `attrs.open`이면 처음부터 펼침. 편집기에서도 줄 번호 칸의 ›로 접고 편다 | 옛 코드 그대로 | |
| 글자 효과 | 굵게 · 기울임 · 취소선 · 밑줄 · 글자 접기(`fold`) · 툴팁 | 옛 코드 그대로. 저장은 서식: 앞의 넷은 본문의 서식과 같은 이름, 접기와 툴팁은 `codeFold` · `codeTip` | 위 "코드 글자" |
| 정규식 규칙 | `rules: [{ scope, name, pattern, flags, line?, attrs? }]`. 코드 전체 또는 한 줄에서 찾아 글자 효과를 건다. 저장은 규칙, 찾은 자리는 저장하지 않는다 | 옛 코드 그대로(`attrs.rules`) | |
| 규칙 칸의 ✦ 후보 | 규칙 칸이 어시스턴트에게 접을 정규식 후보를 물었다 | 넣지 않는다 | 10번의 어시스턴트 진입점에 없다. 고른 글자로 규칙을 바로 만든다(화면에서 정할 것 6) |
| 언어 | `Select` 26개 + 사이트의 `languages` | 사이트가 고른 언어 목록 하나. 고르는 칸은 검색이 되는 목록 | 항목이 많은 고르기는 검색한다([field.md](../admin/components/field.md)). 사이트가 다 고르게 해서 관리자가 쓰지 않는 문법을 싣지 않는다 |
| 파일 이름, 줄 번호 | 울타리 줄의 meta(`title="…"`, `showLineNumbers`) | `attrs.title`, `attrs.lineNumbers` | 본문이 JSON이다. MDX로는 옛 meta 그대로 쓴다 |
| 편집기의 복사 버튼 | 머리 줄 끝 | 옛 코드 그대로 | |
| 줄 고르기 | 줄 번호를 누르고 끌고 Shift로 늘린다. 머리 줄의 "줄 효과"나 오른쪽 클릭이 메뉴를 연다 | 옛 코드 그대로. 메뉴는 오늘의 `DropdownMenu` · `ContextMenu` | |
| 코드 링크 | `blocks` 패키지의 `:code-ref[글]{to="c1"}`. 줄에 `anchor` 줄 효과(`id`)를 걸고, 라벨이 글 전체에서 하나여야 해서 복제 · 붙여넣기 때 라벨을 다시 지었다 | core의 서식 `codeRef { block, anchor }`. 라벨은 그 블록 안에서만 하나 | 03 원칙 2("코드 참조는 블록 id로 코드를 가리킨다"). 블록 id가 있으니 글 전체의 라벨 정리 코드가 필요 없다. 코드 블록이 core라 링크와 검사도 core다 |
| 끊긴 링크 | 발행을 막는다(`code_ref_broken`), 같은 라벨이 둘이면 경고 | 막는 것은 옛 코드 그대로. 겹치는 라벨 경고는 없어진다(라벨이 블록 안에서만 하나다) | |
| 링크를 만드는 길 | 글자 먼저(서식 바) 또는 줄 먼저(줄 메뉴 "본문 연결"), 그다음 다른 쪽을 고르고 "연결". 서식 도구 아래 안내 줄 | 옛 코드 그대로. 안내 줄은 오늘의 뜬 행 모양 | |
| 사이트의 링크 | 가리키면 그 줄만 또렷하고 나머지가 흐려진다. 누르면 그 줄로 가서(접힌 곳은 펼침) 잠시 강조. 줄이 화면 밖이면 글 옆에 줄 미리보기. 처음 가리킨 글로 돌아가는 단추가 줄 끝에 | 옛 코드 그대로 | |
| 사이트 그리기 | remark/rehype와 Shiki를 비동기로 거치는 사슬 | `renderDocument`(동기)에 사이트가 미리 연 칠하기 도구를 넘긴다 | 지금의 `renderDocument`는 프레임워크도 비동기도 모른다(03) |
| 사이트의 스타일 | `@monti-cms/core/render.css`, Tailwind 4 안에서 읽는다 | 같은 파일 이름, 일반 CSS | 예제 앱과 다른 사이트가 Tailwind 없이 쓴다 |
| 사이트의 움직임(복사, 링크) | `blocks`의 React 클라이언트 부품 | `@monti-cms/next`의 `attachCodeTools(root)`(DOM만 쓴다)와 `<CodeTools />` | `renderDocument`가 그리는 HTML에 붙는다. React가 아닌 사이트도 쓴다. core는 브라우저 타입을 싣지 않아 함수는 `next`에 있다(만들며 정함 2026-11-14) |
| 들여쓰기 선, 포커스 흐림, 터치 화면의 툴팁 목록 | 사이트 CSS | 옛 코드 그대로 | |
| Shiki 표기 | `@monti-cms/syntax-shiki`가 읽기만 했다. 내보낼 때는 언제나 Monti 주석(`// @line plus {0-0}`) | 읽기는 옛 코드 그대로(MDX 플러그인 안으로). 내보낼 때 Shiki에 표기가 있는 효과는 Shiki 표기로, 나머지는 옛 Monti 주석으로 | 14의 MDX 플러그인이 하나뿐인 읽고 쓰는 곳이다. 내보낸 MDX를 Shiki로 그리는 다른 도구가 효과를 그대로 그린다 |
| 문서 버전 올리기, 마이그레이션 | 버전 2와 `0015_code_annotations` | 없다 | 사용자가 없다(build.md 규칙 8) |

## 저장 모양

```ts
// a codeBlock (doc 03's Block)
{
	id: "b_6",
	type: "codeBlock",
	attrs: {
		language?: string;            // a language of the site's list ("ts"). Absent: plain text
		title?: string;               // file name shown above the code ("src/app.ts")
		lineNumbers?: true;           // the site shows line numbers
		meta?: string;                // what an imported fence line held that Monti does not read, written back as it was
		lines?: LineEffect[];
		rules?: CodeRule[];
	},
	content: Inline[];              // the code: text with "\n" between lines; text effects are marks
}

type LineEffect = {
	name: string;                   // "highlight" | "focus" | "plus" | "minus" | "warning" | "error" | "collapse" | "anchor" | a site's own
	start: number;                  // first line, from 0
	end: number;                    // the line after the last
	attrs?: { open?: true; id?: string }; // collapse: open from the start; anchor: the label a code link names
};

type CodeRule = {
	scope: "document" | "line";     // the whole code, or one line
	line?: number;                  // scope "line": which line, from 0
	name: "bold" | "italic" | "strike" | "underline" | "codeFold" | "codeTip";
	pattern: string;                // a regular expression
	flags: string;                  // "g", "gi"
	attrs?: { open?: true; text?: string }; // codeFold: open from the start; codeTip: the tooltip's words
};

// marks inside code (doc 03's Mark, code only)
| { type: "codeFold"; open?: true }  // the words fold into "…" on the site
| { type: "codeTip"; text: string }  // a note shown when the reader points at the words
// body text
| { type: "codeRef"; block: string; anchor: string } // "b_6", "c1"
```

- **옛 이름 그대로.** 줄 효과의 이름(`plus`, `minus`, `collapse`, `anchor`)과 규칙의 모양은 옛 코드 그대로다. 글자 효과의 이름만 본문의 서식 이름(`strong` → `bold`, `em` → `italic`, `del` → `strike`, `u` → `underline`)과 맞춘다: 같은 서식이 본문과 코드에서 이름이 다르면 안 된다.
- **코드 안의 서식은 그 넷과 접기, 툴팁뿐이다.** 링크, 코드, 위 첨자 같은 서식은 코드 안에 들어가지 않는다(편집기의 스키마가 막고, 저장 검사가 거절한다).
- **줄이 바뀌면 효과가 따라간다.** 위에 줄을 넣거나 빼면 아래 효과의 `start` · `end`가 함께 움직인다. 효과 안의 줄을 지우면 효과가 줄어든다. 효과의 줄이 모두 지워지면 효과도 없어진다(`anchor`가 없어지면 그것을 가리키던 링크는 끊긴다). 편집기의 입력과 에이전트의 `replaceText`가 같은 함수(`moveLineEffects`)를 쓴다. `setBlock`으로 블록을 통째로 바꾸면 보낸 값이 그대로 들어간다.
- **효과끼리.** 한 줄에 여러 효과가 걸릴 수 있다. `collapse`는 서로 걸치지 않는다(안에 들거나 떨어져 있다. 옛 코드 그대로). `anchor`의 `id`는 그 블록 안에서 하나다.
- **검사.** 저장할 때 `attrs`의 모양을 본다(줄 범위가 코드 안에 있는지, 정규식이 읽히는지, 걸치는 접기). 사이트가 모르는 줄 효과 이름은 그대로 둔다(끈 블록과 같은 규칙, 03).

## 사이트 설정

`monti.config.ts`의 `codeBlock`. 옛 코드의 `codeBlock` 그대로이고, 언어 목록과 사이트 효과의 편집기 모양이 바뀌었다.

```ts
codeBlock: {
	themes: { light: "github-light", dark: "github-dark" }, // Shiki theme names; the site and the editor use the same pair
	languages: ["ts", "tsx", "bash", "json", "css"],         // Shiki language names; the editor's whole list
	tools: { rules: false, fold: true, tooltip: true, textStyles: true, links: true }, // all on unless false
	omitLineEffects: ["focus"],                              // line effects the editor does not offer
	lineEffects: [
		{ name: "info", label: "정보", icon: "Information", class: "line-info", editor: { tone: "neutral", marker: "i" } },
	],
},
```

- **언어 목록은 사이트의 것 하나다.** 옛 코드는 기본 26개에 사이트 것을 더했다. 지금은 사이트가 적은 것만 편집기 목록에 오르고 문법이 실린다. 적지 않으면 기본 목록(옛 코드의 기본 목록)이다. 목록에 없는 언어를 가진 블록(가져온 글)은 그 이름을 그대로 보이고 "목록에 없는 언어"를 붙이며 일반 글자로 그린다(19의 "선택지에 없는 값"과 같은 방식).
- **`tools`는 편집기에서만 끈다(옛 `features` 그대로, 이름만 `tools`).** 끈 도구는 메뉴와 칸에서 빠진다. 이미 그 도구를 쓴 블록은 그대로 읽고 그리고 저장되고, 블록에 있는 효과는 지울 수 있게 보인다. `links: false`면 서식 카드의 "코드 줄 링크"와 줄 메뉴의 "본문 연결"이 없다.
- **사이트가 더한 줄 효과.** `class`는 사이트가 그 줄에 붙이는 이름이다(옛 코드 그대로). 편집기 모양은 `tone`(줄 바탕의 색: `neutral` · `success` · `danger` · `warning`)과 `marker`(줄 번호 칸의 글자 하나)로만 정한다. `icon`은 관리자 아이콘 이름이다(관리자가 아는 이름이 아니면 기본 아이콘).
- 관리자 화면은 이 값을 `blocks.catalog`로 받는다(직렬화되는 값뿐이다).

## 문법 색

- **칠하는 것은 하나다: Shiki.** `@monti-cms/core/code`의 `codeHighlighter({ themes, languages })`가 Shiki(`shiki/core`, 자바스크립트 정규식 엔진)를 연다. 편집기와 사이트가 같은 함수, 같은 테마, 같은 언어로 칠하므로 편집기의 색이 사이트의 색이다. 옛 코드 그대로(`createCodeHighlighter`)이고, 사이트 쪽이 동기로 부를 수 있게 열기만 비동기다.
- **불러오는 문법은 사이트가 고른 것뿐이다.** 문법과 테마는 Shiki의 언어 하나 · 테마 하나 단위 파일이고, 관리자 화면은 목록의 언어를 그 블록이 처음 그 언어로 그려질 때 불러온다. 고르지 않은 언어의 문법은 관리자 화면에 실리지 않는다. 사이트 서버는 연 도구를 한 번 만들어 둔다(모듈 안에서 한 번).
- **편집기의 색.** 관리자의 밝은 화면에서는 밝은 테마의 글자색, 어두운 화면에서는 어두운 테마의 글자색이다. 코드 상자의 바탕은 관리자 토큰(`bg-muted`)이고 테마의 바탕은 쓰지 않는다: 본문의 다른 상자와 같은 상자다.
- **문법을 불러오는 동안** 코드는 색 없는 글자로 서 있고, 불러오면 색이 입혀진다(자리는 움직이지 않는다). 불러오지 못하면 색 없는 글자로 남고 말은 없다.

## 편집기

기준 화면이 없다. 아래 "화면에서 정할 것"의 목업이 정하고, 승인되면 [editor.md](../admin/screens/editor.md)와 [editor-tools.md](../admin/components/editor-tools.md)에 옮긴다. 움직임은 옛 코드 그대로다.

- **코드 상자.** 본문의 코드 상자(`bg-muted`, `radius-lg`) 안 맨 위에 머리 줄, 그 아래 줄 번호 칸과 코드다. 머리 줄 왼쪽은 언어(`TextButton size="caption"`과 `Caret`, 열린 동안 잉크)와 파일 이름(`Input appearance="inline"`), 오른쪽은 둥근 `IconButton size="xs"` 넷: 줄 효과 · 규칙 · 줄 번호 · 복사. 읽기 전용 편집기에서는 언어와 파일 이름이 글자로만 서고 복사만 남는다(접기는 읽는 길이라 남는다).
- **언어.** 머리 줄의 언어를 누르면 링크 칸([editor.md](../admin/screens/editor.md) "링크 칸")과 같은 검색 목록(`Popover` + `Command`, `width="md"`)이 열린다: 검색 칸 "언어 찾기", 행마다 이름과 끝에 코드(`MenuShortcut`), 지금 언어는 행 끝의 ✓(`MenuTick`). 맞는 것이 없으면 `CommandEmpty` "맞는 언어 없음". 맨 위는 "일반 텍스트"다. 목록에 없는 언어를 가진 블록은 그 이름 옆에 `Text variant="caption" tone="warning"` "목록에 없는 언어"(19의 "선택지에 없는 값"과 같다). 고르면 그 자리에서 다시 칠한다. ` ``` ` 뒤에 친 이름(` ```ts `)도 그 언어가 된다(03의 마크다운 단축).
- 레퍼런스(2026-11-13 조사): Notion, Confluence, GitBook이 모두 검색이 되는 언어 목록이고, 언어를 저절로 알아보지 않는다. Sanity와 Payload는 사이트가 목록을 정한다.
- **파일 이름.** 언어 옆의 칸. 비어 있으면 "파일 이름"이 흐리게 있다. 사이트에서 코드 위에 선다.
- **줄 번호 버튼.** 눌린 `IconButton`(`pressed`)이면 사이트가 줄 번호를 보인다. 편집기는 언제나 줄 번호를 보인다(줄을 고르는 곳이라서). 사이트가 보이면 번호는 `fg-subtle`, 아니면 `fg-faint`다(옛 코드는 흐리게 했다).
- **줄 고르기.** 줄 번호를 누르면 그 줄, 끌면 여러 줄, Shift+누르기는 늘린다. 고른 줄은 글자를 고른 바탕(`bg-selection`)이고, 번호 칸의 + − 표시는 남는다. 글자를 여러 줄에 걸쳐 고른 것도 그 줄들을 고른 것이다.
- **줄 효과 메뉴.** 머리 줄의 "줄 효과"(고른 줄이 있을 때, 또는 커서가 있는 줄)나 줄 번호의 오른쪽 클릭이 연다. 행은 사이트가 내놓는 효과마다 여러 줄의 값을 한꺼번에 바꾸는 체크 행(`DropdownMenuCheckboxItem box`, menu.md: 고른 줄 모두가 가지면 ☑, 일부면 –와 흐린 "1/2", 아무도 없으면 ☐, 아이콘 없음), 구분선, "이 줄들 접기"(접은 범위면 "접기 풀기"와 "처음부터 펼치기", 켜면 끝에 ✓), 구분선, "본문 연결"(링크된 줄이면 "연결된 글로 가기"도)이다. 누르면 고른 줄 모두에 걸리고, ☑였으면 모두에서 빠진다. 메뉴 이름(`DropdownMenuLabel`)은 "3–5번째 줄 효과". 오른쪽 클릭은 같은 행의 `ContextMenu`다. 옛 메뉴는 효과마다 아이콘과 ✓였다: 여러 줄을 함께 바꾸는 메뉴의 규칙을 따른다(만들며 정함 2026-11-14).
- **편집기에서 효과의 모양.** 줄 바탕(강조는 `bg-highlight`, 추가는 `bg-success-muted`, 삭제는 `bg-danger-muted`, 포커스는 바탕 없이 ›), 줄 번호 칸의 표시(`+`, `−`, `›`, 굵기 400), 경고와 오류는 줄 전체의 물결 밑줄(`bg-warning-emphasis`, `fg-danger`). 사이트가 더한 효과의 `tone`도 이 넷이다(`neutral`은 `bg-highlight`). 접힌 범위는 첫 줄 번호 앞의 화살표 `IconButton`이 접고 편다. 접혀 있으면 나머지 줄 대신 `TextButton size="caption"` "접힌 6줄"이 한 줄로 선다(누르면 펴진다). 코드 링크가 가리키는 줄은 가리키는 동안 `bg-block`이다. 링크가 걸린 줄은 줄 번호 칸 왼쪽에 2px 선. 편집기에서는 포커스가 다른 줄을 흐리지 않는다(쓰는 동안 읽혀야 한다. 옛 코드 그대로).
- **글자 효과.** 코드 안에서 글자를 고르면 서식 카드가 뜬다. 코드 안의 서식 카드는 굵게 · 기울임 · 밑줄 · 취소선 | 접기 · 툴팁이고(본문 카드와 같은 차례) 링크 · 각주 · "✦ 요청"은 없다. 툴팁을 누르면 카드 아래 4px에 `Popover`(링크 칸과 같은 자리)가 열리고 칸 하나(placeholder "툴팁 설명")다. 툴팁이 걸린 글자를 고르면 툴팁 단추가 눌려 있고, 누르면 그 칸과 "툴팁 떼기". 커서만 들어가서는 카드가 뜨지 않는다(editor-tools.md 서식 카드. 옛 거품은 커서로 떴다). 접은 글자는 편집기에서 접지 않고 옅은 상자로 표시만 한다(옛 코드는 편집기에서도 … 로 접었다: 접힌 글자는 고칠 수 없고 펴는 단추가 하나 더 생겨서다. 만들며 정함 2026-11-14). 사이트에서는 접힌다.
- **규칙.** 머리 줄의 "규칙"이 카드를 연다. 규칙마다 효과, 찾는 곳(`Select` "코드 전체 · 한 줄", 한 줄이면 줄 번호 `Input`), 지우기(`IconButton tone="danger"`), `/정규식/`(`Affix`)과 플래그, 그 아래 맞는 곳의 수("3곳에 적용", 틀리면 그 자리에 `FormFieldError`), 툴팁이면 설명 칸, 접기면 "처음부터 펼치기"(`Option` + `Switch`). 규칙 사이는 선 없이 여백. 아래에 `Button variant="ghost"` "규칙 추가". 글자를 고른 채 열면 "고른 글자로 규칙 추가"가 그 글자를 찾는 규칙을 만든다(관리자 화면이 쓰는 말 "추가". 옛 코드는 "더하기"). 규칙이 찾은 글자는 편집기에서 그 효과로 보인다.
- **복사.** 코드 전체를 복사한다. 누르면 아이콘이 잠깐 `Checkmark`가 되고 이름(툴팁)이 "복사했습니다"다.

## 코드 링크

- **모양.** 본문 글자에 걸린 서식 `codeRef { block, anchor }`. 편집기에서는 점선 밑줄이다(링크의 실선 밑줄과 다르게, 바탕 없음). 가리키는 동안 그 줄이 `bg-block`으로 밝아진다. 링크가 걸린 글자를 고르면 서식 카드의 "코드 줄 링크"가 눌려 있고, 누르면 링크 칸처럼 `Popover`: "코드 3–5번째 줄"(누르면 그 줄로 간다) · 구분선 · "링크 떼기"(링크 칸과 같은 말).
- **만들기 (옛 코드 그대로).** 본문 글자를 고르고 서식 카드의 "코드 줄 링크"(사이트가 더한 서식이 이것뿐이면 ⋯ 없이 바로 단추, 다른 것도 있으면 ⋯ 안의 행. menu.md: 하나만 남은 메뉴는 ⋯를 없앤다)를 누르면, 서식 카드 자리에 안내 행(`CodeLinkBar`, `FloatingBar`의 새 모양)이 선다: "‘고른 글자’에 연결할 코드 줄을 골라 주세요" · `TextButton` "취소". 고른 글자는 길면 잘린다(`CutWords`). 코드 블록의 줄 번호를 누르거나 끌면 행이 "‘고른 글자’ → 코드 3–5번째 줄"과 `Button variant="primary" size="sm"` "연결"이 된다. 거꾸로 줄 메뉴의 "본문 연결"에서 시작하면 안내 행이 "코드 3–5번째 줄에 연결할 본문 글자를 골라 주세요"다. Esc나 "취소"가 끝낸다.
- **라벨.** "연결"은 고른 줄에 `anchor` 효과를 걸고(그 줄에 이미 있으면 그것을 쓴다) 라벨 `c1`, `c2`…를 준다. 새 라벨은 그 글의 어느 블록도 쓰지 않은 것이다(옛 코드 그대로): MDX로 나간 링크는 라벨만 가지므로 다시 읽을 때 블록을 가린다. 저장 검사는 블록 안에서만 하나인지 본다. 링크를 빼서 아무 링크도 가리키지 않는 라벨은 지운다(옛 코드 그대로).
- **코드에서 되짚어 가기.** 링크가 걸린 줄은 줄 번호 칸 왼쪽에 선이 있다. 그 선이나 줄 번호를 가리키면 툴팁 "본문과 연결된 줄"이 뜨고, 줄 메뉴에 "연결된 글로 가기"가 생겨 그 글자를 고른다(여럿이면 글에 나오는 차례대로 다음 것).
- **끊김.** 링크가 이 글에 그려지는 코드 블록의 라벨을 찾지 못하면 끊긴 것이다: 블록이 지워졌거나, 라벨의 줄이 모두 지워졌거나, 다른 글에서 붙여 넣은 링크다. 번역 글에서는 그 글의 블록 가운데 링크의 블록 id이거나 그 블록에서 온 것(`link.from`)을 찾는다. 끊긴 링크는 편집기에서 빨간 점선 밑줄이고(물결은 코드 안 "오류" 효과의 것이라 쓰지 않는다) 카드가 "가리키던 줄 없음" · "링크 떼기"를 보인다. 발행 전 할 일 "끊긴 코드 링크 n개"(`TodoItem blocking`, 덧말 "본문 · 고른 글자")가 발행을 막는다(옛 코드 그대로. 02의 할 일 표에 더한다). 사이트는 끊긴 링크를 글자로만 그린다.
- **복제와 붙여넣기.** 코드 블록을 복제하면 새 id라서 링크는 원래 블록을 그대로 가리킨다. 다른 글로 옮긴 링크는 끊긴다(검사가 찾는다). 옛 코드의 라벨 다시 짓기는 없다.

## 사이트

```tsx
// lib/monti.ts
import { codeHighlighter } from "@monti-cms/core/code";
export const code = codeHighlighter(config.codeBlock); // a promise, opened once

// a page
renderDocument(post.doc, { createElement, media: post.media, entryPath: post.entryPath, code: await code, locale: post.locale });

// app/(site)/layout.tsx
import { CodeTools } from "@monti-cms/next";
import "@monti-cms/core/render.css";
<CodeTools />
```

- **`renderDocument`가 그리는 코드 블록.** `<figure data-code>` 안에 파일 이름(`<figcaption>`), 복사 버튼(`<button data-code-copy>`, 글자는 글의 언어로 "복사" · "Copy"), `<pre data-language data-line-numbers>`, 줄마다 `<span class="line" data-line="3">`과 그 줄의 효과 이름(`data-effect="plus"`), 사이트 효과의 `class`. 글자 조각은 테마 둘의 색을 CSS 변수로 가진다(`--shiki-light`, `--shiki-dark`). 접기는 `<details>`, 글자 접기는 누르면 펴지는 `…`, 툴팁은 가리키거나 포커스하면 뜨는 설명(터치 화면에서는 코드 아래 번호 목록). `code`를 주지 않은 사이트는 색 없이 같은 모양으로 그린다.
- **`render.css`.** 줄 효과의 바탕과 줄 앞 표시, 어두운 테마(`.dark`, `[data-theme="dark"]`), 포커스 흐림, 링크가 가리키는 줄, 복사 버튼(코드 위에 포인터가 있거나 포커스가 있을 때), 접기, 툴팁, 들여쓰기 선. 옛 `render.css` 그대로이고 Tailwind 없이 읽힌다. 사이트는 이것을 싣거나 베껴 고친다.
- **`<CodeTools />`(`@monti-cms/next`의 `attachCodeTools(document)`).** 복사(누르면 2초 동안 "복사함" · "Copied"), 코드 링크(가리키면 그 줄 강조와 다른 줄 흐림, 누르면 그 줄로 가서 접힌 곳을 펴고 잠시 강조, 줄이 화면 밖이면 글 옆에 줄 미리보기, 줄 끝의 "글로 돌아가기" 단추)를 문서 하나에 한 번 건다. 옛 코드의 움직임 그대로다.
- **예제 앱.** `examples/blog`가 `codeBlock` 설정, `CodeTools`, `render.css`를 쓴다. 흐름 테스트가 예제 앱에서 복사 버튼과 코드 링크를 눌러 본다.

## MDX (T79)

14의 MDX 플러그인이 읽고 쓴다. 옛 `syntax-shiki`의 읽기가 이리로 온다.

| 효과 | 읽기 | 쓰기 |
|---|---|---|
| 추가 · 삭제 · 강조 · 포커스 · 오류 · 경고 | Shiki 표기 `// [!code ++]`, `--`, `highlight`(`hl`), `focus`, `error`, `warning`, 수(`[!code ++:3]`). 옛 Monti 주석도 | Shiki 표기 |
| 낱말 강조 `[!code word:x]` | 그 낱말을 찾는 굵게 규칙(코드 전체) | Monti 주석(`@document bold {re:/x/g}`). 굵게와 Shiki의 낱말 강조는 다른 효과라 Shiki 표기로 되돌리지 않는다(만들며 정함 2026-11-14) |
| 접기, 앵커, 사이트 효과, 글자 효과, 그 밖의 규칙 | 옛 Monti 주석(`// @line collapse {2-6} open`, `// @char …`, `// @document … {re:/…/g}`) | 옛 Monti 주석 그대로 |
| 파일 이름, 줄 번호 | 울타리 줄 meta `title="…"`, `showLineNumbers` | 같다 |
| 코드 링크 | `<CodeRef to="c1">글</CodeRef>`, 옛 지시문 `:code-ref[글]{to="c1"}`. 파일에는 블록 id가 없으므로 그 라벨을 가진 첫 코드 블록으로 간다(옛 규칙). 라벨을 가진 블록이 없으면 끊긴 링크(`block: "-"`)로 남아 발행 검사가 찾는다 | `<CodeRef to="c1">` |

- 주석 글자는 그 언어의 주석 문법으로 쓴다(`#`, `--`, `<!-- -->` 등. 옛 코드 그대로). 표기만 있는 줄은 표기를 빼면 빈 줄이라 줄째 뺀다(Shiki와 같다).
- 가져온 글에서 쓰고 다시 내보내면 효과가 같은 표기로 돌아온다(읽기와 쓰기의 짝). 지금 14가 언어 값에 남기는 울타리 줄의 나머지는 위의 meta만 읽고, 모르는 meta는 그대로 `meta`로 둔다(잃지 않는다).

## 비교와 검토 (T196)

- **비교(`compare-entries.ts`).** 코드 블록은 글자와 함께 언어, 파일 이름, 줄 효과, 규칙을 견준다. 글자는 같고 효과만 다르면 그 블록이 "다른 곳"이다. 비교 화면의 코드(`CompareCode`)가 줄 번호 칸의 표시와 줄 바탕으로 효과를 그리고, 효과가 다른 줄은 번호 앞에 변경 점(`ChangeDot`)을 단다. 요약 줄은 두지 않는다(원칙 8: 표시가 이미 말한다). 화면에서 정할 것 8.
- **레퍼런스(2026-11-13 조사).** Notion의 기록은 블록이나 글자만 견주고, GitBook은 울타리 줄의 meta가 바뀌면 블록이 바뀌었다고만 하고, Sanity는 JSON 값의 바뀜("highlightedLines에 4를 더함")으로 보인다. 효과를 코드 위에 그리는 비교는 찾지 못했다. 그래서 줄 번호 칸의 점으로 바뀐 줄만 짚는다.
- **어시스턴트 검토 화면(10).** 본문의 바뀜을 그릴 때 코드 블록은 같은 `CompareCode`로 그린다. 효과만 바꾸는 제안(`setBlock`)도 행이 되고, "나란히"면 지금 · 제안 두 칸의 `CompareCode`에 같은 변경 점이 선다.
- **에이전트.** `body.read`는 코드 블록의 울타리 줄에 다른 attrs를 붙여 보인다(` ```ts {title="src/app.ts" lines=[…]} `). 코드 글자는 그대로라 `replaceText`의 위치가 맞는다. 효과는 `setBlock`으로 바꾼다. 코드 안의 서식은 본문처럼 보이지 않는다(03).

## 기능 목록

새 기능(`defineOperation`)은 없다. 있는 것이 바뀐다.

| 기능 | 바뀌는 것 |
|---|---|
| `blocks.catalog` | 사이트의 `codeBlock` 설정(테마, 언어, 도구, 효과 목록)을 함께 준다 |
| `entries.save` · `body.edit` · `templates.save` | 코드 블록의 `attrs`와 코드 안 서식을 검사한다. `replaceText`가 줄 효과를 옮긴다 |
| `entries.publish`와 발행 할 일 | "끊긴 코드 링크"가 막는다 |
| `entries.compare` | 효과만 바뀐 코드 블록을 다른 곳으로 센다 |
| `body.read` | 코드 블록의 attrs를 울타리 줄에 보인다 |
| `data.export` · `data.import`(MDX 플러그인) | 위 "MDX" |

## 화면 쪽 조각

- `@monti-cms/ui`의 새 부품: `CodeBlockFrame`(편집기의 코드 상자: 머리 줄, 줄 바탕, "접힌 n줄"), `CodeLineGutter`(접기 단추, 번호, + − › 표시, 링크된 줄의 선), `CodeLinkBar`(안내 행, `FloatingBar`의 새 모양: editor-tools.md에 적는다). 본문의 새 표시: 코드 링크의 점선 밑줄과 끊긴 링크의 빨간 점선 밑줄, 코드 안 툴팁의 점선 밑줄, 접은 글자의 옅은 상자(`EditorBody`가 입힌다). `CompareCode`의 줄 번호 앞 `ChangeDot`. 있는 부품: `TextButton`, `Caret`, `Popover` + `Command`, `Input`, `Affix`, `Select`, `IconButton`, `Button`, `DropdownMenu`(`CheckboxItem box`), `ContextMenu`, `FloatingBar`, `Option` + `Switch`, `Tooltip`, `FormFieldError`, `StatusBarList` + `TodoItem`, `CompareCode`, `ChangeDot`.
- 관리자 편집기: 코드 블록 노드 뷰, Shiki 장식 플러그인, 줄 효과 옮기기, 링크 만들기 상태, 서식 카드의 코드 모드와 "코드 줄 링크".
- `@monti-cms/core/code`: `codeHighlighter`, `moveLineEffects`, 규칙 찾기, 효과 정의. `@monti-cms/core/render`: 코드 블록 그리기, `attachCodeTools`. `@monti-cms/next`: `CodeTools`. `@monti-cms/mdx`: 표기 읽고 쓰기.

## 설계에서 정할 것 (답)

- **줄 효과의 저장 모양.** 옛 코드 그대로 `attrs.lines`의 줄 범위. 글자 효과는 서식, 규칙은 `attrs.rules`(위 "저장 모양").
- **문법 색을 칠하는 곳.** 편집기와 사이트가 같은 `codeHighlighter`(Shiki). 사이트가 `codeBlock`에 테마 한 쌍과 언어 목록을 적고, 관리자 화면은 그 언어만 필요할 때 불러온다(위 "문법 색").
- **언어 고르기와 줄 효과를 주는 법.** 옛 코드 그대로: 머리 줄의 언어 칸, 줄 번호를 눌러 고른 줄의 효과 메뉴. 모양은 아래 목업.
- **코드 링크의 모양과 "끊김".** 점선 밑줄. 그 글에 그려지는 블록의 라벨을 찾지 못하면 끊김이고 발행을 막는다.
- **복사 버튼과 색이 사이트에 닿는 길.** `renderDocument`가 HTML과 CSS 변수를, `render.css`가 모양을, `<CodeTools />`가 누르는 움직임을 준다. 예제 앱이 셋을 다 쓴다.

## 화면에서 정할 것 (화면 승인 전)

목업: `/Users/bh2980/.t3/userdata/attachments/mockups-17/index.html`(차례대로 모두). 승인되면 아래를 "화면 승인 (날짜)"로 바꾸고 화면 지도에 옮긴다.

1. **편집기의 코드 상자(모든 상태).** 머리 줄, 줄 번호 칸, 색, 효과, 접힘, 링크된 줄, 읽기 전용, 목록에 없는 언어, 빈 코드 블록. 옛 머리 줄은 테두리 있는 띠였다. 지금은 본문 코드 상자 안의 한 줄이다.
2. **언어 고르기.** 링크 칸과 같은 검색 목록. 옛 코드는 검색 없는 `Select`였다.
3. **줄 고르기와 줄 효과 메뉴.** 옛 코드 그대로.
4. **코드 안 서식 카드와 툴팁 칸.** 옛 코드는 본문과 같은 거품에 코드용 단추가 섞였다. 지금은 서식 카드가 코드 안에서 단추를 바꾼다.
5. **규칙 카드.** 옛 코드 그대로, 오늘의 칸 모양.
6. **넣는 것과 빼는 것.** 규칙 칸의 ✦ 후보를 뺀다(위 표).
7. **코드 링크: 만들기, 모양, 카드, 끊김, 할 일.**
8. **비교와 검토에서 효과만 바뀐 블록.** 옛 코드에 없던 화면이다.
9. **사이트(예제 앱)의 코드 블록.** 복사 버튼, 테마 색, 효과, 링크를 가리킬 때.
10. **번호 칸의 › 둘.** 포커스는 글자 ›, 접기는 화살표 단추다. 둘 다 오른쪽을 가리킨다. 추천: 이대로(접기는 누르는 단추라 모양이 다르다).
11. **줄 바탕 셋.** 강조 효과 `bg-highlight`, 고른 줄 `bg-selection`, 링크가 가리키는 줄 `bg-block`. 추천: 있는 토큰 셋으로, 새 토큰을 만들지 않는다.

목업은 2026-11-14에 `design-review`가 디자인 문서와 견주어 읽었고, 찾은 것(메뉴 행과 지금 값의 ✓, 여러 줄 체크 행, 서식 카드에 단추만, 둥근 아이콘 버튼, 할 일 목록, 비교와 검토의 화면 지도, 말 다듬기)을 모두 고쳤다.

## 지금은 하지 않는 것

- 코드 블록 안의 링크, 위 첨자, 글자 색: 코드 안의 서식은 위의 여섯뿐이다(옛 코드 그대로).
- 언어 저절로 알아보기: 옛 코드에도 없었다. 사람이 고르거나 ` ```ts `로 친다.

## 끝 조건

- **17-1** 코드 블록이 언어, 파일 이름, 줄 번호, 줄 효과, 규칙, 코드 안 서식을 저장하고 읽는다. 범위 밖 줄, 걸치는 접기, 읽히지 않는 정규식, 코드 안의 다른 서식은 저장이 거절한다.
- **17-2** 줄을 넣고 빼면 줄 효과가 따라간다: 편집기의 입력과 에이전트의 `replaceText`가 같다. 줄이 모두 지워진 효과는 없어진다.
- **17-3** 사이트의 `codeBlock` 설정이 편집기의 언어 목록, 효과 메뉴, 도구를 정한다. 끈 도구로 만든 효과는 그대로 그려지고 지울 수 있다.
- **17-4** 편집기와 사이트가 같은 테마로 같은 색을 칠한다. 관리자 화면은 사이트가 고르지 않은 문법을 불러오지 않는다.
- **17-5** 편집기에서 줄 번호로 줄을 고르고 메뉴로 효과를 걸고 뺀다. 접기를 접고 편다. 키보드로도 된다(머리 줄의 "줄 효과").
- **17-6** 코드 안의 글자에 서식, 접기, 툴팁을 걸고, 규칙이 코드가 바뀌어도 다시 찾는다.
- **17-7** 본문 글자를 코드 줄에 잇고(글자 먼저, 줄 먼저), 빼고, 코드에서 그 글로 돌아간다. 라벨은 블록 안에서 하나이고 아무도 가리키지 않는 라벨은 지워진다.
- **17-8** 끊긴 코드 링크가 발행을 막고, 사이트는 끊긴 링크를 글자로만 그린다. 번역 글의 링크는 그 글의 블록으로 찾는다.
- **17-9** 사이트의 코드 블록이 색, 효과, 파일 이름, 줄 번호, 복사 버튼, 접기, 툴팁, 코드 링크로 그려진다. 예제 앱의 흐름 테스트가 복사와 링크를 눌러 본다.
- **17-10** Shiki 표기와 옛 Monti 주석을 가져올 때 효과로 읽고, 내보낼 때 표기로 쓰고, 다시 읽으면 같은 블록이 된다.
- **17-11** 비교와 어시스턴트 검토가 효과만 바뀐 코드 블록을 다른 곳으로 잡고 그 효과를 보인다(T196).
- **17-12** 화면: 위 "화면에서 정할 것"의 목업대로(화면 승인 뒤).

## 결정 기록

- 2026-11-13, 소유자: 옛 코드 블록에서 시작한다("코드블록은 기존에 잘 만들어뒀다가 지금 제거된거라 이전거를 살펴보면 좋을 듯").
- 2026-11-13, 만들며 정함: 위 "옛 코드에서 무엇이 오나" 표의 "바뀜"들. 코드 링크는 core의 서식이고 블록 id로 가리킨다. 사이트 효과의 편집기 모양은 `tone`으로만. 언어 목록은 사이트가 고른 것 하나. 내보낼 때 Shiki에 있는 효과는 Shiki 표기로.
