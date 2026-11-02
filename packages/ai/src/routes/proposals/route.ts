import { adminRoute, CmsError, ok } from "@monti-cms/core/server";
import { editorProposalViews, proposalsForEntry } from "../../agent/entry-proposals";
import { aiStoreFor } from "../../store";

/** The body changes waiting in the signed-in admin's proposals for one entry (`?entry=<id>`): what the entry editor draws as the blue pencil. */
export const GET = adminRoute(async ({ request, cms, auth }) => {
	const entry = new URL(request.url).searchParams.get("entry");
	if (!entry) throw new CmsError("Name the entry with ?entry=", "invalid_input");
	const found = await proposalsForEntry(cms, auth, aiStoreFor(cms).proposals, entry);
	return ok({ items: editorProposalViews(found, entry) });
});
