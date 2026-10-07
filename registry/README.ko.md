# 컴포넌트 레지스트리

[English](README.md) | 한국어

**소스로** 설치하는 컴포넌트입니다. `monti add <이름>`이 파일을 앱에 복사하고, 그 뒤로는 파일이 앱의 것이라 읽고 고쳐 쓸 수 있습니다. 가져다 쓰는 라이브러리가 아닙니다.
컴포넌트는 공개 진입점인 `@monti-cms/admin/hooks`(에디터 훅, 실험적), `@monti-cms/core/render`, `@monti-cms/core/client`, `@monti-cms/core/read`(타입), `@monti-cms/nextjs`에만 기대고, 일반 요소와
호스트 앱의 Tailwind 클래스로 그립니다. (어드민 화면 자체의 스타일은 따로 있고, 미리 빌드되어 나옵니다.)

```sh
pnpm exec monti add article-body                 # 컴포넌트 하나
pnpm exec monti add entry-editor notice-block-view
pnpm exec monti add blog-theme                   # 글 목록과 글 페이지, "블로그 테마" 참고
pnpm exec monti add article-body --dry-run       # 쓸 파일과 설치할 패키지만 보여 줌
```

## 컴포넌트

| 이름 | 종류 | 내용 | 필요한 것 |
| --- | --- | --- | --- |
| `article-body` | 공개 페이지 | `<ArticleBody cms={cms} entry={entry} components={...} />`: 저장된 문서를 `CmsContent`로 그리고, 위에 `tableOfContents`로 만든 목차를 둡니다. 서버 컴포넌트 | `@monti-cms/core` |
| `blog-theme` | 공개 페이지 | 컬렉션 하나의 글 목록(페이지 나눔)과 글 페이지(제목, 날짜, 작성자, 목차, 본문, 새 글과 이전 글). `generateMetadata`, 404, 리다이렉트를 갖춥니다. 라우트 파일은 `app/(site)/blog/`에 놓입니다 | `@monti-cms/core`, `next`, `article-body` |
| `entry-editor` | 어드민 | `<EntryEditorScreen adminId target fields />`: `useEntryEditor`(불러오기, 저장, 발행, 복구 사본, 충돌)와 `useField`로 만든 최소한의 맞춤 편집 화면 | `@monti-cms/admin`, `field-row` |
| `field-row` | 어드민 | `<FieldRow name="title" />`: `useField`로 그린 폼 필드 하나(라벨, 입력, 설명, 오류) | `@monti-cms/admin` |
| `notice-block-view` | 어드민 | `blockViews`에 넣는 `notice` 블록의 편집 화면: 제목 입력, 수준 선택, 중첩 본문(`useBlockEditor`, `BlockFrame`, `Content`). `noticeBlockViews`를 내보냅니다 | `@monti-cms/admin` |

## 블로그 테마

`monti add blog-theme`는 컬렉션 하나에 동작하는 블로그를 줍니다. 목록 페이지와 글 페이지가 직접 고칠 수 있는 소스로 들어옵니다. 글은 `cms.read`(`listEntries`, `getEntry`)로 읽고, 본문은
`article-body` 항목으로 그립니다(`registryDependency`라서 함께 설치됩니다). 스타일은 호스트의 Tailwind 클래스뿐이며, 다크 모드는 `dark:`, 본문은 `@tailwindcss/typography`의 `prose`를 씁니다.
`@monti-cms/admin*`나 어드민 스타일시트는 가져오지 않아(테스트가 확인합니다) 공개 페이지는 어드민 CSS를 불러오지 않습니다.

```sh
pnpm exec monti add blog-theme
# components/monti/blog-theme/{theme.config.ts, blog-list.tsx, blog-post.tsx, post-meta.tsx, pagination.tsx}
# app/(site)/blog/page.tsx          목록:  /blog?page=2
# app/(site)/blog/[slug]/page.tsx   글:    /blog/<slug>
```

- **`theme.config.ts`를 고칩니다.** 사이트마다 다른 것을 한곳에 모았습니다. `cms` import(`@/monti.config`), `collection` 이름(기본 `post`), `routeBase`(`/blog`), `pageSize`, 작성자와 주제의 관계 필드,
  요약 필드, `blogTitle`, `components`(`CmsContent`에 주는 것과 같은, 블록의 공개 컴포넌트), `neighborWindow`(새 글과 이전 글을 찾을 때 훑는 최신 글의 수. `0`이면 그 링크를 끕니다)입니다.
- **라우트.** 라우트 파일은 얇습니다. `blog-list.tsx`와 `blog-post.tsx`의 페이지와 `generateMetadata`를 다시 내보내고 `dynamic = "force-dynamic"`을 설정할 뿐입니다. 블로그를 다른 경로에 두려면
  두 폴더를 옮기고 `routeBase`를 맞추세요. `[locale]` 폴더(`app/(site)/[locale]/blog/`) 아래에서는 페이지가 `params.locale`을 읽고 모르는 언어에는 404를 보여 주며, 없으면 기본 언어를 읽습니다.
  `monti add blog-theme`를 다시 실행하면 라우트 파일이 `app/(site)/blog/`에 한 번 더 써지니, 옮겨 두었다면 새로 생긴 사본을 지우세요.
- **찾을 수 없음과 리다이렉트.** 없는 주소, 발행하지 않은 글, 초안의 주소는 404이고, 이름을 바꾼 글의 옛 주소는 새 주소로 영구 리다이렉트합니다.
- **메타데이터.** 글 페이지는 제목, 설명(요약 필드), canonical 경로, Open Graph article 필드를 설정합니다.

`notice-block-view`는 설정에서 정의한 블록을 그립니다. `monti.config.ts`의 스키마나 블록에 컨테이너 문법과 `level` 속성(`info` 또는 `warning`)을 가진 `notice` 블록을 추가하고,
직접 만든 어드민 플러그인(`definePlugin({ ..., admin: () => import("./admin") })`와 `defineAdminPlugin({ Provider })`)의 `CmsAdminComponentsProvider`로 화면을 등록하세요.

```tsx
import { noticeBlockViews } from "@/components/monti/notice-block-view/notice-block-view";

const components: CmsAdminComponents = { blockViews: { ...noticeBlockViews } };
```

## `monti add`가 하는 일

- **파일 위치.** 호스트의 컴포넌트 별칭 아래 `monti/<이름>/`입니다. 별칭은 `components.json`(shadcn의 파일)이 있으면 그 `aliases.components`, 없으면 `@/components`이고,
  폴더는 `tsconfig.json`의 `paths`로 찾습니다(없으면 앱에 `src/`가 있을 때 `src/`, 아니면 앱 폴더. 이때는 추가할 `paths` 줄을 알려 줍니다).
  그래서 기본 위치는 `components/monti/<이름>/…`(또는 `src/components/monti/<이름>/…`)입니다. `target`이 있는 파일은 앱 폴더 기준 그 경로에 둡니다. target의 `{app}`은 App Router 폴더로, 앱에 `src/app`이 있거나 `src/`만 있고 `app/`이 없으면 `src/app`, 아니면 `app`입니다. 다른 `{이름}`은 오류입니다.
- **import.** 컴포넌트끼리는 레지스트리 자체의 접두사 `@/registry/monti/<이름>/<파일>`로 서로를 가져옵니다. 복사할 때 호스트 별칭(`@/components/monti/<이름>/<파일>`)으로 바뀝니다.
  상대 경로 import와 패키지 import는 그대로 둡니다.
- **필요한 컴포넌트.** `registryDependencies`를 먼저, 한 번씩만 설치합니다. `entry-editor`는 `field-row`를, `blog-theme`은 `article-body`를 함께 가져옵니다. 항목은 같은 레지스트리의 이름이거나 항목의 URL입니다.
- **npm 패키지.** 항목의 `dependencies`와 `devDependencies` 중 앱에 아직 없는 것을 앱의 패키지 매니저로 설치합니다(락 파일, `packageManager` 필드 순으로 찾고, 없으면 npm).
- **고친 파일은 안전합니다.** 모든 파일을 먼저 비교합니다. 레지스트리와 내용이 같은 파일은 그대로 두므로 두 번 실행해도 달라지는 게 없습니다. 내용이 다른 파일이 하나라도 있으면
  설치 전체가 멈춥니다. 아무것도 쓰지 않고 패키지도 설치하지 않으며, 해당 파일을 보여 줍니다. `--overwrite`를 주면 덮어쓰니 뒤에 `git diff`로 비교하세요.
- **`--dry-run`**은 같은 계획을 보여 주고 아무것도 바꾸지 않습니다.
- **`--registry <url|path>`**로 다른 레지스트리를 읽습니다. 폴더(또는 그 `registry.json`)이거나 `registry.json`과 `<이름>.json`을 내려 주는 URL입니다. 주지 않으면
  이 저장소를 체크아웃한 곳의 `registry/r` 폴더를, 없으면 `https://raw.githubusercontent.com/monti-cms/monti/overhaul/registry/r`를 읽습니다.

## shadcn 호환

파일은 [shadcn 레지스트리 스키마](https://ui.shadcn.com/docs/registry)를 따릅니다. `registry.json`이 항목을 나열하고, `<이름>.json`이 레지스트리 항목입니다
(`name`, `type`, `path`·`type`·`target`·`content`를 가진 `files[]`, `dependencies`, `registryDependencies`). 빌드한 레지스트리는 정적 파일이라 어디에든 올릴 수 있습니다.
`npx shadcn add <url>/article-body.json`도 같은 파일을 읽으며, 다른 항목을 import하지 않는 항목(`article-body`, `notice-block-view`)에서 동작합니다. 파일을 항목 종류에 따라 놓고
`@/registry/monti/` 접두사와 `{app}`은 모르므로, `entry-editor`와 `blog-theme`처럼 `registryDependencies`가 있는 항목은 `monti add`로 설치하세요. shadcn에 전체 URL을 주려면
`node scripts/build-registry.mjs --base-url <url>`로 빌드합니다.

## 구성과 빌드

```
registry/
  registry.json            소스 목록: 항목, 파일 경로, 의존성
  items/<이름>/<파일>       각 컴포넌트의 소스(TypeScript, 여기서 타입 검사)
  r/                       빌드 결과(커밋함): registry.json과 파일 내용을 담은 <이름>.json
```

`registry/`는 소스를 실제 패키지에 대해 타입 검사(`pnpm typecheck`)하고 린트하려고 둔 비공개 워크스페이스 패키지(`@monti-cms/registry`)입니다. 배포하지 않습니다.

```sh
pnpm registry:build   # registry.json과 소스로 registry/r을 씀
pnpm registry:check   # registry/r이 소스가 만든 결과와 다르면 실패
```

결과물은 **커밋합니다**. 그래서 체크아웃만으로 기본 레지스트리가 동작하고, 컴포넌트를 고치면 리뷰에서 나가는 항목 JSON의 변화로 보입니다. 코어 테스트가 이 검사를 돌리므로
빌드를 잊으면 CI가 실패합니다. 컴포넌트나 `registry.json`을 고친 뒤에는 `pnpm registry:build`를 실행하고 `registry/r`을 커밋하세요.

## 컴포넌트 추가하기

1. 파일을 `registry/items/<이름>/`에 둡니다(이름은 kebab-case). 다른 항목은 `@/registry/monti/<다른이름>/<파일>`로 가져오고, 패키지는 공개 진입점에서만 가져옵니다.
2. `registry.json`에 항목을 적습니다: `name`, `type`, `description`, npm `dependencies`(`이름` 또는 `이름@범위`), `registryDependencies`, `files`.
3. `pnpm registry:build`를 실행한 뒤 `pnpm typecheck`와 `pnpm test:run`을 돌립니다.
