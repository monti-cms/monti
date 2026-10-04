import { getCmsContentStore } from "../../../container.js";
import { createTemplateBodySchema } from "../../../core/api.js";
import { adminRoute, json, parseWith, readJsonBody } from "../handler.js";
export const GET = adminRoute(async () => json({ items: await getCmsContentStore().listTemplates() }));
export const POST = adminRoute(async ({ request }) => {
    const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
    return json(await getCmsContentStore().createTemplate(body), { status: 201 });
});
