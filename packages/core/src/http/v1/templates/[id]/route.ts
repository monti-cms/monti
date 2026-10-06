import { patchTemplateBodySchema } from "../../../../core/api";
import { adminRoute, json, readFormatQuery, readVersionedBody, readVersionQuery } from "../../handler";
import { templateBodyOf, templatesJson } from "../body";

type IdParams = { id: string };

export const GET = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const [template] = await templatesJson(cms, [await cms.store().getTemplate(params.id)], readFormatQuery(request));
	return json(template);
});

/** Without a body the stored one is kept. Blocks keep their ids where the new body pairs with the old one. */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = await readVersionedBody(request, patchTemplateBodySchema);
	const hasBody = body.doc !== undefined || body.body !== undefined;
	const doc = hasBody ? await templateBodyOf(cms, body, (await cms.store().getTemplate(params.id)).doc) : undefined;
	return json(
		await cms.store().updateTemplate({
			id: params.id,
			expectedVersion: body.expectedVersion,
			...(body.name === undefined ? {} : { name: body.name }),
			...(doc === undefined ? {} : { doc }),
		}),
	);
});

export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) => {
	await cms.store().deleteTemplate({ id: params.id, expectedVersion: readVersionQuery(request) });
	return json({ ok: true });
});
