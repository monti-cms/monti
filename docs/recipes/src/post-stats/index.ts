import { definePlugin } from "@monti-cms/core";

export const postStats = () =>
	definePlugin({
		name: "post-stats",
		nav: [{ path: "post-stats", label: "Post stats" }],
		server: () => import("./server"),
		admin: () => import("./admin"),
	});
