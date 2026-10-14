import { patchTemplateBodySchema } from "../../../../core/api.js";
import { adminRoute, deleted, ok, readFormatQuery, readVersionedBody, readVersionQuery } from "../../handler.js";
import { templateBodyOf, templatesJson } from "../body.js";
export const GET = adminRoute(async ({ request, params, cms }) => {
    const [template] = await templatesJson(cms, [await cms.store().getTemplate(params.id)], readFormatQuery(request));
    return ok(template);
});
/** Without a body the stored one is kept. Blocks keep their ids where the new body pairs with the old one. */
export const PATCH = adminRoute(async ({ request, params, cms }) => {
    const body = await readVersionedBody(request, patchTemplateBodySchema);
    const hasBody = body.doc !== undefined || body.body !== undefined;
    const doc = hasBody ? await templateBodyOf(cms, body, (await cms.store().getTemplate(params.id)).doc) : undefined;
    return ok(await cms.store().updateTemplate({
        id: params.id,
        expectedVersion: body.expectedVersion,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(doc === undefined ? {} : { doc }),
    }));
});
export const DELETE = adminRoute(async ({ request, params, cms }) => {
    await cms.store().deleteTemplate({ id: params.id, expectedVersion: readVersionQuery(request) });
    return deleted();
});
