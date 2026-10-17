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
