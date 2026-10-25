import { adminRoute, parseWith, readJsonBody } from "@monti-cms/core/server";
import { startAgentRun } from "../../agent";
import { agentRequestSchema } from "../../agent-request";
import { loadAgentRuntime } from "../../settings";
import { aiStoreFor } from "../../store";

/**
 * The admin agent. Takes the conversation so far and where the admin is, runs the model with the site's read operations as tools (as the signed-in admin), and
 * answers with the AI SDK's UI message stream. A refused request is an ordinary error answer: `service_unavailable` when no connection is usable,
 * `agent_unavailable` when the model cannot call tools.
 */
export const POST = adminRoute(async ({ request, cms, auth }) => {
	const body = parseWith(agentRequestSchema, await readJsonBody(request));
	const store = aiStoreFor(cms);
	const runtime = await loadAgentRuntime(cms.site, store);
	return startAgentRun({ cms, auth, store, runtime, body, signal: request.signal });
});
