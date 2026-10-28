import { mediaTrashBodySchema } from "../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/** Moves media files to the trash. A file that is in use stays (`kept`). Deleting for good is `POST /v1/trash/delete`. */
export const POST = adminRoute(async ({ request, cms }) => {
	const { ids } = parseWith(mediaTrashBodySchema, await readJsonBody(request));
	return ok(await cms.trashService().trashMedia(ids));
});
