"use client";

import { cmsFetch } from "@monti-cms/admin/api";
import { AdminShell } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import type { PostStats } from "./server";

/** The content of the screen, without the frame, so it can be shown (and tested) on its own. */
export function StatsView() {
	const site = useSite();
	const stats = useQuery({
		queryKey: ["cms", "post-stats"],
		queryFn: ({ signal }) => cmsFetch<PostStats>(site, cmsApiUrl("/v1/post-stats/summary"), { signal }),
	});
	if (stats.isPending) return <p>Loading…</p>;
	if (stats.isError) return <p role="alert">{stats.error.message}</p>;
	return (
		<dl className="grid grid-cols-2 gap-4 p-4">
			<dt>Published</dt>
			<dd>{stats.data.published}</dd>
			<dt>Drafts</dt>
			<dd>{stats.data.draft}</dd>
		</dl>
	);
}

/** The screen at `<admin path>/post-stats`: the frame of the admin (sidebar, title) around the content. The admin checks the login before it renders this. */
export function StatsPage() {
	return (
		<AdminShell title="Post stats" sidebar={{ activeNav: "post-stats" }}>
			<StatsView />
		</AdminShell>
	);
}
