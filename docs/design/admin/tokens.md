# 관리자 화면 디자인 토큰

이 페이지는 Monti Admin의 토큰(색, 글자, 간격, 모서리, 높이, 폭, 그림자, 아이콘 크기)과 각각의 역할, 언제 쓰는지를 정리한다.

토큰 값은 `packages/ui/tokens/tokens.json`에 있다. 코드에서는 이 파일 하나가 원본이다. `pnpm gen:tokens`가 이것을 `packages/ui/styles/tokens.css`로 바꾼다. 아래 표는 그 파일의 이름, 값, 쓰임 설명을 옮겨 적은 것이니, 값이 이상해 보이면 파일을 확인한다. CSS에서는 모든 토큰에 `--monti-` 접두어가 붙고(`bg-page`는 `--monti-bg-page`), Tailwind 테마 이름은 `packages/ui/styles/theme.css`에 있다.

## 이름 짓기

토큰 종류마다 이름 짓는 방식이 하나다. 같은 낱말은 어느 종류에서나 같은 뜻이다.

| 종류 | 방식 | 예 |
|---|---|---|
| 바탕 단계 | 숫자 | `gray-1`부터 `gray-12`까지(밝음에서 어두움), `success-3` / `success-11`(옅은 채움 / 글자), `space-2`부터 `space-48`까지(숫자는 px) |
| 작은 순서 집합 | `sm` `md` `lg` `xl` `full`, 이 순서로만 | `radius-sm`부터 `radius-xl`까지, `radius-full`, `height-control-sm` / `-md` |
| 역할 | 속성-역할 | `bg-`, `fg-`, `border-` 뒤에 역할 낱말 |
| 세기 | muted < default < emphasis < strong < contrast | `bg`, `fg`, `border`에서 같은 순서다. 글자에는 muted 아래로 두 단계가 더 있다: `subtle`과 `faint` |
| 자리 | `page`, `tool` | `bg-page`(콘텐츠), `bg-tool`(도구) |
| 상태 | 속성-상태-세기 | `fg-danger`, `bg-danger-emphasis`, `bg-proposal-muted` |
| 고정 크기 | `height-` 또는 `width-` | `height-header`, `width-sheet` |
| 그림자 | 표면의 이름 | `shadow-floating`(메뉴, 카드, 말풍선), `shadow-overlay`(대화상자), `shadow-sheet` |
| 글자 | `text-` 역할 | `text-page`, `text-body`, `text-meta` |

## 색

색에는 두 층이 있다. **스케일**은 날것의 단계다. **역할**은 컴포넌트가 쓰는 것이다. 컴포넌트는 역할을 쓰고, 스케일 단계나 hex 값을 직접 쓰지 않는다.

### 두 바탕

관리자 화면에는 바탕이 둘 있다. 어느 바탕을 쓰느냐가 화면에서 가장 눈에 띄는 색 결정이다.

- **종이, `bg-page`**: 콘텐츠. 목록, 편집기 본문, 설정, 대화상자, 메뉴.
- **크림, `bg-tool`**: 도구. 사이드바, 속성 패널과 어시스턴트 패널, 시트, 원문 창, 상태 표시줄.
- 어두운 모드에서는 도구 바탕이 페이지보다 어둡다(`bg-tool`은 `gray-1`, `bg-page`는 `gray-2`).

### 스케일

날것의 단계가 갖는 밝은 값과 어두운 값이다. 상태 계열(`success`, `warning`, `danger`, `proposal`)은 역할에 필요한 단계만 있다. `-3`은 옅은 채움, `-9`는 표시(점과 고리), `-11`은 글자다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `gray-1` | `#faf9f5` | `#151412` | 종이. 밝은 테마의 페이지 바탕. |
| `gray-2` | `#f3f1ed` | `#1a1917` | 크림. 밝은 테마의 도구 표면(사이드바, 패널, 시트, 상태 표시줄). |
| `gray-3` | `#f0eee9` | `#26241f` | 회색 알약 채움, 인라인 상자. |
| `gray-4` | `#eae7e0` | `#2b2925` | 행 사이 선과 선택된 행. |
| `gray-5` | `#e6e4de` | `#2e2c28` | 구분선. |
| `gray-6` | `#dcd8cf` | `#3a3833` | 떠 있는 표면의 테두리. |
| `gray-7` | `#c8c4b9` | `#5c5850` | 링크 밑줄, 조용한 선. |
| `gray-8` | `#a8a396` | `#6f6a61` | 비활성 표시. |
| `gray-9` | `#8c887f` | `#8a867d` | 흐린 글자: placeholder와 메타 정보에만. 밝은 테마의 종이 위에서 3.4:1이라, 사람이 읽어야 하는 글자에는 절대 쓰지 않는다. |
| `gray-10` | `#75716a` | `#a29e95` | 옅은 글자: 라벨, 캡션, 보조 메타 정보. |
| `gray-11` | `#4a4741` | `#c9c6bd` | 차분한 글자: 보조 본문, 글자 버튼. |
| `gray-12` | `#1c1b18` | `#ecebe6` | 잉크. 본문 글자, 검은 알약, 페이지 제목 아래 선. |
| `success-3` | `#eaf3ee` | `#12241b` | 성공 뒤의 옅은 채움. |
| `success-11` | `#336a4f` | `#86c09c` | 성공 글자와 점(발행됨). |
| `warning-3` | `#f9f2e2` | `#2a2010` | 경고 뒤의 옅은 채움. |
| `warning-9` | `#aa7406` | `#e2b26b` | 경고 점, 고리, 표시. |
| `warning-11` | `#9a6200` | `#d9aa66` | 경고 글자(수정 중, 저장 안 됨, 할 일). |
| `danger-3` | `#f8e8e8` | `#2b1618` | 오류와 되돌릴 수 없는 동작 뒤의 옅은 채움. |
| `danger-11` | `#a8353c` | `#e3918f` | 오류 글자, 삭제 알약, 실패 상태. |
| `proposal-3` | `#e4eaf8` | `#252b3c` | 파란 연필 채움: AI 제안이 더하는 글자. |
| `proposal-11` | `#2f56c8` | `#93adf5` | 파란 연필: 아직 받아들이지 않은 AI 제안의 모든 표시. 다른 데는 쓰지 않는다. |

### 표면

배경이다. 얼마나 어두워 보여야 하는지가 아니라 그 표면이 무엇인지로 고른다.

- `bg-page`와 `bg-tool`은 두 바탕이다.
- `bg-muted`는 회색 알약(보조 동작)과 인라인 상자다.
- `bg-selected`는 선택되거나 열린 항목이다. 호버된 사이드바 행, 포인터 아래의 메뉴 행, 열린 상태 표시줄 칸, 필터 칩, 선택된 목록 행이 그렇다.
- `bg-current`는 포인터 아래 행이 `bg-selected`를 쓰는 목록(사이드바, 설정의 컬렉션 열, 미디어 선택 창의 폴더 열)에서 지금 열린 항목이다. 열린 항목은 한 단계 위를 써서 포인터 아래 행과 헷갈리지 않는다. 눌린 화면 모드 칸도 이것으로 표시한다. 호버가 `bg-muted`인 목록(글 목록)은 고른 행을 `bg-selected`로 표시한다.
- `bg-emphasis`와 `fg-on-emphasis`는 검은 알약이다. 화면이나 떠 있는 표면의 유일한 주 동작이다.
- `bg-highlight`는 요청이 걸린 글자나 찾은 낱말을 표시한다. `bg-block`은 손잡이나 메뉴 아래에 있는 편집기 블록을 표시한다. `bg-backdrop`은 시트나 대화상자 뒤의 페이지를 어둡게 한다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `bg-page` | `gray-1` `#faf9f5` | `gray-2` `#1a1917` | 콘텐츠 바탕: 목록, 편집기 본문, 설정 페이지, 대화상자, 메뉴. |
| `bg-tool` | `gray-2` `#f3f1ed` | `gray-1` `#151412` | 도구 바탕: 사이드바, 속성 패널과 어시스턴트 패널, 시트, 원문 창, 상태 표시줄. 어두운 테마에서는 페이지보다 어둡다. |
| `bg-muted` | `gray-3` `#f0eee9` | `gray-3` `#26241f` | 회색 알약(보조 동작), 인라인 상자, 쉬고 있는 칩. |
| `bg-selected` | `gray-4` `#eae7e0` | `gray-4` `#2b2925` | 선택되거나 열린 항목: 내비게이션 항목, 메뉴 행, 열린 상태 표시줄 칸, 필터 칩. |
| `bg-current` | `gray-6` `#dcd8cf` | `gray-6` `#3a3833` | 호버가 bg-selected인 목록(사이드바, 설정의 컬렉션 열, 미디어 선택 창의 폴더)에서 지금 열린 항목, 그리고 눌린 화면 모드. 호버보다 한 단계 위. |
| `bg-highlight` | `#e8e1cf` | `#3a352a` | 글자 강조: 요청이 걸린 곳, 찾은 낱말. |
| `bg-block` | `#efe9dc` | `#2a2722` | 손잡이나 메뉴 아래에 있는 편집기 블록. |
| `bg-emphasis` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | 검은 알약: 화면이나 떠 있는 표면의 유일한 주 동작. |
| `bg-backdrop` | `rgba(28, 27, 24, 0.18)` | `rgba(10, 9, 8, 0.55)` | 시트나 대화상자 뒤의 페이지를 어둡게 한다. |

### 글자

글자 색이다. 강한 것부터 약한 것 순으로 `fg-default`, `fg-muted`, `fg-subtle`, `fg-faint`다.

- `fg-faint`는 밝은 테마의 종이 위에서 3.4:1이라 4.5:1에 못 미친다. placeholder와 메타 정보에만 쓰고, 사람이 읽어야 하는 글자에는 절대 쓰지 않는다.
- 검은 알약은 `fg-on-emphasis`를 쓴다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `fg-on-emphasis` | `gray-1` `#faf9f5` | `gray-2` `#1a1917` | 검은 알약 위의 글자. |
| `fg-default` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | 본문 글자, 제목. |
| `fg-muted` | `gray-11` `#4a4741` | `gray-11` `#c9c6bd` | 보조 글자, 글자 버튼. |
| `fg-subtle` | `gray-10` `#75716a` | `gray-10` `#a29e95` | 라벨, 캡션, 쉬고 있는 탭 라벨. |
| `fg-faint` | `gray-9` `#8c887f` | `gray-9` `#8a867d` | placeholder, 메타 정보, 비활성. 읽어야 하는 글자에는 쓰지 않는다(밝은 테마에서 4.5:1에 못 미친다). |

### 테두리

세기가 셀수록 선이 짙다. 행은 `border-muted`, 구역과 도구 가장자리는 `border-default`, 떠 있는 표면은 `border-emphasis`, 글자 버튼 밑줄은 `border-strong`을 쓴다. `border-contrast`는 잉크다. 콘텐츠 페이지 제목 아래의 선이다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `border-muted` | `gray-4` `#eae7e0` | `gray-4` `#2b2925` | 목록 행 사이의 선. |
| `border-default` | `gray-5` `#e6e4de` | `gray-5` `#2e2c28` | 구역과 툴바의 선, 도구 패널 가장자리. |
| `border-emphasis` | `gray-6` `#dcd8cf` | `gray-6` `#3a3833` | 메뉴, 대화상자, 시트, 말풍선의 가장자리. |
| `border-strong` | `gray-7` `#c8c4b9` | `gray-7` `#5c5850` | 글자 버튼과 링크의 밑줄. |
| `border-contrast` | `gray-12` `#1c1b18` | `gray-12` `#ecebe6` | 콘텐츠 페이지 제목 아래의 선. 다른 데는 쓰지 않는다. |

### 톤

색은 상태에만 쓴다. 그 밖의 강조는 굵기와 잉크색으로 한다. 상태는 늘 색과 함께 모양이나 낱말을 짝지운다. 색만으로 나타내지 않는다.

- **성공**(`fg-success`): 발행됨, 끝남.
- **경고**: 색이 둘이다. 글자는 `fg-warning`(`#9a6200`, 읽을 만큼 어둡다)이다. 점, 고리, 표시는 `bg-warning-emphasis`(`#aa7406`, 한 단계 밝다)다. 같은 호박색 계열이라 나란히 놓아도 한 색으로 읽힌다. `bg-warning-emphasis`는 표시에만 쓴다. 그 위에 글자를 얹으면 4.5:1이 되지 않는다. 호박색 바탕 위에 글자가 놓이는 곳(켜진 원문 표시)에서는 `fg-warning`을 바탕으로 쓴다.
- **위험**(`fg-danger`): 오류, 삭제, 되돌릴 수 없음. 실패한 것(실패한 전송)은 경고가 아니라 위험이다.
- **제안**(`fg-proposal`, `bg-proposal-muted`): 파란 연필. 아직 받아들이지 않은 AI 제안을 표시하고, 다른 데는 쓰지 않는다.
- 글 상태는 모양과 색을 함께 쓴다. 발행됨은 채운 점, 수정 중은 호박색으로 채운 점, 초안은 빈 고리, 보관됨은 짧은 막대다. 목록의 상태 열에서 "발행됨"은 평범한 경우라 조용한 색(`.mt-status--quiet`, `fg-subtle`)으로 쓴다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `fg-success` | `success-11` `#336a4f` | `success-11` `#86c09c` | 발행됨, 끝남. |
| `fg-warning` | `warning-11` `#9a6200` | `warning-11` `#d9aa66` | 수정 중, 저장 안 됨, 할 일. |
| `fg-danger` | `danger-11` `#a8353c` | `danger-11` `#e3918f` | 오류, 삭제, 되돌릴 수 없음. |
| `bg-success-muted` | `success-3` `#eaf3ee` | `success-3` `#12241b` | 성공 안내나 표시 뒤의 옅은 색. |
| `bg-warning-muted` | `warning-3` `#f9f2e2` | `warning-3` `#2a2010` | 경고 안내나 표시 뒤의 옅은 색. |
| `bg-warning-emphasis` | `warning-9` `#aa7406` | `warning-9` `#e2b26b` | 경고 점, 고리, 표시. |
| `bg-danger-muted` | `danger-3` `#f8e8e8` | `danger-3` `#2b1618` | 오류 안내나 지워진 줄 뒤의 옅은 색. |
| `bg-danger-emphasis` | `danger-11` `#a8353c` | `danger-11` `#e3918f` | 삭제 알약. |
| `fg-proposal` | `proposal-11` `#2f56c8` | `proposal-11` `#93adf5` | 파란 연필 글자와 선. |
| `bg-proposal-muted` | `proposal-3` `#e4eaf8` | `proposal-3` `#252b3c` | 더한 글자 아래의 파란 연필 채움. |

## 글자

글꼴 계열은 둘이다. 글은 Pretendard, 주소, 숫자, 라벨은 IBM Plex Mono다. Pretendard는 `fonts/PretendardVariable.woff2`로 들어 있고, `tokens.css` 맨 위의 `@font-face`가 불러온다. Noto Sans KR은 대체 글꼴이고, Pretendard를 불러올 수 없을 때만 쓴다. 전체 글꼴 목록은 다음과 같다.

- `sans`: `Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif`
- `mono`: `"IBM Plex Mono", ui-monospace, Menlo, monospace`

역할은 그 글자가 무엇인지로 고른다. 크기 단위는 px다.

| 토큰 | 계열 | 크기 / 줄 | 굵기 | 자간 | 쓰임 |
|---|---|---|---|---|---|
| `text-display` | sans | 36 / 45 | 700 | -0.025em | 편집기의 글 제목. |
| `text-page` | sans | 26 / 32 | 700 | -0.02em | 잉크 선 위의 콘텐츠 페이지 제목. |
| `text-heading` | sans | 22 / 30 | 700 | – | 편집기 본문의 제목. 20px인 대화상자 제목도 이 역할을 쓴다. |
| `text-reading` | sans | 17 / 30 | 400 | – | 편집기 본문 글자. |
| `text-title` | sans | 16 / 22 | 600 | – | 패널과 시트 제목, 설정의 구역 제목. |
| `text-body` | sans | 14 / 20 | 400 | – | 기본 UI 글자, 버튼, 입력, 목록 행 제목(잉크색. 다른 칸은 회색). |
| `text-label` | sans | 13 / 18 | 500 | – | 탭, 필터, 작은 버튼. |
| `text-note` | sans | 13 / 20 | 400 | – | 행 제목 아래의 보조 줄, 피할 수 없는 힌트. |
| `text-caption` | sans | 12 / 16 | 400 | – | 캡션, sans로 쓴 시각. |
| `text-meta` | mono | 12 / 16 | 400 | – | 주소, 식별자, 개수, 파일 크기. |
| `text-micro` | mono | 11 / 14 | 400 | – | 필드 라벨, 메뉴와 패널의 묶음 라벨. |

글자 규칙:

- 상자 안에서 글자를 가운데 맞추는 것은 글꼴의 일이다. 높이가 고정된 부품(버튼, 칩, 메뉴 행, 상태 표시줄 칸)은 위아래 여백을 똑같이 둔다. 글자를 올리려고 아래 여백을 1~2px 더 주지 않는다. 글자가 어긋나 보이면 글꼴을 고친다. `@font-face`에 `ascent-override`와 `descent-override`를 준다. 지금 Pretendard에는 둘 다 필요 없다. 한글 글자는 상자 가운데에서 0.75px 안에 놓여야 하고, 실제로 그렇다(측정값: 버튼 0.05px, 칩 0.6px).
- 굵기는 일부러 가볍게 둔다. 굵은 글자는 패널과 구역 제목(600), 선택된 탭(600, 페이지 제목 아래 툴바에서는 700), 페이지 제목에 쓴다. 작은 글자(11px), 라벨, 회색 알약은 400이다. 이것들을 500으로 올렸더니 화면 전체가 무거워 보였다.
- 목록은 표이므로 행 제목은 `text-body`(14 / 400)다. 잉크색이고 첫 열에 있으니 회색 칸보다 먼저 읽힌다.
- 단계 밖의 크기: 대화상자 제목은 20px(`text-heading` 역할)다. 여백의 요청 표시는 10px mono로, `text-micro`보다 작은 유일한 글자다.

## 간격

이 단계만 쓴다. 다른 값은 쓰지 않는다. `space-10`은 목록 행의 위아래 여백에만 쓴다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `space-2` | 2px | 위아래로 쌓인 라벨과 값 사이. |
| `space-4` | 4px | 작은 컨트롤 안의 아이콘과 글자 사이. |
| `space-6` | 6px | 점과 라벨 사이, 칩 안쪽. |
| `space-8` | 8px | 서로 관련된 컨트롤 사이. |
| `space-10` | 10px | 목록 행 여백(위아래). |
| `space-12` | 12px | 행 여백, 필드 사이. |
| `space-16` | 16px | 툴바와 버튼 묶음 안의 간격. |
| `space-20` | 20px | 탭과 필터 사이, 시트 안의 필드 사이. |
| `space-24` | 24px | 패널과 시트의 좌우 여백. |
| `space-32` | 32px | 페이지 안의 구역 사이. |
| `space-40` | 40px | 페이지 위 여백, 설정의 열 사이. |
| `space-48` | 48px | 페이지 좌우 여백. |

## 모서리

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `radius-sm` | 3px | 체크박스, 글자 표시(파란 연필, 강조). |
| `radius-md` | 6px | 메뉴 행, 선택된 내비게이션 항목, 타일, 이미지. |
| `radius-lg` | 8px | 인라인 상자: 요약, 세그먼트 컨트롤, 테스트 결과. |
| `radius-xl` | 12px | 떠 있는 표면: 메뉴, 팝오버, 대화상자, 채팅 속 카드. |
| `radius-full` | 999px | 모든 알약: 버튼, 칩, 말풍선, 스위치, 점. |

버튼과 입력에는 그림자가 없고, 콘텐츠를 묶는 데 카드나 상자를 쓰지 않는다. 묶는 일은 선과 여백이 한다. 상자 테두리는 떠 있는 것(메뉴, 대화상자, 시트, 말풍선)에만 쓴다.

## 높이

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `height-control-md` | 36px | 페이지 헤더와 대화상자 안의 알약과 입력 높이. |
| `height-control-sm` | 28px | 작은 알약, 칩, 카드 안의 버튼. |
| `height-icon-button` | 32px | 둥근 아이콘 버튼(정사각형: 폭 = 높이). |
| `height-header` | 60px | 편집기의 앱 헤더, 도구 패널과 시트의 헤더. |
| `height-toolbar` | 48px | 페이지 제목 아래의 탭과 필터 줄. |
| `height-panebar` | 44px | 창 안의 막대: 원문 창 머리, 속성 탭. |
| `height-statusbar` | 30px | 상태 표시줄. |

## 폭

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `width-sidebar` | 232px | 사이드바 폭. |
| `width-rail` | 48px | 아이콘만 남게 접은 사이드바. |
| `width-menu` | 240px | 폭이 고정된 메뉴와 팝오버. |
| `width-panel` | 300px | 속성 패널. |
| `width-side-panel` | 360px | 레코드, 미디어, 활동 기록의 옆 패널. |
| `width-assistant` | 380px | 어시스턴트 패널. |
| `width-sheet` | 520px | 시트. |
| `width-content` | 880px | 설정과 양식 페이지의 폭이자, 목록 페이지의 최소 폭. |
| `width-list` | 1200px | 넓은 창에서 목록 페이지(글, 미디어, 휴지통, 도구의 표)가 커질 수 있는 최대 폭. |
| `width-reading` | 680px | 편집기 열의 최대 폭. |

## 그림자

그림자는 셋이다. 버튼과 입력에는 없다. 패널의 가장자리는 그림자가 아니라 안쪽 선이다.

| 토큰 | 밝음 | 어두움 | 쓰임 |
|---|---|---|---|
| `shadow-floating` | `0 12px 32px rgba(40, 32, 20, 0.14)` | `0 12px 32px rgba(0, 0, 0, 0.5)` | 메뉴, 팝오버, 선택 카드, 말풍선. |
| `shadow-overlay` | `0 24px 60px rgba(30, 24, 14, 0.18)` | `0 24px 60px rgba(0, 0, 0, 0.6)` | 대화상자. |
| `shadow-sheet` | `-20px 0 50px rgba(30, 24, 14, 0.12)` | `-20px 0 50px rgba(0, 0, 0, 0.5)` | 오른쪽 가장자리에서 나오는 시트. |

## 아이콘 크기

아이콘은 IBM Carbon에서만 가져온다(`@carbon/icons` 11.90.0, Apache-2.0). 다른 아이콘 세트를 더하거나 아이콘을 손으로 그리지 않는다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `size-icon-xs` | 12px | 칩과 개수 안의 아이콘. |
| `size-icon-sm` | 14px | 13px 글자 옆과 작은 버튼 안의 아이콘. |
| `size-icon-md` | 16px | 메뉴, 버튼, 행의 기본 아이콘 크기. |
| `size-icon-lg` | 20px | 빈 상태와 큰 버튼의 아이콘. |

- 아이콘은 16px 격자에 16px로 그린다(메뉴, 버튼, 행, 탭). 파일 타일 미리보기처럼 더 큰 곳만 20px를 쓴다. Carbon에 그 크기용 그림이 있으면 그것을 쓴다. 없으면 32px 원본을 줄인다(Carbon 컴포넌트도 이렇게 한다).
- Carbon이 준 모양을 그대로 둔다. 채운 면, 16px에서 1px 선이다. 선을 바꾸거나 아이콘을 다시 그리지 않는다.
- 색은 `currentColor`라서 아이콘은 주변 글자를 따른다(메뉴 아이콘은 `fg-subtle`, 위험은 `fg-danger`).
- 직접 만든 표시는 AI를 뜻하는 반짝이 ✦(`.mt-spark`, 코드에서는 `Spark`) 하나뿐이다. 블록 손잡이와 행 끌기 점은 아이콘이 아니라 손잡이이고, 지금 모양 그대로 둔다. 작업 중은 아이콘이 아니라 `.mt-spinner`(`Spinner`)로 보여 준다.
- 딱 맞는 아이콘이 없으면 가장 가까운 Carbon 아이콘을 쓴다. 새로 그리지 않는다. 제목 단계는 Carbon `heading`에 작은 mono 숫자를 붙인 것이다(`.mt-ico-level`, "H2", 코드에서는 `HeadingIcon`).
- lucide 이름을 Carbon 이름으로 바꾸는 표는 관리자 화면 코드가 쓰는 표와 같다.

## 정리한 값

목업들은 작은 데서 서로 많이 달랐다. 아래 선택으로 정리했다.

- **가벼운 굵기.** 위의 글자 규칙을 본다.
- 목록 행은 위아래로 10px다. 행 사이 선은 제목 아래 잉크 선과 폭이 같다. 선택된 행의 배경만 양쪽으로 행보다 12px 더 나간다.
- 제목 아래의 탭은 밑줄 없는 굵은 글자다. 밑줄 탭은 창 맨 위와 언어 탭에 쓴다.
- 알약 높이는 34 또는 36이었고 이제 **36**이다(카드 안에서만 28). 편집기 헤더의 34도 36이 됐다.
- 설정 구역 제목은 15px였고 이제 **16**이다(`text-title`). 목록 행 제목은 표의 항목이므로 `text-body`다. 9px와 10px 글자는 **11**이 됐다(`text-micro`). 요청 표시만 10으로 남는다.
- 편집기 본문 글자는 16 / 17에서 **17 / 30**이 됐다. 번역 창 제목은 30에서 **36**이 되어 글 제목과 같아졌다.
- 모서리 2, 3, 5, 7은 **3**(`sm`) 또는 **6**(`md`)이 됐다. 메뉴와 대화상자는 12에서 `xl`이 됐다.
- 간격 7, 14, 18은 가장 가까운 단계(6, 16, 20)가 됐다. 단계 이름은 hair, snug, relaxed 같은 낱말이 아니라 px 숫자(`space-6`)다. 낱말로는 어느 쪽이 더 큰지 알 수 없기 때문이다.
- 세기 낱말은 종류마다 순서가 달랐는데 이제 한 순서다. `bg-neutral`은 `bg-muted`, `border-floating`은 `border-emphasis`, `border-underline`은 `border-strong`, `border-ink`는 `border-contrast`가 됐다.
- 크기 이름은 축을 앞에 둔다. `size-header`는 `height-header`, `size-sheet`는 `width-sheet`가 됐다.
- 행 사이 선(`#ebe9e3`)과 선택 배경(`#eae7e0`)은 토큰 하나, **gray-4**가 됐다.
- 그림자 여섯 개가 **셋**(floating, overlay, sheet)이 됐다. 버튼 그림자(`shadow-btn`, `shadow-control`, `shadow-card`)는 없앴다.

## 코드

- 컴포넌트는 날것의 값을 받지 않는다. Tailwind 테마(`bg-monti-page`, `text-monti-subtle`, `gap-monti-8`)로 토큰을 읽고, 그 이름은 `packages/ui/styles/theme.css`가 정한다.
- `packages/ui/src`의 `tokens.generated.ts`는 같은 파일로 만든 `Background`와 `Spacing` 타입을 내보낸다.
- 글자 역할마다 CSS 변수 네 개도 생긴다. `--monti-text-<role>-size`, `-line`, `-weight`, `-tracking`이고, 여기에 `--monti-font-sans`와 `--monti-font-mono`가 더해진다.
- 사이트는 `:root`, `.dark`, `[data-theme="dark"]`에서 어떤 `--monti-*` 변수든 덮어쓸 수 있다. 기본값은 명시도가 0이라, 스타일시트 순서와 상관없이 사이트의 덮어쓰기가 이긴다.
- 어두운 모드는 감싸는 요소에 붙는 `dark` 클래스(또는 `data-theme="dark"`)다. 그 안에서는 모든 역할 색과 그림자가 바뀐다.
- Storybook은 모든 묶음을 Foundations 페이지에서 보여 준다: `packages/ui/src/foundations/`.

## 어긋나는 곳

`packages/ui/tokens/tokens.json`(코드)과 디자인 시스템의 `tokens.json`(Monti Admin DS) 사이, 그리고 토큰과 DS README 사이에서 찾은 차이다. 여기서는 하나도 해결하지 않는다.

**두 `tokens.json` 파일.** 모든 토큰 이름, 밝은 값과 어두운 값, 글자 스타일, 간격, 모서리, 그림자, 높이, 폭, 크기, 두 글꼴 목록이 똑같다. 두 파일은 다음 곳에서만 다르다.

- `warning-9` 쓰임. 코드: "Warning dots, rings and markers." DS: "Warning dots, rings and markers: a step brighter than the text so it reads as a warning (3:1 on the page)."
- `bg-warning-emphasis` 쓰임. 코드: "Warning dots, rings and markers." DS: "Warning dots, rings and markers (editing, unsaved change, to-do ring)."
- `width-rail` 쓰임. 코드: "Sidebar folded to its icons." DS: "Folded sidebar: icons only."
- 항목 순서. `warning-9`와 `bg-warning-emphasis`가 목록에서 다른 자리에 있다. 값은 같다.

**코드에만 있는 것.** `theme.css`에는 `monti-divider`(`--background-color-monti-divider`, `--stroke-monti-divider`)가 있다. `border-muted`의 별칭인데 어느 `tokens.json`에도 없다. 메뉴 구분선이 이것을 쓴다.

**토큰과 DS README.**

- README의 토큰 표에는 `bg-highlight`, `bg-block`, `bg-backdrop`, `bg-success-muted`, `bg-warning-muted`, `bg-danger-muted`, `width-rail`, `width-menu`, `width-list`, `size-icon-*` 토큰이 없다. 두 `tokens.json` 파일에는 모두 있다.
- README에서 시스템이 `@monti-cms/ui`와 이어지는 방식을 다룬 부분은 아직 `bg-tool`(`bg-inset`을 대신함), `bg-neutral`(`bg-muted`로 이름 바뀜), `spacing-*` 이름을 앞으로 할 변경으로 적고 있다. 코드는 이미 새 이름을 쓴다.
- `border-contrast` 쓰임은 "The rule under a content page title. Nowhere else."라고 한다. 그런데 Field README는 포커스된 밑줄을 `border-contrast`로 그리고, Tabs README는 선택된 탭의 밑줄을 잉크색으로 그린다(코드는 둘 다 `border-monti-contrast`를 쓴다).
- `bg-muted` 쓰임은 "chips at rest"라고 하고 `bg-selected` 쓰임은 "filter chip"이라고 한다. DS 스타일시트는 `.mt-chip`을 `bg-selected` 위에 그린다.
- README는 선택된 탭이 700이라고 한다. Tabs README와 스타일시트는 600으로 두고, 페이지 제목 아래 툴바에서만 700으로 둔다.
- README는 작은 글자, 라벨, 회색 알약이 굵기 400으로 돌아갔다고 한다. 그런데 두 `tokens.json` 파일 모두 `text-label`이 500이고, 스타일시트는 `.mt-btn`과 `.mt-chip`을 600으로 그린다.
