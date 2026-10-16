"use client";

// The banners under the header of the entry editor screen: trash notice, unreadable body, save error, publish problems and "source changed".

import type { FormatIssue } from "@monti-cms/core/format";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { type CmsIssue, cmsIssueMessage } from "../../api/error-message";
import { Button } from "../../ui/button";
import { FieldError } from "../../ui/field";
import { nounVars } from "../shared/noun.messages";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";

interface EntryEditorBannersProps {
	editor: EntryEditor;
	/** The body could not be read and the source panel is the only way to fix it. */
	visualUnavailable: boolean;
	/** The first thing the source panel found wrong with the text, shown beside the unavailable notice. */
	sourceProblem?: FormatIssue;
	onFocusIssue: (issue: CmsIssue) => void;
	/** Whether to show the "source changed" bar, with its two actions. */
	sourceChanged: boolean;
	onCompareSource: () => void;
}

export function EntryEditorBanners({
	editor,
	visualUnavailable,
	sourceProblem,
	onFocusIssue,
	sourceChanged,
	onCompareSource,
}: EntryEditorBannersProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const { entry, collection, saveStatus, publishIssues } = editor;
	const isReadOnly = editor.readOnly;
	const isTrashed = entry?.status === "trashed";
	return (
		<>
			{isTrashed && (
				<section
					aria-label={t("trash")}
					className="flex flex-wrap items-center gap-2 border-b bg-cms-muted px-4 py-2 text-sm"
				>
					<span>{t("trashNotice", nounVars(site, collection))}</span>
				</section>
			)}
			{visualUnavailable && (
				<output className="border-b bg-cms-warning-soft px-4 py-2 text-cms-warning-foreground text-sm">
					{t("visualUnavailable")} {sourceProblem ? cmsIssueMessage(site, sourceProblem) : ""}
				</output>
			)}
			{editor.saveError && ["failed", "session-expired"].includes(saveStatus) && (
				<FieldError className="border-b px-4 py-2 text-sm">{editor.saveError.message}</FieldError>
			)}
			{publishIssues.length > 0 && (
				<ul className="max-h-36 overflow-y-auto border-b px-4 py-2 text-sm" aria-label={t("publishProblems")}>
					{publishIssues.map((issue) => (
						<li key={JSON.stringify(issue)}>
							<Button
								type="button"
								variant="link"
								size="xs"
								className="h-auto whitespace-normal px-0 text-left"
								onClick={() => onFocusIssue(issue)}
							>
								{cmsIssueMessage(site, issue)}
							</Button>
						</li>
					))}
				</ul>
			)}

			{sourceChanged && (
				<output className="flex flex-wrap items-center gap-2 border-b bg-cms-warning-soft px-4 py-1.5 text-sm">
					<span className="flex-1 font-medium text-cms-warning-foreground">{t("sourceChanged")}</span>
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
