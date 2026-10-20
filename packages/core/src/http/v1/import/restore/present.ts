import { tellIssues } from "../../../../core/issue-text";
import type { RestoreResult } from "../../../../core/store/types";
import type { Issue } from "../../../../core/types";
import { importNotice } from "../../../../services/entry-import/notice";
import type { NotRestored, RestorePreview, RestoreProblem, RestoreWarning } from "../../../../services/restore/types";
import type { Site } from "../../../../site";
import { cmsErrorText } from "../../error-handler";
import { restoreMessages } from "./messages";

/** A problem as the answer sends it: what it is about, its code, and the text in the admin language (with what the failed check found, when it found something). */
export interface ToldProblem {
	readonly subject: RestoreProblem["subject"];
	readonly id: string | null;
	readonly label: string | null;
	readonly code: string;
	readonly text: string;
	/** What a failed check of the content found wrong, one line each. */
	readonly found: string[];
}

export function tellProblem(site: Site, problem: RestoreProblem): ToldProblem {
	const text = site.createTranslator(restoreMessages)(problem.code, problem.params);
	const found: string[] = [];
	if (problem.error) {
		const { message } = cmsErrorText(site, problem.error);
		found.push(message);
		for (const issue of tellIssues(site, (problem.error.issues ?? []) as readonly Issue[])) {
			found.push(issue.where ? `${issue.text} (${issue.where})` : issue.text);
		}
	}
	return { subject: problem.subject, id: problem.id, label: problem.label, code: problem.code, text, found };
}

const tellWarning = (site: Site, warning: RestoreWarning) => ({
	code: warning.code,
	id: warning.id ?? null,
	label: warning.label ?? null,
	text: site.createTranslator(restoreMessages)(warning.code, warning.params),
});

const tellNotRestored = (site: Site, item: NotRestored) => ({
	code: item.code,
	count: item.count ?? null,
	text: site.createTranslator(restoreMessages)(
		`not_restored_${item.code}`,
		item.count === undefined ? undefined : { count: item.count },
	),
});

const tellSkippedTemplates = (site: Site, skipped: RestoreResult["templatesSkipped"]) =>
	skipped.map((template) => ({
		id: template.id,
		name: template.name,
		reason: template.reason,
		text: site.createTranslator(restoreMessages)(`template_skipped_${template.reason}`),
	}));

/** What a restore would do, for the preview: the counts, the problems that stop it, the warnings, and what a restore does not bring back. */
export function presentPreview(site: Site, preview: RestorePreview) {
	const refusal = preview.isBackup ? null : cmsErrorText(site, importNotice("restore.not_backup"));
	return {
		mode: "preview" as const,
		ready: preview.ready,
		isBackup: preview.isBackup,
		/** The text that says why the archive is not a backup. */
		refusal: refusal ? { text: refusal.message, ...(refusal.fix ? { fix: refusal.fix } : {}) } : null,
		empty: preview.empty,
		counts: {
			...preview.counts,
			templatesSkipped: tellSkippedTemplates(site, preview.counts.templatesSkipped),
		},
		problems: preview.problems.map((problem) => tellProblem(site, problem)),
		warnings: preview.warnings.map((warning) => tellWarning(site, warning)),
		notRestored: preview.notRestored.map((item) => tellNotRestored(site, item)),
	};
}

/** What a restore wrote, with the warnings and the data it left out. */
export function presentRun(site: Site, preview: RestorePreview, result: RestoreResult) {
	return {
		mode: "run" as const,
		counts: {
			entries: result.entries,
			byStatus: result.byStatus,
			translations: result.translations,
			folders: result.folders,
			media: result.media,
			addresses: result.addresses,
			aliases: preview.counts.aliases,
			templatesAdded: result.templatesAdded,
			templatesSkipped: tellSkippedTemplates(site, result.templatesSkipped),
		},
		warnings: preview.warnings.map((warning) => tellWarning(site, warning)),
		notRestored: preview.notRestored.map((item) => tellNotRestored(site, item)),
	};
}
