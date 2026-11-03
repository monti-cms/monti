import { defineServerPlugin } from "@monti-cms/core/server";
import * as actions from "./routes/actions/route";
import * as agent from "./routes/agent/route";
import * as agentRun from "./routes/agent/runs/[id]/route";
import * as agentRuns from "./routes/agent/runs/route";
import * as models from "./routes/models/route";
import * as proposalApply from "./routes/proposals/[id]/apply/route";
import * as proposalDiscard from "./routes/proposals/[id]/discard/route";
import * as proposalAsk from "./routes/proposals/[id]/items/[itemId]/ask/route";
import * as proposalRevert from "./routes/proposals/[id]/revert/route";
import * as proposal from "./routes/proposals/[id]/route";
import * as proposalSettle from "./routes/proposals/[id]/settle/route";
import * as proposals from "./routes/proposals/route";
import * as run from "./routes/run/route";
import * as settings from "./routes/settings/route";
import * as spots from "./routes/spots/route";
import * as writingRules from "./routes/writing-rules/route";
import { aiKeyServices } from "./services";
import { getAiSettingsView, keyUseLabels } from "./settings";
import { aiStoreFor } from "./store";

/** Server side of the AI plugin. Loaded by the core API handler and `monti db:migrate`. Not included in the browser bundle. */
export default defineServerPlugin({
	routes: [
		{ pattern: "v1/ai/actions", module: actions },
		{ pattern: "v1/ai/agent", module: agent },
		{ pattern: "v1/ai/agent/runs", module: agentRuns },
		{ pattern: "v1/ai/agent/runs/[id]", module: agentRun },
		{ pattern: "v1/ai/models", module: models },
		{ pattern: "v1/ai/proposals", module: proposals },
		{ pattern: "v1/ai/spots", module: spots },
		{ pattern: "v1/ai/proposals/[id]", module: proposal },
		{ pattern: "v1/ai/proposals/[id]/apply", module: proposalApply },
		{ pattern: "v1/ai/proposals/[id]/revert", module: proposalRevert },
		{ pattern: "v1/ai/proposals/[id]/discard", module: proposalDiscard },
		{ pattern: "v1/ai/proposals/[id]/settle", module: proposalSettle },
		{ pattern: "v1/ai/proposals/[id]/items/[itemId]/ask", module: proposalAsk },
		{ pattern: "v1/ai/run", module: run },
		{ pattern: "v1/ai/settings", module: settings },
		{ pattern: "v1/ai/writing-rules", module: writingRules },
	],
	// The AI services a key can be for, each checked with its service before the key is saved.
	keyServices: ({ cms }) => aiKeyServices(cms.site),
	// What the API keys screen shows for a key the quick tasks or a new conversation use, in the admin language.
	keyUses: async (refs, { cms }) => keyUseLabels(cms.site, refs),
	// `features.ai.ready` of the admin meta API: is there a model to run on?
	features: async ({ cms }) => ({
		ready: await getAiSettingsView(cms.site, aiStoreFor(cms)).then(
			(view) => view.fake || view.assistant !== null || view.quick !== null,
			() => false,
		),
	}),
});
