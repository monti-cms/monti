"use client";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getImportLimit, importKeys } from "../../api/import.js";
import { getRestoreState, previewRestore, restoreKeys, runRestore } from "../../api/restore.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { restoreMessages } from "./messages.js";
/**
 * The state of one backup restore: whether the site is empty (read before a file is chosen), the file, the preview of what restoring it would do
 * (read at once; nothing is written), and the run. A restore changes everything the admin lists, so every cached read is refetched after it.
 */
export function useRestoreBackup() {
    const site = useSite();
    const t = useTranslator(restoreMessages);
    const [file, setFile] = useState(null);
    // Counts the files chosen, so reading the same file again after "start over" is a new read.
    const [fileNumber, setFileNumber] = useState(0);
    const stateQuery = useQuery({
        queryKey: restoreKeys.state(),
        queryFn: ({ signal }) => getRestoreState(site, signal),
        retry: false,
    });
    const limitQuery = useQuery({
        queryKey: importKeys.limit(),
        queryFn: ({ signal }) => getImportLimit(site, signal),
        staleTime: 5 * 60_000,
    });
    const limit = limitQuery.data;
    const tooLarge = file !== null && limit !== undefined && file.size > limit;
    const empty = stateQuery.data?.empty ?? true;
    const previewQuery = useQuery({
        // Not under the `["cms"]` prefix the run invalidates: the file is not read again after the restore.
        queryKey: restoreKeys.preview(fileNumber),
        queryFn: ({ signal }) => previewRestore(site, file, signal),
        enabled: file !== null && !tooLarge && empty,
        // The preview is of one file's bytes at one moment; it is never "fresh" again and never kept after the file is gone.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 0,
        retry: false,
    });
    // A restore changes everything the admin lists, so every cached read is refetched after it (and the site is no longer empty).
    const run = useCmsMutation({
        fn: (_, { site }) => runRestore(site, file),
        success: (result) => t("toast.done", { count: result.counts.entries }),
        failure: t("error.run"),
        invalidate: [["cms"]],
        inline: true,
    });
    return {
        stateReady: !stateQuery.isPending,
        /** Whether the site is empty, so a backup can be restored. Unknown counts as empty: the server checks again. */
        empty,
        file,
        /** Takes a file: the previous preview and result are dropped. */
        chooseFile: (next) => {
            setFile(next);
            setFileNumber((number) => number + 1);
            run.reset();
        },
        reset: () => {
            setFile(null);
            run.reset();
        },
        limit,
        tooLarge,
        preview: previewQuery.data,
        previewQuery,
        isRunning: run.isPending,
        runError: run.error,
        result: run.data,
        start: () => run.mutate(undefined),
    };
}
