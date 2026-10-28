"use client";

// The banners under the header of the entry editor screen: trash notice, unreadable body, save error and "source changed".

import type { FormatIssue } from "@monti-cms/core/format";
import { issueText, trashDaysLeft, useSite, useTranslator } from "@monti-cms/core/site";
import { Banner, Box, FormFieldError, TextButton } from "@monti-cms/ui";
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
				<Banner
					tone="neutral"
					aria-label={t("trash")}
					title={t("trashNotice", nounVars(site, collection))}
					meta={
						entry?.deletedAt
							? t("trashNoticeMeta", { days: trashDaysLeft(new Date(entry.deletedAt), new Date()) })
							: undefined
					}
				/>
			)}
			{visualUnavailable && (
				<Banner
					title={t("visualUnavailable")}
					meta={sourceProblem ? issueLine(issueText(site, sourceProblem)) : undefined}
				/>
			)}
			{editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (
				<Box border="bottom" paddingX={16} paddingY={8}>
					<FormFieldError>{editor.saveError.message}</FormFieldError>
				</Box>
			)}

			{sourceChanged && (
				<Banner title={t("sourceChanged")}>
					<TextButton variant="underline" onClick={onCompareSource}>
						{t("compare")}
					</TextButton>
					<TextButton disabled={isReadOnly} onClick={editor.confirmTranslationSource}>
						{t("confirm")}
					</TextButton>
				</Banner>
			)}
		</>
	);
}
