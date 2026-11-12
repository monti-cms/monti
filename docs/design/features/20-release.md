# 20 설치와 릴리스

상태: 설계 (2026-11-13). 소유자 승인 전이다. 아래 결정은 모두 "만들며 정함"이고, 소유자의 말이 있어야 하는 것은 "소유자에게 물을 것"에 있다. 만드는 순서는 릴리스 묶음(T14) → `monti init`과 `monti doctor`(T82) → S3 저장소(T102)다.

## 한 문장

새 사이트가 Monti를 설치해 운영에 올리는 길이다. 패키지를 묶음으로 내고, `monti init`이 있던 Next 사이트에 관리자 화면을 붙이고, `monti doctor`가 붙인 것과 운영에서 깨지는 것을 점검하고, S3 호환 저장소가 디스크 없는 호스트에서 파일을 받는다.

## 소유자에게 물을 것

1. **패키지를 npm에 공개로 올릴까, GitHub 릴리스의 묶음으로만 낼까.** 릴리스가 내는 파일은 어느 쪽이든 같다(패키지마다 압축 파일 하나). 다른 것은 사람이 설치할 때 적는 주소와, 한 번 올리면 되돌릴 수 없는가다.
   - (가) GitHub 릴리스에만 올린다. 설치할 때 `npm install https://github.com/monti-cms/monti/releases/download/v0.2.0/monti-cms-core-0.2.0.tgz …`처럼 주소를 적는다. 계정이나 토큰이 필요 없고, 릴리스를 지우면 없던 일이 된다. 저장소가 공개라서 누구나 받을 수 있다.
   - (나) npm에 올린다. `npm install @monti-cms/core`로 설치한다. npm의 `@monti-cms` 조직과 토큰이 있어야 하고, 올린 버전은 지울 수 없다.
   - 추천은 (가)로 일요일 릴리스를 내고, npm은 그 뒤에 소유자가 정할 때 같은 파일을 올리는 것이다. 답이 없으면 (가)로 한다.
2. **첫 릴리스의 번호를 `0.2.0`으로 할까.** 지금 패키지는 `0.2.0-next.16`이다. `0.2.0`으로 내면 "다 만든 첫 판"이고, `0.2.0-next.17`로 내면 아직 시험판이라는 뜻이다. 추천은 `0.2.0`이다. 답이 없으면 `0.2.0`으로 한다.

## 원칙

1. **릴리스의 증명은 새 사이트다.** 묶음을 만드는 것으로 끝나지 않는다. 저장소 밖의 새 Next 앱이 묶음에서 설치해 빌드되고 관리자 화면이 떠야 릴리스다. CI가 릴리스 전에도 PR마다 돌린다.
2. **묶음의 파일은 npm에 올릴 파일과 같다.** 패키지마다 `npm pack`이 만드는 압축 파일 하나다. 어디에 올리든 내용이 같아서, 올리는 곳을 나중에 바꿔도 다시 만들 것이 없다.
3. **`init`은 새 파일만 쓴다.** 사이트가 가진 파일을 덮어쓰거나 옮기지 않는다. 이미 있으면 건너뛰고 그렇게 말한다. 손으로 해야 하는 것은 끝에 번호를 붙여 정확한 명령과 함께 적는다.
4. **`doctor`는 읽기만 한다.** 아무것도 고치지 않고, 비밀 값을 찍지 않는다. 무엇이 어디에서 틀렸고 어떻게 고치는지를 한 줄씩 말한다.
5. **묻는 것은 지금 답할 수 있는 것만.** 플러그인, 있던 글 가져오기, AI 키는 `init`이 묻지 않는다. 플러그인과 가져오기는 14번 문서의 일이고(첫 릴리스 뒤), 키는 관리자 화면에서 넣는다.
6. **저장소는 계약 하나다.** S3 어댑터는 09번 문서의 `Storage`를 그대로 지키고, 브라우저가 직접 올리는 길은 그 위에 얹는 선택 기능이다. 없는 저장소에서는 지금 길(서버를 거쳐 올리기)이 그대로 돈다.

## 릴리스 묶음 (T14)

### 지금 무엇이 없나

- `@monti-cms/core`와 `@monti-cms/ui`만 빌드가 있다(`scripts/build-package.mjs`, `dist`와 `publishConfig.exports`). `@monti-cms/admin` · `@monti-cms/next` · `@monti-cms/ai`는 `exports`가 TypeScript 소스(`./src/index.ts`)를 가리키고 빌드도, 내보낼 파일 목록(`files`)도 없다. 예제 앱은 그래서 `transpilePackages`로 소스를 그대로 읽는다. 저장소 밖에서는 통하지 않는다.
- `scripts/pack-release.mjs`와 `release.yml`은 묶음을 `release` 브랜치에 풀어 넣고 `github:monti-cms/monti#release/v…&path:/core`로 설치하게 한다. 이 주소는 pnpm만 읽는다. 그리고 지금 패키지는 서로를 `dependencies`로 가진다(`@monti-cms/admin` → core · ui, `@monti-cms/next` → admin · core). 묶을 때 그 줄은 버전 번호가 되는데, 그 버전은 npm에 없으므로 설치가 멈춘다. 옛 패키지는 서로를 `peerDependencies`로 두어 이 문제를 피했다.

### 무엇을 낸다

- 다섯 패키지를 모두 빌드해 낸다: `@monti-cms/core`, `@monti-cms/ui`, `@monti-cms/admin`, `@monti-cms/ai`, `@monti-cms/next`. `@monti-cms/storage-s3`가 생기면 여섯이다. 버전은 늘 같다(`scripts/version.mjs`).
- `admin` · `next` · `ai`에 core · ui와 같은 빌드를 붙인다(`build-package.mjs`: 파일마다 옮겨 `"use client"`가 남는다. `tsconfig.build.json`, `files`, `publishConfig.exports`). `admin`의 빌드는 스타일시트(`dist/styles.css`, `build-styles.mjs`)까지다. 루트의 `pnpm build`는 의존 순서대로 다섯을 빌드한다: core → ui → admin → ai → next.
- 묶음은 패키지마다 압축 파일 하나(`monti-cms-core-0.2.0.tgz` …)와 설치 줄을 적은 `README.md`다. 압축 파일에는 `dist`, 그 패키지의 `README.md`, `LICENSE`가 있고 소스(`src`) · 테스트 · 스토리는 없다. core에는 `bin`(`monti` 명령), ui에는 `styles`가 더 있다.
- 묶음 안의 패키지끼리는 **같은 묶음의 주소**로 가리킨다. `pack-release.mjs --base <주소>`가 압축 파일 안 `package.json`의 `@monti-cms/*` 줄을 `<주소>/monti-cms-core-0.2.0.tgz`로 바꿔 쓴다. 그래서 사이트는 직접 쓰는 패키지만 주소로 적고, 나머지는 따라온다. 증명이 돌리는 것은 npm이다. pnpm과 yarn으로는 해 보지 않았으므로 된다고 말하지 않는다. `--base` 없이 묶으면 버전 번호 그대로이고, 그것이 npm에 올릴 파일이다(원칙 2). 그 버전은 아직 npm에 없으므로, 그렇게 묶은 것을 설치하려면 묶음의 압축 파일을 모두 함께 설치한다(묶음의 `README.md`가 그 줄을 적는다).
- 묶음의 `README.md`가 릴리스의 글이다. 있는 것만 적는다: `monti init`은 T82가 들어온 뒤에 적는다. 그 전에는 사이트가 쓰는 파일 넷이 어디 있는지(`packages/next`의 README, 예제 앱)를 가리킨다.
- 아이콘 패키지(`@carbon/icons-react`)는 그것을 가져다 쓰는 `@monti-cms/ui`의 의존이다. 전에는 ui와 admin의 peer였는데, peer를 스스로 설치하지 않는 패키지 매니저(yarn)에서는 빌드가 그 패키지를 찾지 못한다. peer여야 할 까닭(하나만 있어야 하는 상태)이 없다.
- 압축 파일의 `sideEffects`는 낸 파일을 가리킨다. 저장소 안에서는 소스(`./src/admin.tsx`: 관리자의 스타일시트를 가져오는 파일)를 가리키는데 소스는 나가지 않으므로, 묶을 때 낸 파일 이름(`./dist/admin.js`)으로 바꾸고 스타일시트도 함께 적는다. 그대로 두면 번들러가 스타일시트를 가져오는 줄을 버려도 된다고 읽는다.
- `release` 브랜치와 `github:…&path:` 설치는 없앤다. `v*` 태그를 밀면 `release.yml`이 버전을 확인하고, 빌드하고, 새 사이트로 증명하고(아래), GitHub 릴리스를 만들어 압축 파일을 자산으로 올린다. 릴리스는 초안으로 만들어 압축 파일을 다 올린 뒤에 공개한다: 올리다 실패해도 반쯤 된 릴리스가 보이지 않고, 다시 돌리면 그 초안을 이어 쓴다.
- **관리자 화면의 스타일은 다 만든 CSS 파일 하나로 나간다.** `@monti-cms/admin/styles.css`(`dist/styles.css`)는 빌드할 때 Tailwind로 이미 만든 파일이고, `@monti-cms/next/admin`이 그것을 가져온다. 사이트의 Tailwind가 `node_modules` 안의 클래스를 찾아야 하는 것이 없으므로, 사이트에 Tailwind가 없어도, 다른 버전이어도 된다. 그 파일의 규칙은 모두 관리자 화면이 든 문서 아래에만 걸리고 `--monti-` 이름만 쓰며 글꼴도 함께 담는다(16번 문서, `scripts/build-styles.mjs`). 지금 `packages/admin`과 예제 앱이 하는 그대로다. 공개한 관리자 패키지가 흔히 깨지는 곳이 여기라서, 아래 증명이 새 사이트에서 관리자 화면을 브라우저로 열어 스타일이 걸렸는지까지 본다.
- **`"use client"`는 파일마다 남는다.** 빌드가 파일을 하나로 뭉치지 않고 하나씩 옮기기 때문이다. `pack-release.mjs`가 소스에 그 줄이 있던 파일은 `dist`의 같은 파일도 그 줄로 시작하는지 본다.
- 패키지의 `private: true`는 그대로 둔다. npm에 올리기로 정해질 때 뗀다(실수로 올라가지 않게 하는 잠금이다).
- 사이트의 `next.config`에는 Monti를 위한 줄이 필요 없다. `transpilePackages`는 저장소 안에서 소스를 읽을 때만 쓰는 것이고, `pg`는 Next가 이미 서버 바깥 패키지로 다룬다. 새 사이트 증명이 이것을 확인한다.

### 새 사이트로 증명하기

`scripts/try-release.mjs`가 한다. CI의 한 작업으로 PR마다 돌고, `release.yml`도 릴리스를 만들기 전에 돌린다.

1. `pnpm build` 뒤 묶음을 임시 폴더에 만들고, 이 컴퓨터의 HTTP 주소로 내준다(`--base http://127.0.0.1:…`). 릴리스에서 사람이 받는 것과 같은 모양이다: 사이트가 적지 않은 패키지가 주소에서 따라온다.
2. 저장소 밖 임시 폴더에 새 Next 16 앱을 놓는다. `create-next-app`이 만드는 것과 같은 모양의 틀(`testing/release/app`: TypeScript, App Router, `app/layout.tsx`, `app/page.tsx`)이다. 네트워크와 그날의 `create-next-app`에 기대지 않으려고 틀을 저장소에 둔다.
3. npm으로 그 주소에서 설치한다(`@monti-cms/core` · `admin` · `next`, 그리고 이 사이트의 어느 페이지도 쓰지 않는 `ai`). pnpm의 작업 공간 연결이 없는, 가장 봐주지 않는 길이다. core와 ai는 설치된 자리에서 Node로 읽어 본다.
4. `npx monti init --yes`로 Monti 파일을 쓴다. `init`이 생기기 전(T14의 PR)에는 스크립트가 예제 앱의 파일 넷을 그대로 넣는다.
5. `npx monti db:setup`, `npx monti doctor`, `npx tsc --noEmit`, `npx next build`를 차례로 돌린다. 하나라도 실패하면 멈춘다.
6. `npx next start`를 띄우고 브라우저(흐름 테스트가 쓰는 Playwright)로 `/admin`을 연다. 관리자 화면이 그려지는지(15번 문서의 첫 화면), 그 화면의 버튼이 토큰의 높이와 색을 가졌는지(스타일 파일이 걸렸다는 뜻이다), 브라우저 콘솔에 오류가 없는지, 관리자 API(`auth.state`)가 답하는지, 사이트의 첫 페이지가 제 모습 그대로인지(관리자의 스타일이 사이트로 새지 않았는지) 본다.

데이터베이스는 CI의 Postgres를 쓴다. 로컬에서는 `DATABASE_URL`을 받는다. 중간에 멈춰도(Ctrl-C, 취소된 CI 작업) 만든 데이터베이스와 임시 사이트를 치운다.

증명이 보지 못하는 것:

- 릴리스에 올라가는 압축 파일은 릴리스의 주소로 한 번 더 묶은 것이다(`release.yml`). 내용은 같고 서로를 가리키는 주소만 다르다. 그래서 GitHub의 내려받기 주소(다른 주소로 넘겨 준다)와 공개가 아닌 저장소는 여기서 해 보지 못한다.
- npm 말고 다른 패키지 매니저.
- 타입 검사는 새 Next 앱이 기본으로 그러듯 라이브러리의 선언 파일 안은 보지 않는다(`skipLibCheck`). Monti의 선언이 맞는지는 `@arethetypeswrong/cli`가 본다(진행 기록 T201).

### 릴리스의 관문

릴리스는 셋을 모두 지나야 나간다. CI도 PR마다 돌린다.

1. 위의 새 사이트 증명.
2. `publint`: 압축 파일마다(`--base` 없이 묶은 것) `exports`와 `files`가 맞는지 본다.
3. `@arethetypeswrong/cli`: 압축 파일마다 타입 선언이 `exports`대로 풀리는지 본다. Monti의 패키지는 ESM뿐이라 ESM 쪽 풀이(`--profile esm-only`)만 본다. CSS 진입점(`./styles.css`)은 타입이 없으므로 뺀다.

두 도구를 지금 묶음에 돌려 본 것(2026-11-13): `publint` 0.3.25는 macOS에서 만든 압축 파일에 든 `._` 파일을 잡아냈고(고쳤다), 그 뒤로는 다섯 패키지 모두 통과다. `@arethetypeswrong/cli`는 ui · ai · next가 통과이고, core의 타입 선언에 Node의 ESM 풀이로는 풀리지 않는 줄이 있다고 한다(번들러 풀이로는 통과라 Next 사이트의 타입 검사는 된다). T14에서 고친다.

### 버전과 릴리스 절차

- 버전은 한 번에 올린다: `node scripts/version.mjs 0.2.0` → 커밋 → `v0.2.0` 태그. 지금 있는 스크립트 그대로다. 패키지마다 버전을 따로 올리는 도구(Changesets)는 쓰지 않는다: 패키지가 늘 같은 버전이라 고를 것이 없다. 바뀐 것은 GitHub 릴리스의 글에 손으로 적는다.
- npm에 올리게 되면(물을 것 1) 그때 `next` 같은 배포 태그와 출처 증명(GitHub Actions의 provenance)을 더한다. 지금은 올리지 않으므로 넣지 않는다.

## `monti init` (T82)

있던 Next 사이트를 관리자 화면이 뜨는 데까지 데려간다. 예제 앱이 손으로 가진 것을 쓴다.

### 어떻게 부르나

```sh
npx create-next-app@latest my-site        # 새 사이트라면
cd my-site
npm install <묶음의 core · admin · next 주소>   # 릴리스 README의 한 줄
npx monti init
```

- `monti` 명령은 `@monti-cms/core`에 있다. 지금은 `monti.config.ts`가 없으면 멈추는데, `init`과 `doctor`는 그 파일 없이 돈다(`bin/monti.mjs`가 두 명령을 먼저 가른다).
- `init`은 패키지를 설치하지 않는다. `@monti-cms/admin`이나 `@monti-cms/next`가 없으면 아무것도 쓰지 않고 설치할 줄을 말한다. 설치는 사이트의 패키지 매니저가 할 일이고, 묶음의 주소는 릴리스 README에 있다.

### 무엇을 보고, 묻고, 쓰나

1. **본다.** `package.json`의 Next 버전(16 이상), App Router 폴더(`app/`이나 `src/app/`), TypeScript, 잠금 파일로 본 패키지 매니저, 이미 있는 Monti 파일. Next가 없거나 `pages/`뿐이면 아무것도 쓰지 않고 까닭을 말한다.
2. **묻는다.** 넷이고, 모두 명령줄 값이 있다. `--yes`(`-y`)나 사람이 없는 실행(파이프, CI)은 기본값을 쓰고, 물음에서 멈춰 기다리는 일이 없다. 모든 답을 받기 전에는 아무것도 쓰지 않으므로, 취소하면 사이트는 그대로다.

   | 물음 | 값 | 기본 |
   |---|---|---|
   | 관리자 주소 | `--admin-path` | `/admin` |
   | 사이트의 기본 언어 | `--locale` | 루트 레이아웃의 `<html lang>`, 없으면 `en` |
   | 로그인 | `--login password\|github` | `password` |
   | 미디어 파일을 둘 곳 | `--storage local\|s3\|none` | `local`(이 컴퓨터의 폴더) |

   `s3`는 `@monti-cms/storage-s3`가 설치되어 있을 때만 고를 수 있다. 없으면 설치할 줄을 말한다.
3. **쓴다.** 새 파일만이다(원칙 3).

   | 파일 | 무엇 |
   |---|---|
   | `monti.schema.ts` | 구조의 시작: 고른 기본 언어, 본문이 있는 컬렉션 `post` 하나(제목, 주소). 값만 있는 파일이다 |
   | `monti.config.ts` | 데이터베이스(`DATABASE_URL`), 고른 로그인, 고른 저장소 |
   | `lib/monti.ts` (`src/`가 있으면 그 아래) | `openSite(config)` |
   | `app/<관리자 주소>/page.tsx` | `AdminPage` |
   | `app/<관리자 주소>/api/[...path]/route.ts` | `adminRoute(monti)` |
   | `.env.example` | `DATABASE_URL`, `MONTI_SECRET`(GitHub 로그인이면 그 값들, S3면 `S3_*`)의 이름과 한 줄 설명 |

   있던 파일에 하는 것은 덧붙이기뿐이다.
   - 환경 값은 Next가 읽는 순서로 먼저 읽는다(`.env.local`, 그다음 `.env`). 어디에도 없는 값만 `.env.local`에 더한다(`MONTI_SECRET`은 새로 만든 긴 무작위 값, `DATABASE_URL`은 `postgres://localhost/<패키지 이름>`). 있던 값은 바꾸지 않고, `.env`는 건드리지 않는다.
   - `.gitignore`에 `.env.local`과 `.monti/`가 없으면 더한다.
   - `package.json`의 `scripts`에 `db:setup`과 `db:migrate`가 없으면 더한다. 있던 `dev` · `build` 같은 줄은 바꾸지 않는다.
   - 사람이 고친 파일을 덮어쓰는 길은 없다. 덮어쓰라는 값(`--force`)도 두지 않는다. Monti 파일을 처음 모양으로 되돌리려면 그 파일을 지우고 다시 돌린다.
4. **데이터베이스.** `DATABASE_URL`에 닿으면 표를 만든다(`db:setup`). 사람이 있으면 먼저 묻는다. 닿지 않으면 건너뛰고 남은 일에 적는다.
5. **점검하고 말한다.** `doctor`를 돌려 결과를 보이고, 쓴 것 · 건너뛴 것 · 남은 일을 적는다. 남은 일은 번호와 정확한 명령이다: 데이터베이스 주소 넣기, `npm run db:setup`, `npm run dev` 뒤 `/admin` 열기, 운영에 올릴 때 넣을 환경 변수와 `monti db:migrate`.

- `--dry-run`은 쓸 것을 보이기만 한다.
- 다시 돌려도 된다. 있는 것은 건너뛰고 빠진 것만 채운다. 빠진 것이 없으면 아무것도 쓰지 않고, 무엇이 이미 있는지 말한 뒤 `doctor`를 돌린다.
- 관리자의 첫 계정은 `init`이 만들지 않는다. 운영 사이트의 첫 방문이 만들고(15번 문서), 개발 서버는 로그인을 건너뛴다(16번 문서). 터미널에서 계정을 만드는 둘째 길을 두지 않는다.
- 관리자 주소는 폴더가 정한다(16번 문서). `--admin-path`는 `init`이 만들 폴더의 이름일 뿐이고, 뒤에 폴더 이름을 바꾸면 주소가 바뀐다.

### 사이트의 틀과 관리자 화면

- 관리자 화면은 제 틀을 가져야 사이트의 머리말 · 글꼴 · 전역 스타일이 걸리지 않는다. Next에서 그 길은 하나다: 맨 위의 `app/layout.tsx`가 없고, 사이트의 페이지와 관리자 페이지가 저마다 제 루트 레이아웃을 가진다(예제 앱의 `app/(site)/layout.tsx`와 `app/admin/layout.tsx`, 16번 문서 "관리자 주소").
- 사이트에 맨 위 `app/layout.tsx`가 없으면(이미 묶음으로 나뉜 사이트) `init`은 `app/<관리자 주소>/layout.tsx`를 함께 쓴다. 관리자 화면이 제 틀로 뜬다.
- 맨 위 `app/layout.tsx`가 있으면(새 `create-next-app` 사이트가 그렇다) 관리자 페이지는 그 아래에 놓인다. 화면은 뜬다. 관리자의 스타일은 사이트의 규칙보다 앞서게 만들어져 있어서 모양도 대개 그대로다. 다만 루트 레이아웃이 머리말이나 꼬리말을 그리면 그것이 관리자 화면에도 보인다.
- 그때도 `init`은 사이트의 페이지를 옮기지 않는다(원칙 3). 폴더를 한 단계 옮기면 상대 경로로 가져오는 줄이 깨질 수 있어서다. 대신 남은 일에 정확한 순서로 적는다: 사이트의 페이지와 레이아웃을 `app/(site)/`로 옮기고, `init`을 다시 돌리면 관리자의 레이아웃이 생긴다. `doctor`의 `site/layout`이 같은 것을 경고로 말한다. (레퍼런스: Payload도 있던 Next 앱에 붙일 때 이 옮기기를 사람에게 맡긴다. 그 설치 문서가 "있던 프런트엔드 파일을 루트 레이아웃까지 새 route group으로 옮겨야 할 수 있다"고 적는다. 2026-11-13 확인.)

### 묻지 않는 것

- 플러그인 고르기, 있던 글 알아보기(옛 `init`의 가져오기): 14번 문서의 가져오기와 플러그인이 생길 때 그 문서에서 `init`에 더한다(진행 기록 T198). 첫 릴리스 뒤다.
- AI 키와 모델: 관리자 화면에서 넣는다(14번의 키).
- 블록 고르기, 시간대, 언어를 여럿 고르기: 설정 화면의 일이다.

## `monti doctor` (T82)

`init`이 놓은 것과, 운영 사이트를 깨뜨리는 것을 점검한다. `monti.config.ts`가 없어도, 깨져 있어도 돈다: 그것이 첫 점검이다.

```text
monti doctor: /Users/me/my-site

  ok    site/next             Next 16.4.6, App Router (app/)
  ok    site/packages         @monti-cms/core, admin, next 0.2.0
  ok    files/config          monti.config.ts loads
  FAIL  env/secret            MONTI_SECRET is not set
                              where: .env.local, or the host's environment
                              fix:   add MONTI_SECRET with a long random value (openssl rand -base64 32)
  skip  database/migrations   the database is not reachable

1 failed, 0 warnings, 3 ok, 1 skipped
```

| 점검 | 무엇을 보나 | 틀리면 |
|---|---|---|
| `site/next` | Next 16 이상, App Router | FAIL |
| `site/packages` | core · admin · next가 설치되어 있고 버전이 같다 | FAIL |
| `site/layout` | 관리자 페이지가 사이트의 루트 레이아웃 아래에 있다(위 "사이트의 틀") | warn |
| `files/config` | `monti.config.ts`가 있고 읽힌다 | FAIL, 뒤의 점검은 skip |
| `files/schema` | `monti.schema.ts`가 있고 구조 검사를 지난다 | FAIL |
| `files/admin` | 관리자 페이지와 관리자 API 라우트가 같은 폴더 아래에 있고, 라우트가 `adminRoute`를 내보낸다 | FAIL |
| `files/gitignore` | `.env.local`이 git에 들어가지 않는다 | warn |
| `env/secret` | `MONTI_SECRET`이 있고, 예시 값(`change-me`)이 아니고, 충분히 길다 | FAIL |
| `database/url` | `DATABASE_URL`이 있다 | FAIL |
| `database/reachable` | 데이터베이스에 닿는다 | FAIL |
| `database/migrations` | 표가 있고, 안 따른 변경이 없다 | FAIL, 고치는 법은 `monti db:setup`이나 `monti db:migrate` |
| `storage/configured` | 저장소가 있다 | warn(파일을 올릴 수 없다) |
| `storage/reachable` | 저장소에 닿는다: 없는 키를 물어 "없다"는 답을 받는다 | FAIL |
| `storage/host` | 디스크가 남지 않는 호스트(`VERCEL` 같은 변수가 있다)에서 로컬 폴더 저장소를 쓴다 | FAIL |
| `storage/cors` | 직접 올리는 저장소가 사이트 주소(`--origin`이나 `SITE_URL`)에서 온 올리기를 받는다 | FAIL, 버킷에 붙여 넣을 CORS 설정을 그대로 찍는다. 주소를 모르면 skip |
| `auth/login` | GitHub 로그인이면 그 값들이 있다. 돌아올 주소를 한 줄로 알려 준다 | FAIL |

- 점검 하나가 한 줄이고, 앞에 표시(`ok` · `warn` · `FAIL` · `skip`)가 있다. 틀린 것은 그 줄 바로 아래에 어디에서 틀렸는지와 고치는 명령을 적는다. 끝에 개수를 센다.
- 끝나는 값은 FAIL이 있으면 1, 없으면 0이다. 경고는 세지 않는다. `--json`은 같은 것을 JSON으로 낸다. 배포 과정이 이 값으로 멈출 수 있다.
- `doctor`는 스스로 고치지 않는다. 고치는 명령을 찍을 뿐이다.
- 환경 값은 Next가 읽는 순서로 읽는다(`.env.local`, `.env`, 실제 환경). `--env-file`로 다른 파일을 가리킨다. 어느 파일에서 온 값인지 말하고, 값 자체는 찍지 않는다.
- 운영 사이트를 올리는 과정에서 `monti doctor`를 돌리면 운영의 환경 값으로 점검한다. `storage/host`처럼 운영에서만 뜻이 있는 점검은 그때 걸린다.
- 점검은 아무것도 쓰지 않는다. 저장소에 시험 파일을 올려 보지 않는 것도 그래서다.

## S3 저장소와 직접 올리기 (T102)

### 어댑터

- 패키지는 `@monti-cms/storage-s3`, 함수는 `s3Storage()`다. 09번 문서의 `Storage`(`put` · `stat` · `read` · `remove` · `url`)를 지킨다. AWS S3, Cloudflare R2, MinIO처럼 S3 API를 말하는 저장소면 된다.

  ```ts
  // monti.config.ts
  import { s3Storage } from "@monti-cms/storage-s3";

  plugins: [definePlugin({ name: "files", storage: s3Storage() })],
  ```

- 값은 환경 변수에서 읽고, 옵션으로 하나씩 덮는다: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`(파일이 보이는 주소의 앞부분), `S3_REGION`, `S3_ENDPOINT`(지역이 있으면 없어도 된다), `S3_FORCE_PATH_STYLE`(MinIO). 처음 쓸 때 읽으므로, 값 없이도 사이트 빌드는 된다. 빠진 값은 이름과 넣을 곳을 말하는 오류가 된다.
- 파일은 공개로 읽힌다: 주소는 `S3_PUBLIC_URL/<키>`다. 버킷이 공개이거나 그 앞에 CDN이 있다. 읽을 때마다 서명하는 비공개 버킷은 넣지 않는다.
- S3와 말하는 데는 AWS의 공식 SDK(`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)를 쓴다. 옛 어댑터가 쓰던 것이다.
- AWS가 아닌 저장소에서도 같은 코드가 돈다. 주소를 직접 준다(`S3_ENDPOINT`: R2는 `https://<계정>.r2.cloudflarestorage.com`). 지역을 적지 않으면 `auto`다(R2의 지역이 그것이다). MinIO는 `S3_FORCE_PATH_STYLE`을 켠다. 파일마다 권한(ACL)을 붙이지 않는다: R2는 그 머리글을 받지 않는다. 공개로 읽히는 것은 버킷이나 CDN의 설정이다. (레퍼런스: Cloudflare R2의 S3 API 문서가 지역은 `auto`, 주소는 위 모양, `x-amz-acl`은 "구현하지 않음"이라고 적는다. 2026-11-13 확인.)

### 브라우저가 직접 올리는 길

호스트가 받는 요청의 크기가 Monti의 한도(10 MB)보다 작을 수 있다(서버리스 함수는 흔히 4.5 MB다). 그런 호스트에서는 파일이 서버를 거치면 안 된다.

1. 브라우저가 올리기 표를 청한다: `POST <관리자 API>/media/ticket`(이름, 크기). 서버는 세션을 보고, 이름과 크기를 지금 규칙(`acceptFile`)으로 보고, 키를 정하고, 저장소에 그 키로 올릴 서명된 주소를 받아 준다. 저장소가 직접 올리기를 하지 않으면 그렇게 답하고, 브라우저는 지금 길(`PUT …/media/bytes`)로 올린다.
2. 브라우저가 그 주소로 파일을 곧장 올린다. 진행 막대는 지금 것 그대로다. 서명에는 키와 종류가 묶여 있다. 서명된 주소에는 아무것도 덧붙이지 않는다(덧붙이면 서명이 깨진다).
3. 브라우저가 올렸다고 알린다: `POST <관리자 API>/media/sealed`(키). **서버가 저장소에 든 그 파일을 직접 본다.** 크기를 묻고 앞부분을 읽어, 서버를 거친 길과 같은 검사(`acceptFile`: 한도, 종류)를 한다. 브라우저가 말한 크기와 종류는 믿지 않는다. 다르면 저장소에서 지우고 거절한다. 맞으면 지금 길과 같은 답(키, 종류, 크기)을 준다. 이 검사를 지나기 전에는 어떤 항목도 그 파일을 가리키지 않는다.
4. 그 뒤는 같다: `media.upload`가 그 키로 항목을 만든다. 알리지 않은 채 남은 파일은 지금처럼 치워진다(11번 문서의 치우기).

- 첫 파일부터 이 길로 간다. 파일의 바이트가 서버를 지나는 때가 없다(항목을 만드는 `media.upload`는 키만 받는다).
- `Storage`에 선택 기능 하나가 붙는다: `ticket(key, { mime, size })`가 올릴 주소와 머리글을 준다. 없는 저장소(로컬 폴더, 메모리)는 그대로다.
- 화면은 바뀌지 않는다. 올리는 중과 실패의 모습은 지금 것이고, 관리자 화면의 올리기 길(`transport`)만 표를 먼저 청한다. 새 화면이 필요해지면 만들기 전에 멈추고 그림으로 묻는다.
- 버킷은 사이트 주소에서 오는 `PUT`을 받아야 한다(CORS). `doctor`의 `storage/cors`가 본다.
- 한도는 그대로 10 MB다. 큰 파일을 나눠 올리는 것은 넣지 않는다.

### 일요일까지 못 하면

만드는 순서가 셋째라서, 잘 만들 시간이 안 되면 첫 릴리스에서 뺀다. 그때 운영 사이트는 이렇게 된다.

- 디스크가 남는 호스트(자기 서버, 볼륨이 있는 컨테이너)는 로컬 폴더 저장소(`localFolderStorage`)로 파일을 받는다. 다만 파일이 그 서버의 폴더에 있으므로 서버를 옮기면 폴더도 옮겨야 한다.
- 디스크가 남지 않는 호스트(Vercel 같은 서버리스)는 파일을 올릴 수 없다. 미디어 화면이 저장소가 없다고 말하고(09번 원칙 6), `doctor`가 `storage/host`로 막는다. 글과 설정은 그대로 된다.
- 빼게 되면 이 절과 진행 기록에 그렇게 적고, T102는 릴리스 다음 일로 남긴다.

## 기능 목록

새 기능(`defineOperation`)은 없다. 명령과, 기능이 아닌 관리자 API 길이 생긴다.

| 이름 | 종류 | 무엇 |
|---|---|---|
| `monti init` | 명령 | 있던 Next 사이트에 Monti 파일을 쓰고 남은 일을 말한다. `--yes`, `--dry-run`, `--admin-path`, `--locale`, `--login`, `--storage` |
| `monti doctor` | 명령 | 설정 점검. `--json`, `--env-file`, `--origin` |
| `POST …/media/ticket` | 관리자 API 길 | 직접 올릴 주소를 준다. 세션이 있어야 한다 |
| `POST …/media/sealed` | 관리자 API 길 | 직접 올린 파일을 검사하고 받아들인다 |
| `scripts/pack-release.mjs` | 저장소 스크립트 | 패키지마다 압축 파일을 만든다. `--base` |
| `scripts/try-release.mjs` | 저장소 스크립트 | 새 사이트가 묶음에서 설치해 도는지 본다 |

## 에이전트

바뀌는 것이 없다. 설치와 점검은 사람이 터미널에서 하는 일이다.

## 화면 쪽 조각

없다. 올리기 길(`transport`)이 표를 먼저 청하는 것뿐이고, 보이는 것은 같다.

## 넣지 않는 것

- 있던 글 알아보기와 플러그인 고르기(14번, T198).
- 새 사이트를 통째로 만들어 주는 명령(`create-monti-app`). `create-next-app` 뒤에 `monti init`이다.
- Pages Router.
- 사이트의 파일을 옮기거나 고치는 일(`next.config`, 레이아웃).
- 패키지마다 다른 버전, 바뀐 것 목록을 자동으로 쓰기.
- 비공개 버킷, 10 MB를 넘는 파일, 그림 크기 바꾸기.

## 결정 기록

모두 만들며 정함(2026-11-13). 소유자의 말은 아직 없다. "레퍼런스"는 다른 도구가 같은 일을 어떻게 하는지 조사한 요약(2026-11-13)에서 온 것이고, "확인"이라고 적은 것만 그 도구의 문서나 실행으로 직접 보았다. 나머지는 요약을 읽은 것이다.

1. **묶음은 패키지마다 압축 파일이고, 묶음 안의 패키지는 같은 묶음의 주소로 서로를 가리킨다.** 지금의 `release` 브랜치 방식은 pnpm만 되고, 패키지가 서로를 `dependencies`로 가진 지금은 설치가 멈춘다.
2. **`admin` · `next` · `ai`를 core · ui와 같은 방식으로 빌드한다.** 한 묶음으로 뭉치지 않고 파일마다 옮긴다. `"use client"`가 파일에 남아야 Next가 서버와 브라우저를 가른다. (레퍼런스: 묶는 도구가 그 줄을 지워 공개한 라이브러리가 깨지는 것이 흔한 불만이다.)
3. **관리자의 스타일은 다 만든 CSS 파일로 낸다.** Monti가 이미 그렇게 한다(16번 문서). 설계가 새로 정한 것은 이것을 릴리스의 증명에서 브라우저로 확인한다는 것이다. (레퍼런스: 사이트의 Tailwind가 라이브러리 안의 클래스를 찾게 하는 방식은 Tailwind 버전과 설정에 따라 깨진다.)
4. **릴리스는 새 사이트 증명, `publint`, `@arethetypeswrong/cli`를 지나야 나간다.** (레퍼런스: 공개 전 관문으로 흔히 쓰는 셋이다. 두 도구는 지금 묶음에 돌려 확인했다: 위 "릴리스의 관문".)
5. **새 Next 앱의 틀을 저장소에 둔다.** `create-next-app`을 CI에서 부르지 않는다.
6. **명령은 `monti init`이다. 새 앱을 만들어 주는 `create-…`는 두지 않는다.** Monti는 사이트 안에 사는 도구다. (레퍼런스: 사이트 안에 사는 도구(TinaCMS, Prisma, Better Auth)는 `init`을, 따로 서는 도구는 `create-…`를 앞세운다. Payload는 둘을 한 명령에 넣었고 있던 프로젝트에서 값들이 어긋난다는 불만이 있다.)
7. **`init`은 패키지를 설치하지 않고, 사이트의 파일을 옮기거나 고치지 않는다.** `next.config`, `tsconfig`, `dev` · `build` 스크립트에 넣을 것이 없다. (레퍼런스: Payload는 `next.config`와 `tsconfig`를 고치고, TinaCMS는 `dev` · `build` 스크립트를 감싸 불만을 산다. 페이지를 route group으로 옮기는 일은 Payload도 사람에게 맡긴다: 확인.)
8. **`init`은 다시 돌려도 덮어쓰지 않는다. `.env`는 건드리지 않고, 없는 값만 `.env.local`에 더한다.** (레퍼런스: Payload가 있던 `.env`를 덮어쓴다는 불만. Prisma의 `init`은 있으면 더하지 않고 다시 돌리면 덮어쓰기를 거절한다.)
9. **`init`의 물음은 넷이고, 모두 값이 있으며 `-y`가 있다.** 옛 `init`은 아홉을 물었다. 지금은 대부분 설정 화면이 가진다. (레퍼런스: 사람 없는 실행에서 물음이 멈춰 있는 것이 흔한 불만이다.)
10. **첫 계정은 15번 문서의 것이다. `init`은 계정을 만들지 않는다.** (레퍼런스: Payload와 Strapi도 사용자가 없으면 브라우저의 첫 화면이 첫 계정을 만든다. Monti의 15번이 같은 모양이라 둘째 길을 두지 않는다.)
11. **관리자 주소는 폴더가 정한다(16번 문서).** 다른 도구처럼 설정 값으로 두지 않는다. 16번에서 이미 정한 것이고, 화면에서 값을 바꿔도 폴더가 따라 움직이지 않기 때문이다.
12. **있던 글 알아보기는 14번 문서로 옮긴다.** 가져오기가 그 문서에 있다.
13. **`doctor`는 점검마다 한 줄, 표시, 틀린 것 옆에 고치는 명령, FAIL이면 1, `--json`이다. 스스로 고치지 않는다.** (레퍼런스: `expo doctor`, `flutter doctor`, `storybook doctor`가 이 모양이고, `--json`은 대개 없다. 고쳐 주는 것은 `react-native doctor`뿐이다. 데이터베이스에 붙어 안 따른 변경을 보고 1로 끝나는 것은 `prisma migrate status`와 같다.)
14. **`doctor`는 저장소에 쓰지 않는다.** 닿는지는 없는 키를 물어서 본다.
15. **S3 어댑터는 `Storage`를 그대로 지키고, 직접 올리기는 선택 기능이다.** 옛 어댑터는 따로 된 계약(임시 자리에 올리고 서버가 옮긴다)이었다. 지금은 키가 처음부터 서버의 것이고 치우기가 이미 있어서 옮길 것이 없다.
16. **직접 올린 파일은 서버가 저장소에서 직접 본 뒤에만 받아들인다.** (레퍼런스: 가장 흔한 구멍이 브라우저가 말한 크기와 종류를 믿는 것이다. Payload의 `clientUploads`가 그랬다는 보고가 있고, Strapi와 Directus의 문서도 저장 전에 서버가 저장소에 물으라고 한다.)
17. **첫 파일부터 직접 올리고, 서명된 주소에 아무것도 덧붙이지 않는다.** (레퍼런스: Payload에서 첫 올리기가 서버를 지나 작은 한도에 걸린 것과, 서명된 주소에 붙인 값이 서명을 깬 것이 보고되었다.)
18. **R2와 MinIO는 주소, 경로 방식, 지역 `auto`로 되고 ACL은 쓰지 않는다.** (레퍼런스: Cloudflare R2의 문서, 확인.)
19. **직접 올리기의 한도는 서버를 거친 길과 같은 10 MB다.** 큰 파일을 나눠 올리는 길(multipart)은 넣지 않는다.
20. **증명은 묶음을 HTTP 주소로 내주고 npm으로 설치한다. 된다고 말하는 것은 해 본 것뿐이다.** `file:` 주소로 설치하면 사람이 받는 모양과 다르다(#483 코드 리뷰).
21. **아이콘 패키지는 ui의 의존이고, 압축 파일의 `sideEffects`는 낸 파일을 가리킨다.** (#483 코드 리뷰.)
22. **패키지는 늘 같은 버전이고, 버전을 올리는 도구를 따로 들이지 않는다.** (레퍼런스: 한 번호로 묶는 것은 Payload, tRPC와 같다. Changesets를 쓰는 곳이 많지만 Payload는 제 스크립트를 쓴다.)

## 옛 코드

`9c69629f` 이전. 그대로 되살리지 않고, 아래만 읽고 가져온다.

- `packages/core/src/cli/doctor/`(`outcome.ts`, `format.ts`, `types.ts`): 점검 하나의 모양(`ok` · `warn` · `fail` · `skip`, 어디에서, 어떻게 고치나)과 찍는 모양.
- `packages/core/src/cli/doctor/database-checks.ts`, `secrets-checks.ts`, `config-checks.ts`: 닿는지, 안 따른 변경, 환경 파일이 어디서 왔는지 말하는 법.
- `packages/core/src/cli/init-detect.ts`: Next 버전, App Router, `src/`, 패키지 매니저를 알아보는 법.
- `packages/core/src/cli/init-env.ts`, `init-writer.ts`: `.env.local`에 없는 값만 더하기, 사이트 폴더 밖에는 쓰지 않기.
- `packages/core/src/cli/prompt.ts`: 물음과 취소.
- `packages/storage-s3/src/s3.ts`, `media-store.ts`: 환경 변수 이름, 빠진 값의 오류, 서명된 주소 만들기.

가져오지 않는 것: `init-install.ts`(설치), `init-edit.ts`(사이트 파일 고치기), `init-plan.ts`의 있던 글 알아보기, `next-app.ts`의 `withCms`, 옛 저장소 계약의 임시 자리와 옮기기.

## 끝 조건

- **20-1** 빌드한 패키지의 압축 파일마다 `exports`가 가리키는 파일이 모두 들어 있고, 소스와 테스트와 스토리는 없다. 버전이 서로 다르면 묶음을 만들지 않는다.
- **20-2** `--base`로 묶으면 묶음 안의 `@monti-cms/*` 줄이 모두 그 주소의 압축 파일을 가리키고, 없이 묶으면 버전 번호다.
- **20-3** 저장소 밖의 새 Next 16 앱이 묶음에서 npm으로 설치해 타입 검사와 `next build`를 지나고, `next start`에서 브라우저로 연 `/admin`에 관리자 화면이 제 스타일로 그려지고, 관리자 API가 답하고, 사이트의 첫 페이지는 제 모습 그대로다(`scripts/try-release.mjs`, CI).
- **20-4** `v*` 태그를 밀면 20-3을 지난 묶음이 GitHub 릴리스의 자산으로 올라간다. 태그와 패키지 버전이 다르면 멈춘다.
- **20-5** 새 Next 앱에서 `monti init --yes`를 돌리면 위 표의 파일이 생기고, 그 사이트가 타입 검사를 지나고, 데이터베이스가 있으면 `doctor`에 FAIL이 없다.
- **20-6** `init`은 있던 파일을 덮어쓰지 않고, `.env`를 건드리지 않고, `.env.local`의 있던 값을 바꾸지 않는다. 두 번째로 돌리면 아무것도 쓰지 않는다. 사람이 고친 Monti 파일은 고친 그대로 남는다. `--dry-run`은 아무것도 쓰지 않는다.
- **20-7** Next가 없거나 `pages/`뿐이거나 Monti 패키지가 빠진 폴더에서 `init`은 아무것도 쓰지 않고 까닭과 할 일을 말한다. 물음 도중에 취소해도 아무것도 쓰지 않는다.
- **20-8** `doctor`는 고장마다 그 점검의 이름으로 FAIL하고 고치는 법을 말한다: `MONTI_SECRET`이 없음, 데이터베이스에 닿지 않음, 안 따른 변경, 깨진 구조 파일, 닿지 않는 저장소, 디스크 없는 호스트의 로컬 폴더, 서로 다른 패키지 버전. FAIL이 있으면 1로 끝나고, `--json`이 같은 것을 낸다.
- **20-9** `doctor`는 `monti.config.ts`가 없거나 깨져 있어도 끝까지 돌고, 아무것도 쓰지 않고, 비밀 값을 찍지 않는다.
- **20-10** `s3Storage()`가 `Storage` 계약을 지킨다: 로컬 폴더 저장소와 같은 계약 테스트를 지난다. 빠진 값은 이름과 넣을 곳을 말한다.
- **20-11** 직접 올리는 저장소에서 표를 받아 올리고 알리면 `media.upload`가 항목을 만든다. 결과는 서버를 거친 길과 같다.
- **20-12** 직접 올린 파일이 말한 크기나 종류와 다르면 지우고 거절한다. 세션이 없으면 표를 주지 않는다. 알리지 않은 파일은 치워진다.
- **20-13** 직접 올리기를 하지 않는 저장소에서는 지금 길로 올라간다.
- **20-14** 묶음의 압축 파일이 모두 `publint`와 `@arethetypeswrong/cli`(ESM 풀이)를 지나고, 소스에 `"use client"`가 있던 파일은 낸 파일도 그 줄로 시작한다. 하나라도 아니면 릴리스가 멈춘다.
- **20-15** 맨 위 `app/layout.tsx`가 없는 사이트에서 `init`은 관리자의 레이아웃을 함께 쓰고, 있는 사이트에서는 쓰지 않고 남은 일에 옮기는 순서를 적는다. `doctor`가 그 사이트를 `site/layout` 경고로 말한다.
