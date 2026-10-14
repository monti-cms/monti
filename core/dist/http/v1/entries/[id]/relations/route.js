import { adminRoute, ok } from "../../../handler.js";
/** Where this entry is used (back references). Distinguishes draft and published usages. */
export const GET = adminRoute(async ({ params, cms }) => {
    const store = cms.store();
    await store.getEntry(params.id);
    const relations = await store.getIncomingReferences({ targetId: params.id });
    return ok({ targetId: params.id, incomingReferences: relations, total: relations.length });
});
