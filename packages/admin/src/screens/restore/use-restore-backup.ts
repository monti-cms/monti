"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { getRestoreState, previewRestore, restoreKeys, runRestore } from "../../api/restore";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { restoreMessages } from "./messages";

/**
 * The state of one backup restore: whether the site is empty (read before a file is chosen), the preview of what restoring `file` would do (read at
 * once when `readable` and the site is empty; nothing is written), and the run. `fileNumber` counts the files chosen, so reading the same file again is
 * a new read. A restore changes everything the admin lists, so every cached read is refetched after it.
 */
export function useRestoreBackup(file: File | null, fileNumber: number, readable: boolean) {
	const site = useSite();
	const t = useTranslator(restoreMessages);

	const stateQuery = useQuery({
		queryKey: restoreKeys.state(),
		queryFn: ({ signal }) => getRestoreState(site, signal),
		retry: false,
	});
	const empty = stateQuery.data?.empty ?? true;

	const previewQuery = useQuery({
		// Not under the `["cms"]` prefix the run invalidates: the file is not read again after the restore.
		queryKey: restoreKeys.preview(fileNumber),
		queryFn: ({ signal }) => previewRestore(site, file as File, signal),
		// Not before the site is known to be empty: a site with entries never reads a zip as a backup.
		enabled: file !== null && readable && stateQuery.isSuccess && empty,
		// The preview is of one file's bytes at one moment; it is never "fresh" again and never kept after the file is gone.
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 0,
		retry: false,
	});

	// A restore changes everything the admin lists, so every cached read is refetched after it (and the site is no longer empty).
	const run = useCmsMutation({
		fn: (_: undefined, { site }) => runRestore(site, file as File),
		success: (result) => t("toast.done", { count: result.counts.entries }),
		failure: t("error.run"),
		invalidate: [["cms"]],
		inline: true,
	});

	return {
		stateReady: !stateQuery.isPending,
		/** Whether the site is empty, so a backup can be restored. Unknown counts as empty: the server checks again. */
		empty,
		preview: previewQuery.data,
		/** The preview is in, or could not be read: either way the file is not waiting for it any more. */
		previewSettled: previewQuery.isSuccess || previewQuery.isError,
		isRunning: run.isPending,
		runError: run.error,
		result: run.data,
		start: () => run.mutate(undefined),
		reset: () => run.reset(),
	};
}

export type RestoreForm = ReturnType<typeof useRestoreBackup>;
