import { patchTemplateBodySchema } from "../../../../core/api";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

export const GET = adminRoute<IdParams>(async ({ params, cms }) => json(await cms.store().getTemplate(params.id)));

export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = await readVersionedBody(request, patchTemplateBodySchema);
	return json(await cms.store().updateTemplate({ id: params.id, ...body }));
});

export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) => {
	await cms.store().deleteTemplate({ id: params.id, expectedVersion: readVersionQuery(request) });
	return json({ ok: true });
});
