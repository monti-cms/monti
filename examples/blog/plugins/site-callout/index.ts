import { definePlugin } from "@monti-cms/core";

/** Draws the site's own callout (`components/callout.tsx`) in the admin editor. Add it after `callout()`: `plugins: [callout(), siteCallout()]`. */
export const siteCallout = () =>
	definePlugin({
		name: "site-callout",
		options: {},
		admin: () => import("./admin"),
	});
