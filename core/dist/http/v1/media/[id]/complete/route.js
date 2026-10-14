import { adminRoute, ok } from "../../../handler.js";
import { completeMediaUpload } from "../../upload-flow.js";
/**
 * Upload completion check. Marks the media `ready` only after the server inspects the stored file.
 * If the check fails, the media does not become usable and stays `failed`, to be cleaned up.
 */
export const POST = adminRoute(async ({ params, cms }) => ok(await completeMediaUpload(cms, params.id)));
