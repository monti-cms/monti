import { adminRoute, json } from "@monti-cms/core/plugin/server";
import { getAiSettingsView } from "../../settings.js";
import { getAiStore } from "../../store.js";
/** List of saved AI connections. Keys are returned as only the last four characters. */
export const GET = adminRoute(async () => json(await getAiSettingsView(getAiStore())));
