import { patchEntryBodySchema } from "../../../../core/api";
import { isItemCollection } from "../../../../core/collections";
import type { StoredDocument } from "../../../../doc/stored-document";
import { exportText } from "../../../../format/convert";
import { createExportRefs } from "../../../../read";
import type { SaveDraftInput } from "../../../../services/types";
import { adminRoute, json, readFormatQuery, readVersionedBody, readVersionQuery } from "../../handler";

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
	const formats = format === undefined ? undefined : await cms.formats();
	const refsOf = createExportRefs({ store: cms.store, mediaStore: cms.mediaStore }, "working");
	const bodyOf = async <B extends { readonly doc: StoredDocument }>(
		body: B,
		locale: string,
	): Promise<B & { body?: string }> => {
		if (!formats || format === undefined) return body;
		const { text } = await exportText(formats, format, body.doc, {
			locale,
			purpose: "sync",
			refs: await refsOf(body.doc, locale),
		});
		return { ...body, body: text };
	};
	const translations = isItemCollection(entry.collection)
		? null
		: await store.getTranslationGroup({ entryId: entry.id });
	const source =
		entry.translationGroupId !== entry.id ? await store.getEntry(entry.translationGroupId).catch(() => null) : null;
	return json({
		...entry,
		working: await bodyOf(entry.working, entry.locale),
		...(entry.published ? { published: await bodyOf(entry.published, entry.locale) } : {}),
		translations: translations?.members ?? [],
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
						...(formats && format !== undefined ? { body: (await bodyOf(source.working, source.locale)).body } : {}),
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
		...(body.doc !== undefined
			? { doc: body.doc }
			: body.body !== undefined
				? { body: body.body, format: body.format }
				: { doc: current.working.doc }),
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
		...(body.translation !== undefined ? { translation: body.translation } : {}),
	} as SaveDraftInput;
	return json(await cms.contentService().saveDraft(params.id, input));
});

/** Permanently deletes a trashed entry. Moving to trash is `POST /entries/:id/trash`. */
export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const expectedVersion = readVersionQuery(request);
	await cms.store().permanentDeleteEntry({ id: params.id, expectedVersion });
	return new Response(null, { status: 204 });
});
