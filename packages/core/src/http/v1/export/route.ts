import type { Cms } from "../../../cms";
import { exportScopeSchema } from "../../../core/api";
import type { ExportSnapshot } from "../../../core/store";
import { exportText } from "../../../format/convert";
import { unknownFormatError } from "../../../format/unknown";
import { createExportRefs } from "../../../read";
import {
	buildExportArchive,
	type ExportScope,
	type ExportTexts,
	exportTextKey,
} from "../../../services/export-service";
import { adminRoute, parseWith, readJsonBody, readQuery } from "../handler";

/**
 * Writes the bodies of an export as text in a format. The admin archive is a backup, so its texts are written to be imported again (`sync`: links by path,
 * an unresolved link keeps its id, media by id) and resolve links to the current address of any entry. The public archive is for readers: only published
 * entries, links as readers see them (an unpublished target is not a link), images by public URL.
 */
async function exportTexts(
	cms: Cms,
	snapshot: ExportSnapshot,
	scope: ExportScope,
	format: string,
): Promise<ExportTexts> {
	const registry = await cms.formats();
	const found = registry.get(format);
	if (!found) throw unknownFormatError(format, registry);
	const purpose = scope === "public" ? "read" : "sync";
	const refsOf = createExportRefs(
		{ site: cms.site, store: cms.store, mediaStore: cms.mediaStore },
		scope === "public" ? "published" : "working",
	);
	const bodies = new Map<string, string>();
	const write = async (key: string, doc: Parameters<typeof refsOf>[0], locale: string) => {
		const { text } = await exportText(cms.site, registry, format, doc, {
			locale,
			purpose,
			refs: await refsOf(doc, locale),
		});
		bodies.set(key, text);
	};
	for (const entry of snapshot.entries) {
		if (scope === "public") {
			if (entry.status === "published" && entry.published) {
				await write(exportTextKey(entry.id, "published"), entry.published.doc, entry.locale);
			}
			continue;
		}
		await write(exportTextKey(entry.id, "working"), entry.working.doc, entry.locale);
		if (entry.published) await write(exportTextKey(entry.id, "published"), entry.published.doc, entry.locale);
	}
	if (scope === "admin") {
		for (const template of snapshot.templates) {
			await write(exportTextKey(template.id, "template"), template.doc, cms.site.DEFAULT_LOCALE);
		}
	}
	return { format: { name: found.name, extension: found.extension }, bodies };
}

const buildResponse = async (cms: Cms, scope: ExportScope, format: string | undefined): Promise<Response> => {
	const snapshot = await cms.store().readExportSnapshot();
	const exportedAt = new Date();
	const texts = format === undefined ? undefined : await exportTexts(cms, snapshot, scope, format);
	const archive = buildExportArchive(snapshot, { site: cms.site, scope, exportedAt, ...(texts ? { texts } : {}) });

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

const optionsFrom = (value: unknown) => parseWith(exportScopeSchema, value, "Invalid export options");

/**
 * Admin export. GET is also open so it can be downloaded via a link. The archive holds the stored documents; `format=<name>` also writes every body as a text
 * file in that format.
 */
export const GET = adminRoute(async ({ request, cms }) => {
	const { scope, format } = optionsFrom(readQuery(request));
	return buildResponse(cms, scope, format);
});

export const POST = adminRoute(async ({ request, cms }) => {
	const { scope, format } = optionsFrom(await readJsonBody(request));
	return buildResponse(cms, scope, format);
});
