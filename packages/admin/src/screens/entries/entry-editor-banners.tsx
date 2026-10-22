"use client";

// The banners under the header of the entry editor screen: trash notice, unreadable body, save error and "source changed".

import type { FormatIssue } from "@monti-cms/core/format";
import { issueText, useSite, useTranslator } from "@monti-cms/core/site";
import { Button, FormFieldError } from "@monti-cms/ui";
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
				<section
					aria-label={t("trash")}
					className="flex flex-wrap items-center gap-2 border-b bg-monti-neutral px-4 py-2 text-monti-body"
				>
					<span>{t("trashNotice", nounVars(site, collection))}</span>
				</section>
			)}
			{visualUnavailable && (
				<output className="border-b bg-monti-warning-muted px-4 py-2 text-monti-body text-monti-warning">
					{t("visualUnavailable")} {sourceProblem ? issueLine(issueText(site, sourceProblem)) : ""}
				</output>
			)}
			{editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (
				<FormFieldError className="border-b px-4 py-2 text-monti-body">{editor.saveError.message}</FormFieldError>
			)}

			{sourceChanged && (
				<output className="flex flex-wrap items-center gap-2 border-b bg-monti-warning-muted px-4 py-2 text-monti-body">
					<span className="flex-1 font-medium text-monti-warning">{t("sourceChanged")}</span>
					<Button type="button" size="sm" variant="outline" onClick={onCompareSource}>
						{t("compare")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isReadOnly}
						onClick={editor.confirmTranslationSource}
					>
						{t("confirm")}
					</Button>
				</output>
			)}
		</>
	);
}
