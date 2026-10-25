import { adminRoute, ok } from "@monti-cms/core/server";
import { agentMessages } from "../../../../agent.messages";
import { AiError } from "../../../../errors";
import { aiStoreFor } from "../../../../store";

/** One conversation, with its messages. Only to the admin who started it: another admin's conversation is a 404. */
export const GET = adminRoute<{ id: string }>(async ({ params, cms, auth }) => {
	const run = await aiStoreFor(cms).agentRuns.get(auth.userId, params.id);
	if (!run) throw new AiError("not_found", cms.site.createTranslator(agentMessages)("unknownRun"));
	const { adminId: _adminId, ...visible } = run;
	return ok(visible);
});
