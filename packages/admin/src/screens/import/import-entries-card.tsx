"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Banner,
	Box,
	Button,
	FormFieldError,
	Inline,
	Input,
	List,
	ListItem,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useRef } from "react";
import { errorText } from "../../api/client";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { PreviewView } from "./import-preview";
import { ResultView } from "./import-result";
import { importMessages } from "./messages";
import { useImportEntries } from "./use-import-entries";

const formatBytes = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** What the run is doing: the server writes drafts, then bodies, then publishes, and answers when it is done, so there is no bar, only the words (a step that cannot be measured has none). */
function RunProgress({ count }: { count: number }) {
	const t = useTranslator(importMessages);
	return (
		<output data-testid="import-progress">
			<Stack gap={8}>
				<Text tone="muted">{t("progress.running", { count })}</Text>
				<Text as="p" variant="caption" tone="muted">
					{t("progress.hint")}
				</Text>
			</Stack>
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
		<Stack gap={24}>
			<Stack gap={8}>
				<Text as="p" weight="medium">
					{t("kinds.label")}
				</Text>
				<List>
					<ListItem>
						<Text variant="caption" tone="muted">
							{t("kinds.export")}
						</Text>
					</ListItem>
					<ListItem>
						<Text variant="caption" tone="muted">
							{t("kinds.markdown")}
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
					data-testid="import-file"
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

			{preview && !result && (
				<Box dimmed={previewQuery.isPlaceholderData} aria-busy={previewQuery.isPlaceholderData}>
					<PreviewView preview={preview} form={form} />
				</Box>
			)}

			{Boolean(form.runError) && (
				<Banner role="alert" tone="danger" title={errorText(site, form.runError, t("error.run"))} />
			)}

			{running && preview && <RunProgress count={preview.counts.imported} />}

			{preview && !result && (
				<Inline gap={8} wrap>
					<Button
						type="button"
						disabled={running || previewQuery.isPlaceholderData || preview.counts.imported === 0}
						onClick={form.start}
					>
						{t("action.import")}
					</Button>
					<TextButton type="button" disabled={running} onClick={form.reset}>
						{t("action.cancel")}
					</TextButton>
					{preview.counts.imported === 0 && (
						<Text variant="caption" tone="muted">
							{t("nothing.description")}
						</Text>
					)}
				</Inline>
			)}

			{result && (
				<>
					<ResultView result={result} />
					<Box>
						<Button type="button" variant="secondary" onClick={form.reset}>
							{t("action.again")}
						</Button>
					</Box>
				</>
			)}
		</Stack>
	);
}
