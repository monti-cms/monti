import { importNotice } from "../../../../services/entry-import/notice";
import { planRestore, runRestore } from "../../../../services/restore/plan";
import { adminRoute, CmsError, ok } from "../../handler";
import { readImportUpload } from "../upload";
import { presentPreview, presentRun, tellProblem } from "./present";

/**
 * Whether this site can take a backup: it can only when it holds no entries, folders or media records. The Data page reads it to disable the card before a file is chosen.
 */
export const GET = adminRoute(async ({ cms }) => {
	const content = await cms.store().countSiteContent();
	return ok({ empty: content.entries + content.folders + content.media === 0, ...content });
});

/**
 * Restores a full admin backup (an export of this version with `scope=admin` and no selection) into an EMPTY site, exactly as it was (admin only): the same
 * ids, versions, statuses, dates, draft and published bodies, translations, folders, media records, former addresses (so old URLs keep redirecting) and
 * references. The seeded templates stay and the archive's templates are added. Preferences, accounts, API keys, AI connections and event logs are not
 * restored, and no content event is written, so plugins are not notified. The answer says what was and was not restored.
 *
 * It is all or nothing. The archive is checked against the current schema first (every body, folder, media record, translation source and reference),
 * and any problem refuses the restore with the problems listed per entry. The write is one database transaction, which checks the site is empty again.
 * The upload has the size limit of the entry import (`limits.importBytes` of `/v1/meta`; 413 above it).
 *
 * `multipart/form-data` fields:
 * - `file`: the zip.
 * - `mode`: `preview` (writes nothing, answers what a restore would do and whether it can) or `run`.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { bytes, mode } = await readImportUpload(request);
	const preview = await planRestore(cms, bytes);
	if (mode === "preview") return ok(presentPreview(cms.site, preview));

	if (!preview.isBackup) throw importNotice("restore.not_backup");
	if (!preview.empty) throw new CmsError("The site is not empty", "conflict", { notice: { key: "restore.not_empty" } });
	if (preview.problems.length > 0) {
		throw new CmsError("The backup does not fit this site", "validation_failed", {
			notice: { key: "restore.problems" },
			details: { problems: preview.problems.map((problem) => tellProblem(cms.site, problem)) },
		});
	}
	const result = await runRestore(cms, preview);
	return ok(presentRun(cms.site, preview, result));
});
