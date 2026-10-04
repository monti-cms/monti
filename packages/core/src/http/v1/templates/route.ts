import { getCmsContentStore } from "../../../container";
import { createTemplateBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

export const GET = adminRoute(async () => json({ items: await getCmsContentStore().listTemplates() }));

export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
	return json(await getCmsContentStore().createTemplate(body), { status: 201 });
});
