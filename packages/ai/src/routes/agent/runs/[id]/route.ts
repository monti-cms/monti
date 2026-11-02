import { adminRoute, ok } from "@monti-cms/core/server";
import { agentMessages } from "../../../../agent.messages";
import { AiError } from "../../../../errors";
import { aiStoreFor } from "../../../../store";

/**
 * One conversation, with its messages, marked opened now (an opened conversation is kept). Only to the admin who started it: another admin's conversation
 * is a 404.
 */
export const GET = adminRoute<{ id: string }>(async ({ params, cms, auth }) => {
	const run = await aiStoreFor(cms).agentRuns.open(auth.userId, params.id);
	if (!run) throw new AiError("not_found", cms.site.createTranslator(agentMessages)("unknownRun"));
	const { adminId: _adminId, ...visible } = run;
	return ok(visible);
});

/** Deletes one of the admin's conversations. */
export const DELETE = adminRoute<{ id: string }>(async ({ params, cms, auth }) => {
	const removed = await aiStoreFor(cms).agentRuns.remove(auth.userId, params.id);
	if (!removed) throw new AiError("not_found", cms.site.createTranslator(agentMessages)("unknownRun"));
	return ok({ deleted: true });
});
