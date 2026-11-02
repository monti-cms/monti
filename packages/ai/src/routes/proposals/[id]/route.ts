import { adminRoute, CmsError, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { includeItems, refreshStale } from "../../../agent/apply";
import { proposalView } from "../../../agent/proposal-view";
import { aiStoreFor } from "../../../store";

type Params = { id: string };

/**
 * One proposal of the signed-in admin, as the review shows it. Opening it marks the waiting items whose target changed since the plan as stale ("changed
 * meanwhile"); they are left out of applying.
 */
export const GET = adminRoute<Params>(async ({ params, cms, auth }) => {
	const store = aiStoreFor(cms).proposals;
	const proposal = await store.get(auth.userId, params.id);
	if (!proposal) throw new CmsError("No such proposal", "not_found");
	return ok(proposalView(await refreshStale(cms, auth, store, proposal)));
});

const includeBodySchema = z.object({ include: z.record(z.string(), z.boolean()) });

/** Puts items in or leaves them out before applying (`{ include: { <item id>: true | false } }`). */
export const PATCH = adminRoute<Params>(async ({ request, params, cms, auth }) => {
	const { include } = parseWith(includeBodySchema, await readJsonBody(request));
	return ok(proposalView(await includeItems(auth, aiStoreFor(cms).proposals, params.id, include)));
});
