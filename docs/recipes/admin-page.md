# Add an admin page to a plugin

Goal: a "Post stats" item under Manage in the admin sidebar, opening a screen at `<admin path>/post-stats` that shows the published and draft counts from an API route of the plugin.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **A plugin has three sides**, each a lazy loader: `server` (routes, hooks, commands), `admin` (screens and providers) and `nav` (the sidebar item, plain JSON) ("Plugins" in the [core README](../../packages/core/README.md)).
2. **A route** is `{ pattern, module: { GET, POST, ... } }` under `/api/cms/`. Wrap each handler with `adminRoute(...)`: it checks the login and the same-origin rule, and hands you the instance (`cms`). Only `public: true` takes the check off, for webhooks that verify themselves.
3. **A page** is a client component in `defineAdminPlugin({ pages: { "<segment>": Component } })`. The `nav` item's `path` is the same segment.
4. **Screen building blocks**: `AdminShell` (the frame with the sidebar and the title) and the rest of `@monti-cms/admin/kit`; `cmsFetch` (`@monti-cms/admin/api`) for the call, with a readable error; `cmsApiUrl` and `useSite` from `@monti-cms/core/client`.

## A sketch

The plugin:

```ts
import { definePlugin } from "@monti-cms/core";

export const postStats = () =>
	definePlugin({
		name: "post-stats",
		options: {},
		nav: [{ path: "post-stats", label: "Post stats", icon: "bar-chart-3" }],
		server: () => import("./server"),
		admin: () => import("./admin"),
	});
```

The route (`GET /api/cms/v1/post-stats/summary`):

```ts
import type { CmsServerPlugin } from "@monti-cms/core";
import { adminRoute, json } from "@monti-cms/core/plugin/server";

const server: CmsServerPlugin = {
	routes: [
		{
			pattern: "v1/post-stats/summary",
			module: {
				GET: adminRoute(async ({ cms }) => {
					const count = async (status: "draft" | "published") =>
						(await cms.store().listEntries({ collection: "post", statuses: [status], pageSize: 25 })).total;
					return json({ draft: await count("draft"), published: await count("published") });
				}),
			},
		},
	],
};

export default server;
```

The admin side and the screen:

```tsx
"use client";

import { cmsFetch } from "@monti-cms/admin/api";
import { AdminShell } from "@monti-cms/admin/kit";
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { cmsApiUrl, useSite } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";

function StatsPage() {
	const site = useSite();
	const stats = useQuery({
		queryKey: ["cms", "post-stats"],
		queryFn: ({ signal }) =>
			cmsFetch<{ draft: number; published: number }>(site, cmsApiUrl("/v1/post-stats/summary"), { signal }),
	});
	return (
		<AdminShell title="Post stats" sidebar={{ activeNav: "post-stats" }}>
			{stats.isPending && <p>Loading…</p>}
			{stats.isError && <p role="alert">{stats.error.message}</p>}
			{stats.data && (
				<p>
					{stats.data.published} published, {stats.data.draft} drafts
				</p>
			)}
		</AdminShell>
	);
}

// the admin module (default export of `./admin`)
export default defineAdminPlugin({ pages: { "post-stats": StatsPage } });
```

In `monti.config.ts`: `plugins: [postStats()]`.

## How it behaves

- The route is served through `cms.handle(request)` (the Next route handler calls it), so it is at `/api/cms/v1/post-stats/summary`. A request without a session gets `401`.
- A failed call shows the admin's own error text (`You don't have permission.` for a `403`).
- To test the route, build a server with `testServer()` from `@monti-cms/core/testing` and call `cms.handle(request)`.
