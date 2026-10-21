import { tellIssues } from "../../../../core/issue-text.js";
import { importNotice } from "../../../../services/entry-import/notice.js";
import { cmsErrorText } from "../../error-handler.js";
import { restoreMessages } from "./messages.js";
export function tellProblem(site, problem) {
    const text = site.createTranslator(restoreMessages)(problem.code, problem.params);
    const found = [];
    if (problem.error) {
        const { message } = cmsErrorText(site, problem.error);
        found.push(message);
        for (const issue of tellIssues(site, (problem.error.issues ?? []))) {
            found.push(issue.where ? `${issue.text} (${issue.where})` : issue.text);
        }
    }
    return { subject: problem.subject, id: problem.id, label: problem.label, code: problem.code, text, found };
}
const tellWarning = (site, warning) => ({
    code: warning.code,
    id: warning.id ?? null,
    label: warning.label ?? null,
    text: site.createTranslator(restoreMessages)(warning.code, warning.params),
});
const tellNotRestored = (site, item) => ({
    code: item.code,
    count: item.count ?? null,
    text: site.createTranslator(restoreMessages)(`not_restored_${item.code}`, item.count === undefined ? undefined : { count: item.count }),
});
const tellSkippedTemplates = (site, skipped) => skipped.map((template) => ({
    id: template.id,
    name: template.name,
    reason: template.reason,
    text: site.createTranslator(restoreMessages)(`template_skipped_${template.reason}`),
}));
/** What a restore would do, for the preview: the counts, the problems that stop it, the warnings, and what a restore does not bring back. */
export function presentPreview(site, preview) {
    const refusal = preview.isBackup ? null : cmsErrorText(site, importNotice("restore.not_backup"));
    return {
        mode: "preview",
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
export function presentRun(site, preview, result) {
    return {
        mode: "run",
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
