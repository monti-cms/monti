"use client";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { entriesKeys } from "../../api/entries.js";
import { getImportLimit, importKeys, previewEntryImport, runEntryImport, } from "../../api/import.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { importMessages } from "./messages.js";
/** Archive collection → where it goes, as the preview says it goes now. */
export const mappingOf = (preview) => Object.fromEntries(preview.collections.map((collection) => [collection.name, collection.target]));
/**
 * The state of one entry import: the file, the preview of what it holds (read again whenever a collection's target changes), the publish choice, and the run.
 * Choosing a file reads it at once; nothing is written until the run.
 */
export function useImportEntries() {
    const site = useSite();
    const t = useTranslator(importMessages);
    const [file, setFile] = useState(null);
    // Counts the files chosen, so reading the same file again after "start over" is a new read.
    const [fileNumber, setFileNumber] = useState(0);
    // `undefined`: the server's own choice (each collection to the one of the same name).
    const [choices, setChoices] = useState(undefined);
    const [publish, setPublish] = useState(false);
    const limitQuery = useQuery({
        queryKey: importKeys.limit(),
        queryFn: ({ signal }) => getImportLimit(site, signal),
        staleTime: 5 * 60_000,
    });
    const limit = limitQuery.data;
    const tooLarge = file !== null && limit !== undefined && file.size > limit;
    const previewQuery = useQuery({
        queryKey: [...importKeys.all, "preview", fileNumber, choices ?? null],
        queryFn: ({ signal }) => previewEntryImport(site, file, choices, signal),
        enabled: file !== null && !tooLarge,
        placeholderData: keepPreviousData,
        // The preview is of one file's bytes at one moment; it is never "fresh" again and never kept after the file is gone.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 0,
        retry: false,
    });
    const preview = previewQuery.data;
    const run = useCmsMutation({
        fn: (_, { site }) => runEntryImport(site, file, choices ?? (preview ? mappingOf(preview) : {}), publish),
        success: (result) => t("toast.done", { count: result.counts.imported + result.counts.draft }),
        failure: t("error.run"),
        invalidate: [entriesKeys.all],
        inline: true,
    });
    const reset = () => {
        setFile(null);
        setChoices(undefined);
        setPublish(false);
        run.reset();
    };
    return {
        file,
        /** Takes a file: the previous preview, choices and result are dropped. */
        chooseFile: (next) => {
            setFile(next);
            setFileNumber((number) => number + 1);
            setChoices(undefined);
            setPublish(false);
            run.reset();
        },
        reset,
        limit,
        tooLarge,
        preview,
        previewQuery,
        /** Where an archive collection goes: a collection of this site, or `null` to skip it. */
        setTarget: (collection, target) => {
            if (preview)
                setChoices({ ...mappingOf(preview), ...choices, [collection]: target });
        },
        publish,
        setPublish,
        isRunning: run.isPending,
        runError: run.error,
        result: run.data,
        start: () => run.mutate(undefined),
    };
}
