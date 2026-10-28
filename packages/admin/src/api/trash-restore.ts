import type { Site, TrashRestoreResult, TrashTarget } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/**
 * `POST /v1/trash/restore`: puts back what was just moved to the trash (the undo of a trash toast). Entries and folders name the version the trash
 * returned; media files need none. One answer per item, in order; an item that could not come back says why and does not stop the others.
 */
export const restoreTrashed = async (
	site: Site,
	items: readonly TrashTarget[],
	fallback?: string,
): Promise<readonly TrashRestoreResult[]> => {
	const answer = await adminFetch<{ results: TrashRestoreResult[] }>(site, "/v1/trash/restore", {
		method: "POST",
		json: { items },
		fallback,
	});
	return answer.results;
};
