# Monti 관리자 화면 디자인

이 폴더에는 Monti 관리자 화면 디자인 시스템의 규칙이 있다. 사람과 에이전트가 디자인 아티팩트를 열지 않고도 규칙을 읽고 링크할 수 있게 하려는 것이다.

디자인 시스템은 관리자 화면들을 다룬다. 어떻게 보이는지, 어떤 부품으로 만드는지, 그 부품을 어떤 규칙으로 쓰는지다. 편집 목업(디자인 캔버스 "A · 가운데 단")에서 모은 것을 `@monti-cms/ui`의 구조에 맞게 정리했다. 색은 두 층(바탕 단계와 역할)으로, 글자는 역할별로, 간격은 이름 붙은 단계로 나눈다. `@monti-cms/ui`의 토큰과 부품은 이 문서를 따른다.

## 원칙

1. **종이와 크림, 두 층.** 내용(목록, 편집기 본문, 설정, 대화상자, 메뉴)은 종이 바탕 `bg-page` 위에 있다. 도구(사이드바, 속성 패널과 어시스턴트 패널, 시트, 원문 패널, 상태 표시줄)는 크림 바탕 `bg-tool` 위에 있다. 어두운 테마에서는 도구 쪽이 더 어둡다.
2. **잉크 선은 한 곳에만 있다.** 내용 페이지 제목 아래에 1px `border-contrast`가 있다. 도구 면의 머리는 `height-header`(60px)이고, 얇은 `border-default` 선이 하나 있다.
3. **카드와 상자 대신 선과 여백.** 상자 테두리는 떠 있는 것에만 쓴다. 메뉴, 대화상자, 시트, 말풍선이다.
4. **화면이나 떠 있는 면마다 검은 알약은 하나.** 곁 동작은 회색 알약 한두 개, 섹션 안에서 추가하고 고치는 것은 텍스트 버튼이고, 나머지는 ⋯ 안에 둔다.
5. **색은 상태에만 쓴다.** 그 밖의 강조는 굵기와 잉크 색으로 한다. 파란 연필 `fg-proposal`은 아직 받아들이지 않은 AI 제안에만 쓴다.
6. **설명 대신 구조.** 헷갈리는 곳이 있으면 이름, 자리, 상태로 고친다. 필드 아래 도움말, "~했어요" 같은 안심시키는 문장, 면책 문구는 두지 않는다.

## 이 문서를 읽는 법

이 순서로 읽는다.

1. 이 페이지.
2. [tokens.md](tokens.md): 색, 글자, 간격, 모서리, 높이, 너비, 그림자, 아이콘 크기와 각각을 언제 쓰는지.
3. 컴포넌트 페이지들. 작은 것부터 큰 것 순이다. 각 페이지는 앞 페이지들의 부품만 쓴다.
4. [screens.md](screens.md): 캔버스의 주요 보드 하나하나와 그 상태.
5. [flows/README.md](flows/README.md): 부품을 함께 쓰는 흐름을 단계별로 적었다. 캔버스 흐름마다 그 흐름을 따라가는 테스트가 하나 있다.

컴포넌트 페이지는 다섯 층으로 묶여 있고, 순서는 `@monti-cms/ui`의 Storybook과 같다.

| 층 | 무엇 | 페이지 |
|---|---|---|
| 1 Foundations | 색, 글자, 간격, 모서리, 크기, 그림자 | [tokens.md](tokens.md) |
| 2 Primitives | 레이아웃 조각(Box, Stack, Grid), 텍스트, 아이콘과 AI 표시 ✦, 라벨, 구분선, 이미지, 코드 블록, 패널, 섹션 | [primitives](components/primitives.md)(Box, Stack, Inline, Text, Heading, Icon, Label, Separator, 라벨 제공자, 크기 조절 열). 아이콘과 글자 규칙은 [tokens.md](tokens.md)에 있다. `.mt-stack`, `.mt-line`, `.mt-label`, `.mt-vr`, `.mt-spark`, `.mt-panel`, `.mt-section`은 DS 스타일시트 맨 위에 있다 |
| 3 Controls | 누르고, 입력하고, 고르는 것과 상태를 알려 주는 것 | [button](components/button.md), [field](components/field.md), [choice](components/choice.md), [tabs](components/tabs.md), [menu](components/menu.md), [overlay](components/overlay.md)(모달, 팝오버, 토스트), [status](components/status.md) |
| 4 Patterns | 화면의 틀과 목록 | [list](components/list.md), [page-header](components/page-header.md), [sidebar](components/sidebar.md), [status-bar](components/status-bar.md), 그리고 [overlay](components/overlay.md)의 시트와 사이드 패널 |
| 5 Monti | Monti에만 있는 부품 | [editor-tools](components/editor-tools.md), [change](components/change.md), [proposal](components/proposal.md), [assistant](components/assistant.md), [translation](components/translation.md) |

- DS에는 Cover (Frame) 묶음도 있다. 규칙 글은 없고, 틀 조각은 page-header, sidebar, status-bar 페이지에서 설명한다.
- 한 폴더가 두 층에 걸칠 수 있다(Overlay). 위 표에서는 나눠 적었다.
- DS 아티팩트의 미리보기 카드 묶음도 같은 층 이름을 쓴다.

컴포넌트 페이지는 한 가지 틀을 따른다. 부품마다 규칙이 먼저 나오고, 이어서 "코드" 절이 `@monti-cms/ui` 컴포넌트 이름을 대거나 아직 코드에 없다고 말한다. DS 클래스 이름(`.mt-…`)은 DS 아티팩트의 스타일시트에 대응할 때만 적는다.

부품은 묶음에 속한다. 한 묶음의 부품은 규칙(높이, 선, 색)을 함께 쓴다.

| 묶음 | 페이지 | 들어 있는 것 |
|---|---|---|
| 누르기 | Button | 알약(primary, secondary, danger, sm), 텍스트 버튼, 아이콘 버튼, 나뉜 알약 |
| 입력 | Field | 한 줄, 여러 줄, 선택 |
| | Choice | 체크박스와 라디오, 스위치, 몇 개 중 하나 |
| | Tabs | 밑줄 탭, 필터 칩 |
| 알림 | Status | 글 상태, 개수, 진행 막대, 알림 띠 |
| 면 | Menu | 떠 있는 메뉴 카드 |
| | Overlay | 모달, 시트, 사이드 패널, 이름과 값 |
| 페이지 | PageHeader | 제목 줄, 툴바(일괄 작업 줄) |
| | List | 목록 행, 격자 칸, 빈 상태 |
| | Sidebar, StatusBar | 내비게이션, 편집기 아래 막대 |
| 편집기 | EditorTools | 블록 손잡이, 서식 카드 |
| AI | Proposal | 파란 연필, 말풍선, 요청 표시와 카드 |
| | Assistant | 대화, 제안 카드, 입력 상자 |
| 스키마 | Change | 스키마 변경 검토 |
| 번역 | Translation | 흐려진 블록, 원문 바뀜, 나란히 보기 |

## 시각 자료가 있는 곳

이 문서에는 규칙이 있다. 어떻게 보이는지는 아래를 본다.

- **캔버스**: https://claude.ai/artifact/BUBfqadfYBA1JZW9dT13co. 화면마다 보드가 있고, 흐름마다 페이지가 있다. 각 화면과 흐름이 어떻게 보이는지 담고 있다.
- **DS 아티팩트**: https://claude.ai/artifact/KoiQ42HjDgktbfSY7mx5ma. 디자인 시스템의 시각 카탈로그로, 모든 부품의 미리보기가 있다. 미리보기는 DS 스타일시트로 그린 정적 렌더이고, 실제 React 부품이 아니다.
- **Storybook**: `@monti-cms/ui`의 실제 부품과 관리자 화면들. `pnpm --filter @monti-cms/ui storybook`으로 띄운다(포트 6006). 사이드바에는 위의 다섯 층이 있다. `packages/ui/README.md`가 티어, 시각 테스트, 감사를 설명한다.

## 무엇이 기준인가

| 무엇 | 어디 |
|---|---|
| 규칙: 부품을 언제 쓰는지, 어떻게 동작하는지, 어떤 상태가 있는지 | 이 문서 |
| 토큰 값(이름, 밝은 테마와 어두운 테마) | `packages/ui/tokens/tokens.json`. `pnpm gen:tokens`가 이 파일에서 `packages/ui/styles/tokens.css`를 만든다. CSS는 손으로 고치지 않는다 |
| 각 화면과 흐름이 어떻게 보이는지 | 캔버스 |
| 부품을 어떻게 만드는지 | `packages/ui/src`와 그 스토리. 부품은 토큰 유틸리티로 스스로 스타일을 입힌다. `packages/admin/styles/admin.css`에는 문서 전체의 기본 규칙(포털로 띄운 팝업, 기본 테두리 색, 스크롤바)만 있다 |

규칙이 바뀌면 코드와 같은 풀 리퀘스트에서 이 문서를 고치고, 그다음 아티팩트(캔버스와 DS 아티팩트)를 맞춘다.

이 문서의 한국어 UI 텍스트는 따옴표 안에 그대로 옮긴다. 보드 이름과 상태 이름은 따옴표 안에 한국어로 둔다. 캔버스가 그렇게 부르기 때문이다.

## 관리자 화면 UI 만들기

이 규칙들은 관리자 화면을 하나의 시스템으로 묶어 둔다. `pnpm check:design`(`scripts/check-design.mjs`)은 기계적으로 잡을 수 있는 규칙을 어기면 CI를 실패시킨다. 스타일시트와 `admin.css` 선택자, 어디에 있든 날 색 값, 화면 안의 날 길이 값과 인라인 스타일, 화면에서 가져온 프리미티브, 이 문서에 없는 부품, 그리는 파일(`DRAWING`) 밖의 `className`·`style`·`cn`, 사이트 앱의 색 이름과 `dark:`, 테마와 토큰 파일의 이름, 시스템 밖의 클래스(모르는 역할, 간격 눈금 밖, 줄 높이, 글자 간격)다. 나머지는 `design-review` 에이전트가 잡는다. `@monti-cms/ui` 안의 부품은 자기가 잰 길이(`h-[34px]`)를 써도 된다. 디자인 시스템의 크기가 있는 곳이 거기이기 때문이다. 화면은 안 된다.

1. **토큰 유틸리티로만 스타일을 입힌다.** 색, 글자, 간격, 모서리, 크기, 그림자는 `monti-*` 토큰 유틸리티(`bg-monti-muted`, `text-monti-body`, `gap-monti-8` …)에서 가져온다. 날 팔레트 클래스(`bg-gray-100`, `text-sm`)와 날 색 값(`#fff`)은 어디에도 쓰지 않는다. 화면은 임의 길이(`w-[320px]`)도 쓰지 않는다. 크기는 `@monti-cms/ui`의 부품이나 토큰에 속한다. 여럿이 함께 쓰는 크기에 토큰이 없으면 먼저 `packages/ui/tokens/tokens.json`과 [tokens.md](tokens.md)에 더한다.
2. **새 스타일시트도, 새 CSS 클래스도 만들지 않는다.** `packages/admin/styles/admin.css`에는 문서 전체의 기본 규칙만 있다. 포털로 띄운 팝업을 위해 body에 둔 기본 글자, 기본 테두리 색, 스크롤바다. 나머지는 모두 요소에 붙인 유틸리티다. 상태는 `data-` 속성과 `data-[…]:` 변형으로 나타낸다.
3. **화면에는 인라인 스타일을 쓰지 않는다.** `packages/admin/src`의 `style={{}}`는 실행 중에 재거나 계산한 값에만 쓰고, `// design-allow: <reason>`을 붙인다.
4. **부품은 `@monti-cms/ui`에 있다.** `packages/admin`의 화면은 부품을 조합한다. Radix, Base UI, `cva`를 가져오지 않고, 버튼, 메뉴, 행, 패널을 직접 만들지 않는다.
5. **모든 부품은 문서에 있다.** `@monti-cms/ui`에서 내보내는 컴포넌트는 `components/`의 해당 묶음 페이지에 이름이 나오고, 규칙과 "코드" 줄이 있다. 새 부품은 같은 풀 리퀘스트에서 페이지 항목을 얻는다.
6. **부품 먼저, 그다음 화면.** 작업을 여러 조각으로 나눌 때는 한 조각이 새 공유 부품이나 바뀐 공유 부품을 `@monti-cms/ui`에 (스토리와 문서까지) 먼저 만들고, 그 뒤에 화면 조각들이 시작한다. 화면 조각은 그 부품을 쓰고 새 부품을 더하지 않는다. 빠진 부품을 찾은 조각은 멈추고 그 부품을 요청한다.
7. **보드에 먼저 맞추고, 그다음 문서에 맞춘다.** 보드의 값이 이 문서나 이미 있는 부품과 다르면, 혼자 정할 일이 아니라 소유자에게 물을 일이다. 풀 리퀘스트에 적어 둔다.
8. **병합 전 관문 셋.** 각 조각은 다음을 모두 거친 뒤에만 공유 브랜치에 들어간다. `pnpm check:design` 통과, `design-review` 에이전트(`.claude/agents/design-review.md`)의 diff 검토, 그리고 바뀐 상태 하나하나를 1440×900에서 보드와 나란히 비교해 다른 점을 모두 고치거나 소유자에게 물을 질문으로 적어 두기. 조각이 스스로 낸 보고는 주장일 뿐 증거가 아니다.

`// design-allow: <reason>`(JSX에서는 `{/* design-allow: <reason> */}`)은 `check:design`에서 한 줄을 건너뛴다. 실행 중에 재는 값을 위한 것이지, 스타일 선택을 위한 것이 아니다.

## DS 아티팩트 쓰기

- 네임스페이스: `MontiAdmin`. 디자인 캔버스에서는 `ds/montiadmin/`에 복사되어 있다.
- `tokens.css`를 먼저 불러오고, 그다음 `components/bundle.css`를 불러온다. 두 번째 파일이 첫 번째 파일의 변수를 읽는다.
- `tokens.css`는 `tokens.json`에서 만들어진다. 손으로 고치지 않는다. 같은 폴더의 `fonts/`를 읽으므로 함께 옮긴다.
- 어두운 테마: 감싸는 요소에 `dark` 클래스(또는 `data-theme="dark"`)를 붙인다. 그 안의 역할 색과 그림자가 모두 바뀐다.
- 부품은 `.mt` 안에서 쓴다(글꼴, 기본 크기, 버튼 상속).

## 알려진 빈틈

- DS 아티팩트의 컴포넌트 미리보기는 `components/bundle.css`로 그린 정적 렌더이고, `@monti-cms/ui`의 실제 React 부품을 묶은 것이 아니다.
- IBM Plex Mono 파일은 들어 있지 않다. 목업은 Google Fonts에서 불러온다(Pretendard는 `fonts/`에 있다).
- 로고가 없다. 사이트 이름은 글자로 쓴다.
- Primitives에는 DS에 이미지 부품과 코드 블록이 없다(`@monti-cms/ui`에는 `Image`와 `CodeBlock`이 있다).
