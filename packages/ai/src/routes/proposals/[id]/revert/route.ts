import { adminRoute } from "@monti-cms/core/server";
import { revertProposal } from "../../../../agent/apply";
import { progressResponse } from "../../../../agent/progress";
import { aiStoreFor } from "../../../../store";

/** Undoes an applied proposal, leaving alone what changed after it was applied, with a line per step (see `progressResponse`). */
export const POST = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	progressResponse((onProgress) => revertProposal(cms, auth, aiStoreFor(cms).proposals, params.id, onProgress)),
);
