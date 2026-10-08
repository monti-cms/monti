import { definePlugin } from "@monti-cms/core";

/** `plugins: [contentHealth()]`: `monti doctor` then lists `content-health/summaries` and `content-health/site-url` after the checks of core. */
export const contentHealth = () =>
	definePlugin({ name: "content-health", options: {}, server: () => import("./server") });
