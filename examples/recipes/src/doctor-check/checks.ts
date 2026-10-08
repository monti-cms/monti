import { type DoctorCheck, ok, warn } from "@monti-cms/core";

/**
 * Checks for `monti doctor`, listed under the plugin's name (`content-health/summaries`). A check says what it found, and for a warning where it is and how
 * to fix it, in words a person can follow: the file, variable or screen, and the exact next step.
 */
export const contentHealthChecks: readonly DoctorCheck[] = [
	{
		id: "summaries",
		title: "Published posts have a summary",
		// The context holds the app's instance (`cms`), the folder (`cwd`), the environment (`env`) and `online`.
		run: async ({ cms }) => {
			const { items, total } = await cms.read.listEntries({ collection: "post", pageSize: 100 });
			const without = items.filter((post) => !String(post.metadata.summary ?? "").trim());
			if (without.length === 0) return ok(`all ${total} published posts have a summary`);
			return warn(
				`${without.length} of ${total} published posts have no summary: ${without.map((post) => post.slug).join(", ")}`,
				{
					where: `the Summary field of each post (${cms.site.adminHref("/")}?collection=post)`,
					fix: "write a summary, or set `fillFromBody: true` on the summary field in monti.schema.json so publishing fills it from the body",
				},
			);
		},
	},
	{
		id: "site-url",
		title: "The site URL is set",
		run: ({ cms, env }) =>
			cms.site.config.site?.url || env.SITE_URL
				? ok("the site URL is set")
				: warn("the site URL is not set, so links in feeds and notifications are relative", {
						where: "SITE_URL in .env.local, or `site.url` in monti.schema.json",
						fix: "set SITE_URL=https://your-site.example",
					}),
	},
];
