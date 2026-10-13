import { mediaPatchBodySchema } from "../../../../core/api";
import { CmsError } from "../../error-handler";
import { adminRoute, deleted, ok, parseWith, readJsonBody } from "../../handler";

type IdParams = { id: string };

/** Media detail. Also used when the editor shows an image from `mediaId` alone (including a check of the stored file). */
export const GET = adminRoute<IdParams>(async ({ params, cms }) => {
	const media = await cms.store().getMediaAsset(params.id);
	if (!media) throw new CmsError("Media asset not found", "not_found");
	if (media.status !== "ready" || !media.storageKey) {
		return ok({ ...media, mediaId: media.id, publicUrl: null });
	}
	const mediaStore = cms.mediaStore();
	const head = await mediaStore.headFile({ key: media.storageKey });
	return ok({
		...media,
		mediaId: media.id,
		status: head ? "ready" : "missing",
		publicUrl: head ? mediaStore.getPublicUrl(media.storageKey) : null,
		originalUrl: media.original?.storageKey ? mediaStore.getPublicUrl(media.original.storageKey) : null,
	});
});

/** Edits the default alt and caption. Bodies already written do not change. */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = parseWith(mediaPatchBodySchema, await readJsonBody(request));
	return ok(await cms.store().updateMediaMetadata({ id: params.id, ...body }));
});

/**
 * Deletes only unused files. Marks the row `deleting`, deletes the file, and removes the row on success.
 * If storage deletion fails, the `deleting` row stays and can be retried.
 */
export const DELETE = adminRoute<IdParams>(async ({ params, cms }) => {
	await cms.mediaService().delete(params.id);
	return deleted();
});
