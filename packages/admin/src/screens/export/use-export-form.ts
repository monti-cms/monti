"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	downloadExport,
	type ExportFormat,
	type ExportProgress,
	type ExportScope,
	exportKeys,
	getExportSummary,
	listExportFormats,
	saveBlob,
} from "../../api/export";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { exportMessages } from "./messages";

/** How far an export is: building the archive on the server, or reading it (`percent` when the server said how large it is). */
export type ExportPhase = { kind: "building" } | { kind: "downloading"; percent: number | null };

/**
 * The state of one export, shared by the Site backup card, the dialog of selected entries and the dialog of one entry: the scope, the text format,
 * the summary of what the archive would hold, and the download. `ids` limits it to those entries (their translations come along); without it the export is the whole site.
 */
export function useExportForm({ ids }: { ids?: readonly string[] } = {}) {
	const site = useSite();
	const t = useTranslator(exportMessages);
	const [scope, setScope] = useState<ExportScope>("admin");
	// The server writes one text format per archive: `undefined` is the first installed one, `null` is none.
	const [picked, setPicked] = useState<string | null | undefined>(undefined);
	const [progress, setProgress] = useState<ExportProgress | null>(null);

	const formatsQuery = useQuery({
		queryKey: exportKeys.formats(),
		queryFn: ({ signal }) => listExportFormats(site, signal),
		staleTime: 5 * 60_000,
	});
	const formats: readonly ExportFormat[] = formatsQuery.data ?? [];
	const format = picked === undefined ? formats[0]?.name : (picked ?? undefined);

	const summaryQuery = useQuery({
		queryKey: exportKeys.summary({ scope, ids }),
		queryFn: ({ signal }) => getExportSummary(site, { scope, ids }, signal),
		placeholderData: keepPreviousData,
		// What the archive holds changes as people write, so a dialog opened again counts again.
		staleTime: 0,
	});

	const download = useCmsMutation({
		fn: async (_: undefined, { site }) => {
			setProgress({ received: 0, total: null });
			try {
				return await downloadExport(
					site,
					{ scope, ...(ids ? { ids } : {}), ...(format ? { format } : {}) },
					{ onProgress: setProgress, fallback: t("error.export") },
				);
			} finally {
				setProgress(null);
			}
		},
		success: ({ filename, notWritten }) =>
			notWritten > 0
				? `${t("toast.done", { name: filename })} ${t("toast.notWritten", { count: notWritten })}`
				: t("toast.done", { name: filename }),
		failure: t("error.export"),
		onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
	});

	const phase: ExportPhase | null = !download.isPending
		? null
		: progress && progress.received > 0
			? {
					kind: "downloading",
					percent: progress.total ? Math.min(100, Math.floor((progress.received / progress.total) * 100)) : null,
				}
			: { kind: "building" };

	return {
		scope,
		setScope,
		formats,
		formatsQuery,
		format,
		/** Picks a text format, or clears it when it is the one picked. */
		toggleFormat: (name: string) => setPicked(format === name ? null : name),
		summary: summaryQuery.data,
		summaryQuery,
		phase,
		isExporting: download.isPending,
		/** Builds the archive and saves it. Resolves when it is done; a failure is toasted. */
		run: () =>
			download.mutateAsync(undefined).then(
				() => true,
				() => false,
			),
	};
}

export type ExportForm = ReturnType<typeof useExportForm>;
