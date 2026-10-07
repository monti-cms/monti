# @monti-cms/nextjs

English | [한국어](README.ko.md)

The Next.js adapter of Monti. It holds everything Next-specific, so `@monti-cms/core` and `@monti-cms/admin` stay free of `next/*`:

- the route handler of the admin API (`createRouteHandler`),
- the `next.config.ts` wiring (`withCms`),
- the admin page and layout, with the App Router adapter the admin needs (`CmsAdminLayout`, `CmsAdminPage`, `NextAdminRouter`),
- `nextHost`, the Next.js side of the admin login (`@monti-cms/auth`).

Next.js (App Router) is the only supported host for now; see "Supported frameworks" in the `@monti-cms/core` README. Another framework would be another package like this one.

## Install

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/auth @monti-cms/nextjs
```

`monti init` (in `@monti-cms/core`) writes the files below for you. `next` and `react` are peers.

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`, the `CmsRouteHandler` type |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms(nextConfig)` |
| `@monti-cms/nextjs/admin` | admin route files | `CmsAdminLayout`, `CmsAdminPage`, `CmsAdminPageProps`, `cmsAdminMetadata(cms)`, `NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `cms.server.ts` | `nextHost`, `githubAuth(options)` (deprecated) |

### Route handler

```ts
// app/api/cms/[...path]/route.ts
import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "../../../../cms.server";

export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
```

It passes the request and the path segments Next already split on to `cms.handle(request)`. This one route serves the admin API (`/api/cms/v1/*`), the login (`/api/cms/auth/*`) and the plugin routes.

### `next.config.ts`

```ts
import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig);
```

It links no config file (the site config goes to `createCms` in `cms.server.ts`, and the admin gets it from that instance). It builds the core package with the app, passes Next's `basePath` to the server and browser bundles, and links an empty module for optional dependencies of the CMS packages that are not installed (see "Optional dependencies" in the core README).

### Admin page and layout

```tsx
// app/(admin)/admin/layout.tsx
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "../../../cms.server";

export const generateMetadata = () => cmsAdminMetadata(cms);

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}

// app/(admin)/admin/[[...path]]/page.tsx
import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "../../../../cms.server";

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
```

`CmsAdminLayout` takes the props of the admin layout (`themeProvider`, `themeStorageKey`, `toaster`; see the `@monti-cms/admin` README) and renders it inside `NextAdminRouter`.

`NextAdminRouter` is the App Router adapter of the admin: a client component that gives `@monti-cms/admin` a `Link`, `navigate`, `replace`, `usePathname` and `useSearchParams` built on `next/link` and `next/navigation`. `CmsAdminPage` gives the admin's server screens Next's `redirect` and `notFound`. The admin itself imports nothing from Next.

### Login

```ts
// cms.server.ts
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { nextHost } from "@monti-cms/nextjs/auth";

export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		auth: auth({
			providers: [
				github({
					clientId: process.env.AUTH_GITHUB_ID,
					clientSecret: process.env.AUTH_GITHUB_SECRET,
					admins: [process.env.CMS_ADMIN_GITHUB_ID],
				}),
			],
			host: nextHost,
			secret: process.env.AUTH_SECRET,
		}),
	}),
});
```

The options, the login path, host trust and the development bypass are described in the core README ("Server config", "Login path", "Host trust", "Login bypass for development"). The login itself is `@monti-cms/auth` (Auth.js core on `Request` and `Response`, with the ways to log in as providers; see its README), and it imports nothing from Next. This package supplies the one thing the core asks of a Next host: `nextHost`, the headers of the current request (read from `next/headers` when asked, so code that only reads content, and command-line tools, never load it). Nothing has to reach Next as a thrown redirect any more, so there is no `rethrow`.

`githubAuth(options)` is the previous one-call GitHub login (`clientId`, `clientSecret`, `adminIds`, `devBypass`, `basePath`, `secret`). It still works and calls `auth({ providers: [github(...)], host: nextHost })`, but is deprecated.

## Upgrading

For the move from NextAuth to `@monti-cms/auth` (what changes for the owner: nothing to edit, everyone signs in once more), see "Upgrading to `@monti-cms/auth`" in the `@monti-cms/core` README.

See "Upgrading to `@monti-cms/nextjs`" in the `@monti-cms/core` README for the import changes from `@monti-cms/core/next`, `@monti-cms/core/server` and `@monti-cms/admin/next`.
