import { exportOptionsSchema } from "../../../core/api.js";
import { buildExportArchive } from "../../../services/export-service.js";
import { adminRoute, parseWith, readJsonBody, readQuery } from "../handler.js";
import { exportTexts, readExportPlan } from "./plan.js";
const buildResponse = async (cms, { scope, format, ids }) => {
    const plan = await readExportPlan(cms, { scope, ids });
    const exportedAt = new Date();
    const texts = format === undefined ? undefined : await exportTexts(cms, plan, scope, format);
    const archive = buildExportArchive(plan.snapshot, {
        site: cms.site,
        scope,
        exportedAt,
        selection: plan.selection,
        ...(texts ? { texts } : {}),
    });
    return new Response(archive.zip, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="monti-export-${scope}-${exportedAt.toISOString().replace(/[:.]/g, "-")}.zip"`,
            "Content-Length": String(archive.zip.byteLength),
            "X-Monti-Export-Digest": archive.digest,
            "X-Monti-Export-Scope": scope,
            "X-Monti-Export-Files": String(archive.manifest.counts.files),
            // How many bodies are in the archive as JSON only because the format could not write them (0: every body was written).
            "X-Monti-Export-Not-Written": String(archive.manifest.notWritten.length),
            "Cache-Control": "no-store",
        },
    });
};
const optionsFrom = (value) => parseWith(exportOptionsSchema, value, "Invalid export options");
/**
 * Admin export. GET is also open so it can be downloaded via a link. The archive holds the stored documents; `format=<name>` also writes every body as a text
 * file in that format, and `ids` limits it to those entries and their translations (`GET /export/summary` says what it would hold).
 */
export const GET = adminRoute(async ({ request, cms }) => buildResponse(cms, optionsFrom(readQuery(request))));
export const POST = adminRoute(async ({ request, cms }) => buildResponse(cms, optionsFrom(await readJsonBody(request))));
