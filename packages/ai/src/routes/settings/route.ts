import { adminRoute, json } from "@monti-cms/core/plugin/server";
import { getAiSettingsView } from "../../settings";
import { aiStoreFor } from "../../store";

/** List of saved AI connections. Keys are returned as only the last four characters. */
export const GET = adminRoute(async ({ cms }) => json(await getAiSettingsView(aiStoreFor(cms))));
