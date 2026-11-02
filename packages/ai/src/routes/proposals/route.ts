import { adminRoute, CmsError, ok } from "@monti-cms/core/server";
import { proposalsForEntry } from "../../agent/entry-proposals";
import { proposalView } from "../../agent/proposal-view";
import { aiStoreFor } from "../../store";

/** The signed-in admin's proposals that wait for review and change one entry (`?entry=<id>`), for the entry editor's marks. */
export const GET = adminRoute(async ({ request, cms, auth }) => {
	const entry = new URL(request.url).searchParams.get("entry");
	if (!entry) throw new CmsError("Name the entry with ?entry=", "invalid_input");
	const found = await proposalsForEntry(cms, auth, aiStoreFor(cms).proposals, entry);
	return ok({ items: found.map(proposalView) });
});
