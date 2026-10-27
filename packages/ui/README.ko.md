# @monti-cms/ui

Monti의 디자인 시스템이다. 관리자와 그 확장이 쓰는 토큰과 부품이 들어 있다.

- **토큰.** `tokens/tokens.json`이 디자인 시스템 자체의 토큰 파일이고 유일한 원천이다. 저장소 루트의 `pnpm gen:tokens`가 `styles/tokens.css`(밝은 테마와 어두운 테마의 값, `--monti-*` 변수)와 `styles/theme.css`의 토큰 부분(Tailwind 4용 이름)을 쓴다. 둘 중 하나라도 스크립트가 쓰는 내용과 다르면 테스트가 실패한다. 클래스는 모두 `monti-`로 시작하고 그다음에 디자인 시스템의 역할 이름이 온다: 속성마다 나뉜 색(`bg-monti-tool`, `text-monti-faint`, `border-monti-muted`, `ring-monti-contrast`), 간격 단계(`gap-monti-12`, 2~48px), 모서리(`rounded-monti-md`), 높이(`h-monti-control-md`, `h-monti-header`), 너비(`w-monti-sidebar`, `max-w-monti-reading`), 아이콘 크기(`size-monti-icon-md`), 그림자 셋(`shadow-monti-floating`, `-overlay`, `-sheet`), 그리고 스타일마다 하나인 글자 역할이다. 글자 역할은 크기, 줄 간격, 굵기, 자간, 글꼴을 한 번에 정한다(`text-monti-body` … `text-monti-display`). 산세리프 역할이 붙은 같은 요소의 `font-mono`가 항상 이기고, 그 안의 자식에는 미치지 않는다.
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

사이드바는 가장 작은 부품에서 제품 고유의 부품까지 다섯 단으로 나뉜다. **Foundations**(토큰 페이지), **Primitives**(레이아웃 원자, 글, 아이콘, AI 표시: Box, Stack, Grid, Text, Icon, Label, Separator …), **Controls**(사람이 조작하는 것, 묶음별: Button, Field, Choice, Tabs, Menu, Overlay, Status), **Patterns**(컨트롤로 조립한 것: List, Frame, Sheet), **Monti**(CMS에만 있는 것: EditorTools, Change, Proposal, Assistant, Translation). 스토리 제목은 Foundations와 Primitives에서는 `단/이름`, 나머지에서는 `단/묶음/이름`이고, 모든 스토리는 정확히 한 단에 놓인다(`.storybook/preview.tsx`의 `storySort`, `storybook-parity.test.ts`가 확인).

관리자의 화면 상태(불러오기 실패, 빈 목록, 열린 대화상자)는 `packages/admin`에서 같은 카탈로그에 더해지며, 다섯 단 뒤 `Screens` 아래에 놓인다.

스토리는 관리자가 한국어로 보여 주는 모습 그대로 보여 준다. `<html lang="ko">`, 부품이 스스로 쓰는 말(`UiLabels`: 닫기, 취소, 저장 …)은 `.storybook/ko-labels.ts`에서, 예시 글은 한국어로. 도구 모음의 Language로 부품의 영어 기본값으로 바꿀 수 있다. 이 한국어 목록과 관리자의 사전이 다르면 `packages/admin`의 테스트가 실패한다.

## 시각 회귀

이 패키지 카탈로그의 모든 스토리를 밝은 테마와 어두운 테마로 찍어 `visual/baselines`의 PNG와 비교한다. 같은 화면에서 가로 스크롤, 상자에 잘린 글, 글자 크기가 `text-monti-*` 역할과 다른 요소, 고정폭을 요청(`font-mono`, `text-monti-meta`, `text-monti-micro`)했는데 다른 글꼴로 그려지는 요소, 버튼·링크·탭 안에서 글과 다른 줄에 놓인 아이콘, 높이가 정해진 한 줄짜리 컨트롤(버튼, 칩, 메뉴 행, 상태 표시줄 칸)의 글이 상자의 세로 가운데에서 0.75px보다 더 벗어난 경우도 검사한다(글꼴 자체의 수치로 잰다. `visual/checks.ts`의 `findOffCenterText` 참고). 관리자 화면 스토리는 `visual` 태그를 달기 전까지 찍지 않고, 카탈로그 스토리를 빼려면 `no-visual`을 단다(규칙은 `visual/stories.ts`).

**점검.** `pnpm test:visual:audit`은 이 검사만, 빌드한 Storybook의 모든 스토리(찍지 않는 관리자 화면 포함)에 밝은 테마와 어두운 테마로 돌린다. 이미지를 비교하지 않으므로 어느 시스템에서나 돈다. 리디자인 에픽이 끝날 때마다 돌려서, 나온 항목은 고치거나 그 화면을 맡은 이슈에 적는다. `MONTI_STORYBOOK_DIR=<빌드 폴더>`로 다른 빌드(기준 브랜치)를 가리키면, 이 브랜치가 깨뜨린 것과 원래 있던 것을 가를 수 있다. 실행마다 비어 있는 포트에 자기 빌드를 띄우므로, 두 실행이 서로의 Storybook을 보는 일은 없다. CI에서는 `visual` 작업의 독립된 단계로 돌아서, 기준 이미지가 아직 없어도 작업을 실패시킬 수 있다.

기준 이미지는 CI가 쓰는 Linux 이미지에서만 만든다. 글자가 시스템마다 다르게 그려지기 때문이다. 그래서 `pnpm test:visual`은 macOS와 Windows에서 실행을 거부하고, 기준 이미지는 CI에서 받는다.

**처음 기준 이미지.** 첫 기준 이미지를 커밋하기 전에는 `visual/baselines/{light,dark}`가 비어 있다. 푸시에서 도는 첫 CI는 PNG를 찾지 못해 아무것도 비교하지 않고, 찍은 이미지를 `visual-baselines` 산출물(`light/`와 `dark/`)로 올린다. 이것을 받아 두 폴더를 `visual/baselines`에 넣는다.

```bash
gh run download <run-id> --name visual-baselines --dir packages/ui/visual/baselines
git add packages/ui/visual/baselines && git commit
```

**그 뒤.** CI는 푸시마다 커밋된 이미지와 비교한다. 차이가 있으면 작업이 실패하고, 새 코드가 찍은 이미지를 같은 산출물로 올린다. 의도한 변경이면 `visual/baselines`의 두 폴더를 지우고(없앤 스토리의 이미지가 남지 않게) 위처럼 산출물을 받아 변경과 함께 커밋한다. 의도한 것이 아니면 코드를 고친다. 차이는 작업의 리포트에 하나씩 나온다.

**내 컴퓨터에서.** Docker가 같은 Linux 이미지(설치된 Playwright 버전, CI와 같은 태그)를 실행한다. 저장소를 컨테이너로 복사하므로 호스트의 `node_modules`는 건드리지 않는다.

```bash
pnpm test:visual:docker                              # visual/baselines와 비교, 차이 이미지는 visual/test-results에 남는다
pnpm test:visual:docker --baselines /tmp/shots --update   # 이미지를 내가 고른 폴더에 찍어 눈으로 본다
```

`--update` 실행은 대상 폴더의 `light`와 `dark`를 통째로 바꾸므로, 이름을 바꾸거나 지운 스토리의 이미지가 남지 않는다.

이렇게 만든 이미지는 커밋하지 않는다. CI 러너와 Apple silicon Mac은 CPU 구조가 달라 글자 가장자리가 조금 다르게 그려진다. 커밋하는 것은 언제나 CI가 만든 이미지다.

## 개발

```bash
pnpm --filter @monti-cms/ui test:run
pnpm gen:tokens   # tokens/tokens.json을 고친 뒤
```

관리자의 디자인 시스템 테스트(`packages/admin/src/__test__/design-system.test.ts`)는 이 패키지, 관리자, 1차 플러그인에 시스템 밖의 클래스가 있으면 실패한다.
