import { adminRoute, ok } from "@monti-cms/core/server";
import { listActions } from "../../actions";
import { usableActionKeys } from "../../settings";
import { aiStoreFor } from "../../store";

/** The AI actions of the site config and the names of actions usable now (a model is ready). Slots only attach enabled actions that are usable. */
export const GET = adminRoute(async ({ cms }) => {
	const items = listActions(cms.site);
	return ok({ usable: await usableActionKeys(cms.site, aiStoreFor(cms), items), items });
});
