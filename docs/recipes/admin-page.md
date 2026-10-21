# Add an admin page to a plugin

Goal: a "Post stats" item in the Site group of the admin sidebar, opening a screen at `<admin path>/tools/post-stats` that shows the published and draft counts from an API route of the plugin.

The code below is the recipe's own files in [`src/post-stats/`](src/post-stats/), type checked in CI.

## What you need to know

1. **A plugin has three sides**, each a lazy loader: `server` (routes, `on` subscribers, commands), `admin` (screens and providers) and `nav` (the Tools page, plain JSON) ("Plugins" in the [core README](../../packages/core/README.md)).
2. **A route** is `{ pattern, module: { GET, POST, ... } }` under `/api/monti/`. Wrap each handler with `adminRoute(...)`: it checks the login and the same-origin rule, and hands you the instance (`cms`) and the plugin's own context (`plugin`). A route that must be reachable without login names an `access` kind instead of the default `admin`: `public-read` (GET only), `same-origin-form`, `signed` (a webhook that verifies its signature itself) or `admin-or-bearer`.
3. **A page** is a client component in `defineAdminPlugin({ pages: { "<segment>": Component } })`. The `nav` item's `path` is the same segment: the page shows as an item of the sidebar's Site group (`group: "writing"` would put it next to Templates).
4. **Screen building blocks**: `useAdminFetch()` (`@monti-cms/admin`) for the call: it takes the path after `/api/monti` and throws a readable error. Buttons, forms and lists are in `@monti-cms/admin/kit` (`PageActions` puts the page's one primary action on the right of the title bar; the admin already draws the sidebar and the title).

## The code

The plugin:

<!-- src/post-stats/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

export const postStats = () =>
	definePlugin({
		name: "post-stats",
		nav: [{ path: "post-stats", label: "Post stats", icon: "bar-chart-3" }],
		server: () => import("./server"),
		admin: () => import("./admin"),
	});
```

The route (`GET /api/monti/v1/post-stats/summary`):

<!-- src/post-stats/server.ts -->
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

The admin module, a `"use client"` module with the screen and its declaration:

<!-- src/post-stats/admin.tsx -->
```tsx
"use client";

import { defineAdminPlugin, useAdminFetch } from "@monti-cms/admin";
import { useQuery } from "@tanstack/react-query";

function StatsPage() {
	const adminFetch = useAdminFetch();
	const stats = useQuery({
		queryKey: ["cms", "post-stats"],
		queryFn: ({ signal }) => adminFetch<{ draft: number; published: number }>("/v1/post-stats/summary", { signal }),
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
