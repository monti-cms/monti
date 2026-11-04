# Monti

[English](README.md) | 한국어

개발자 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것입니다. 이탈리아어로 "monti"는 "산들"이라는 뜻이기도 합니다.

## 상태: 다시 만드는 중

Monti는 설계부터 다시 만들고 있습니다. 이전 패키지는 지웠고, 그것이 있는 마지막 커밋은 `9c69629f`입니다. 다시 만들기가 그 단계에 이를 때까지
설치할 릴리스는 없습니다.

- 설계는 [`docs/design/features`](docs/design/features/README.md)에 있습니다. 기능마다 문서 하나이고, 만드는 순서는
  [`build.md`](docs/design/features/build.md)에 있습니다. 어디까지 왔고 무엇이 남았는지는 [`docs/tracker.md`](docs/tracker.md)에 있습니다.
- 기준이 되는 화면은 디자인 시스템 Storybook의 기준 화면(`Screens/Reference`)입니다.

## 패키지

| 패키지 | 무엇인가 |
|---|---|
| [`@monti-cms/core`](packages/core) | 기능(`defineOperation`), 기능을 돌리는 엔진(버전, 되돌리기 스냅숏, 활동 기록, 전송, 제안), 기능에서 나오는 입구들(관리자 API, 에이전트 도구, CLI) |
| [`@monti-cms/ui`](packages/ui) | 디자인 시스템. 토큰, 관리자 화면을 만드는 부품, 기준 화면 |

## 개발

```sh
pnpm install            # 설치
pnpm lint               # 린트 (pnpm lint:fix로 고침)
pnpm check:design       # 관리자 화면 규칙 (docs/design/admin)
pnpm check:operations   # 기능 문서와 코드가 같은 기능을 말하는지
pnpm typecheck          # 모든 패키지 타입 검사
pnpm build              # 모든 패키지 빌드
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test   # core 테스트, Postgres 테스트 데이터베이스에서
pnpm --filter @monti-cms/ui storybook                             # 디자인 시스템과 기준 화면
```

커밋하면 코드 검사(lint-staged)와 커밋 메시지 검사(commitlint)가 저절로 돕니다. 커밋 메시지는 영어로 `type(scope): subject`처럼 씁니다
(예: `feat(core): add thing`). scope 목록은 `commitlint.config.mjs`에 있습니다.

## 라이선스

[MIT](LICENSE)
