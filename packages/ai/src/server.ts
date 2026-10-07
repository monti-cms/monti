import type { CmsServerPlugin } from "@monti-cms/core";
import { aiChecks } from "./doctor-checks";
import { migrateAi } from "./migrate";
import * as resetAction from "./routes/actions/[key]/reset/route";
import * as action from "./routes/actions/[key]/route";
import * as actions from "./routes/actions/route";
import * as models from "./routes/models/route";
import * as provider from "./routes/providers/[id]/route";
import * as providerCheck from "./routes/providers/check/route";
import * as providers from "./routes/providers/route";
import * as run from "./routes/run/route";
import * as settings from "./routes/settings/route";
import * as shared from "./routes/shared/route";
import { getAiSettingsView } from "./settings";
import { aiStoreFor } from "./store";

/** Server side of the AI plugin. Loaded by the core API handler and `monti migrate`. Not included in the browser bundle. */
const aiServer: CmsServerPlugin = {
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
		{ pattern: "v1/ai/shared", module: shared },
	],
	migrate: migrateAi,
	// What `monti doctor` checks: is a connection saved and usable.
	checks: aiChecks,
	// `features.ai.ready` of the admin meta API: is at least one connection ready?
	features: async (cms) => ({
		ready: await getAiSettingsView(cms.site, aiStoreFor(cms)).then(
			(view) => view.fake || view.providers.some((item) => item.ready),
			() => false,
		),
	}),
};

export default aiServer;
