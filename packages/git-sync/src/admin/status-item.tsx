"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import { formatAgo, StatusBarItem, StatusPopoverHeader, StatusPopoverRow } from "@monti-cms/admin/kit";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, TriangleAlert } from "lucide-react";
import { getGitSyncStatus, gitSyncKeys, type StatusView } from "./api";
import { gitSyncMessages } from "./page.messages";

/** What the status bar says: conflicts and queued commits across the targets, and when the last pull or commit happened. */
export function syncSummary(status: StatusView) {
	const targets = status.targets;
	const times = targets.flatMap((target) =>
		[target.lastPull?.at, target.lastFlush?.at].flatMap((at) => (at ? [Date.parse(at)] : [])),
	);
	return {
		conflicts: targets.reduce((sum, target) => sum + target.conflicts, 0),
		queued: targets.reduce((sum, target) => sum + target.queued, 0),
		lastAt: times.length > 0 ? Math.max(...times) : null,
	};
}

/** The popup: each target's repo and branch, when it last synced, what waits for a commit and what conflicts, and the way to the Git sync page. */
function GitSyncPopover({ status }: { status: StatusView }) {
	const site = useSite();
	const t = useTranslator(gitSyncMessages);
	return (
		<>
			<StatusPopoverHeader title={t("status.popover.title")} />
			{status.targets.map((target) => {
				const { lastAt } = syncSummary({ ...status, targets: [target] });
				return (
					<div key={target.id} className="py-1">
						<StatusPopoverRow label={target.repo} value={target.branch} />
						<StatusPopoverRow
							label={t("status.popover.lastSync")}
							value={lastAt === null ? t("target.never") : formatAgo(site, lastAt)}
						/>
						{target.queued > 0 && (
							<StatusPopoverRow label={t("target.queued", { count: target.queued })} tone="warning" />
						)}
						{target.conflicts > 0 && (
							<StatusPopoverRow label={t("target.conflicts", { count: target.conflicts })} tone="danger" />
						)}
					</div>
				);
			})}
			<StatusPopoverRow label={t("status.title")} href={site.adminHref("/tools/git-sync")} />
		</>
	);
}

/**
 * Status bar item: the Git sync state, read from the status the Git sync page reads (the same query). Conflicts show in the danger tone, queued commits
 * and the last sync time otherwise; it opens the targets and the way to the Git sync page, and hides while nothing is set up or nothing has happened.
 */
export function GitSyncStatus() {
	const site = useSite();
	const t = useTranslator(gitSyncMessages);
	// A light background read. Errors (no access, no token) are ignored so the bar never breaks.
	const { data } = useQuery({
		queryKey: gitSyncKeys.status(),
		queryFn: ({ signal }) => getGitSyncStatus(site, { signal }),
		retry: false,
		staleTime: 60_000,
	});
	if (!data || data.targets.length === 0) return null;
	const { conflicts, queued, lastAt } = syncSummary(data);
	const popover = <GitSyncPopover status={data} />;
	if (conflicts > 0)
		return (
			<StatusBarItem tone="danger" icon={<TriangleAlert />} popover={popover} title={t("status.title")}>
				{t("status.conflicts", { count: conflicts })}
			</StatusBarItem>
		);
	if (queued > 0)
		return (
			<StatusBarItem tone="warning" icon={<GitBranch />} popover={popover} title={t("status.title")}>
				{t("status.queued", { count: queued })}
			</StatusBarItem>
		);
	if (lastAt === null) return null;
	return (
		<StatusBarItem icon={<GitBranch />} popover={popover} title={t("status.title")}>
			{t("status.synced", { ago: formatAgo(site, lastAt) })}
		</StatusBarItem>
	);
}
