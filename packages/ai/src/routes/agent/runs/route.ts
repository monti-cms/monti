import { adminRoute, ok, parseWith } from "@monti-cms/core/server";
import { agentRunsQuerySchema } from "../../../agent-request";
import { aiStoreFor } from "../../../store";

/** The signed-in admin's own conversations with the agent, newest first, without their messages. */
export const GET = adminRoute(async ({ request, cms, auth }) => {
	const query = parseWith(agentRunsQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
	return ok(await aiStoreFor(cms).agentRuns.list(auth.userId, query));
});
