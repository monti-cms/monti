import type { Cms } from "../../../cms";
import { normalizeImportedDoc } from "../../../core/import-normalize";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { readStoredDocument, type StoredDocument } from "../../../doc/stored-document";
import { exportText, importText } from "../../../format/convert";
import { createExportRefs } from "../../../read";
import { mediaUrlResolver } from "../../../services/media-urls";
import { linkResolverOf } from "../../../services/write-pipeline";

const normalize = (cms: Cms, doc: StoredDocument): Promise<StoredDocument> =>
	normalizeImportedDoc(doc, {
		links: linkResolverOf(cms.store()),
		...(cms.isMediaConfigured ? { media: mediaUrlResolver(cms.store, cms.mediaStore) } : {}),
	});

/**
 * The body of a template request as a document, or `undefined` when the request carries none. A text is read by its format (a text the format rejects
 * fails the request with `format_import_failed` and the format's findings: a template has no place to keep text that is not a document). Like any imported
 * body, the result goes through core's normalisation, so links and media are by id. A document is checked by the store, which also gives its blocks ids.
 */
export async function templateBodyOf(
	cms: Cms,
	input: { readonly doc?: unknown; readonly body?: string; readonly format?: string },
	previous?: StoredDocument | null,
): Promise<unknown> {
	if (input.body === undefined || input.format === undefined) {
		if (input.doc === undefined) return undefined;
		const read = readStoredDocument(input.doc);
		// What is not a stored document is rejected by the store (`invalid_input`).
		return read ? normalize(cms, read) : input.doc;
	}
	const imported = await importText(await cms.formats(), input.format, input.body, {
		locale: DEFAULT_LOCALE,
		previous,
		strict: true,
	});
	return normalize(cms, imported.doc);
}

/**
 * Templates as the API returns them. With a `format`, each also carries `body`: its document as text in that format, written to be imported again
 * (`sync`: links by path, an unresolved link keeps its id). An unknown format fails the request.
 */
export async function templatesJson<T extends { readonly doc: StoredDocument }>(
	cms: Cms,
	templates: readonly T[],
	format: string | undefined,
): Promise<(T & { body?: string })[]> {
	if (format === undefined) return [...templates];
	const formats = await cms.formats();
	const refsOf = createExportRefs({ store: cms.store, mediaStore: cms.mediaStore }, "working");
	return Promise.all(
		templates.map(async (template) => {
			const { text } = await exportText(formats, format, template.doc, {
				locale: DEFAULT_LOCALE,
				purpose: "sync",
				refs: await refsOf(template.doc, DEFAULT_LOCALE),
			});
			return { ...template, body: text };
		}),
	);
}
