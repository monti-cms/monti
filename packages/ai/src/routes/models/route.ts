import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { aiModelsQuerySchema } from "../../connection";
import { isFakeAi, listModels } from "../../provider";
import { keyConnection } from "../../settings";
import { aiStoreFor } from "../../store";

/**
 * The models of one AI key (`GET {service address}/models`, with the key). The key is never returned to the browser. A service that gives no list
 * answers an empty one, and the menu lets the person type the name.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { keyId } = parseWith(aiModelsQuerySchema, await readJsonBody(request));
	if (isFakeAi()) return ok({ items: [{ id: "fake-agent" }] });
	const connection = await keyConnection(aiStoreFor(cms), keyId);
	if (!connection) return ok({ items: [] });
	return ok({ items: await listModels(cms.site, connection.baseUrl, connection.apiKey || null, request.signal) });
});
