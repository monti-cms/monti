import { migrateAi } from "./migrate.js";
import * as resetAction from "./routes/actions/[key]/reset/route.js";
import * as action from "./routes/actions/[key]/route.js";
import * as actions from "./routes/actions/route.js";
import * as models from "./routes/models/route.js";
import * as provider from "./routes/providers/[id]/route.js";
import * as providerCheck from "./routes/providers/check/route.js";
import * as providers from "./routes/providers/route.js";
import * as run from "./routes/run/route.js";
import * as settings from "./routes/settings/route.js";
import * as shared from "./routes/shared/route.js";
import { getAiSettingsView } from "./settings.js";
import { aiStoreFor } from "./store.js";
/** Server side of the AI plugin. Loaded by the core API handler and `monti migrate`. Not included in the browser bundle. */
const aiServer = {
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
    // `features.ai.ready` of the admin meta API: is at least one connection ready?
    features: async (cms) => ({
        ready: await getAiSettingsView(cms.site, aiStoreFor(cms)).then((view) => view.fake || view.providers.some((item) => item.ready), () => false),
    }),
};
export default aiServer;
