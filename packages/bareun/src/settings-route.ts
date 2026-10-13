import { apiKeyChoiceSchema } from "@monti-cms/core/client";
import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { getSettingsView, saveSettings } from "./settings";

/**
 * Which API key Bareun uses (`/api/monti/v1/text-check/bareun/settings`). Admin only. The key is shown by its name and last characters, never its value.
 * `PUT` takes `{ key }`: a saved key, a typed value to save as a new key, or no key.
 */
export const settingsRoute = {
	GET: adminRoute(async ({ cms }) => json(await getSettingsView(cms))),
	PUT: adminRoute(async ({ request, cms }) => {
		const body = (await readJsonBody(request)) as { key?: unknown } | null;
		const choice = parseWith(apiKeyChoiceSchema, body?.key);
		return json(await saveSettings(cms, choice));
	}),
};
