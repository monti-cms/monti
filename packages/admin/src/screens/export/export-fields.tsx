"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useId } from "react";
import { errorText } from "../../api/client";
import type { ExportScope, ExportSummary } from "../../api/export";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Spinner } from "../../ui/spinner";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { exportMessages } from "./messages";
import type { ExportForm, ExportPhase } from "./use-export-form";

const SCOPES: readonly ExportScope[] = ["admin", "public"];

/**
 * What the archive would hold, said in counts. For a selection it leads with the entries and the translations that come with them
 * ("3 post entries + 2 translations"); for the whole site it lists every kind. It says what was left out, and why.
 */
function SummaryView({ summary, selection, noun }: { summary: ExportSummary; selection: boolean; noun: string }) {
	const t = useTranslator(exportMessages);
	const asked = summary.entries - summary.addedByTranslations;
	const stats: [string, number][] = [
		...(selection ? [] : ([["count.entries", summary.entries]] as [string, number][])),
		...(summary.scope === "admin" && !selection
			? ([["count.templates", summary.templates]] as [string, number][])
			: []),
		...(summary.scope === "admin" ? ([["count.folders", summary.folders]] as [string, number][]) : []),
		...(summary.scope === "admin" ? ([["count.addresses", summary.addresses]] as [string, number][]) : []),
		["count.media", summary.media],
	];
	return (
		<div className="flex flex-col gap-3" data-testid="export-summary">
			{selection && (
				<p className="font-medium text-base" data-testid="export-headline">
					{summary.entries === 0
						? t("summary.empty")
						: [
								asked > 0 ? t("summary.entries", { count: asked, noun }) : null,
								summary.addedByTranslations > 0
									? t("summary.translations", { count: summary.addedByTranslations })
									: null,
							]
								.filter(Boolean)
								.join(" + ")}
				</p>
			)}
			<dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
				{stats.map(([key, count]) => (
					<div key={key} className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm">
						<dt className="text-monti-muted-foreground">{t(key as "count.entries")}</dt>
						<dd className="font-medium tabular-nums">{count}</dd>
					</div>
				))}
			</dl>
			<ul className="flex flex-col gap-1 text-monti-muted-foreground text-xs leading-relaxed">
				{selection && summary.addedByTranslations > 0 && <li>{t("note.translations")}</li>}
				{selection && summary.scope === "admin" && <li>{t("note.selection")}</li>}
				{summary.notPublished > 0 && <li>{t("note.notPublished", { count: summary.notPublished })}</li>}
				{summary.notFound > 0 && <li>{t("note.notFound", { count: summary.notFound })}</li>}
				<li>{t("note.media")}</li>
			</ul>
		</div>
	);
}

/**
 * The choices and counts of an export, one component for the card and both dialogs: the counts first (they follow the scope), then the scope, then the files.
 * JSON is always in; each text format the server lists is a checkbox. `noun` is the label of the collection the selected entries belong to.
 */
export function ExportFields({
	form,
	selection = false,
	noun = "",
}: {
	form: ExportForm;
	selection?: boolean;
	noun?: string;
}) {
	const t = useTranslator(exportMessages);
	const site = useSite();
	const scopeName = useId();
	const formatId = useId();
	const { summary, summaryQuery, formats, formatsQuery } = form;
	const busy = form.isExporting;
	return (
		<div className="flex flex-col gap-6">
			<section
				aria-label={t("summary.includes")}
				// While the counts of another scope are being fetched, the old ones stay in view but are marked as out of date.
				aria-busy={summaryQuery.isPlaceholderData}
				className={cn("flex flex-col gap-3 transition-opacity", summaryQuery.isPlaceholderData && "opacity-50")}
			>
				{summary ? (
					<SummaryView summary={summary} selection={selection} noun={noun} />
				) : summaryQuery.isError ? (
					<LoadErrorAlert
						message={errorText(site, summaryQuery.error, t("summary.failed"))}
						onRetry={() => void summaryQuery.refetch()}
					/>
				) : (
					<p className="text-monti-muted-foreground text-sm">{t("summary.loading")}</p>
				)}
			</section>

			<fieldset className="flex flex-col gap-2" disabled={busy}>
				<legend className="mb-1 font-medium text-sm">{t("scope.label")}</legend>
				{SCOPES.map((scope) => (
					<label
						key={scope}
						className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-disabled:cursor-not-allowed has-checked:border-monti-primary has-checked:bg-monti-primary/5 has-disabled:opacity-60"
					>
						<input
							type="radio"
							name={scopeName}
							value={scope}
							checked={form.scope === scope}
							onChange={() => form.setScope(scope)}
							className="mt-0.5 accent-monti-primary"
						/>
						<span className="flex flex-col gap-0.5">
							<span className="font-medium">{t(`scope.${scope}`)}</span>
							<span className="text-monti-muted-foreground text-xs leading-relaxed">{t(`scope.${scope}.hint`)}</span>
						</span>
					</label>
				))}
			</fieldset>

			<fieldset className="flex flex-col gap-2" disabled={busy}>
				<legend className="mb-1 font-medium text-sm">{t("formats.label")}</legend>
				<div className="flex items-start gap-3 text-sm">
					<Checkbox checked disabled aria-label={t("formats.json")} className="mt-0.5" />
					<span className="flex flex-col gap-0.5">
						<span className="font-medium">{t("formats.json")}</span>
						<span className="text-monti-muted-foreground text-xs leading-relaxed">{t("formats.json.hint")}</span>
					</span>
				</div>
				{formats.map((format) => (
					<label
						key={format.name}
						htmlFor={`${formatId}-${format.name}`}
						className="flex cursor-pointer items-start gap-3 text-sm"
					>
						<Checkbox
							id={`${formatId}-${format.name}`}
							checked={form.format === format.name}
							onCheckedChange={() => form.toggleFormat(format.name)}
							aria-label={t("formats.text", { label: format.label, extension: format.extension })}
							className="mt-0.5"
						/>
						<span className="flex flex-col gap-0.5">
							<span className="font-medium">
								{t("formats.text", { label: format.label, extension: format.extension })}
							</span>
							<span className="text-monti-muted-foreground text-xs leading-relaxed">{t("formats.text.hint")}</span>
						</span>
					</label>
				))}
				{formats.length > 1 && <p className="text-monti-muted-foreground text-xs">{t("formats.one")}</p>}
				{formatsQuery.isSuccess && formats.length === 0 && (
					<p className="text-monti-muted-foreground text-xs" data-testid="export-no-formats">
						{t("formats.none")}
					</p>
				)}
				{formatsQuery.isError && <p className="text-monti-muted-foreground text-xs">{t("formats.failed")}</p>}
			</fieldset>
		</div>
	);
}

/** What the export is doing while it runs: building the archive, then the share of it that has come down. */
export function ExportProgressLine({ phase }: { phase: ExportPhase | null }) {
	const t = useTranslator(exportMessages);
	if (!phase) return null;
	const percent = phase.kind === "downloading" ? phase.percent : null;
	return (
		<output className="flex flex-col gap-1.5" data-testid="export-progress">
			<div className="flex items-center gap-2 text-monti-muted-foreground text-sm">
				<Spinner aria-hidden className="size-3.5" />
				{phase.kind === "building"
					? t("progress.building")
					: percent === null
						? t("progress.downloadingUnknown")
						: t("progress.downloading", { percent })}
			</div>
			<div className="h-1 overflow-hidden rounded-sm bg-monti-muted">
				<div
					className={
						percent === null
							? "h-full w-1/3 animate-pulse rounded-sm bg-monti-primary"
							: "h-full rounded-sm bg-monti-primary transition-[width]"
					}
					style={percent === null ? undefined : { width: `${percent}%` }}
				/>
			</div>
		</output>
	);
}

/** The export button of a form: disabled while it runs, and when a selection holds nothing to export. */
export function ExportButton({
	form,
	label,
	selection = false,
	onDone,
}: {
	form: ExportForm;
	label: string;
	selection?: boolean;
	onDone?: () => void;
}) {
	const empty = form.summary !== undefined && selection && form.summary.entries === 0;
	return (
		<Button
			type="button"
			disabled={form.isExporting || form.summary === undefined || form.summaryQuery.isPlaceholderData || empty}
			onClick={() => void form.run().then((ok) => ok && onDone?.())}
		>
			{label}
		</Button>
	);
}
