import { splitTemplates } from "../../core/domain/restore.js";
import { readBackupArchive } from "./read-backup.js";
import { validateRestorePlan } from "./validate.js";
/** How many media files are looked up in storage at once. */
const HEAD_CONCURRENCY = 8;
/**
 * The media whose file is not in storage, as warnings. A restore brings back the records, not the files, so a backup restored into a site that uses other
 * storage has records that point at nothing. When the site has no storage, or a lookup fails (an outage), the files are not checked, and that is said once.
 */
async function checkMediaFiles(host, media) {
    const files = media.filter((asset) => asset.status === "ready" && asset.storageKey);
    if (files.length === 0)
        return [];
    if (!host.isMediaConfigured)
        return [{ code: "files_not_checked" }];
    const store = host.mediaStore();
    const warnings = [];
    let failed = false;
    let next = 0;
    const worker = async () => {
        for (let index = next++; index < files.length; index = next++) {
            const asset = files[index];
            if (!asset?.storageKey)
                continue;
            try {
                if ((await store.headFile({ key: asset.storageKey })) === null) {
                    warnings.push({
                        code: "media_file_missing",
                        id: asset.id,
                        label: asset.filename,
                        params: { key: asset.storageKey },
                    });
                }
            }
            catch {
                failed = true;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(HEAD_CONCURRENCY, files.length) }, worker));
    if (failed)
        return [{ code: "files_not_checked" }];
    return warnings.sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""));
}
/**
 * Reads an uploaded backup and says what restoring it would do, and whether it can. Nothing is written. The site must be empty (no entries, folders or media
 * records; the seeded templates may be there) and the archive a full backup; every body is checked against the current schema. The store checks the emptiness
 * again inside the transaction of the run.
 */
export async function planRestore(host, bytes) {
    const read = readBackupArchive(bytes);
    const store = host.store();
    const content = await store.countSiteContent();
    const empty = content.entries + content.folders + content.media === 0;
    const { plan } = read;
    const problems = [...read.problems];
    if (read.isBackup)
        problems.push(...(await validateRestorePlan(host.site, plan)));
    const warnings = read.isBackup && problems.length === 0 ? await checkMediaFiles(host, plan.media) : [];
    const templates = splitTemplates(await store.listTemplates(), plan.templates);
    const byStatus = { draft: 0, published: 0, archived: 0, trashed: 0 };
    for (const entry of plan.entries)
        byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    return {
        isBackup: read.isBackup,
        empty,
        plan,
        counts: {
            entries: plan.entries.length,
            byStatus,
            translations: plan.entries.filter((entry) => entry.translationGroupId !== entry.id).length,
            folders: plan.folders.length,
            media: plan.media.length,
            addresses: plan.addresses.length,
            aliases: plan.addresses.filter((address) => address.type === "alias").length,
            templatesAdded: templates.add.length,
            templatesSkipped: templates.skipped,
        },
        problems,
        warnings,
        notRestored: read.notRestored,
        ready: read.isBackup && empty && problems.length === 0,
    };
}
/** Restores a previewed backup in one transaction. The caller has checked that it is `ready`; the store checks the site is still empty. */
export const runRestore = (host, preview) => host.store().restoreArchive(preview.plan);
