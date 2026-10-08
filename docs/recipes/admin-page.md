# Add an admin page to a plugin

Goal: a "Post stats" item under Manage in the admin sidebar, opening a screen at `<admin path>/post-stats` that shows the published and draft counts from an API route of the plugin.

Code: [`examples/recipes/src/admin-page`](../../examples/recipes/src/admin-page). Tests: `admin-page.server.test.ts` (the route, with and without a login) and `admin-page.test.tsx` (the screen).

## What you need to know

1. **A plugin has three sides**, each a lazy loader: `server` (routes, hooks, commands, checks), `admin` (screens and providers) and `nav` (the sidebar item, plain JSON) ("Plugins" in the [core README](../../packages/core/README.md)).
2. **A route** is `{ pattern, module: { GET, POST, ... } }` under `/api/cms/`. Wrap each handler with `adminRoute(...)`: it checks the login and the same-origin rule, and hands you the instance (`cms`). Only `public: true` takes the check off, for webhooks that verify themselves.
3. **A page** is a client component in `defineAdminPlugin({ pages: { "<segment>": Component } })`. The `nav` item's `path` is the same segment.
4. **Screen building blocks**: `AdminShell` (the frame with the sidebar and the title) and the rest of `@monti-cms/admin/kit`; `cmsFetch` (`@monti-cms/admin/api`) for the call, with a readable error; `cmsApiUrl` and `useSite` from `@monti-cms/core/client`.

## The code

The plugin:

<!-- source: examples/recipes/src/admin-page/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

/**
 * A screen of your own in the admin, with its own API: `plugins: [postStats()]`. `nav` adds the sidebar item under "Manage" (the path is one segment after the
 * admin path, and has to match a key of `pages` in the admin module).
 */
export const postStats = () =>
	definePlugin({
		name: "post-stats",
		options: {},
		nav: [{ path: "post-stats", label: "Post stats", icon: "bar-chart-3" }],
		server: () => import("./server"),
		admin: () => import("./admin"),
	});
```

The route:

<!-- source: examples/recipes/src/admin-page/server.ts -->
```ts
import type { CmsServerPlugin } from "@monti-cms/core";
import { adminRoute, json } from "@monti-cms/core/plugin/server";

export interface PostStats {
	readonly draft: number;
	readonly published: number;
}

/**
 * The API of the plugin: `GET /api/cms/v1/post-stats/summary`. `adminRoute` wraps the handler with the login check and the same-origin check, so a route
 * that forgets authentication does not exist; only `public: true` takes it off. The handler gets the instance that serves it (`cms`).
 */
const server: CmsServerPlugin = {
	routes: [
		{
			pattern: "v1/post-stats/summary",
			module: {
				GET: adminRoute(async ({ cms }) => {
					const count = async (status: "draft" | "published") =>
						(await cms.store().listEntries({ collection: "post", statuses: [status], pageSize: 25 })).total;
					return json({ draft: await count("draft"), published: await count("published") } satisfies PostStats);
				}),
			},
		},
	],
};

export default server;
```

The admin side and the screen:

<!-- source: examples/recipes/src/admin-page/admin.ts -->
```ts
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { StatsPage } from "./stats-page";

/** The admin side: `pages` maps a path segment after the admin path to a client component. */
export default defineAdminPlugin({ pages: { "post-stats": StatsPage } });
```

<!-- source: examples/recipes/src/admin-page/stats-page.tsx -->
```tsx
"use client";

import { cmsFetch } from "@monti-cms/admin/api";
import { AdminShell } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import type { PostStats } from "./server";

/** The content of the screen, without the frame, so it can be shown (and tested) on its own. */
export function StatsView() {
	const site = useSite();
	const stats = useQuery({
		queryKey: ["cms", "post-stats"],
		queryFn: ({ signal }) => cmsFetch<PostStats>(site, cmsApiUrl("/v1/post-stats/summary"), { signal }),
	});
	if (stats.isPending) return <p>Loading…</p>;
	if (stats.isError) return <p role="alert">{stats.error.message}</p>;
	return (
		<dl className="grid grid-cols-2 gap-4 p-4">
			<dt>Published</dt>
			<dd>{stats.data.published}</dd>
			<dt>Drafts</dt>
			<dd>{stats.data.draft}</dd>
		</dl>
	);
}

/** The screen at `<admin path>/post-stats`: the frame of the admin (sidebar, title) around the content. The admin checks the login before it renders this. */
export function StatsPage() {
	return (
		<AdminShell title="Post stats" sidebar={{ activeNav: "post-stats" }}>
			<StatsView />
		</AdminShell>
	);
}
```

In `monti.config.ts`: `plugins: [postStats()]`.

## How it behaves

- The route is served through `cms.handle(request)` (the Next route handler calls it), so it is at `/api/cms/v1/post-stats/summary`. The server test calls it with a signed-in admin and gets the counts; with a login that has no session it gets `401`.
- The screen is split into `StatsPage` (the frame) and `StatsView` (the content). The frame needs the router and the sidebar of the admin, so the test renders the content with a `SiteProvider` and a query client and a stubbed `fetch`.
- A failed call shows the admin's own error text (`You don't have permission.` for a `403`).

## Found while writing it

- `AdminShell`, `cmsFetch` and the route helpers (`adminRoute`, `json`) were learned from the git-sync plugin's source. They are named in the READMEs now.
- `cmsFetch(site, url)` takes the site only for its fallback error text. Not changed (it would break callers); listed in the pull request.
