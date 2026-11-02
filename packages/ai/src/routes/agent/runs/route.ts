import { adminRoute, ok, parseWith } from "@monti-cms/core/server";
import { outcomeOf } from "../../../agent/outcome";
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
	await store.sweepRuns(auth.userId, await unopenedDaysOf(store));
	const page = await store.agentRuns.list(auth.userId, query);
	// What came of each conversation, from its latest proposal: the past conversations show it after the time.
	const items = await Promise.all(
		page.items.map(async (run) => {
			const outcome = outcomeOf(await store.proposals.ofRun(auth.userId, run.id));
			return outcome ? { ...run, outcome } : run;
		}),
	);
	return ok({ ...page, items });
});
