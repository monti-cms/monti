# Add an admin page to a plugin

Goal: a "Post stats" item in the Tools group of the admin sidebar, opening a screen at `<admin path>/tools/post-stats` that shows the published and draft counts from an API route of the plugin.

The snippets below are a sketch to adapt, not tested code.

## What you need to know

1. **A plugin has three sides**, each a lazy loader: `server` (routes, hooks, commands), `admin` (screens and providers) and `nav` (the Tools page, plain JSON) ("Plugins" in the [core README](../../packages/core/README.md)).
2. **A route** is `{ pattern, module: { GET, POST, ... } }` under `/api/monti/`. Wrap each handler with `adminRoute(...)`: it checks the login and the same-origin rule, and hands you the instance (`cms`). A route that must be reachable without login names an `access` kind instead of the default `admin`: `public-read` (GET only), `same-origin-form`, `signed` (a webhook that verifies its signature itself) or `admin-or-bearer`.
3. **A page** is a client component in `defineAdminPlugin({ pages: { "<segment>": Component } })`. The `nav` item's `path` is the same segment: the page shows as an item of the sidebar's Tools group.
4. **Screen building blocks**: `PageActions` (puts the page's one primary action on the right of the title bar; the admin already draws the sidebar and the title) and the rest of `@monti-cms/admin/kit`; `adminFetch` (`@monti-cms/admin/api`) for the call, with a readable error; `adminApiUrl` and `useSite` from `@monti-cms/core/site`.

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

The route (`GET /api/monti/v1/post-stats/summary`):

```ts
import { adminRoute, defineServerPlugin, ok } from "@monti-cms/core/server";

export default defineServerPlugin({
	routes: [
		{
			pattern: "v1/post-stats/summary",
			module: {
				GET: adminRoute(async ({ cms }) => {
					const count = async (status: "draft" | "published") =>
						(await cms.store().listEntries({ collection: "post", statuses: [status], pageSize: 25 })).total;
					return ok({ draft: await count("draft"), published: await count("published") });
				}),
			},
		},
	],
});
```

The admin side and the screen:

```tsx
"use client";

import { adminFetch } from "@monti-cms/admin/api";
import { defineAdminPlugin } from "@monti-cms/admin";
import { adminApiUrl, useSite } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";

function StatsPage() {
	const site = useSite();
	const stats = useQuery({
		queryKey: ["cms", "post-stats"],
		queryFn: ({ signal }) =>
			adminFetch<{ draft: number; published: number }>(site, adminApiUrl("/v1/post-stats/summary"), { signal }),
	});
	return (
		<div>
			{stats.isPending && <p>Loading…</p>}
			{stats.isError && <p role="alert">{stats.error.message}</p>}
			{stats.data && (
				<p>
					{stats.data.published} published, {stats.data.draft} drafts
				</p>
			)}
		</div>
	);
}

// the admin module (default export of `./admin`)
export default defineAdminPlugin({ pages: { "post-stats": StatsPage } });
```

In `monti.config.ts`: `plugins: [postStats()]`.

## How it behaves

- The route is served through `cms.handle(request)` (the Next route handler calls it), so it is at `/api/monti/v1/post-stats/summary`. A request without a session gets `401`.
- A failed call shows the admin's own error text (`You don't have permission.` for a `403`).
- To test the route, build a server with `testServer()` from `@monti-cms/core/testing` and call `cms.handle(request)`.
- Kept in the site's folder, the plugin needs nothing more. Published as a package, its `./server` export needs a `browser` condition that points at a one-line
  `server.browser.ts` (`export { emptyServerPlugin as default } from "@monti-cms/core";`), so the route code stays out of the browser bundle ("Publishing a plugin as a
  package" in the [core README](../../packages/core/README.md)).
