import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { settleInEditor } from "../../../../agent/entry-proposals";
import { proposalView } from "../../../../agent/proposal-view";
import { aiStoreFor } from "../../../../store";

const settleBodySchema = z.object({
	accepted: z.array(z.object({ id: z.string(), placed: z.array(z.string()).optional() })).optional(),
	discarded: z.array(z.string()).optional(),
});

/** What the admin did with items in the entry editor: accepted ones (after the save that wrote them) and discarded ones. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms, auth }) => {
	const body = parseWith(settleBodySchema, await readJsonBody(request));
	return ok(proposalView(await settleInEditor(cms, auth, aiStoreFor(cms).proposals, params.id, body)));
});
