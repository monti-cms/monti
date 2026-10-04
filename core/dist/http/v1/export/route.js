import { getCmsContentStore } from "../../../container.js";
import { exportScopeSchema } from "../../../core/api.js";
import { buildExportArchive } from "../../../services/export-service.js";
import { adminRoute, parseWith, readJsonBody, readQuery } from "../handler.js";
const buildResponse = async (scope) => {
    const snapshot = await getCmsContentStore().readExportSnapshot();
    const exportedAt = new Date();
    const archive = buildExportArchive(snapshot, { scope, exportedAt });
    return new Response(archive.zip, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="cms-export-${scope}-${exportedAt.toISOString().replace(/[:.]/g, "-")}.zip"`,
            "Content-Length": String(archive.zip.byteLength),
            "X-Cms-Export-Digest": archive.digest,
            "X-Cms-Export-Scope": scope,
            "X-Cms-Export-Files": String(archive.manifest.counts.files),
            "Cache-Control": "no-store",
        },
    });
};
const scopeFrom = (value) => parseWith(exportScopeSchema, value, "Invalid export scope").scope;
/** Admin export. GET is also open so it can be downloaded via a link. */
export const GET = adminRoute(async ({ request }) => buildResponse(scopeFrom(readQuery(request))));
export const POST = adminRoute(async ({ request }) => buildResponse(scopeFrom(await readJsonBody(request))));
