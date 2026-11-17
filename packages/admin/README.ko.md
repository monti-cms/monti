# @monti-cms/admin

Monti의 관리자 화면이다. `@monti-cms/ui`의 부품으로 만들고, 서버에는 기능으로만 닿는다. `useOperation`과 `useRead`가 `Transport`로 관리자 API를
부르고, 화면은 `fetch`를 부르지 않는다(린트가 `src/operations`에서만 허용한다).

```tsx
import { httpTransport, MontiAdmin } from "@monti-cms/admin";

<MontiAdmin transport={httpTransport("/admin/api")} siteName="example.dev" />;
```

`siteName`과 `language`는 설정에 이름(설정 › 사이트)과 화면 언어(설정 › 관리자)가 저장되기 전까지 보이는 값이다. 저장된 뒤에는 저장된 값이
로그인 화면까지 보인다.

지금 있는 것: 로그인 화면(첫 관리자, 로그인, 잠금, GitHub)과 틀(스키마와 `frame.counts`로 그리는 사이드바, 화면 모드, 스키마 알림 띠). 다른
화면은 각 기능 문서(`docs/design/features`)와 함께 온다.

## 스타일

`@monti-cms/admin/styles.css`는 빌드한 파일로 나오는 관리자 화면의 스타일이다(`pnpm --filter @monti-cms/admin build:styles`.
`scripts/build-styles.mjs`가 `styles/index.css`에서 만든다). 사이트는 그대로 가져다 쓰고 Tailwind가 필요 없다. 관리자 밖을 건드리지 않는다.
모든 규칙이 `.monti-admin`이 있는 문서 안에서만 걸리고, 변수와 키프레임 이름이 모두 `monti-`로 시작하고, 캐스케이드 레이어를 남기지 않으며,
관리자 화면의 글꼴을 함께 싣는다. Next.js 사이트에서는 `@monti-cms/next`가 관리자 페이지와 함께 싣는다.

## Storybook

```sh
pnpm --filter @monti-cms/admin storybook   # 포트 6007
```

화면 스토리마다 브라우저 안에서 사이트 하나가 통째로 돈다. PGlite 위의 Postgres, core의 진짜 기능, 진짜 관리자 API다(`.storybook/pglite-site.ts`).
스토리는 데이터를 기능으로 넣으므로 코드와 어긋날 수 없다.
