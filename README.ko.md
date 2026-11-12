# Monti

[English](README.md) | 한국어

개발자 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것입니다. 이탈리아어로 "monti"는 "산들"이라는 뜻이기도 합니다.

## 상태: 다시 만드는 중

Monti는 설계부터 다시 만들고 있습니다. 이전 패키지는 지웠고, 그것이 있는 마지막 커밋은 `9c69629f`입니다. 다시 만든 패키지의 첫 릴리스를
만들고 있습니다([20번 문서](docs/design/features/20-release.md)). 나오기 전까지 [릴리스 페이지](https://github.com/monti-cms/monti/releases)는 비어 있습니다.

- 설계는 [`docs/design/features`](docs/design/features/README.md)에 있습니다. 기능마다 문서 하나이고, 만드는 순서는
  [`build.md`](docs/design/features/build.md)에 있습니다. 어디까지 왔고 무엇이 남았는지는 [`docs/tracker.md`](docs/tracker.md)에 있습니다.
- 기준이 되는 화면은 디자인 시스템 Storybook의 기준 화면(`Screens/Reference`)입니다.

## 패키지

| 패키지 | 무엇인가 |
|---|---|
| [`@monti-cms/core`](packages/core) | 기능(`defineOperation`), 기능을 돌리는 엔진(버전, 되돌리기 스냅숏, 활동 기록, 전송, 제안), 기능에서 나오는 입구들(관리자 API, 에이전트 도구, CLI) |
| [`@monti-cms/ui`](packages/ui) | 디자인 시스템. 토큰, 관리자 화면을 만드는 부품, 기준 화면 |
| [`@monti-cms/admin`](packages/admin) | 관리자 화면. 기능으로만 서버에 닿는다 |
| [`@monti-cms/next`](packages/next) | Next.js 사이트에 Monti 붙이기. 관리자 페이지, 관리자 API 라우트, 초안 모드의 미리보기, 발행할 때의 캐시 갱신 |
| [`@monti-cms/ai`](packages/ai) | 어시스턴트. 사이트의 기능 위에서 모델을 돌리고, 검토할 제안을 돌려준다 |

[`examples/blog`](examples/blog)는 Monti를 붙인 Next.js 블로그다. 흐름 테스트(`pnpm test:e2e`)가 이 앱에서 돈다.

## 릴리스 설치하기

릴리스는 패키지마다 압축 파일 하나이고, npm이 아니라 [릴리스 페이지](https://github.com/monti-cms/monti/releases)에 있습니다. 사이트는 그 파일을
주소로 적습니다. 패키지끼리도 같은 주소로 서로를 가리키므로, 사이트가 적지 않은 패키지는 따라옵니다. 릴리스를 증명한
패키지 매니저는 npm입니다. pnpm과 yarn으로는 아직 해 보지 않았습니다.
정확한 줄은 릴리스마다 그 글에 있습니다. Next.js 사이트(App Router, Next 16 이상)라면:

```sh
npm install \
  https://github.com/monti-cms/monti/releases/download/v<버전>/monti-cms-core-<버전>.tgz \
  https://github.com/monti-cms/monti/releases/download/v<버전>/monti-cms-admin-<버전>.tgz \
  https://github.com/monti-cms/monti/releases/download/v<버전>/monti-cms-next-<버전>.tgz
npx monti init        # 사이트의 Monti 파일을 쓰고, .env.local에 없는 값을 더하고, 남은 일을 말한다
npx monti doctor      # 설정 점검: 파일, 환경 값, 데이터베이스, 저장소
```

`monti init`은 넷을 묻습니다(관리자 주소, 사이트의 언어, 관리자가 로그인하는 법, 미디어 파일을 둘 곳). 저마다 명령줄 값이 있고,
`-y`는 기본값을 씁니다. 사이트에 없는 파일만 쓰고 있는 파일은 덮어쓰지 않으므로 다시 돌려도 됩니다. 무엇을 쓰는지는
[`packages/next`](packages/next)에 있고, [`examples/blog`](examples/blog)는 사이트 하나 전체입니다. 관리자 화면은 이미 만들어진 제
스타일시트를 가져옵니다. 그것 때문에 사이트에 Tailwind가 있어야 하지 않습니다.

`monti` 명령은 사이트의 환경 파일을 Next가 읽는 순서로 읽습니다. 환경에 이미 있는 값, 그다음 `.env.<mode>.local`, `.env.local`,
`.env.<mode>`, `.env`입니다(`<mode>`는 `NODE_ENV`, 없으면 `development`). `--env-file <경로>`는 하나를 더 가리키고, 가장 먼저 읽습니다.

## 개발

```sh
pnpm install            # 설치
pnpm lint               # 린트 (pnpm lint:fix로 고침)
pnpm check:design       # 관리자 화면 규칙 (docs/design/admin)
pnpm check:review       # 관리자 화면이 디자인 검토가 읽은 그대로인지
pnpm check:operations   # 기능 문서와 코드가 같은 기능을 말하는지
pnpm typecheck          # 모든 패키지 타입 검사
pnpm build              # 모든 패키지 빌드
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test   # core 테스트, Postgres 테스트 데이터베이스에서
pnpm --filter @monti-cms/ui storybook                             # 디자인 시스템과 기준 화면
```

### 릴리스 내기

```sh
node scripts/version.mjs 0.2.0     # 모든 패키지가 같은 버전이 된다
git commit -am "chore(release): 0.2.0" && git tag v0.2.0 && git push --follow-tags
```

태그가 릴리스 작업을 시작합니다. 버전을 확인하고, 빌드하고, 세 관문을 지나야만 릴리스가 나갑니다. 관문은 push마다도 돌고, 손으로도 돌립니다.

```sh
pnpm build
pnpm check:packages                # 압축 파일마다 publint와 arethetypeswrong
DATABASE_URL=postgres://localhost/postgres pnpm try:release --shot admin.png
                                   # 저장소 밖의 새 Next 앱이 압축 파일을 npm으로 설치해 빌드되고 뜨고,
                                   # 브라우저가 그 관리자 화면을 연다(제 데이터베이스를 만들고 끝나면 지운다)
node scripts/pack-release.mjs out --base <주소>   # 묶음 자체: 패키지마다 압축 파일 하나
```

커밋하면 코드 검사(lint-staged)와 커밋 메시지 검사(commitlint)가 저절로 돕니다. 커밋 메시지는 영어로 `type(scope): subject`처럼 씁니다
(예: `feat(core): add thing`). scope 목록은 `commitlint.config.mjs`에 있습니다.

## 미디어 저장소

미디어 라이브러리는 플러그인이 가져오는 저장소에 파일을 둡니다. 저장소가 없는 사이트도 돌아갑니다. 라이브러리가 연결하는 법을 알려 주고, 올리기만 안 됩니다.

```ts
import { createMonti, definePlugin, localFolderStorage } from "@monti-cms/core";

const monti = createMonti({
	// ...사이트의 나머지
	plugins: [definePlugin({ name: "media", storage: localFolderStorage({ dir: "./media" }) })],
});
```

`localFolderStorage`는 개발 서버용입니다. 파일을 디스크의 폴더에 두고 관리자 API로 내줍니다. 다른 곳에 두려면 `Storage`를 구현한 플러그인을 씁니다. S3 호환 어댑터는 만들 예정입니다.

## 라이선스

[MIT](LICENSE)
