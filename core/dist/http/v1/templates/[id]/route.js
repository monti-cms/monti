import { getCmsContentStore } from "../../../../container.js";
import { patchTemplateBodySchema } from "../../../../core/api.js";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler.js";
export const GET = adminRoute(async ({ params }) => json(await getCmsContentStore().getTemplate(params.id)));
export const PATCH = adminRoute(async ({ request, params }) => {
    const body = await readVersionedBody(request, patchTemplateBodySchema);
    return json(await getCmsContentStore().updateTemplate({ id: params.id, ...body }));
});
export const DELETE = adminRoute(async ({ request, params }) => {
    await getCmsContentStore().deleteTemplate({ id: params.id, expectedVersion: readVersionQuery(request) });
    return json({ ok: true });
});
