"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Badge, Box, Heading, Inline, Stack, Text, TextLink } from "@monti-cms/ui";
import type { ImportResultEntry, ImportRun, ImportStep } from "../../api/import";
import { importMessages } from "./messages";

const OUTCOME_VARIANT = {
	imported: "success",
	draft: "warning",
	skipped: "secondary",
	failed: "danger",
} as const;

/** One step that did not go as asked, with its reason. */
function StepLine({ label, step }: { label: string | null; step: ImportStep }) {
	const t = useTranslator(importMessages);
	const status = t(`result.step.${step.status}`);
	return (
		<Text as="li" variant="caption">
			{label && <Text weight="medium">{label} </Text>}
			<Text tone="muted">
				{label ? `${status}${step.reason ? ": " : ""}` : ""}
				{step.reason ? `${step.reason.text}${step.reason.fix ? ` ${step.reason.fix}` : ""}` : ""}
			</Text>
		</Text>
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
		<Stack
			as="li"
			gap="condensed"
			paddingY="normal"
			border="bottom"
			data-testid="import-result"
			data-outcome={entry.outcome}
		>
			<Inline gap="condensed" wrap>
				<Badge variant={OUTCOME_VARIANT[entry.outcome]}>{t(`result.outcome.${entry.outcome}`)}</Badge>
				{entry.id ? (
					<TextLink underline="hover" href={site.adminEntryEditHref(entry.id)}>
						<Text weight="medium">{entry.title ?? entry.slug ?? entry.key}</Text>
					</TextLink>
				) : (
					<Text weight="medium">{entry.title ?? entry.slug ?? entry.key}</Text>
				)}
				<Text variant="caption" tone="muted">
					{site.localeLabel(entry.locale)}
				</Text>
				{entry.publish?.status === "done" && <Badge variant="outline">{t("result.published", { count: 1 })}</Badge>}
				{entry.id && (
					<TextLink tone="accent" size="caption" href={site.adminEntryEditHref(entry.id)}>
						{t("result.open")}
					</TextLink>
				)}
			</Inline>
			{(problems.length > 0 || entry.notes.length > 0 || warnings.length > 0) && (
				<Stack as="ul" gap="hair" paddingX="tight">
					{problems.map(([label, step]) => (
						<StepLine key={label ?? "create"} label={label} step={step} />
					))}
					{entry.notes.map((note) => (
						<Text as="li" key={note.code} variant="caption" tone="muted">
							{note.text}
						</Text>
					))}
					{warnings.map((text) => (
						<Text as="li" key={text} variant="caption" tone="muted">
							{text}
						</Text>
					))}
				</Stack>
			)}
		</Stack>
	);
}

/** What the import did, entry by entry: a link to every new entry, and the reason for each one that was skipped, failed or stayed a draft. */
export function ResultView({ result }: { result: ImportRun }) {
	const t = useTranslator(importMessages);
	const { counts } = result;
	return (
		<Stack gap="comfortable" data-testid="import-run-result">
			<Heading as="h4">{t("result.title")}</Heading>
			<Text as="p" tone="muted" data-testid="import-result-summary">
				{[
					t("result.imported", { count: counts.imported }),
					counts.draft > 0 ? t("result.draft", { count: counts.draft }) : null,
					t("result.skipped", { count: counts.skipped }),
					counts.failed > 0 ? t("result.failed", { count: counts.failed }) : null,
					counts.published > 0 ? t("result.published", { count: counts.published }) : null,
				]
					.filter(Boolean)
					.join(" · ")}
			</Text>
			<Box radius="md" border="all" paddingX="normal" maxHeight="list" overflow="y">
				<Stack as="ul" gap="none">
					{result.results.map((entry) => (
						<ResultRow key={entry.key} entry={entry} />
					))}
				</Stack>
			</Box>
		</Stack>
	);
}
