import { createTemplateBodySchema } from "../../../core/api";
import { adminRoute, ok, parseWith, readFormatQuery, readJsonBody } from "../handler";
import { templateBodyOf } from "./body";

/** `?format=<name>` adds `body` to each template: its document as text in that format. The operation `templates.list`. */
export const GET = adminRoute(async ({ request, cms, auth }) =>
	ok(await cms.runOperation("templates.list", { format: readFormatQuery(request) }, { auth })),
);

/** The body is `doc`, or `body` with its `format`. With neither the template is empty. */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
	const doc = await templateBodyOf(cms, body);
	return ok(await cms.store().createTemplate({ name: body.name, ...(doc === undefined ? {} : { doc }) }), {
		status: 201,
	});
});
