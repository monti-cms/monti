import { adminRoute } from "@monti-cms/core/server";
import { applyProposal } from "../../../../agent/apply";
import { progressResponse } from "../../../../agent/progress";
import { aiStoreFor } from "../../../../store";

/** Applies the included waiting items of a proposal one by one, as the signed-in admin, answering with a line per step (see `progressResponse`). */
export const POST = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	progressResponse((onProgress) => applyProposal(cms, auth, aiStoreFor(cms).proposals, params.id, onProgress)),
);
