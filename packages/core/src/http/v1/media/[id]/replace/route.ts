import { mediaReplaceBodySchema } from "../../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody } from "../../../handler";
import { replaceMediaFile } from "../../upload-flow";

/**
 * Replaces the file of a media file and keeps its id. The new file is uploaded first as a media file of its own (`POST /media/uploads`, the upload,
 * `POST /media/:id/complete`); this moves its stored file into `:id` and removes it as a separate media file. The name, folder, alt, caption and references of `:id` stay.
 */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { fromId } = parseWith(mediaReplaceBodySchema, await readJsonBody(request));
	return ok(await replaceMediaFile(cms, params.id, fromId));
});
