import { adminRoute, json, readJsonBody } from "../../handler";
import { prepareMediaUpload } from "../upload-flow";

/**
 * Upload preparation. The server decides the allowed type, size, and file key, and issues a time-limited direct upload URL.
 * Credentials never reach the browser, and the file body does not pass through the app server.
 */
export const POST = adminRoute(async ({ request, cms }) =>
	json(await prepareMediaUpload(cms, await readJsonBody(request)), { status: 201 }),
);
