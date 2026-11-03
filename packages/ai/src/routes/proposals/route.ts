import { adminRoute, CmsError, ok } from "@monti-cms/core/server";
import {
	editorProposalViews,
	mediaProposalViews,
	proposalsForEntry,
	proposalsForMedia,
} from "../../agent/entry-proposals";
import { aiStoreFor } from "../../store";

/**
 * The changes waiting in the signed-in admin's proposals for one entry (`?entry=<id>`: what the entry editor draws as the blue pencil), or for media files
 * (`?media`: the alt texts the media library shows on its tiles).
 */
export const GET = adminRoute(async ({ request, cms, auth }) => {
	const params = new URL(request.url).searchParams;
	if (params.has("media")) {
		const found = await proposalsForMedia(cms, auth, aiStoreFor(cms).proposals);
		return ok({ items: mediaProposalViews(found) });
	}
	const entry = params.get("entry");
	if (!entry) throw new CmsError("Name the entry with ?entry= (or ask for ?media)", "invalid_input");
	const found = await proposalsForEntry(cms, auth, aiStoreFor(cms).proposals, entry);
	return ok({ items: editorProposalViews(found, entry) });
});
