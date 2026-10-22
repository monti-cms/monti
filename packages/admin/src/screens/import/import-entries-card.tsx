"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Alert, AlertDescription, Button, Spinner } from "@monti-cms/ui";
import { useRef } from "react";
import { errorText } from "../../api/client";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { PreviewView } from "./import-preview";
import { ResultView } from "./import-result";
import { importMessages } from "./messages";
import { useImportEntries } from "./use-import-entries";

const formatBytes = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** What the run is doing: the server writes drafts, then bodies, then publishes, and answers when it is done, so the bar does not claim a percentage. */
function RunProgress({ count }: { count: number }) {
	const t = useTranslator(importMessages);
	return (
		<output className="flex flex-col gap-condensed" data-testid="import-progress">
			<div className="flex items-center gap-condensed text-monti-body text-monti-muted">
				<Spinner aria-hidden className="size-3.5" />
				{t("progress.running", { count })}
			</div>
			<div className="h-1 overflow-hidden rounded-sm bg-monti-neutral">
				<div className="h-full w-1/3 animate-pulse rounded-sm bg-monti-emphasis" />
			</div>
			<p className="text-monti-caption text-monti-muted">{t("progress.hint")}</p>
		</output>
	);
}

/**
 * The body of the Import entries card: choose a zip, read what it holds (the preview), pick where each collection goes, then import. The result replaces the
 * preview and links to every new entry.
 */
export function ImportEntriesFields() {
	const t = useTranslator(importMessages);
	const site = useSite();
	const form = useImportEntries();
	const input = useRef<HTMLInputElement>(null);
	const { preview, previewQuery, result } = form;
	const running = form.isRunning;

	return (
		<div className="flex flex-col gap-spacious">
			<div className="flex flex-col gap-condensed">
				<p className="font-medium text-monti-body">{t("kinds.label")}</p>
				<ul className="flex list-disc flex-col gap-tight pl-comfortable text-monti-caption text-monti-muted">
					<li>{t("kinds.export")}</li>
					<li>{t("kinds.markdown")}</li>
				</ul>
			</div>

			<div className="flex flex-wrap items-center gap-normal">
				<input
					ref={input}
					type="file"
					accept=".zip,application/zip"
					className="sr-only"
					aria-label={t("file.choose")}
					data-testid="import-file"
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
				{form.file && <span className="min-w-0 truncate text-monti-body text-monti-muted">{form.file.name}</span>}
			</div>

			{form.tooLarge && form.limit !== undefined && (
				<Alert tone="danger" layout="stack">
					<AlertDescription>{t("file.tooLarge", { limit: formatBytes(form.limit) })}</AlertDescription>
				</Alert>
			)}

			{form.file && !form.tooLarge && !preview && previewQuery.isPending && (
				<p className="text-monti-body text-monti-muted">{t("preview.loading")}</p>
			)}
			{previewQuery.isError && (
				<LoadErrorAlert
					message={errorText(site, previewQuery.error, t("preview.failed"))}
					onRetry={() => void previewQuery.refetch()}
				/>
			)}

			{preview && !result && (
				<div
					aria-busy={previewQuery.isPlaceholderData}
					className={previewQuery.isPlaceholderData ? "opacity-50 transition-opacity" : "transition-opacity"}
				>
					<PreviewView preview={preview} form={form} />
				</div>
			)}

			{Boolean(form.runError) && (
				<Alert tone="danger" layout="stack">
					<AlertDescription>{errorText(site, form.runError, t("error.run"))}</AlertDescription>
				</Alert>
			)}

			{running && preview && <RunProgress count={preview.counts.imported} />}

			{preview && !result && (
				<div className="flex flex-wrap items-center gap-condensed">
					<Button
						type="button"
						disabled={running || previewQuery.isPlaceholderData || preview.counts.imported === 0}
						onClick={form.start}
					>
						{t("action.import")}
					</Button>
					<Button type="button" variant="ghost" disabled={running} onClick={form.reset}>
						{t("action.cancel")}
					</Button>
					{preview.counts.imported === 0 && (
						<span className="text-monti-caption text-monti-muted">{t("nothing.description")}</span>
					)}
				</div>
			)}

			{result && (
				<>
					<ResultView result={result} />
					<div>
						<Button type="button" variant="outline" onClick={form.reset}>
							{t("action.again")}
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
