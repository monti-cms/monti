"use client";

import type { EditorExtensionContext, EditorExtensionResult } from "@monti-cms/admin";
import { cmsFetch } from "@monti-cms/admin/api";
import { buttonVariants } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { GitPullRequest } from "lucide-react";
import type { DraftPullRequestView } from "./git-sync-page";
import { gitSyncMessages } from "./page.messages";

/** The query of the open draft pull requests of one entry. */
export const draftPrKey = (entryId: string | undefined) => ["cms", "git-sync", "drafts", entryId] as const;

/**
 * The "Draft PR" link on the editor's entry page: an edit screen extension (the toolbar slot) that shows a small link to the entry's draft pull request on GitHub
 * when there is one. It asks the plugin's API for the open draft pull requests of the entry and shows nothing while loading, when there is none, or when the
 * request fails (a site without drafts, no token yet).
 */
export function useDraftPrExtension(context: EditorExtensionContext): EditorExtensionResult {
	const site = useSite();
	const t = useTranslator(gitSyncMessages);
	const entryId = context.getEntry?.().entryId;
	const query = useQuery({
		queryKey: draftPrKey(entryId),
		enabled: entryId !== undefined,
		retry: false,
		staleTime: 30_000,
		queryFn: ({ signal }) =>
			cmsFetch<{ items: DraftPullRequestView[] }>(
				site,
				cmsApiUrl(`/v1/git-sync/drafts?entryId=${encodeURIComponent(entryId ?? "")}`),
				{ signal, fallback: "" },
			),
	});
	const first = query.data?.items[0];
	return {
		toolbar: first ? (
			<a
				href={first.url}
				target="_blank"
				rel="noreferrer"
				title={t("draftPr.title")}
				className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5 text-cms-muted-foreground" })}
			>
				<GitPullRequest aria-hidden className="size-4" />
				{t("draftPr.link")}
			</a>
		) : null,
	};
}
