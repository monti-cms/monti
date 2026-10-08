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
