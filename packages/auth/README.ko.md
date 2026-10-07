# @monti-cms/auth

[English](README.md) | 한국어

프레임워크 없이 쓰는 `@monti-cms/core`용 관리자 로그인. 코어의 `CmsAuth`를 표준 `Request`·`Response` 위에서 구현하고, [Auth.js core](https://authjs.dev)(`@auth/core`)를 바탕으로 하며, `next/*`에서 아무것도 가져오지 않는다. 로그인 방법은 **프로바이더**다. GitHub는 여기에 들어 있고, GitLab·Google·비밀번호 로그인은 코어를 건드리지 않고 프로바이더 패키지가 더한다.

## 설치

```sh
pnpm add @monti-cms/auth
```

Next.js 앱에서는 `monti init`이 설정해 준다. `@monti-cms/core`는 peer다.

## 사용

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	database: postgres(),
	auth: auth({ providers: [github()] }),
});
```

`github()`와 `postgres()`는 설정을 환경 변수에서 읽으므로 인자 없이 부르면 된다.

| 변수 | 읽는 곳 | 뜻 |
| --- | --- | --- |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | `github()` | GitHub OAuth 앱 |
| `MONTI_ADMIN_GITHUB_ID` | `github()` | 관리자. GitHub 숫자 ID 하나, 또는 쉼표로 구분한 여러 개 |
| `MONTI_SECRET` | `defineConfig` | 하나뿐인 비밀 값. 로그인 세션 키가 여기서 파생된다("비밀 값" 참고) |
| `DATABASE_URL`, `DATABASE_SCHEMA` | `postgres()` | 콘텐츠 DB |

값을 직접 넘기면 변수보다 우선한다(`github({ clientId, clientSecret, admins: ["12345678"] })`). 다른 이름에서 값을 짐작해 가져오지 않으며, 꼭 필요한 값이 없으면 변수 이름을 알려 주는 오류가 난다. GitHub 앱은 로그인 연결을 만들 때 확인하고, 개발용 우회(아래)에서는 로그인을 시도할 때만 확인하므로 `next dev`는 이 변수가 하나도 없어도 돈다.

GitHub OAuth 앱의 콜백 URL은 NextAuth 때와 같은 `<사이트>/api/cms/auth/callback/github`다.

### `auth(options)`

| 옵션 | 뜻 |
| --- | --- |
| `providers` | 로그인 방법. 로그인 버튼 순서가 된다. 하나 이상이어야 하고 id가 서로 달라야 한다 |
| `admins` | 프로바이더를 붙인 계정 ID(`"github:12345678"`)로 적은 관리자. 프로바이더에 적은 것(`github({ admins })`)도 같이 센다 |
| `devBypass` | 로컬 개발에서만. 이 컴퓨터에서 온 요청을 첫 번째 관리자로 본다. `next dev`에서는 기본으로 켜져 있고 `false`로 끈다("개발용 우회" 참고) |
| `basePath` | 로그인 API 경로. 기본 `/api/cms/auth`(관리자 API 라우트가 같이 처리한다. 코어 README의 "로그인 경로") |
| `host` | Next.js에서는 `@monti-cms/nextjs`가 붙여 주므로 필요 없다. 다른 프레임워크에서는 `{ requestHeaders, rethrow }`를 넘긴다. 붙여진 것보다 우선한다. `requestHeaders`가 없으면 `session()`에 요청을 넘겨야 하고 개발용 우회는 적용되지 않는다 |

`secret` 옵션은 없다. 세션 키는 `MONTI_SECRET`에서 나온다("비밀 값" 참고). 호스트 신뢰(`trustHost`, `AUTH_TRUST_HOST`, `AUTH_URL`)는 "호스트 신뢰"에 있다. 세션은 서명한 JWT 쿠키(8시간, 갱신형)라 따로 저장하는 것이 없다.

## 비밀 값

하나뿐인 비밀 값 `MONTI_SECRET`(`defineConfig`)이 설정해야 할 비밀 값의 전부다. 세션 쿠키 키(`cms.secrets("auth").deriveKey("session")`)와 각 플러그인의 암호화 키(AI 서비스 키, git-sync 토큰)가 모두 이 값에서 HKDF로 파생된다. `AUTH_SECRET`과 `CMS_SECRET`은 더 읽지 않고, `auth()`에도 `secret` 옵션이 없다. 값이 없으면 `MONTI_SECRET`을 짚는 오류와 함께 로그인이 실패한다. 값을 바꾸면 모두 로그아웃되며, 바꾸기 전 값을 `defineConfig`의 `previousSecrets`에 적어 두면 그 값으로 저장된 것을 계속 읽을 수 있다.

세션 키를 직접 만드는 로그인 연결도 같은 도구를 받는다. `AuthCreateContext`에 `secrets: PluginSecrets`(`cms.secrets("auth")`)가 있다.

## 호스트 신뢰

`trustHost`는 Auth.js가 콜백 URL을 `X-Forwarded-Host`·`X-Forwarded-Proto` 헤더로 만들어도 되는지 정한다. 다음 순서로 결정된다.

1. `trustHost` 옵션이 있으면 그것.
2. 환경 변수 `AUTH_TRUST_HOST`.
3. 알려진 프록시 플랫폼이 감지되면(Vercel, Netlify, Cloudflare Pages, Render, Railway, Fly.io, Cloud Run의 환경 변수: `VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`) 또는 개발·테스트에서는 **켬**.
4. 그 밖에 운영 환경에서는 **끔**.

직접 운영하는 프록시(nginx, 로드 밸런서)는 감지되지 않으므로 `trustHost: true` 또는 `AUTH_TRUST_HOST=true`를 둔다. 단 그 프록시가 `X-Forwarded-Host`를 덮어쓸 때만 둔다. 그렇지 않으면 클라이언트가 로그인 콜백을 만들 호스트를 고를 수 있다. `AUTH_URL`이 있으면 사이트의 출처를 그 값으로 고정한다.

## 개발용 우회

`next dev`(`NODE_ENV=development`)에서는 로그인 설정이 전혀 없어도 첫 번째 관리자로 로그인된다. 기본으로 켜져 있고, 다음을 모두 만족할 때만 적용된다. 요청이 이 컴퓨터(루프백 호스트)에서 왔고, 환경이 배포된 것처럼 보이지 않아야 한다(호스팅 플랫폼 변수나 공개 `AUTH_URL`이 없을 것). 운영 환경에서는 절대 적용되지 않는다. `auth({ devBypass: false })`로 끌 수 있고, 배포된 것처럼 보이는 프로세스에서 `devBypass: true`를 주면 시작을 거부한다. 이를 위한 환경 변수는 없다(`CMS_DEV_AUTH_BYPASS`는 없어졌다).

요청 헤더가 필요한데, Next.js 연동이 자동으로 붙여 주므로 설정 없이 동작한다. Next.js 밖에서 `host.requestHeaders`가 없으면 로그인이 요청을 볼 수 없어 우회가 적용되지 않으며, 경고가 그 사실을 알린다.

## 누가 관리자인가

계정에는 **프로바이더를 붙인 ID**가 있다. 프로바이더 id, 콜론, 프로바이더 안의 ID 순이다. GitHub는 숫자 ID라서 계정 이름을 바꿔도 `github:12345678`은 같은 사람이다. `isAdmin`과 `admins` 목록은 이 값을 비교한다.

- 프로바이더에 적는 항목은 그 안의 ID(`"12345678"`)나 프로바이더를 붙인 ID(`"github:12345678"`)다. 값이 없는 항목(설정하지 않은 환경 변수)은 건너뛴다. 어디에도 관리자가 없으면 아무도 관리자가 아니다.
- GitHub ID는 숫자로 비교한다(앞의 0은 무시). **로그인 이름**(`octocat`)은 받지 않는다. 이름은 바뀔 수 있고, 바뀐 뒤 다른 사람이 가져갈 수 있어서 경고만 남기고 무시한다.
- 두 프로바이더에 같은 ID가 있어도 다른 계정이다. `github:77`은 `gitlab:77`이 아니다.
- 프로바이더가 이름을 주지 않으면, 변경한 사람으로 이 ID가 기록된다.

## 프로바이더

```ts
interface LoginProvider {
	id: string; // "github": /callback/<id>, signIn(id)의 이름, 계정 ID의 앞부분
	name: string; // "GitHub"
	label: { en: string; [locale: string]: string }; // 버튼 글자. 바꾸려면 admin.messages["cms.auth"]["<id>.label"]
	icon?: string; // 버튼에 넣을 이미지 URL이나 data: URL
	admins?: readonly (string | undefined)[];
	setup(context: { storage(plugin: string): PluginStorage; trustHost: boolean }): AuthJsProvider; // Auth.js 프로바이더 설정
	account(signedIn: { user; account; profile? }): { id: string; name?: string } | null; // 계정 -> Monti 계정. null이면 로그인을 거절
	normalizeId?(id: string): string | null; // 비교용 표준 형태. null이면 이 프로바이더의 계정이 될 수 없는 값
}
```

`setup`은 인스턴스의 플러그인 저장소(`cms.storage(plugin)`)를 받으므로, 자기 사용자를 따로 두는 프로바이더도 둘 곳이 있다. `account`는 ID를 `account.providerAccountId`에서 가져온다(DB 어댑터가 없으면 Auth.js가 `user.id`를 무작위 값으로 바꾸기 때문이다).

### OAuth 프로바이더 더하기(GitLab, Google, ...)

OAuth 프로바이더는 Auth.js 프로바이더에 이름표를 붙인 것으로 20줄쯤이다. 프로바이더 패키지가 쓰는 GitLab은 이렇다.

```ts
import GitLab from "@auth/core/providers/gitlab";
import type { LoginProvider } from "@monti-cms/auth";

export const gitlab = (options: { clientId?: string; clientSecret?: string; admins?: string[] } = {}): LoginProvider => ({
	id: "gitlab",
	name: "GitLab",
	label: { en: "Sign in with GitLab" },
	...(options.admins ? { admins: options.admins } : {}),
	setup: () =>
		GitLab({
			clientId: options.clientId ?? process.env.AUTH_GITLAB_ID,
			clientSecret: options.clientSecret ?? process.env.AUTH_GITLAB_SECRET,
			profile: (profile) => ({ id: String(profile.id), name: profile.name }),
		}),
	account: ({ user, account }) => ({ id: account.providerAccountId, ...(user.name ? { name: user.name } : {}) }),
});
```

그다음 `providers: [github({ ... }), gitlab({ ... })]`로 쓴다. 로그인 화면에 프로바이더마다 버튼이 하나씩 생기고, 콜백은 `/api/cms/auth/callback/gitlab`, 관리자는 `gitlab:<id>`다. 이 패키지의 테스트가 이런 프로바이더를 가짜 서버로 등록해 본다.

### 비밀번호 프로바이더 더하기(계획만 있고 아직 만들지 않았다)

비밀번호 로그인은 사용자를 플러그인 저장소에 두는 credentials 프로바이더다. 그것을 위한 자리는 있고, 그 위에 올라갈 패키지는 아직 없다.

- **저장소의 사용자.** `setup({ storage })`가 다른 플러그인이 쓰는 것과 같은 플러그인별 저장소 `cms.storage(plugin)`를 받는다. 패키지가 자기 플러그인 이름으로 사용자 기록을 거기에 두고, `account()`가 사용자 키를 ID로 돌려준다(`password:<키>`).
- **해시와 횟수 제한.** Auth.js `Credentials` 프로바이더의 `authorize`에 둔다. 메모리를 많이 쓰는 해시(scrypt, argon2)로 비교하고, 실패 횟수를 같은 저장소에 세어 한도를 넘으면 거절한다.
- **아직 없는 것.** 로그인 화면에는 프로바이더마다 버튼만 있고 입력 칸이 없다. 그래서 지금은 `signIn`이 credentials 프로바이더를 거절한다("아직 지원하지 않음"). 지원하려면 로그인 화면에 입력 칸을 만들고, `signIn`이 보낸 값을 `/callback/<id>`로 넘겨야 한다. 이는 이 패키지가 아니라 비밀번호 패키지의 일이다.

이런 프로바이더의 컴파일 검사를 거친 예가 `src/__test__/providers.test.ts`에 있다.

## 로그인 흐름

로그인 화면이 코어에 일반 폼을 보낸다(`POST /api/cms/v1/session/sign-in/<id>`). 코어가 같은 출처인지 확인한 뒤 `signIn`을 부르고, `signIn`은 상태 쿠키를 실은 프로바이더 리다이렉트(`Response`, 그대로 돌려준다)로 답한다. 프로바이더가 브라우저를 `/api/cms/auth/callback/<id>`로 돌려보내면 Auth.js가 상태를 확인하고 세션 쿠키를 세팅하며, 브라우저는 관리자로 들어간다. 로그아웃도 같은 모양이다. 네트워크에서 오는 요청(`handlers`)은 Auth.js의 CSRF 검사를 그대로 거친다. 서버가 직접 하는 로그인·로그아웃 호출만, 코어의 출처 확인 뒤에 이 검사를 건너뛴다.

## `githubAuth`(NextAuth)에서 올리기

`@monti-cms/nextjs/auth`의 `githubAuth`는 없어졌다. 이렇게 바꾼다.

```diff
-import { githubAuth } from "@monti-cms/nextjs/auth";
+import { auth } from "@monti-cms/auth";
+import { github } from "@monti-cms/auth/github";
 ...
-auth: githubAuth({ clientId, clientSecret, adminIds: [id], devBypass, secret }),
+auth: auth({ providers: [github({ clientId, clientSecret, admins: [id] })] }),
```

- **관리자.** `adminIds`는 프로바이더의 `admins`, 또는 `MONTI_ADMIN_GITHUB_ID` 변수(전의 `CMS_ADMIN_GITHUB_ID`)가 된다. 여전히 GitHub 숫자 ID를 받으므로 바꿀 값은 없다. 로그인 이름은 처음부터 비교하지 않았다.
- **다시 로그인.** NextAuth가 만든 세션은 더 읽지 않는다(안의 계정 ID가 이제 `github:<id>`다). 그래서 모두 한 번 다시 로그인한다.
- **환경 변수.** `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`는 그대로 쓰고, OAuth 콜백 URL도 바뀌지 않는다. `AUTH_SECRET`은 `MONTI_SECRET`으로("비밀 값" 참고), `CMS_ADMIN_GITHUB_ID`는 `MONTI_ADMIN_GITHUB_ID`로 바뀌었고, `CMS_DEV_AUTH_BYPASS`는 없어졌다(우회는 `next dev`에서 켜진다). `package.json`에서 `next-auth`는 빼도 된다.
- **기록되는 작성자.** 이름이 없어 계정 ID가 변경 기록에 남는 곳은 전에 `12345678`이었고 이제 `github:12345678`이다.
