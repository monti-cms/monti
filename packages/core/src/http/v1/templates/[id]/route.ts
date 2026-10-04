import { getCmsContentStore } from "../../../../container";
import { patchTemplateBodySchema } from "../../../../core/api";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

export const GET = adminRoute<IdParams>(async ({ params }) => json(await getCmsContentStore().getTemplate(params.id)));

export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, patchTemplateBodySchema);
	return json(await getCmsContentStore().updateTemplate({ id: params.id, ...body }));
});

export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	await getCmsContentStore().deleteTemplate({ id: params.id, expectedVersion: readVersionQuery(request) });
	return json({ ok: true });
});
