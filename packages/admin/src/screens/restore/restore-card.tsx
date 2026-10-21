"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useRef } from "react";
import { errorText } from "../../api/client";
import type { RestoreCounts, RestoreNotRestored, RestorePreview, RestoreWarning } from "../../api/restore";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Spinner } from "../../ui/spinner";
import { useConfirm } from "../shared/confirm-dialog";
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
		<div className="flex flex-col gap-1.5 text-sm" data-testid="restore-counts">
			<p className="font-medium text-base">{t("summary.entries", { count: counts.entries })}</p>
			<ul className="flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground">
				{statuses.length > 0 && <li>{statuses.join(" · ")}</li>}
				{counts.translations > 0 && <li>{t("summary.translations", { count: counts.translations })}</li>}
				<li>{t("summary.folders", { count: counts.folders })}</li>
				<li>{t("summary.media", { count: counts.media })}</li>
				<li>{t("summary.addresses", { count: counts.addresses, aliases: counts.aliases })}</li>
				<li>{t("summary.templates", { added: counts.templatesAdded, skipped: counts.templatesSkipped.length })}</li>
			</ul>
			{counts.templatesSkipped.length > 0 && (
				<div className="mt-1 flex flex-col gap-1" data-testid="restore-templates">
					<p className="font-medium">{t("templates.title")}</p>
					<ul className="flex flex-col gap-0.5 text-monti-muted-foreground text-xs leading-relaxed">
						{counts.templatesSkipped.slice(0, LIST_LIMIT).map((template) => (
							<li key={template.id}>
								<span className="font-medium">{template.name}</span>: {template.text}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

/** Every problem that stops the restore, with what it is about and what the check found. */
function Problems({ preview }: { preview: RestorePreview }) {
	const t = useTranslator(restoreMessages);
	const shown = preview.problems.slice(0, LIST_LIMIT);
	return (
		<section className="flex flex-col gap-2" aria-label={t("problems.title")} data-testid="restore-problems">
			<h4 className="font-medium text-monti-destructive text-sm">{t("problems.title")}</h4>
			<p className="text-monti-muted-foreground text-xs">{t("problems.hint")}</p>
			<ul className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-md border px-3 py-2">
				{shown.map((problem, index) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: a problem has no id of its own; the list does not change while it is shown.
						key={index}
						className="flex flex-col gap-0.5 border-b pb-2 text-sm last:border-b-0 last:pb-0"
						data-testid="restore-problem"
						data-code={problem.code}
					>
						<span className="font-medium">{problem.label ?? problem.id ?? t("problems.archive")}</span>
						<span className="text-monti-muted-foreground text-xs leading-relaxed">{problem.text}</span>
						{problem.found.map((line) => (
							<span key={line} className="text-monti-muted-foreground text-xs leading-relaxed">
								{line}
							</span>
						))}
					</li>
				))}
			</ul>
			{preview.problems.length > LIST_LIMIT && (
				<p className="text-monti-muted-foreground text-xs">
					{t("problems.more", { count: preview.problems.length - LIST_LIMIT })}
				</p>
			)}
		</section>
	);
}

function Warnings({ warnings }: { warnings: RestoreWarning[] }) {
	const t = useTranslator(restoreMessages);
	if (warnings.length === 0) return null;
	return (
		<section className="flex flex-col gap-2" aria-label={t("warnings.title")} data-testid="restore-warnings">
			<h4 className="font-medium text-sm">{t("warnings.title")}</h4>
			<ul className="flex flex-col gap-1 text-monti-muted-foreground text-xs leading-relaxed">
				{warnings.slice(0, LIST_LIMIT).map((warning) => (
					<li key={`${warning.code}:${warning.id ?? ""}`}>
						{warning.label && <span className="font-medium">{warning.label} </span>}
						{warning.text}
					</li>
				))}
			</ul>
			{warnings.length > LIST_LIMIT && (
				<p className="text-monti-muted-foreground text-xs">
					{t("warnings.more", { count: warnings.length - LIST_LIMIT })}
				</p>
			)}
		</section>
	);
}

function NotRestored({ items }: { items: RestoreNotRestored[] }) {
	const t = useTranslator(restoreMessages);
	return (
		<section className="flex flex-col gap-2" aria-label={t("notRestored.title")} data-testid="restore-not-restored">
			<h4 className="font-medium text-sm">{t("notRestored.title")}</h4>
			<p className="text-monti-muted-foreground text-xs">{t("notRestored.hint")}</p>
			<ul className="flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground text-xs leading-relaxed">
				{items.map((item) => (
					<li key={item.code}>{item.text}</li>
				))}
			</ul>
		</section>
	);
}

/** What the run is doing: the server writes everything in one step and answers when it is done, so the bar does not claim a percentage. */
function RunProgress({ count }: { count: number }) {
	const t = useTranslator(restoreMessages);
	return (
		<output className="flex flex-col gap-1.5" data-testid="restore-progress">
			<div className="flex items-center gap-2 text-monti-muted-foreground text-sm">
				<Spinner aria-hidden className="size-3.5" />
				{t("progress.running", { count })}
			</div>
			<div className="h-1 overflow-hidden rounded-sm bg-monti-muted">
				<div className="h-full w-1/3 animate-pulse rounded-sm bg-monti-primary" />
			</div>
			<p className="text-monti-muted-foreground text-xs">{t("progress.hint")}</p>
		</output>
	);
}

function PreviewView({ preview }: { preview: RestorePreview }) {
	return (
		<div className="flex flex-col gap-6" data-testid="restore-preview">
			{preview.isBackup ? (
				<>
					<CountLines counts={preview.counts} />
					{preview.problems.length > 0 && <Problems preview={preview} />}
					<Warnings warnings={preview.warnings} />
					<NotRestored items={preview.notRestored} />
				</>
			) : (
				<Alert variant="destructive" layout="stack" data-testid="restore-refusal">
					<AlertDescription>
						{preview.refusal?.text}
						{preview.refusal?.fix ? ` ${preview.refusal.fix}` : ""}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

function ResultView({ form }: { form: RestoreForm }) {
	const t = useTranslator(restoreMessages);
	const site = useSite();
	const result = form.result;
	if (!result) return null;
	return (
		<div className="flex flex-col gap-6" data-testid="restore-result">
			<div className="flex flex-col gap-2">
				<h4 className="font-medium text-base">{t("result.title")}</h4>
				<p className="text-monti-muted-foreground text-sm">{t("result.summary", { count: result.counts.entries })}</p>
			</div>
			<CountLines counts={result.counts} />
			<Warnings warnings={result.warnings} />
			<NotRestored items={result.notRestored} />
			<div>
				<a
					href={site.adminHref()}
					className={"text-monti-highlight text-sm underline underline-offset-4"}
					data-testid="restore-open"
				>
					{t("result.open")}
				</a>
			</div>
		</div>
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
	const { confirm, dialog } = useConfirm();
	const input = useRef<HTMLInputElement>(null);
	const { preview, previewQuery, result } = form;
	const running = form.isRunning;
	const disabled = !form.empty && !result;

	if (disabled) {
		return (
			<div className="flex flex-col gap-1.5" data-testid="restore-disabled">
				<p className="font-medium text-sm">{t("notEmpty.title")}</p>
				<p className="text-monti-muted-foreground text-xs leading-relaxed">{t("notEmpty.description")}</p>
				<div>
					<Button type="button" variant="outline" disabled aria-disabled>
						{t("file.choose")}
					</Button>
				</div>
			</div>
		);
	}

	const restore = async () => {
		if (!preview) return;
		const ok = await confirm({
			title: t("confirm.title"),
			description: t("confirm.description", { count: preview.counts.entries }),
			confirmLabel: t("confirm.confirm"),
			destructive: true,
		});
		if (ok) form.start();
	};

	return (
		<div className="flex flex-col gap-6">
			{!result && (
				<>
					<div className="flex flex-col gap-2">
						<p className="font-medium text-sm">{t("kinds.label")}</p>
						<ul className="flex list-disc flex-col gap-1 pl-5 text-monti-muted-foreground text-xs leading-relaxed">
							<li>{t("kinds.backup")}</li>
						</ul>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<input
							ref={input}
							type="file"
							accept=".zip,application/zip"
							className="sr-only"
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
						<Button type="button" variant="outline" disabled={running} onClick={() => input.current?.click()}>
							{form.file ? t("file.change") : t("file.choose")}
						</Button>
						{form.file && (
							<span className="min-w-0 truncate text-monti-muted-foreground text-sm">{form.file.name}</span>
						)}
					</div>

					{form.tooLarge && form.limit !== undefined && (
						<Alert variant="destructive" layout="stack">
							<AlertDescription>{t("file.tooLarge", { limit: formatBytes(form.limit) })}</AlertDescription>
						</Alert>
					)}

					{form.file && !form.tooLarge && !preview && previewQuery.isPending && (
						<p className="text-monti-muted-foreground text-sm">{t("preview.loading")}</p>
					)}
					{previewQuery.isError && (
						<LoadErrorAlert
							message={errorText(site, previewQuery.error, t("preview.failed"))}
							onRetry={() => void previewQuery.refetch()}
						/>
					)}

					{preview && <PreviewView preview={preview} />}

					{Boolean(form.runError) && (
						<Alert variant="destructive" layout="stack" data-testid="restore-error">
							<AlertDescription>{errorText(site, form.runError, t("error.run"))}</AlertDescription>
						</Alert>
					)}

					{running && preview && <RunProgress count={preview.counts.entries} />}

					{preview && (
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								disabled={running || !preview.ready}
								onClick={() => void restore()}
								data-testid="restore-run"
							>
								{t("action.restore")}
							</Button>
							<Button type="button" variant="ghost" disabled={running} onClick={form.reset}>
								{t("action.cancel")}
							</Button>
						</div>
					)}
				</>
			)}

			{result && <ResultView form={form} />}
			{dialog}
		</div>
	);
}
