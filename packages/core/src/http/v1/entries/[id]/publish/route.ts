import { publishBodySchema } from "../../../../../core/api";
import { adminRoute, ok, readVersionedBody } from "../../../handler";

/**
 * Explicit publish. The draft goes through the write pipeline (hooks, core preparation), and the store re-checks it for publishing inside the transaction;
 * on failure it returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`
 * (the content service adds them, so a bulk publish reports the same).
 */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { expectedVersion, resetPublishedAt } = await readVersionedBody(request, publishBodySchema);
	const result = await cms.contentService().publish({ id: params.id, expectedVersion, resetPublishedAt });
	return ok(result);
});
