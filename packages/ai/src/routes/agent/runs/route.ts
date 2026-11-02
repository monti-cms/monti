import { adminRoute, ok, parseWith } from "@monti-cms/core/server";
import { agentRunsQuerySchema } from "../../../agent-request";
import { unopenedDaysOf } from "../../../settings";
import { aiStoreFor } from "../../../store";

/**
 * The signed-in admin's own conversations with the agent, the last opened or asked in first, without their messages. Conversations unopened for the days
 * the settings say are deleted first.
 */
export const GET = adminRoute(async ({ request, cms, auth }) => {
	const query = parseWith(agentRunsQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
	const store = aiStoreFor(cms);
	await store.agentRuns.sweep(auth.userId, await unopenedDaysOf(store));
	return ok(await store.agentRuns.list(auth.userId, query));
});
