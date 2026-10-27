# @monti-cms/ui

Monti의 디자인 시스템이다. 관리자와 그 확장이 쓰는 토큰과 부품이 들어 있다.

- **토큰.** `tokens/tokens.json`이 디자인 시스템 자체의 토큰 파일이고 유일한 원천이다. 저장소 루트의 `pnpm gen:tokens`가 `styles/tokens.css`(밝은 테마와 어두운 테마의 값, `--monti-*` 변수)와 `styles/theme.css`의 토큰 부분(Tailwind 4용 이름)을 쓴다. 둘 중 하나라도 스크립트가 쓰는 내용과 다르면 테스트가 실패한다. 클래스는 모두 `monti-`로 시작하고 그다음에 디자인 시스템의 역할 이름이 온다: 속성마다 나뉜 색(`bg-monti-tool`, `text-monti-faint`, `border-monti-muted`, `ring-monti-contrast`), 간격 단계(`gap-monti-12`, 2~48px), 모서리(`rounded-monti-md`), 높이(`h-monti-control`, `h-monti-header`), 너비(`w-monti-sidebar`, `max-w-monti-reading`), 아이콘 크기(`size-monti-icon-md`), 그림자 셋(`shadow-monti-floating`, `-overlay`, `-sheet`), 그리고 스타일마다 하나인 글자 역할이다. 글자 역할은 크기, 줄 간격, 굵기, 자간, 글꼴을 한 번에 정한다(`text-monti-body` … `text-monti-display`).
- **부품.** 조작(`Button`, `IconButton`, `Input`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Tabs` 등), 안내(`Alert`, `Badge`, `EntryStatus`, `Banner`, `Skeleton`, `Spinner`), 떠 있는 창(`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`), 배치(`Text`, `Heading`, `Stack`, `Panel`, `Table`, `PageHeader`, `StatusBar`)다. 부품은 역할이나 톤을 속성으로 받고, 원래 값은 받지 않는다.
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

관리자의 화면 상태(불러오기 실패, 빈 목록, 열린 대화상자)는 `packages/admin`에서 같은 카탈로그에 더해진다.

## 시각 회귀

이 패키지 카탈로그의 모든 스토리를 밝은 테마와 어두운 테마로 찍어 `visual/baselines`의 PNG와 비교한다. 같은 화면에서 가로 스크롤, 상자에 잘린 글, 글자 크기가 `text-monti-*` 역할과 다른 요소도 검사한다. 관리자 화면 스토리는 `visual` 태그를 달기 전까지 찍지 않고, 카탈로그 스토리를 빼려면 `no-visual`을 단다(규칙은 `visual/stories.ts`).

```bash
pnpm test:visual:docker           # CI가 쓰는 Linux 이미지에서 비교
pnpm test:visual:docker --update  # 의도한 변경 뒤 기준 이미지를 다시 쓴다
```

기준 이미지는 Linux에서만 만든다(글자가 시스템마다 다르게 그려진다). 그래서 `pnpm test:visual`은 macOS와 Windows에서 실행을 거부한다. CI가 차이를 찾으면 바뀐 이미지를 `visual-baselines` 산출물로 올린다. 받아들이려면 `visual/baselines`를 그 폴더로 바꾼다.

## 개발

```bash
pnpm --filter @monti-cms/ui test:run
pnpm gen:tokens   # tokens/tokens.json을 고친 뒤
```

관리자의 디자인 시스템 테스트(`packages/admin/src/__test__/design-system.test.ts`)는 이 패키지, 관리자, 1차 플러그인에 시스템 밖의 클래스가 있으면 실패한다.
