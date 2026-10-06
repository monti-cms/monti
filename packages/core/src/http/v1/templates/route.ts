import { createTemplateBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readFormatQuery, readJsonBody } from "../handler";
import { templateBodyOf, templatesJson } from "./body";

/** `?format=<name>` adds `body` to each template: its document as text in that format. */
export const GET = adminRoute(async ({ request, cms }) =>
	json({ items: await templatesJson(cms, await cms.store().listTemplates(), readFormatQuery(request)) }),
);

/** The body is `doc`, or `body` with its `format`. With neither the template is empty. */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
	const doc = await templateBodyOf(cms, body);
	return json(await cms.store().createTemplate({ name: body.name, ...(doc === undefined ? {} : { doc }) }), {
		status: 201,
	});
});
