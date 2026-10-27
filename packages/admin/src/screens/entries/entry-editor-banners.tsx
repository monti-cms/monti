"use client";

// The banners under the header of the entry editor screen: trash notice, unreadable body, save error and "source changed".

import type { FormatIssue } from "@monti-cms/core/format";
import { issueText, useSite, useTranslator } from "@monti-cms/core/site";
import { Alert, Box, Button, FormFieldError, Inline, Text } from "@monti-cms/ui";
import { issueLine } from "../../api/error-message";
import { nounVars } from "../shared/noun.messages";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";

interface EntryEditorBannersProps {
	editor: EntryEditor;
	/** The body could not be read and the source panel is the only way to fix it. */
	visualUnavailable: boolean;
	/** The first thing the source panel found wrong with the text, shown beside the unavailable notice. */
	sourceProblem?: FormatIssue;
	/** Whether to show the "source changed" bar, with its two actions. */
	sourceChanged: boolean;
	onCompareSource: () => void;
}

export function EntryEditorBanners({
	editor,
	visualUnavailable,
	sourceProblem,
	sourceChanged,
	onCompareSource,
}: EntryEditorBannersProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const { entry, collection, saveStatus } = editor;
	const isReadOnly = editor.readOnly;
	const isTrashed = entry?.status === "trashed";
	return (
		<>
			{isTrashed && (
				<Box as="section" aria-label={t("trash")} background="muted" border="bottom" paddingX={16} paddingY={8}>
					<Inline wrap gap={8}>
						<Text>{t("trashNotice", nounVars(site, collection))}</Text>
					</Inline>
				</Box>
			)}
			{visualUnavailable && (
				<Alert role="status" tone="warning" layout="strip">
					{t("visualUnavailable")} {sourceProblem ? issueLine(issueText(site, sourceProblem)) : ""}
				</Alert>
			)}
			{editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (
				<Box border="bottom" paddingX={16} paddingY={8}>
					<FormFieldError>{editor.saveError.message}</FormFieldError>
				</Box>
			)}

			{sourceChanged && (
				<Alert role="status" tone="warning" layout="strip">
					<Text tone="warning" weight="medium">
						{t("sourceChanged")}
					</Text>
					<Inline gap={8}>
						<Button type="button" size="sm" variant="secondary" onClick={onCompareSource}>
							{t("compare")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={isReadOnly}
							onClick={editor.confirmTranslationSource}
						>
							{t("confirm")}
						</Button>
					</Inline>
				</Alert>
			)}
		</>
	);
}
