import { defineServerPlugin } from "@monti-cms/core/server";
import * as resetAction from "./routes/actions/[key]/reset/route";
import * as action from "./routes/actions/[key]/route";
import * as actions from "./routes/actions/route";
import * as models from "./routes/models/route";
import * as provider from "./routes/providers/[id]/route";
import * as providerCheck from "./routes/providers/check/route";
import * as providers from "./routes/providers/route";
import * as run from "./routes/run/route";
import * as settings from "./routes/settings/route";
import * as snippets from "./routes/snippets/route";
import { getAiSettingsView, keyUseLabels } from "./settings";
import { aiStoreFor } from "./store";

/** Server side of the AI plugin. Loaded by the core API handler and `monti db:migrate`. Not included in the browser bundle. */
export default defineServerPlugin({
	routes: [
		{ pattern: "v1/ai/actions", module: actions },
		{ pattern: "v1/ai/actions/[key]", module: action },
		{ pattern: "v1/ai/actions/[key]/reset", module: resetAction },
		{ pattern: "v1/ai/models", module: models },
		{ pattern: "v1/ai/providers", module: providers },
		{ pattern: "v1/ai/providers/check", module: providerCheck },
		{ pattern: "v1/ai/providers/[id]", module: provider },
		{ pattern: "v1/ai/run", module: run },
		{ pattern: "v1/ai/settings", module: settings },
		{ pattern: "v1/ai/snippets", module: snippets },
	],
	// What the API keys screen shows for a connection that uses a key: its current name, in the admin language.
	keyUses: (refs, { cms }) => keyUseLabels(cms.site, aiStoreFor(cms), refs),
	// `features.ai.ready` of the admin meta API: is at least one connection ready?
	features: async ({ cms }) => ({
		ready: await getAiSettingsView(cms.site, aiStoreFor(cms)).then(
			(view) => view.fake || view.providers.some((item) => item.ready),
			() => false,
		),
	}),
});
