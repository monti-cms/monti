# @monti-cms/nextjs

English | [한국어](README.ko.md)

The Next.js adapter of Monti. It holds everything Next-specific, so `@monti-cms/core` and `@monti-cms/admin` stay free of `next/*`:

- the route handler of the admin API (`createRouteHandler`),
- the `next.config.ts` wiring (`withCms`),
- the admin page and layout, with the App Router adapter the admin needs (`CmsAdminLayout`, `CmsAdminPage`, `NextAdminRouter`),
- the NextAuth admin login (`githubAuth`).

Next.js (App Router) is the only supported host for now; see "Supported frameworks" in the `@monti-cms/core` README. Another framework would be another package like this one.

## Install

```sh
pnpm add @monti-cms/core @monti-cms/admin @monti-cms/nextjs next-auth@5.0.0-beta.32
```

`monti init` (in `@monti-cms/core`) writes the files below for you. `next` and `react` are peers; `next-auth` is only needed for GitHub login.

## Entry points

| Entry point | Used in | Contents |
| --- | --- | --- |
| `@monti-cms/nextjs` | `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`, the `CmsRouteHandler` type |
| `@monti-cms/nextjs/config` | `next.config.ts` | `withCms(nextConfig)` |
| `@monti-cms/nextjs/admin` | admin route files | `CmsAdminLayout`, `CmsAdminPage`, `CmsAdminPageProps`, `cmsAdminMetadata(cms)`, `NextAdminRouter` |
| `@monti-cms/nextjs/auth` | `cms.server.ts` | `githubAuth(options)` |

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

### GitHub login

```ts
// cms.server.ts
import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { githubAuth } from "@monti-cms/nextjs/auth";

export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL }),
		auth: githubAuth({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
			secret: process.env.AUTH_SECRET,
		}),
	}),
});
```

The options, the login path, host trust and the development bypass are described in the core README ("Server config", "Login path", "Host trust", "Login bypass for development"). NextAuth (`next-auth`) is loaded the first time login is used, so code that only reads content, and command-line tools, never load it. The connection supplies the two things the core asks of a host: the headers of the current request (from `next/headers`) and a way to let NextAuth's redirects reach Next.

## Upgrading

See "Upgrading to `@monti-cms/nextjs`" in the `@monti-cms/core` README for the import changes from `@monti-cms/core/next`, `@monti-cms/core/server` and `@monti-cms/admin/next`.
