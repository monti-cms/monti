# @monti-cms/nextjs

English | [한국어](README.ko.md)

The Next.js adapter of Monti. It holds everything Next-specific, so `@monti-cms/core` and `@monti-cms/admin` stay free of `next/*`:

- the route handler of the admin API (`createRouteHandler`),
- the `next.config.ts` wiring (`withCms`),
- the admin page and layout, with the App Router adapter the admin needs (`CmsAdminLayout`, `CmsAdminPage`, `NextAdminRouter`),
- the Next.js side of the admin login (`@monti-cms/auth`): the request headers, attached to the instance by the route handler, layout and page,
- a development warning when a client component imports the server-only config (`checkImportBoundaryInDev`, run by `withCms`).

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
| `@monti-cms/nextjs/auth` | (attached for you by the route handler and the admin) | `nextHost` |

### Route handler

```ts
// app/api/cms/[...path]/route.ts
import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from "@/monti.config";

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

It links no config file (the one config is `monti.config.ts`, which exports the `cms` instance, and the admin gets the site from that instance). It builds the core package with the app, and passes Next's `basePath` to the server and browser bundles. That is all it adds to your config, and the server prints it in its startup summary (remove `withCms` to undo it; add `transpilePackages: ["@monti-cms/core"]` yourself then). It writes no stand-in files: an optional package that is missing (`recharts` for `chart()`) is the bundler's own "module not found" error. Under `next dev` it also warns once per server start when a `"use client"` file imports the server-only config (see "Files").

### Admin page and layout

```tsx
// app/admin/layout.tsx
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from "@/monti.config";

export const generateMetadata = () => cmsAdminMetadata(cms);

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}

// app/admin/[[...path]]/page.tsx
import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from "@/monti.config";

// Only with `cacheComponents: true` (Next fails the build on it otherwise). A segment setting is written here, it cannot be re-exported:
// the admin is a per-request app, so Next's instant navigation validation skips it.
export const instant = false;

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
```

`CmsAdminLayout` takes the props of the admin layout (`themeProvider`, `themeStorageKey`, `toaster`; see the `@monti-cms/admin` README) and renders it inside `NextAdminRouter`.

**Cache Components.** The admin works with and without Next's `cacheComponents` (and `partialPrefetching`), which `create-next-app` turns on in new apps. `CmsAdminLayout` waits for the request (`connection()`) inside a `Suspense` boundary with no fallback, so nothing below it is prerendered: the session, the database, the current time and the URL are all request-time data. The page is a child of that boundary and needs none of its own. With `cacheComponents` on, add `export const instant = false` to the page (`monti init` does when `next.config` has `cacheComponents: true`): it keeps the development-only instant validation of Next 16.4 from checking a route that is never instant, and without it the dev overlay reports that the validation could not render the admin. Next fails the build on that export when `cacheComponents` is off, so leave it out then. The admin theme provider sets a class and `color-scheme` on `<html>` before React hydrates, so the root layout needs `suppressHydrationWarning` on its `<html>` tag (`monti init` adds it).

`NextAdminRouter` is the App Router adapter of the admin: a client component that gives `@monti-cms/admin` a `Link`, `navigate`, `replace`, `usePathname` and `useSearchParams` built on `next/link` and `next/navigation`. `CmsAdminPage` gives the admin's server screens Next's `redirect` and `notFound`. The admin itself imports nothing from Next.

### Login

```ts
// monti.config.ts
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	database: postgres(), // DATABASE_URL, DATABASE_SCHEMA
	auth: auth({ providers: [github()] }), // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
});
```

The environment variables, the one secret (`MONTI_SECRET`), host trust and the development bypass (on under `next dev`) are described in the `@monti-cms/auth` README. The login itself is `@monti-cms/auth` (Auth.js core on `Request` and `Response`, with the ways to log in as providers), and it imports nothing from Next. This package supplies the one thing the login asks of a Next host, the headers of the current request (read from `next/headers` when asked, so code that only reads content, and command-line tools, never load it). The route handler, the admin layout and the admin page attach it to the instance automatically (`cms.attachHost(nextHost)`), so the development bypass and sessions work with no config, and the three files below are unchanged. `nextHost` is still exported by `@monti-cms/nextjs/auth`, but sites do not need it.

## Files

The admin needs three files in the app (`monti init` writes them), whatever the admin path:

| File | Contents |
| --- | --- |
| `app/<admin path>/layout.tsx` | `CmsAdminLayout` and `generateMetadata` (`cmsAdminMetadata`); the admin's stylesheet imports |
| `app/<admin path>/[[...path]]/page.tsx` | `CmsAdminPage` |
| `app/api/cms/[...path]/route.ts` | `createRouteHandler(cms)`: the admin API, the login and the plugin routes |

There is no route group and no other admin file: custom admin components are a plugin with an admin side (see "Adding site components" in the `@monti-cms/admin` README). All three import `cms` from `monti.config.ts`.

**Why the layout is not folded into the page.** Next remounts the subtree of a dynamic segment (`[[...path]]`) when its value changes. A layout written inside the page would remount the whole admin (navigation, query cache, theme provider) on every screen change, so the layout stays one level above, where it keeps its state while you move between screens.

**Server only.** `monti.config.ts` holds the database and login settings, so it must never reach the browser: loading it there throws. `monti doctor` reports every `"use client"` file whose import chain reaches it (`monti doctor --only config/boundary` runs just that, for CI), and `withCms` warns about the same once per `next dev` start (`checkImportBoundaryInDev`). A Next file that gets no instance (a wrong import of `cms`) fails with a message that says which file and how to import it; `monti doctor` also checks that the three Next files exist at the admin path and that `next.config` uses `withCms`. The admin gets a JSON snapshot of the site from its layout, so it never needs the config in the browser.

## Preview pages

A site page that shows drafts (`site.previewPath`, for example `/preview/ko/posts/<slug>`) reads them with `previewEntry(cms, { collection, slug, locale })` from `@monti-cms/nextjs`, not with `cms.read.getPreview` directly. It attaches the request headers to the instance first, so the admin session (or the dev bypass under `next dev`) is read even when the preview is the first request after a cold start, or the only thing a serverless instance has served. It returns `null` for anyone who is not the admin, so the page answers 404. `examples/blog` has such a page.

## Status codes and the login settings

**404 and 308.** Monti ships no `proxy.ts`. A page calls `notFound()` and `permanentRedirect()` like any Next page. With `cacheComponents` off that is a real `404` and `308`. With it on, Next has already sent the page's shell with a `200`, so an unknown post is a page marked `noindex` and an old address is a redirect in the browser; search engines may read that as a soft 404. If you need strict statuses, the [strict status recipe](../../docs/recipes/strict-status.md) is a short `proxy.ts` and a tested function.

**Production without the login settings.** If `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` or `MONTI_SECRET` is missing, the admin layout shows a "Not set up yet" screen that points to `monti doctor` and logs the full problem once, instead of Next's error page (which hides the message in production). It is the admin, not a public page, so the status is whatever Next sends (a `200` under Cache Components). Under `next dev` the development login is used and nothing is shown.

## Upgrading

For the move from NextAuth to `@monti-cms/auth` (`githubAuth` is gone; everyone signs in once more), see "Upgrading to `@monti-cms/auth`" in the `@monti-cms/core` README.

See "Upgrading to `@monti-cms/nextjs`" in the `@monti-cms/core` README for the import changes from `@monti-cms/core/next`, `@monti-cms/core/server` and `@monti-cms/admin/next`.
