import type { NextRequest } from "next/server";
import { getCmsContentStore } from "../../../container";
import { exportScopeSchema } from "../../../core/api";
import { buildExportArchive, type ExportScope } from "../../../services/export-service";
import { adminRoute, parseWith, readJsonBody, readQuery } from "../handler";

const buildResponse = async (scope: ExportScope): Promise<Response> => {
	const snapshot = await getCmsContentStore().readExportSnapshot();
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

/** 관리자 내보내기(§11.4). 링크로 받을 수 있게 GET도 연다. */
export const GET = adminRoute(async ({ request }) => buildResponse(scopeFrom(readQuery(request as NextRequest))));

export const POST = adminRoute(async ({ request }) => buildResponse(scopeFrom(await readJsonBody(request))));
