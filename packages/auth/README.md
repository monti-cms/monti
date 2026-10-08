# @monti-cms/auth

English | [한국어](README.ko.md)

Admin login for `@monti-cms/core` that needs no framework. It implements the core's `CmsAuth` on the standard `Request` and `Response`, over [Auth.js core](https://authjs.dev) (`@auth/core`), and imports nothing from `next/*`. The ways to log in are **providers**: GitHub and a built-in email and password login ship here, and GitLab or Google are added by a provider package without touching the core.

## Install

```sh
pnpm add @monti-cms/auth
```

`monti init` sets this up for a Next.js app. `@monti-cms/core` is a peer.

## Use

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

`github()` and `postgres()` read their settings from the environment, so the call needs no arguments:

| Variable | Read by | Meaning |
| --- | --- | --- |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | `github()` | The GitHub OAuth app |
| `MONTI_ADMIN_GITHUB_ID` | `github()` | The admin: one numeric GitHub id, or several separated by commas |
| `MONTI_SECRET` | `defineConfig` | The one secret; the login session key is derived from it (see "Secret") |
| `DATABASE_URL`, `DATABASE_SCHEMA` | `postgres()` | The content database |

An explicit value overrides the variable (`github({ clientId, clientSecret, admins: ["12345678"] })`). Nothing is guessed from other names, and a missing required value is an error that names the variable. The GitHub app is checked when the login connection is created; under the dev bypass (below) only when a sign-in is attempted, so `next dev` runs with none of them set.

The callback URL of the GitHub OAuth app is `<site>/api/cms/auth/callback/github`, as it was with NextAuth.

### Email and password: `password()`

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { password } from "@monti-cms/auth/password";

export const cms = defineConfig({
	schema,
	database: postgres(),
	auth: auth({ providers: [password()] }),
});
```

It needs no other service and no environment variable besides the ones every site has (`DATABASE_URL`, `MONTI_SECRET`). `monti init` writes it by default (`--login password`; `--login github` writes `github()` instead).

- **Accounts** live in the Monti database, in the plugin storage of the instance (plugin `auth`, collections `password-accounts` and `password-setup`), so `monti migrate` is all the setup there is. An account is an email (trimmed, lower case) and a password hash: scrypt from `node:crypto`, a random salt per account, the cost stored with the hash, compared in constant time; an unknown email takes as long to refuse as a wrong password. A password has at least 10 characters. No hashing dependency is added.
- **Every account is an admin** (`LoginProvider.everyAccountIsAdmin`): the account id is `password:<email>`, and a session is only made by a successful sign-in. No admin list is needed, and the "no admin is set" warning is not given for this provider.
- **The first admin** is created on the admin's login screen while no account exists: email, password, confirmation, then it signs you in. It is guarded on the server, not only in the UI: `POST /api/cms/v1/session/first-admin` calls `cms.auth().accounts.createFirst`, which refuses with `closed` as soon as any account exists, and one marker row written with `expectedVersion: 0` makes two simultaneous attempts safe (only one wins). There is no setup code. Right after deploying, open the admin and create it; or create it beforehand by running the app in production mode on your machine against the production database (under `next dev` you are the admin without signing in, so the screen does not show).
- **Sessions** are the same signed JWT cookie as for any provider (8 hours, rolling, key derived from `MONTI_SECRET`); Auth.js's `Credentials` provider needs the JWT strategy, which this package already uses.
- **Failed attempts are slowed down simply:** 5 failures for one email within a minute are followed by refusals for the rest of that minute (counted in the memory of the server process, so it is per instance, not shared between servers). It is a brake, not a full defence; use a long password.
- **A forgotten password** is replaced with `monti admin:reset-password [--email <email>]` (core). There is no mail. Sessions already signed in stay valid until they expire.
- `monti doctor` warns while no admin account exists (`auth/admin-accounts`).

`cms.auth().accounts` (`LoginAccounts` of `@monti-cms/core/server`) is how the screen, the route and the command reach the accounts: `hasAny()`, `createFirst({ email, password })`, `resetPassword({ email, password })`, each answering `{ ok: true }` or `{ ok: false, reason }`.

### `auth(options)`

| Option | Meaning |
| --- | --- |
| `providers` | The ways to log in, in the order of the login buttons. At least one; ids must differ |
| `admins` | Admins as qualified account ids (`"github:12345678"`). The ones on a provider (`github({ admins })`) count too |
| `devBypass` | Local development only: treat requests from this machine as the first admin. On by default under `next dev`; `false` turns it off (see "Dev bypass") |
| `basePath` | Login API path, default `/api/cms/auth` (served by the admin API route; see "Login path" in the core README) |
| `host` | Not needed in Next.js, where `@monti-cms/nextjs` attaches it. For other frameworks pass `{ requestHeaders, rethrow }`; it wins over the attached one. Without `requestHeaders`, `session()` needs the request passed in and the development bypass never applies |

There is no `secret` option: the session key comes from `MONTI_SECRET` (see "Secret"). Host trust (`trustHost`, `AUTH_TRUST_HOST`, `AUTH_URL`) is described under "Host trust". The session is a signed JWT cookie (8 hours, rolling), so nothing is stored for it.

## Secret

The one secret, `MONTI_SECRET` (`defineConfig`), is the only secret to set. The session cookie key is derived from it with HKDF (`cms.secrets("auth").deriveKey("session")`), and so is each plugin's encryption key (AI service keys, the git-sync token). Neither `AUTH_SECRET` nor `CMS_SECRET` is read any more, and `auth()` has no `secret` option. If it is missing, the login fails with an error that names `MONTI_SECRET`. Changing it signs everyone out; list the replaced value in `previousSecrets` of `defineConfig` to keep values stored under it readable.

`monti doctor` checks the login setup (`auth/*`): for the email and password login, that an admin account exists yet; for GitHub, the GitHub client id and secret, that an admin is listed (and calls out an entry that is a GitHub login, not a numeric id), `SITE_URL`, the result of host trust and why, and prints the callback URL to register in the OAuth app, derived from `SITE_URL`. A provider sets `usesCallbackUrl` when it needs a callback URL. When a person signs in with GitHub for the first time the server log says where GitHub will send the browser back, and a person who signs in but is not an admin is logged with the id to add.

A login connection that builds its own session key gets the same helper: `AuthCreateContext` has `secrets: PluginSecrets` (`cms.secrets("auth")`).

## Host trust

`trustHost` tells Auth.js whether it may build the callback URL from the `X-Forwarded-Host` and `X-Forwarded-Proto` headers. It is decided in this order:

1. The `trustHost` option, if given.
2. The `AUTH_TRUST_HOST` environment variable.
3. **On** when a known proxy platform is detected (an environment variable of Vercel, Netlify, Cloudflare Pages, Render, Railway, Fly.io or Cloud Run: `VERCEL`, `NETLIFY`, `CF_PAGES`, `RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `K_SERVICE`), or in development and tests.
4. Otherwise **off** in production.

A proxy you run yourself (nginx, a load balancer) is not detected: set `trustHost: true` or `AUTH_TRUST_HOST=true`, and only if that proxy overwrites `X-Forwarded-Host`. Otherwise a client could choose the host the login callback is built from. `AUTH_URL`, if set, pins the site's origin instead.

## Dev bypass

Under `next dev` (`NODE_ENV=development`) you are signed in as the first admin with no login settings at all. It is on by default and applies only when all of these hold: the request comes from this machine (a loopback host), and the environment does not look deployed (no hosting platform variables, no public `AUTH_URL`). It never applies in production. `auth({ devBypass: false })` turns it off; `devBypass: true` on a process that looks deployed refuses to start. There is no environment variable for it (`CMS_DEV_AUTH_BYPASS` is gone).

It needs the request headers, which the Next.js integration attaches automatically, so it works with no config. Outside Next.js, without `host.requestHeaders` the login cannot see the request and the bypass never applies; a warning says so.

## Who is an admin

An account has a **qualified id**: the provider id, a colon, and the id inside the provider. For GitHub it is the numeric GitHub id, so `github:12345678` stays the same person after a rename. `isAdmin` and the `admins` lists compare these.

- On a provider, an entry is an id inside it (`"12345678"`) or qualified (`"github:12345678"`). Unset entries (an unset environment variable) are skipped. With no admin anywhere, nobody is one.
- GitHub ids are compared as numbers (leading zeros do not matter). A **login** (`octocat`) is never accepted, because a login can be renamed and then taken by someone else; it is ignored with a warning.
- The same id under two providers is two different accounts: `github:77` is not `gitlab:77`.
- The id is also what is recorded as the author of a change when the provider gives no name.

## Providers

```ts
interface LoginProvider {
	id: string; // "github": the /callback/<id>, the signIn(id) name, and the prefix of account ids
	name: string; // "GitHub"
	label: { en: string; [locale: string]: string }; // button text; override: admin.messages["cms.auth"]["<id>.label"]
	icon?: string; // image URL or data: URL for the button
	everyAccountIsAdmin?: boolean; // every account of this provider is an admin (password())
	accounts?(context): LoginAccounts; // accounts kept in the database, for the first-admin screen and monti admin:reset-password
	admins?: readonly (string | undefined)[];
	setup(context: { storage(plugin: string): PluginStorage; trustHost: boolean }): AuthJsProvider; // the Auth.js provider config
	account(signedIn: { user; account; profile? }): { id: string; name?: string } | null; // account -> Monti account; null refuses the sign-in
	normalizeId?(id: string): string | null; // canonical id for comparing; null: never an account of this provider
}
```

`setup` gets the plugin storage of the instance (`cms.storage(plugin)`), so a provider that keeps its own users has a place for them. `account` takes the id from `account.providerAccountId` (Auth.js replaces `user.id` with a random value when there is no database adapter).

### Adding an OAuth provider (GitLab, Google, ...)

An OAuth provider is the Auth.js provider plus labels, about 20 lines. Here is GitLab as a provider package would write it:

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

Then `providers: [github({ ... }), gitlab({ ... })]`. The login page shows one button per provider, the callback is `/api/cms/auth/callback/gitlab`, and admins are `gitlab:<id>`. A test in this package registers such a provider against a fake server.

### Other credentials providers

`password()` is a credentials provider like any other. One written by a package of its own looks the same: a `LoginProvider` whose `setup` returns an Auth.js `Credentials` provider (with the `id` of the `LoginProvider`), whose users live in `context.storage(plugin)`, and whose `authorize` does the hashing and the rate limit. The login page shows an email and password form for any provider the core lists with `credentials: true`, and `signIn` forwards the posted `email` and `password` to `/callback/<id>`. A compile-checked example is in `src/__test__/providers.test.ts`.

## Sign-in flow

The login screen posts a plain form to the core (`POST /api/cms/v1/session/sign-in/<id>`). The core checks the same origin and calls `signIn`, which answers with a redirect to the provider that carries the state cookies (a `Response`, returned as it is). The provider sends the browser back to `/api/cms/auth/callback/<id>`, Auth.js checks the state and sets the session cookie, and the browser lands in the admin. Sign-out is the same shape. Requests that come from the network (`handlers`) keep Auth.js's CSRF check; only the server's own sign-in and sign-out calls skip it, after the core's origin check.

## Upgrading from `githubAuth` (NextAuth)

`githubAuth` of `@monti-cms/nextjs/auth` is gone. Replace it:

```diff
-import { githubAuth } from "@monti-cms/nextjs/auth";
+import { auth } from "@monti-cms/auth";
+import { github } from "@monti-cms/auth/github";
 ...
-auth: githubAuth({ clientId, clientSecret, adminIds: [id], devBypass, secret }),
+auth: auth({ providers: [github({ clientId, clientSecret, admins: [id] })] }),
```

- **Admins.** `adminIds` becomes `admins` on the provider, or the `MONTI_ADMIN_GITHUB_ID` variable (formerly `CMS_ADMIN_GITHUB_ID`). It still takes numeric GitHub ids; no value changes. Logins were never matched.
- **Sign-in again.** Sessions made by NextAuth are not read any more (the account id in them is `github:<id>` now), so everyone signs in once more.
- **Environment.** `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL` and `AUTH_TRUST_HOST` work as before, and the OAuth callback URL does not change. `AUTH_SECRET` is replaced by `MONTI_SECRET` (see "Secret"), `CMS_ADMIN_GITHUB_ID` by `MONTI_ADMIN_GITHUB_ID`, and `CMS_DEV_AUTH_BYPASS` is gone (the bypass is on under `next dev`). `next-auth` can be removed from `package.json`.
- **Recorded authors.** Where a change records an account id because there was no name (`12345678` before), it is now `github:12345678`.
