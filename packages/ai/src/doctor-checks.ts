import { type DoctorCheck, fail, ok, skip, warn } from "@monti-cms/core/plugin/server";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { isFakeAi } from "./provider";
import { getAiSettingsView } from "./settings";
import { aiStoreFor } from "./store";

const connection: DoctorCheck = {
	id: "connection",
	title: "AI connection",
	run: async ({ cms }) => {
		const screen = cms.site.adminHref("/ai");
		if (isFakeAi())
			return ok("the fake development connection is on (CMS_AI_FAKE=1): every action answers without a key");
		if (!cms.secrets(AI_PLUGIN_NAME).available) {
			return fail("MONTI_SECRET is not set, so an AI service key cannot be saved or read", {
				where: ".env.local (and the environment settings of your host)",
				fix: "set MONTI_SECRET (`openssl rand -base64 32`), restart the server, then add the connection on the AI screen",
			});
		}
		let view: Awaited<ReturnType<typeof getAiSettingsView>>;
		try {
			view = await getAiSettingsView(cms.site, aiStoreFor(cms));
		} catch {
			return skip("not checked: the saved connections cannot be read (see the database checks)");
		}
		if (view.providers.length === 0) {
			return warn("no AI connection is saved, so the AI buttons (polish, draft, translate) do not work", {
				where: `the Connections tab of the AI screen (${screen})`,
				fix: "add a connection there: an OpenAI-compatible address (for example https://openrouter.ai/api/v1), its key and a default model",
			});
		}
		const ready = view.providers.filter((provider) => provider.ready);
		if (ready.length === 0) {
			return warn(
				`${view.providers.length === 1 ? "the saved connection is" : "the saved connections are"} not usable: ${view.providers.map((provider) => provider.name).join(", ")} lack an address, a key or a default model`,
				{
					where: `the Connections tab of the AI screen (${screen})`,
					fix: "open the connection and fill in the address, the key and the default model",
				},
			);
		}
		return ok(
			`${ready.length} connection${ready.length === 1 ? "" : "s"} ready: ${ready.map((provider) => provider.name).join(", ")}`,
			{ where: screen },
		);
	},
};

/** The checks the AI plugin adds to `monti doctor`. */
export const aiChecks: readonly DoctorCheck[] = [connection];
