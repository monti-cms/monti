import { createTemplateBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

export const GET = adminRoute(async ({ cms }) => json({ items: await cms.store().listTemplates() }));

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
	return json(await cms.store().createTemplate(body), { status: 201 });
});
