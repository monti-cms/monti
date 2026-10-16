import { adminRoute, ok } from "@monti-cms/core/server";
import { getAiSettingsView } from "../../settings";
import { aiStoreFor } from "../../store";

/** List of saved AI connections. Keys are returned as only the last four characters. */
export const GET = adminRoute(async ({ cms }) => ok(await getAiSettingsView(cms.site, aiStoreFor(cms))));
