import { getCmsContentStore } from "../../../../../container";
import { adminRoute, json } from "../../../handler";

/** Where this entry is used (back references). Distinguishes draft and published usages. */
export const GET = adminRoute<{ id: string }>(async ({ params }) => {
	const store = getCmsContentStore();
	await store.getEntry(params.id);
	const relations = await store.getIncomingReferences({ targetId: params.id });
	return json({ targetId: params.id, incomingReferences: relations, total: relations.length });
});
