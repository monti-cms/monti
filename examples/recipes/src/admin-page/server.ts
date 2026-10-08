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
