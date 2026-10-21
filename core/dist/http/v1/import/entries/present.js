import { tellIssues } from "../../../../core/issue-text.js";
import { cmsErrorText } from "../../error-handler.js";
import { importMessages } from "./messages.js";
export const tellReason = (site, reason) => {
    if (reason.code === "write_failed" && reason.error) {
        const { message, fix } = cmsErrorText(site, reason.error);
        // What the write found wrong with the content (a required value missing, a link that does not resolve) says more than the code alone.
        const found = tellIssues(site, (reason.error.issues ?? [])).map((issue) => issue.where ? `${issue.text} (${issue.where})` : issue.text);
        return { code: reason.code, text: [message, ...found].join(" "), ...(fix && found.length === 0 ? { fix } : {}) };
    }
    return { code: reason.code, text: site.createTranslator(importMessages)(reason.code, reason.params) };
};
const tellStep = (site, step) => step === null ? null : { status: step.status, ...(step.reason ? { reason: tellReason(site, step.reason) } : {}) };
const bodyOf = (entry) => {
    const { body } = entry.source;
    return body === null ? null : body.kind === "text" ? { kind: "text", format: body.format } : { kind: "json" };
};
/**
 * What an import would do, for the preview: the archive's collections and where each goes, every entry with its target and what happens to it, the values that
 * are not read, and the counts that sum it up. It carries everything the person needs to decide, and nothing is written.
 */
export function presentPlan(site, plan) {
    const entries = plan.entries.map((entry) => ({
        key: entry.source.key,
        collection: entry.source.collection,
        target: entry.target,
        title: entry.title,
        slug: entry.slug,
        locale: entry.source.locale,
        isTranslation: !entry.source.isSource,
        body: bodyOf(entry),
        published: entry.source.published,
        outsideImages: entry.outsideImages,
        keptLinks: entry.keptLinks,
        skipped: entry.skip ? tellReason(site, entry.skip) : null,
        notes: entry.notes.map((note) => tellReason(site, note)),
    }));
    const imported = plan.entries.filter((entry) => entry.skip === null);
    return {
        mode: "preview",
        kind: plan.kind,
        collections: plan.collections.map((collection) => ({
            name: collection.name,
            entries: collection.entries,
            target: collection.target,
            skipped: collection.skipped ? tellReason(site, collection.skipped) : null,
        })),
        targets: plan.targets,
        entries,
        fieldsNotImported: plan.fieldsNotImported,
        counts: {
            entries: plan.entries.length,
            imported: imported.length,
            skipped: plan.entries.length - imported.length,
            conflicts: plan.entries.filter((entry) => entry.skip?.code === "slug_exists").length,
            publishable: imported.filter((entry) => entry.source.published).length,
            outsideImages: imported.reduce((sum, entry) => sum + entry.outsideImages, 0),
            keptLinks: imported.reduce((sum, entry) => sum + entry.keptLinks, 0),
            otherFiles: plan.otherFiles,
        },
    };
}
/** The per-entry results of a run, with the text of each reason and warning in the admin language. */
export function presentResults(site, results) {
    return {
        mode: "run",
        results: results.map((result) => ({
            key: result.key,
            collection: result.collection,
            target: result.target,
            locale: result.locale,
            title: result.title,
            slug: result.slug,
            id: result.id,
            outcome: result.outcome,
            create: tellStep(site, result.create),
            body: tellStep(site, result.body),
            publish: tellStep(site, result.publish),
            warnings: tellIssues(site, result.warnings),
            notes: result.notes.map((note) => tellReason(site, note)),
        })),
        counts: {
            imported: results.filter((result) => result.outcome === "imported").length,
            draft: results.filter((result) => result.outcome === "draft").length,
            skipped: results.filter((result) => result.outcome === "skipped").length,
            failed: results.filter((result) => result.outcome === "failed").length,
            published: results.filter((result) => result.publish?.status === "done").length,
        },
    };
}
