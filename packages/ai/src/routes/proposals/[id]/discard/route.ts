import { adminRoute, ok } from "@monti-cms/core/server";
import { discardProposal } from "../../../../agent/apply";
import { proposalView } from "../../../../agent/proposal-view";
import { aiStoreFor } from "../../../../store";

/** Discards a waiting proposal: nothing changes, and it stays in its conversation as "discarded". */
export const POST = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	ok(proposalView(await discardProposal(auth, aiStoreFor(cms).proposals, params.id))),
);
