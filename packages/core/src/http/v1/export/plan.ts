import type { z } from "zod";
import type { Cms } from "../../../cms";
import type { exportOptionsSchema } from "../../../core/api";
import type { StoredDocument } from "../../../doc/stored-document";
import { unknownFormatError } from "../../../format/unknown";
import { createBodyExporter } from "../../../services/body-export";
import {
	type ExportNotWritten,
	type ExportPlan,
	type ExportScope,
	type ExportTexts,
	exportTextKey,
	planExport,
} from "../../../services/export-service";

export type ExportOptions = z.output<typeof exportOptionsSchema>;

/** What an export holds, read from the store: the whole site, or the selection with its translation groups. */
export async function readExportPlan(
	cms: Cms,
	options: Pick<ExportOptions, "scope" | "ids" | "collection">,
): Promise<ExportPlan> {
	const snapshot = await cms.store().readExportSnapshot();
	if (options.collection === undefined) return planExport(snapshot, { scope: options.scope, ids: options.ids });
	// A collection is a selection of all its entries: an empty one exports nothing, not the whole site.
	const asked = options.ids ? new Set(options.ids) : undefined;
	const ids = snapshot.entries
		.filter((entry) => entry.collection === options.collection && (!asked || asked.has(entry.id)))
		.map((entry) => entry.id);
	return planExport(snapshot, { scope: options.scope, ids });
}

/** Fails with `unknown_format` before any work is done if no installed format has that name. */
export async function assertFormatInstalled(cms: Cms, format: string): Promise<void> {
	const registry = await cms.formats();
	if (!registry.get(format)) throw unknownFormatError(format, registry);
}

const reasonOf = (error: unknown): string => {
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === "string" ? code : "format_export_failed";
};

/**
 * Writes the bodies of an export as text in a format. The admin archive is a backup, so its texts are written to be imported again (`sync`: links by path,
 * an unresolved link keeps its id, media by id) and resolve links to the current address of any entry. The public archive is for readers: only published
 * entries, links as readers see them (an unpublished target is not a link), images by public URL.
 *
 * A body the format cannot write is not an error of the export: its JSON document stays in the archive, its text file is skipped and it is listed in
 * `notWritten`. Only a format nobody provides fails the export.
 */
export async function exportTexts(
	cms: Cms,
	plan: ExportPlan,
	scope: ExportScope,
	format: string,
): Promise<ExportTexts> {
	const exporter = await createBodyExporter(cms, {
		format,
		purpose: scope === "public" ? "read" : "sync",
		source: scope === "public" ? "published" : "working",
	});
	const bodies = new Map<string, string>();
	const notWritten: ExportNotWritten[] = [];
	const write = async (id: string, state: ExportNotWritten["state"], doc: StoredDocument, locale: string) => {
		try {
			bodies.set(exportTextKey(id, state), await exporter.text(doc, locale));
		} catch (error) {
			notWritten.push({ id, state, reason: reasonOf(error) });
		}
	};
	const { snapshot } = plan;
	for (const entry of snapshot.entries) {
		if (scope === "public") {
			if (entry.status === "published" && entry.published) {
				await write(entry.id, "published", entry.published.doc, entry.locale);
			}
			continue;
		}
		await write(entry.id, "working", entry.working.doc, entry.locale);
		if (entry.published) await write(entry.id, "published", entry.published.doc, entry.locale);
	}
	if (scope === "admin") {
		for (const template of snapshot.templates) {
			await write(template.id, "template", template.doc, cms.site.DEFAULT_LOCALE);
		}
	}
	return { format: exporter.format, bodies, notWritten };
}
