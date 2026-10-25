import { patchEntryBodySchema } from "../../../../core/api";
import { bodyInputOf } from "../../../../services/body-input";
import type { SaveDraftInput } from "../../../../services/types";
import { adminRoute, deleted, ok, readFormatQuery, readVersionedBody, readVersionQuery, written } from "../../handler";

type IdParams = { id: string };

/**
 * An entry and the translation group needed by the editor (the operation `entries.get`).
 * For a translation, also returns the source's latest draft metadata (`source`). The translation properties panel shows the shared values read-only.
 */
export const GET = adminRoute<IdParams>(async ({ request, params, cms, auth }) =>
	ok(await cms.runOperation("entries.get", { id: params.id, format: readFormatQuery(request) }, { auth })),
);

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
