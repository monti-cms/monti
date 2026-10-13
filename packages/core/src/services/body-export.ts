import type { Cms } from "../cms";
import type { StoredDocument } from "../doc/stored-document";
import { exportText } from "../format/convert";
import type { FormatRegistry } from "../format/registry";
import { unknownFormatError } from "../format/unknown";
import { createExportRefs } from "../read";

type Source = "working" | "published";

/**
 * Writes stored documents as text in one format, for the admin API (`?format=`, the export archive). One place decides how:
 * - `purpose: "sync"` writes text to be imported again: links by path, an unresolved link keeps its id, media by id (the admin reads, templates and the admin archive);
 * - `purpose: "read"` writes what a reader sees: an unpublished target is not a link, images by public URL (the public archive).
 * `source` says which version of the entries the links are resolved against.
 */
export interface BodyExporter {
	readonly format: { readonly name: string; readonly extension: string };
	/** The document as text in the format. */
	text(doc: StoredDocument, locale: string): Promise<string>;
}

export async function createBodyExporter(
	cms: Pick<Cms, "site" | "formats" | "store" | "mediaStore">,
	options: { readonly format: string; readonly purpose?: "sync" | "read"; readonly source?: Source },
): Promise<BodyExporter> {
	const registry: FormatRegistry = await cms.formats();
	const found = registry.get(options.format);
	if (!found) throw unknownFormatError(options.format, registry);
	const refsOf = createExportRefs(
		{ site: cms.site, store: cms.store, mediaStore: cms.mediaStore },
		options.source ?? "working",
	);
	return {
		format: { name: found.name, extension: found.extension },
		text: async (doc, locale) =>
			(
				await exportText(cms.site, registry, options.format, doc, {
					locale,
					purpose: options.purpose ?? "sync",
					refs: await refsOf(doc, locale),
				})
			).text,
	};
}
