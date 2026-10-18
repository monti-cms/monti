import { patchEntryBodySchema } from "../../../../core/api";
import type { StoredDocument } from "../../../../doc/stored-document";
import { createBodyExporter } from "../../../../services/body-export";
import { bodyInputOf } from "../../../../services/body-input";
import type { SaveDraftInput } from "../../../../services/types";
import {
	adminRoute,
	deleted,
	ok,
	readFormatQuery,
	readVersionedBody,
	readVersionQuery,
	translationsOf,
	written,
} from "../../handler";

type IdParams = { id: string };

/**
 * An entry and the translation group needed by the editor.
 * For a translation, also returns the source's latest draft metadata (`source`). The translation properties panel shows the shared values read-only.
 */
export const GET = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const store = cms.store();
	const entry = await store.getEntry(params.id);
	// `?format=<name>` adds `body` to `working`, `published` and the source: the document as text in that format, written to be imported again (`sync`).
	const format = readFormatQuery(request);
	const exporter = format === undefined ? undefined : await createBodyExporter(cms, { format });
	const bodyOf = async <B extends { readonly doc: StoredDocument }>(
		body: B,
		locale: string,
	): Promise<B & { body?: string }> => (exporter ? { ...body, body: await exporter.text(body.doc, locale) } : body);
	const translations = await translationsOf(cms, entry);
	const source =
		entry.translationGroupId !== entry.id ? await store.getEntry(entry.translationGroupId).catch(() => null) : null;
	return ok({
		...entry,
		working: await bodyOf(entry.working, entry.locale),
		...(entry.published ? { published: await bodyOf(entry.published, entry.locale) } : {}),
		translations,
		...(source
			? {
					source: {
						id: source.id,
						locale: source.locale,
						status: source.status,
						workingSlug: source.workingSlug,
						metadata: source.working.metadata,
						// The stored document carries the block ids that pair this version's blocks with the confirmed one's.
						doc: source.working.doc,
						...(exporter ? { body: await exporter.text(source.working.doc, source.locale) } : {}),
					},
				}
			: {}),
	});
});

/** Saves the latest draft. Fields not sent keep their current draft values. */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = await readVersionedBody(request, patchEntryBodySchema);
	const current = await cms.store().getEntry(params.id);
	const input = {
		collection: current.collection,
		expectedVersion: body.expectedVersion,
		slug: body.slug !== undefined ? body.slug : current.workingSlug,
		metadata: body.metadata ?? current.working.metadata,
		// The body sent (a document, or a text with its format), or the current draft's document.
		...bodyInputOf(body, current.working.doc),
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
		...(body.translation !== undefined ? { translation: body.translation } : {}),
	} as SaveDraftInput;
	return written(cms, await cms.contentService().saveDraft(params.id, input));
});

/** Permanently deletes a trashed entry. Moving to trash is `POST /entries/:id/trash`. */
export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const expectedVersion = readVersionQuery(request);
	await cms.store().permanentDeleteEntry({ id: params.id, expectedVersion });
	return deleted();
});
