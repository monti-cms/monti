import type { NextRequest } from "next/server";
import type { Cms } from "../../../cms";
import { exportScopeSchema } from "../../../core/api";
import { buildExportArchive, type ExportScope } from "../../../services/export-service";
import { adminRoute, parseWith, readJsonBody, readQuery } from "../handler";

const buildResponse = async (cms: Cms, scope: ExportScope): Promise<Response> => {
	const snapshot = await cms.store().readExportSnapshot();
	const exportedAt = new Date();
	const archive = buildExportArchive(snapshot, { scope, exportedAt });

	return new Response(archive.zip as unknown as BodyInit, {
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

const scopeFrom = (value: unknown) => parseWith(exportScopeSchema, value, "Invalid export scope").scope;

/** Admin export. GET is also open so it can be downloaded via a link. */
export const GET = adminRoute(async ({ request, cms }) =>
	buildResponse(cms, scopeFrom(readQuery(request as NextRequest))),
);

export const POST = adminRoute(async ({ request, cms }) => buildResponse(cms, scopeFrom(await readJsonBody(request))));
