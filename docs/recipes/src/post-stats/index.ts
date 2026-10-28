import { definePlugin } from "@monti-cms/core";

export const postStats = () =>
	definePlugin({
		name: "post-stats",
		nav: [{ path: "post-stats", label: "Post stats", icon: "chart--column" }],
		server: () => import("./server"),
		admin: () => import("./admin"),
	});
