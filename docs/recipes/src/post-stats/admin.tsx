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
