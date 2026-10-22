"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Checkbox, DescriptionItem, DescriptionList, Inline, Spinner, Stack, Text } from "@monti-cms/ui";
import { type ReactNode, useId } from "react";
import { errorText } from "../../api/client";
import type { ExportScope, ExportSummary } from "../../api/export";
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
		<Stack gap="normal" data-testid="export-summary">
			{selection && (
				<Text as="p" variant="title" data-testid="export-headline">
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
				</Text>
			)}
			<DescriptionList>
				{stats.map(([key, count]) => (
					<DescriptionItem key={key} label={t(key as "count.entries")}>
						<Text weight="medium">{count}</Text>
					</DescriptionItem>
				))}
			</DescriptionList>
			<Stack as="ul" gap="tight">
				{selection && summary.addedByTranslations > 0 && <NoteLine>{t("note.translations")}</NoteLine>}
				{selection && summary.scope === "admin" && <NoteLine>{t("note.selection")}</NoteLine>}
				{summary.notPublished > 0 && <NoteLine>{t("note.notPublished", { count: summary.notPublished })}</NoteLine>}
				{summary.notFound > 0 && <NoteLine>{t("note.notFound", { count: summary.notFound })}</NoteLine>}
				<NoteLine>{t("note.media")}</NoteLine>
			</Stack>
		</Stack>
	);
}

/** One muted line of a list of notes. */
function NoteLine({ children }: { children: ReactNode }) {
	return (
		<Text as="li" variant="caption" tone="muted">
			{children}
		</Text>
	);
}

/** A choice with its name and a hint under it. */
function ChoiceText({ name, hint }: { name: string; hint: string }) {
	return (
		<Stack gap="hair">
			<Text weight="medium">{name}</Text>
			<Text variant="caption" tone="muted">
				{hint}
			</Text>
		</Stack>
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
		<Stack gap="spacious">
			{/* While the counts of another scope are being fetched, the old ones stay in view but are marked as out of date. */}
			{/* design-system: needs a dimmed (opacity) state for content that is out of date while it reloads */}
			<Stack as="section" gap="normal" aria-label={t("summary.includes")} aria-busy={summaryQuery.isPlaceholderData}>
				{summary ? (
					<SummaryView summary={summary} selection={selection} noun={noun} />
				) : summaryQuery.isError ? (
					<LoadErrorAlert
						message={errorText(site, summaryQuery.error, t("summary.failed"))}
						onRetry={() => void summaryQuery.refetch()}
					/>
				) : (
					<Text as="p" tone="muted">
						{t("summary.loading")}
					</Text>
				)}
			</Stack>

			<fieldset disabled={busy}>
				<legend>
					<Text weight="medium">{t("scope.label")}</Text>
				</legend>
				<Stack gap="condensed" paddingTop="tight">
					{SCOPES.map((scope) => (
						<Box
							as="label"
							key={scope}
							border={form.scope === scope ? "default" : "all"}
							background={form.scope === scope ? "selected" : undefined}
							radius="md"
							padding="normal"
						>
							<Inline gap="normal" align="start">
								{/* design-system: needs a Radio part (the native radio takes the browser's accent color) */}
								<input
									type="radio"
									name={scopeName}
									value={scope}
									checked={form.scope === scope}
									onChange={() => form.setScope(scope)}
								/>
								<ChoiceText name={t(`scope.${scope}`)} hint={t(`scope.${scope}.hint`)} />
							</Inline>
						</Box>
					))}
				</Stack>
			</fieldset>

			<fieldset disabled={busy}>
				<legend>
					<Text weight="medium">{t("formats.label")}</Text>
				</legend>
				<Stack gap="condensed" paddingTop="tight">
					<Inline gap="normal" align="start">
						<Checkbox checked disabled aria-label={t("formats.json")} />
						<ChoiceText name={t("formats.json")} hint={t("formats.json.hint")} />
					</Inline>
					{formats.map((format) => (
						<Box as="label" key={format.name} htmlFor={`${formatId}-${format.name}`}>
							<Inline gap="normal" align="start">
								<Checkbox
									id={`${formatId}-${format.name}`}
									checked={form.format === format.name}
									onCheckedChange={() => form.toggleFormat(format.name)}
									aria-label={t("formats.text", { label: format.label, extension: format.extension })}
								/>
								<ChoiceText
									name={t("formats.text", { label: format.label, extension: format.extension })}
									hint={t("formats.text.hint")}
								/>
							</Inline>
						</Box>
					))}
					{formats.length > 1 && (
						<Text as="p" variant="caption" tone="muted">
							{t("formats.one")}
						</Text>
					)}
					{formatsQuery.isSuccess && formats.length === 0 && (
						<Text as="p" variant="caption" tone="muted" data-testid="export-no-formats">
							{t("formats.none")}
						</Text>
					)}
					{formatsQuery.isError && (
						<Text as="p" variant="caption" tone="muted">
							{t("formats.failed")}
						</Text>
					)}
				</Stack>
			</fieldset>
		</Stack>
	);
}

/** What the export is doing while it runs: building the archive, then the share of it that has come down. */
export function ExportProgressLine({ phase }: { phase: ExportPhase | null }) {
	const t = useTranslator(exportMessages);
	if (!phase) return null;
	const percent = phase.kind === "downloading" ? phase.percent : null;
	return (
		<output data-testid="export-progress">
			<Stack gap="condensed">
				<Inline gap="condensed">
					<Spinner aria-hidden size="sm" />
					<Text tone="muted">
						{phase.kind === "building"
							? t("progress.building")
							: percent === null
								? t("progress.downloadingUnknown")
								: t("progress.downloading", { percent })}
					</Text>
				</Inline>
				{/* design-system: needs a Progress part (a bar with a known percent or an indeterminate one) */}
				<div className="h-1 overflow-hidden rounded-sm bg-monti-neutral">
					<div
						className={
							percent === null
								? "h-full w-1/3 animate-pulse rounded-sm bg-monti-emphasis"
								: "h-full rounded-sm bg-monti-emphasis transition-[width]"
						}
						style={percent === null ? undefined : { width: `${percent}%` }}
					/>
				</div>
			</Stack>
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
