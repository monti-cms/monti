# @monti-cms/auth

English | [한국어](README.ko.md)

Admin login for `@monti-cms/core` that needs no framework. It implements the core's `CmsAuth` on the standard `Request` and `Response`, over [Auth.js core](https://authjs.dev) (`@auth/core`), and imports nothing from `next/*`. The ways to log in are **providers**: GitHub ships here, and GitLab, Google or a password login are added by a provider package without touching the core.

## Install

```sh
pnpm add @monti-cms/auth
```

`monti init` sets this up for a Next.js app. `@monti-cms/core` is a peer.

## Use

```ts
// cms.server.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { nextHost } from "@monti-cms/nextjs/auth"; // only in a Next.js app
import config from "./cms.config";

export const cms = createCms({
	config,
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		auth: auth({
			providers: [
				github({
					clientId: process.env.AUTH_GITHUB_ID,
					clientSecret: process.env.AUTH_GITHUB_SECRET,
					admins: [process.env.CMS_ADMIN_GITHUB_ID], // numeric GitHub id
				}),
			],
			host: nextHost,
			devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
			secret: process.env.AUTH_SECRET,
		}),
	}),
});
```

The callback URL of the GitHub OAuth app is `<site>/api/cms/auth/callback/github`, as it was with NextAuth.

### `auth(options)`

| Option | Meaning |
| --- | --- |
| `providers` | The ways to log in, in the order of the login buttons. At least one; ids must differ |
| `admins` | Admins as qualified account ids (`"github:12345678"`). The ones on a provider (`github({ admins })`) count too |
| `secret` | Signs the login session cookie. If unset, the `AUTH_SECRET` environment variable. Separate from the server config `secret`, which encrypts stored values |
| `devBypass` | Local development only: treat requests from this machine as the first admin. Same limits as before (`NODE_ENV=development`, not a deployed server, a loopback request; see "Login bypass for development" in the core README) |
| `basePath` | Login API path, default `/api/cms/auth` (served by the admin API route; see "Login path" in the core README) |
| `host` | What the host framework supplies: `requestHeaders()` (the headers of the request being handled) and `rethrow(error)`. `nextHost` of `@monti-cms/nextjs/auth` is the Next.js one. Without `requestHeaders`, `session()` needs the request passed in and the development bypass never applies |

Host trust (`trustHost`, `AUTH_TRUST_HOST`, `AUTH_URL`) works as described in "Host trust" in the core README. The session is a signed JWT cookie (8 hours, rolling), so nothing is stored for it.

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

### Adding a password provider (planned, not built)

A password login is a credentials provider whose users live in plugin storage. The seams for it exist; the package that builds on them does not:

- **Users in storage.** `setup({ storage })` receives `cms.storage(plugin)`, the same per-plugin store other plugins use. The package keeps user records there under its own plugin name, and `account()` returns the user key as the id (`password:<key>`).
- **Hashing and rate limits.** They belong in the Auth.js `Credentials` provider's `authorize`: hash with a memory-hard function (scrypt or argon2) and keep failed-attempt counters in the same storage, refusing after a limit.
- **Still missing.** The login page has a button per provider and no form, so `signIn` refuses a credentials provider today ("not supported yet"). Supporting it means a form on the login page, and `signIn` forwarding the posted fields to `/callback/<id>`. That is the work of the password package, not this one.

A compile-checked example of such a provider is in `src/__test__/providers.test.ts`.

## Sign-in flow

The login screen posts a plain form to the core (`POST /api/cms/v1/session/sign-in/<id>`). The core checks the same origin and calls `signIn`, which answers with a redirect to the provider that carries the state cookies (a `Response`, returned as it is). The provider sends the browser back to `/api/cms/auth/callback/<id>`, Auth.js checks the state and sets the session cookie, and the browser lands in the admin. Sign-out is the same shape. Requests that come from the network (`handlers`) keep Auth.js's CSRF check; only the server's own sign-in and sign-out calls skip it, after the core's origin check.

## Upgrading from `githubAuth` (NextAuth)

`githubAuth` of `@monti-cms/nextjs/auth` still works with the same options (it now calls this package), so an existing `cms.server.ts` keeps running once `@monti-cms/auth` is installed with `@monti-cms/nextjs`. It is deprecated; move to `auth({ providers: [github(...)] })` when convenient:

```diff
-import { githubAuth } from "@monti-cms/nextjs/auth";
+import { auth } from "@monti-cms/auth";
+import { github } from "@monti-cms/auth/github";
+import { nextHost } from "@monti-cms/nextjs/auth";
 ...
-auth: githubAuth({ clientId, clientSecret, adminIds: [id], devBypass, secret }),
+auth: auth({ providers: [github({ clientId, clientSecret, admins: [id] })], host: nextHost, devBypass, secret }),
```

- **Admins.** The old option listed numeric GitHub ids (`CMS_ADMIN_GITHUB_ID`), and that is still what `admins` takes; no value changes. Logins were never matched.
- **Sign-in again.** Sessions made by NextAuth are not read any more (the account id in them is `github:<id>` now), so everyone signs in once more.
- **No new environment variables.** `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `AUTH_URL` and `AUTH_TRUST_HOST` work as before, and the OAuth callback URL does not change. `next-auth` can be removed from `package.json`.
- **Recorded authors.** Where a change records an account id because there was no name (`12345678` before), it is now `github:12345678`.
