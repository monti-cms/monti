"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { entriesKeys } from "../../api/entries";
import {
	type ImportMapping,
	type ImportPreview,
	importKeys,
	previewEntryImport,
	runEntryImport,
} from "../../api/import";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { importMessages } from "./messages";

/** Archive collection → where it goes, as the preview says it goes now. */
export const mappingOf = (preview: ImportPreview): ImportMapping =>
	Object.fromEntries(preview.collections.map((collection) => [collection.name, collection.target]));

/**
 * The state of one entry import: the preview of what `file` holds (read again whenever a collection's target changes), the publish choice, and the run.
 * It reads when `enabled` (the file is readable and is not a backup to restore); nothing is written until the run. `fileNumber` counts the files
 * chosen, so reading the same file again is a new read. `reset` drops the choices and the result, for the next file.
 */
export function useImportEntries(file: File | null, fileNumber: number, enabled: boolean) {
	const site = useSite();
	const t = useTranslator(importMessages);
	// `undefined`: the server's own choice (each collection to the one of the same name).
	const [choices, setChoices] = useState<ImportMapping | undefined>(undefined);
	const [publish, setPublish] = useState(false);

	const previewQuery = useQuery({
		queryKey: [...importKeys.all, "preview", fileNumber, choices ?? null] as const,
		queryFn: ({ signal }) => previewEntryImport(site, file as File, choices, signal),
		enabled: file !== null && enabled,
		placeholderData: keepPreviousData,
		// The preview is of one file's bytes at one moment; it is never "fresh" again and never kept after the file is gone.
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 0,
		retry: false,
	});
	const preview = previewQuery.data;

	const run = useCmsMutation({
		fn: (_: undefined, { site }) =>
			runEntryImport(site, file as File, choices ?? (preview ? mappingOf(preview) : {}), publish),
		success: (result) => t("toast.done", { count: result.counts.imported + result.counts.draft }),
		failure: t("error.run"),
		invalidate: [entriesKeys.all],
		inline: true,
	});

	return {
		preview,
		previewQuery,
		/** Where an archive collection goes: a collection of this site, or `null` to skip it. */
		setTarget: (collection: string, target: string | null) => {
			if (preview) setChoices({ ...mappingOf(preview), ...choices, [collection]: target });
		},
		publish,
		setPublish,
		isRunning: run.isPending,
		runError: run.error,
		result: run.data,
		start: () => run.mutate(undefined),
		reset: () => {
			setChoices(undefined);
			setPublish(false);
			run.reset();
		},
	};
}

export type ImportForm = ReturnType<typeof useImportEntries>;
