"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import type { ImportResultEntry, ImportRun, ImportStep } from "../../api/import";
import { Badge } from "../../ui/badge";
import { importMessages } from "./messages";

const OUTCOME_VARIANT = {
	imported: "success",
	draft: "warning",
	skipped: "secondary",
	failed: "destructive",
} as const;

/** One step that did not go as asked, with its reason. */
function StepLine({ label, step }: { label: string | null; step: ImportStep }) {
	const t = useTranslator(importMessages);
	const status = t(`result.step.${step.status}`);
	return (
		<li className="text-xs leading-relaxed">
			{label && <span className="font-medium">{label} </span>}
			<span className="text-monti-muted-foreground">
				{label ? `${status}${step.reason ? ": " : ""}` : ""}
				{step.reason ? `${step.reason.text}${step.reason.fix ? ` ${step.reason.fix}` : ""}` : ""}
			</span>
		</li>
	);
}

function ResultRow({ entry }: { entry: ImportResultEntry }) {
	const t = useTranslator(importMessages);
	const site = useSite();
	const problems: [string | null, ImportStep][] = [
		...(entry.create.status !== "done" ? ([[null, entry.create]] as [string | null, ImportStep][]) : []),
		...(entry.body && entry.body.status !== "done"
			? ([[t("result.step.body"), entry.body]] as [string | null, ImportStep][])
			: []),
		...(entry.publish && entry.publish.status !== "done"
			? ([[t("result.step.publish"), entry.publish]] as [string | null, ImportStep][])
			: []),
	];
	// What the editor checks said about the saved body, once each.
	const warnings = [...new Set(entry.warnings.map((warning) => warning.text))];
	return (
		<li
			className="flex flex-col gap-1.5 border-b py-3 last:border-b-0"
			data-testid="import-result"
			data-outcome={entry.outcome}
		>
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<Badge variant={OUTCOME_VARIANT[entry.outcome]}>{t(`result.outcome.${entry.outcome}`)}</Badge>
				{entry.id ? (
					<a href={site.adminEntryEditHref(entry.id)} className="font-medium underline-offset-4 hover:underline">
						{entry.title ?? entry.slug ?? entry.key}
					</a>
				) : (
					<span className="font-medium">{entry.title ?? entry.slug ?? entry.key}</span>
				)}
				<span className="text-monti-muted-foreground text-xs">{site.localeLabel(entry.locale)}</span>
				{entry.publish?.status === "done" && <Badge variant="outline">{t("result.published", { count: 1 })}</Badge>}
				{entry.id && (
					<a
						href={site.adminEntryEditHref(entry.id)}
						className="ml-auto text-monti-primary text-xs underline underline-offset-4"
					>
						{t("result.open")}
					</a>
				)}
			</div>
			{(problems.length > 0 || entry.notes.length > 0 || warnings.length > 0) && (
				<ul className="flex flex-col gap-0.5 pl-1">
					{problems.map(([label, step]) => (
						<StepLine key={label ?? "create"} label={label} step={step} />
					))}
					{entry.notes.map((note) => (
						<li key={note.code} className="text-monti-muted-foreground text-xs leading-relaxed">
							{note.text}
						</li>
					))}
					{warnings.map((text) => (
						<li key={text} className="text-monti-muted-foreground text-xs leading-relaxed">
							{text}
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

/** What the import did, entry by entry: a link to every new entry, and the reason for each one that was skipped, failed or stayed a draft. */
export function ResultView({ result }: { result: ImportRun }) {
	const t = useTranslator(importMessages);
	const { counts } = result;
	return (
		<div className="flex flex-col gap-4" data-testid="import-run-result">
			<h4 className="font-medium text-base">{t("result.title")}</h4>
			<p className="text-monti-muted-foreground text-sm" data-testid="import-result-summary">
				{[
					t("result.imported", { count: counts.imported }),
					counts.draft > 0 ? t("result.draft", { count: counts.draft }) : null,
					t("result.skipped", { count: counts.skipped }),
					counts.failed > 0 ? t("result.failed", { count: counts.failed }) : null,
					counts.published > 0 ? t("result.published", { count: counts.published }) : null,
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<ul className="max-h-[28rem] overflow-y-auto rounded-md border px-3">
				{result.results.map((entry) => (
					<ResultRow key={entry.key} entry={entry} />
				))}
			</ul>
		</div>
	);
}
