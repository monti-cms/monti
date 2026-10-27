"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Banner,
	Box,
	Button,
	FormFieldError,
	Heading,
	Inline,
	Input,
	List,
	ListItem,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useRef, useState } from "react";
import { errorText } from "../../api/client";
import type { RestoreCounts, RestoreNotRestored, RestorePreview, RestoreWarning } from "../../api/restore";
import { commonMessages } from "../../lib/common.messages";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { restoreMessages } from "./messages";
import { type RestoreForm, useRestoreBackup } from "./use-restore-backup";

/** The most problems, warnings and skipped templates listed; the counts above them cover all. */
const LIST_LIMIT = 50;
const STATUSES = ["draft", "published", "archived", "trashed"] as const;

const formatBytes = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** What a restore holds, in plain lines. */
function CountLines({ counts }: { counts: RestoreCounts }) {
	const t = useTranslator(restoreMessages);
	const statuses = STATUSES.filter((status) => (counts.byStatus[status] ?? 0) > 0).map((status) =>
		t(`summary.${status}`, { count: counts.byStatus[status] ?? 0 }),
	);
	return (
		<Stack gap={8} data-testid="restore-counts">
			<Text as="p" variant="title">
				{t("summary.entries", { count: counts.entries })}
			</Text>
			<List>
				{statuses.length > 0 && (
					<ListItem>
						<Text tone="muted">{statuses.join(" · ")}</Text>
					</ListItem>
				)}
				{counts.translations > 0 && (
					<ListItem>
						<Text tone="muted">{t("summary.translations", { count: counts.translations })}</Text>
					</ListItem>
				)}
				<ListItem>
					<Text tone="muted">{t("summary.folders", { count: counts.folders })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">{t("summary.media", { count: counts.media })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">{t("summary.addresses", { count: counts.addresses, aliases: counts.aliases })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">
						{t("summary.templates", { added: counts.templatesAdded, skipped: counts.templatesSkipped.length })}
					</Text>
				</ListItem>
			</List>
			{counts.templatesSkipped.length > 0 && (
				<Stack gap={4} paddingTop={4} data-testid="restore-templates">
					<Text as="p" weight="medium">
						{t("templates.title")}
					</Text>
					<Stack as="ul" gap={2}>
						{counts.templatesSkipped.slice(0, LIST_LIMIT).map((template) => (
							<Text as="li" variant="caption" tone="muted" key={template.id}>
								<Text weight="medium">{template.name}</Text>: {template.text}
							</Text>
						))}
					</Stack>
				</Stack>
			)}
		</Stack>
	);
}

/** Every problem that stops the restore, with what it is about and what the check found. */
function Problems({ preview }: { preview: RestorePreview }) {
	const t = useTranslator(restoreMessages);
	const shown = preview.problems.slice(0, LIST_LIMIT);
	return (
		<Stack as="section" gap={8} aria-label={t("problems.title")} data-testid="restore-problems">
			<Heading as="h4" variant="label" tone="danger">
				{t("problems.title")}
			</Heading>
			<Text as="p" variant="caption" tone="muted">
				{t("problems.hint")}
			</Text>
			<Box radius="md" border="all" paddingX={12} paddingY={8} maxHeight="list" overflow="y">
				<Stack as="ul" gap={8}>
					{shown.map((problem, index) => (
						<Stack
							as="li"
							// biome-ignore lint/suspicious/noArrayIndexKey: a problem has no id of its own; the list does not change while it is shown.
							key={index}
							gap={2}
							paddingBottom={8}
							border="bottom"
							data-testid="restore-problem"
							data-code={problem.code}
						>
							<Text weight="medium">{problem.label ?? problem.id ?? t("problems.archive")}</Text>
							<Text variant="caption" tone="muted">
								{problem.text}
							</Text>
							{problem.found.map((line) => (
								<Text key={line} variant="caption" tone="muted">
									{line}
								</Text>
							))}
						</Stack>
					))}
				</Stack>
			</Box>
			{preview.problems.length > LIST_LIMIT && (
				<Text as="p" variant="caption" tone="muted">
					{t("problems.more", { count: preview.problems.length - LIST_LIMIT })}
				</Text>
			)}
		</Stack>
	);
}

function Warnings({ warnings }: { warnings: RestoreWarning[] }) {
	const t = useTranslator(restoreMessages);
	if (warnings.length === 0) return null;
	return (
		<Stack as="section" gap={8} aria-label={t("warnings.title")} data-testid="restore-warnings">
			<Heading as="h4" variant="label">
				{t("warnings.title")}
			</Heading>
			<Stack as="ul" gap={4}>
				{warnings.slice(0, LIST_LIMIT).map((warning) => (
					<Text as="li" variant="caption" tone="muted" key={`${warning.code}:${warning.id ?? ""}`}>
						{warning.label && <Text weight="medium">{warning.label} </Text>}
						{warning.text}
					</Text>
				))}
			</Stack>
			{warnings.length > LIST_LIMIT && (
				<Text as="p" variant="caption" tone="muted">
					{t("warnings.more", { count: warnings.length - LIST_LIMIT })}
				</Text>
			)}
		</Stack>
	);
}

function NotRestored({ items }: { items: RestoreNotRestored[] }) {
	const t = useTranslator(restoreMessages);
	return (
		<Stack as="section" gap={8} aria-label={t("notRestored.title")} data-testid="restore-not-restored">
			<Heading as="h4" variant="label">
				{t("notRestored.title")}
			</Heading>
			<Text as="p" variant="caption" tone="muted">
				{t("notRestored.hint")}
			</Text>
			<List>
				{items.map((item) => (
					<ListItem key={item.code}>
						<Text variant="caption" tone="muted">
							{item.text}
						</Text>
					</ListItem>
				))}
			</List>
		</Stack>
	);
}

/** What the run is doing: the server writes everything in one step and answers when it is done, so there is no bar, only the words (a step that cannot be measured has none). */
function RunProgress({ count }: { count: number }) {
	const t = useTranslator(restoreMessages);
	return (
		<output data-testid="restore-progress">
			<Stack gap={8}>
				<Text tone="muted">{t("progress.running", { count })}</Text>
				<Text as="p" variant="caption" tone="muted">
					{t("progress.hint")}
				</Text>
			</Stack>
		</output>
	);
}

function PreviewView({ preview }: { preview: RestorePreview }) {
	return (
		<Stack gap={24} data-testid="restore-preview">
			{preview.isBackup ? (
				<>
					<CountLines counts={preview.counts} />
					{preview.problems.length > 0 && <Problems preview={preview} />}
					<Warnings warnings={preview.warnings} />
					<NotRestored items={preview.notRestored} />
				</>
			) : (
				<FormFieldError data-testid="restore-refusal">
					{preview.refusal?.text}
					{preview.refusal?.fix ? ` ${preview.refusal.fix}` : ""}
				</FormFieldError>
			)}
		</Stack>
	);
}

function ResultView({ form }: { form: RestoreForm }) {
	const t = useTranslator(restoreMessages);
	const site = useSite();
	const result = form.result;
	if (!result) return null;
	return (
		<Stack gap={24} data-testid="restore-result">
			<Stack gap={8}>
				<Heading as="h4">{t("result.title")}</Heading>
				<Text as="p" tone="muted">
					{t("result.summary", { count: result.counts.entries })}
				</Text>
			</Stack>
			<CountLines counts={result.counts} />
			<Warnings warnings={result.warnings} />
			<NotRestored items={result.notRestored} />
			<Box>
				<TextButton variant="underline" href={site.adminHref()} data-testid="restore-open">
					{t("result.open")}
				</TextButton>
			</Box>
		</Stack>
	);
}

/**
 * The body of the Restore backup card: choose a backup zip, read what restoring it would do (the preview: counts, problems, warnings, what is not
 * restored), confirm, and restore. On a site that is not empty the card is disabled and says so.
 */
export function RestoreBackupFields() {
	const t = useTranslator(restoreMessages);
	const site = useSite();
	const form = useRestoreBackup();
	const tc = useTranslator(commonMessages);
	const [confirming, setConfirming] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const { preview, previewQuery, result } = form;
	const running = form.isRunning;
	const disabled = !form.empty && !result;

	if (disabled) {
		return (
			<Stack gap={8} data-testid="restore-disabled">
				<Text as="p" weight="medium">
					{t("notEmpty.title")}
				</Text>
				<Text as="p" variant="caption" tone="muted">
					{t("notEmpty.description")}
				</Text>
				<Box>
					<Button type="button" variant="secondary" disabled aria-disabled>
						{t("file.choose")}
					</Button>
				</Box>
			</Stack>
		);
	}

	return (
		<Stack gap={24}>
			{!result && (
				<>
					<Stack gap={8}>
						<Text as="p" weight="medium">
							{t("kinds.label")}
						</Text>
						<List>
							<ListItem>
								<Text variant="caption" tone="muted">
									{t("kinds.backup")}
								</Text>
							</ListItem>
						</List>
					</Stack>

					<Inline gap={12} wrap>
						<Input
							ref={input}
							type="file"
							accept=".zip,application/zip"
							srOnly
							aria-label={t("file.choose")}
							data-testid="restore-file"
							disabled={running}
							onChange={(event) => {
								const picked = event.target.files?.[0];
								if (picked) form.chooseFile(picked);
								// The same file chosen again must still fire a change.
								event.target.value = "";
							}}
						/>
						<Button type="button" variant="secondary" disabled={running} onClick={() => input.current?.click()}>
							{form.file ? t("file.change") : t("file.choose")}
						</Button>
						{form.file && (
							<Text tone="muted" truncate>
								{form.file.name}
							</Text>
						)}
					</Inline>

					{form.tooLarge && form.limit !== undefined && (
						<FormFieldError>{t("file.tooLarge", { limit: formatBytes(form.limit) })}</FormFieldError>
					)}

					{form.file && !form.tooLarge && !preview && previewQuery.isPending && (
						<Text as="p" tone="muted">
							{t("preview.loading")}
						</Text>
					)}
					{previewQuery.isError && (
						<LoadErrorAlert
							message={errorText(site, previewQuery.error, t("preview.failed"))}
							onRetry={() => void previewQuery.refetch()}
						/>
					)}

					{preview && <PreviewView preview={preview} />}

					{Boolean(form.runError) && (
						<Banner
							role="alert"
							tone="danger"
							title={errorText(site, form.runError, t("error.run"))}
							data-testid="restore-error"
						/>
					)}

					{running && preview && <RunProgress count={preview.counts.entries} />}

					{preview && (
						<Inline gap={8} wrap>
							<Button
								type="button"
								disabled={running || !preview.ready}
								onClick={() => {
									setConfirming(true);
								}}
								data-testid="restore-run"
							>
								{t("action.restore")}
							</Button>
							<TextButton type="button" disabled={running} onClick={form.reset}>
								{t("action.cancel")}
							</TextButton>
						</Inline>
					)}
				</>
			)}

			{result && <ResultView form={form} />}
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("confirm.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("confirm.description", { count: preview?.counts.entries ?? 0 })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel type="button">{tc("cancel")}</AlertDialogCancel>
						<AlertDialogAction type="button" variant="outline-danger" onClick={() => form.start()}>
							{t("confirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Stack>
	);
}
