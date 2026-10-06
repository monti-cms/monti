import { adminRoute, json, readJsonBody } from "@monti-cms/core/plugin/server";
import { createCustomAction, listActions } from "../../actions";
import { usableActionKeys } from "../../settings";
import { aiStoreFor } from "../../store";

/** The AI action list (definition + edited values) and the names of actions usable now (connection ready). Slots only attach enabled actions that are usable. */
export const GET = adminRoute(async ({ cms }) => {
	const store = aiStoreFor(cms);
	const items = await listActions(store);
	return json({ usable: await usableActionKeys(store, items), items });
});

/**
 * Creates a screen action. The body is `{ base: { label, surface, result, engine? }, value?: edited value }`.
 * If edited values (connection, model, instructions, checks, etc.) are given too, they are saved at once.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = (await readJsonBody(request)) as { base?: unknown; value?: unknown };
	return json(await createCustomAction(aiStoreFor(cms), body.base, body.value), { status: 201 });
});
