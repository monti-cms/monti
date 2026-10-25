import { mediaPatchBodySchema } from "../../../../core/api";
import { CmsError } from "../../error-handler";
import { adminRoute, deleted, ok, parseWith, readJsonBody } from "../../handler";
import { renameProblem } from "../media-files";

type IdParams = { id: string };

/** Media detail. Also used when the editor shows an image from `mediaId` alone (including a check of the stored file). The operation `media.get`. */
export const GET = adminRoute<IdParams>(async ({ params, cms, auth }) =>
	ok(await cms.runOperation("media.get", { id: params.id }, { auth })),
);

/** Edits the file name, or the default alt and caption. A new name keeps the file's extension. Bodies already written do not change. */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = parseWith(mediaPatchBodySchema, await readJsonBody(request));
	if (body.filename !== undefined) {
		const media = await cms.store().getMediaAsset(params.id);
		if (!media) throw new CmsError("Media asset not found", "not_found");
		const problem = renameProblem(media.filename, body.filename.normalize("NFC"));
		if (problem) throw new CmsError(`Invalid file name (${problem.key})`, "invalid_input", { notice: problem });
	}
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
