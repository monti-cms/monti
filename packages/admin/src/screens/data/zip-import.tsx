"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Button, FormFieldError, Inline, Input, Stack, Text } from "@monti-cms/ui";
import { useRef } from "react";
import { errorText } from "../../api/client";
import { ImportSheet } from "../import/import-sheet";
import { importMessages } from "../import/messages";
import { RestoreSheet } from "../restore/restore-sheet";
import { type DataZip, useDataZip } from "./use-data-zip";

const formatBytes = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** What the page says about the chosen file until a sheet can open: that it is being read, or why it cannot be. */
function ZipStatus({ zip }: { zip: DataZip }) {
	const t = useTranslator(importMessages);
	const site = useSite();
	if (zip.phase === "reading") {
		return (
			<Text variant="caption" tone="muted" role="status">
				{t("preview.loading")}
			</Text>
		);
	}
	if (zip.phase === "too-large" && zip.limit !== undefined) {
		return <FormFieldError>{t("file.tooLarge", { limit: formatBytes(zip.limit) })}</FormFieldError>;
	}
	if (zip.phase === "failed") {
		return <FormFieldError>{errorText(site, zip.imports.previewQuery.error, t("preview.failed"))}</FormFieldError>;
	}
	return null;
}

/**
 * Choosing a zip on the Data page, and the sheet it opens once it is read: the restore of a full backup into an empty site, or the import of
 * entries from any other zip. Until then the page says it is reading, or why it cannot read it.
 */
export function ZipImport() {
	const t = useTranslator(importMessages);
	const zip = useDataZip();
	const input = useRef<HTMLInputElement>(null);
	const { file } = zip;
	return (
		<Stack gap={8}>
			<Inline gap={12} wrap align="center">
				<Input
					ref={input}
					type="file"
					accept=".zip,application/zip"
					srOnly
					aria-label={t("file.choose")}
					disabled={zip.busy}
					onChange={(event) => {
						const picked = event.target.files?.[0];
						if (picked) zip.choose(picked);
						// The same file chosen again must still fire a change.
						event.target.value = "";
					}}
				/>
				<Button type="button" variant="secondary" disabled={zip.busy} onClick={() => input.current?.click()}>
					{t("file.choose")}
				</Button>
				<Text variant="caption" tone="subtle" mono>
					{t("kinds.hint")}
				</Text>
			</Inline>
			{file && (
				<Inline gap={12} wrap align="baseline">
					<Text mono>{file.name}</Text>
					<ZipStatus zip={zip} />
				</Inline>
			)}
			{file && zip.phase === "import" && zip.imports.preview && (
				<ImportSheet file={file.name} preview={zip.imports.preview} form={zip.imports} onClose={zip.close} />
			)}
			{file && zip.phase === "restore" && (
				<RestoreSheet file={file.name} preview={zip.restore.preview} form={zip.restore} onClose={zip.close} />
			)}
		</Stack>
	);
}
