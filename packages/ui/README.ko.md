# @monti-cms/ui

Monti의 디자인 시스템이다. 관리자와 그 확장이 쓰는 토큰과 부품이 들어 있다.

- **토큰.** `tokens/tokens.json`이 디자인 시스템 자체의 토큰 파일이고 유일한 원천이다. 저장소 루트의 `pnpm gen:tokens`가 `styles/tokens.css`(밝은 테마와 어두운 테마의 값, `--monti-*` 변수)와 `styles/theme.css`의 토큰 부분(Tailwind 4용 이름)을 쓴다. 생성된 파일이 스크립트가 쓰는 내용과 다르면 CI에서 도는 `pnpm gen:tokens --check`가 실패하고, 글자 역할이 바탕에서 4.5:1보다 낮거나 역할을 두 번 선언하는 토큰은 스크립트가 쓰지 않는다. 클래스는 모두 `monti-`로 시작하고 그다음에 디자인 시스템의 역할 이름이 온다: 속성마다 나뉜 색(`bg-monti-tool`, `text-monti-faint`, `border-monti-muted`, `ring-monti-contrast`), 간격 단계(`gap-monti-12`, 2~48px), 모서리(`rounded-monti-md`), 높이(`h-monti-control-md`, `h-monti-header`), 너비(`w-monti-sidebar`, `max-w-monti-reading`), 아이콘 크기(`size-monti-icon-md`), 그림자 셋(`shadow-monti-floating`, `-overlay`, `-sheet`), 그리고 스타일마다 하나인 글자 역할이다. 글자 역할은 크기, 줄 간격, 굵기, 자간, 글꼴을 한 번에 정한다(`text-monti-body` … `text-monti-display`). 산세리프 역할이 붙은 같은 요소의 `font-mono`가 항상 이기고, 그 안의 자식에는 미치지 않는다.
- **부품.** 조작(`Button`, `IconButton`, `Input`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Tabs` 등), 안내(`EntryStatus`, `Count`, `Banner`, `Progress`), 떠 있는 창(`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`), 배치(`Text`, `Heading`, `Stack`, `Table`, `PageHeader`, `StatusBar`)다. 부품은 역할이나 톤을 속성으로 받고, 원래 값은 받지 않는다.
- **부품이 쓰는 말.** 몇몇 부품은 직접 말을 쓴다(닫기, 지우기, 페이지 이동). 앱이 `UiLabelsProvider`로 자기 언어를 넘기지 않으면 영어다. 관리자는 자기 사전을 넘긴다.

관리자의 미리 빌드한 스타일시트(`@monti-cms/admin/styles.css`)가 이 패키지를 함께 컴파일하므로, 사이트는 여기서 아무것도 불러오지 않는다. 다른 레포의 확장은 같은 이름으로 자기 CSS를 빌드한다.

```css
/* 확장의 Tailwind 입력 파일 */
@import "@monti-cms/ui/theme.css";
@import "tailwindcss/utilities.css" source(none);
@source "./src";
```

사이트는 `:root`에서 토큰을 덮어써서 모양을 바꾼다(관리자 README의 "관리자 테마" 참고).

## 카탈로그

모든 부품을 모든 변형과 상태로, 밝은 테마와 어두운 테마에서 본다.

```bash
pnpm --filter @monti-cms/ui storybook
```

사이드바는 가장 작은 부품에서 제품 고유의 부품까지 다섯 단으로 나뉜다. **Foundations**(토큰 페이지), **Primitives**(레이아웃 원자, 글, 아이콘, AI 표시: Box, Stack, Grid, Text, Icon, Label, Separator …), **Controls**(사람이 조작하는 것, 묶음별: Button, Field, Choice, Tabs, Menu, Overlay, Status), **Patterns**(컨트롤로 조립한 것: List, Frame, Sheet), **Monti**(CMS에만 있는 것: EditorTools, Change, Proposal, Assistant, Translation). 스토리 제목은 Foundations와 Primitives에서는 `단/이름`, 나머지에서는 `단/묶음/이름`이고, 모든 스토리는 정확히 한 단에 놓인다(`.storybook/preview.tsx`의 `storySort`). 한 단 안과 화면들은, 사이드바도 각 부품의 스토리도 가나다(A→Z) 순이다.

관리자의 화면 상태(불러오기 실패, 빈 목록, 열린 대화상자)는 `packages/admin`에서 같은 카탈로그에 더해지며, 다섯 단 뒤 `Screens` 아래에 놓인다.

스토리는 관리자가 한국어로 보여 주는 모습 그대로 보여 준다. `<html lang="ko">`, 부품이 스스로 쓰는 말(`UiLabels`: 닫기, 취소, 저장 …)은 `.storybook/ko-labels.ts`에서, 예시 글은 한국어로. 도구 모음의 Language로 부품의 영어 기본값으로 바꿀 수 있다.

## 개발

```bash
pnpm gen:tokens   # tokens/tokens.json을 고친 뒤
pnpm gen:tokens --check   # CI가 도는 것: 다른 생성 파일의 이름을 알리고 아무것도 쓰지 않는다
```

`pnpm check:design`(`scripts/check-design.mjs`의 `off-system` 규칙)은 이 패키지, 관리자, 1차 플러그인에 시스템 밖의 클래스가 있으면 실패한다.
