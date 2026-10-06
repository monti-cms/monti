import { z } from "zod";
import { LOCALES } from "../../../../../core/locales";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler";

type IdParams = { id: string };

const createTranslationSchema = z.object({ locale: z.enum(LOCALES) }).strict();

/** The source and translations in the same translation group. */
export const GET = adminRoute<IdParams>(async ({ params, cms }) =>
	json(await cms.store().getTranslationGroup({ entryId: params.id })),
);

/** Creates a translation: a draft copying the source's per-locale values and body. */
export const POST = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const body = parseWith(createTranslationSchema, await readJsonBody(request));
	const entry = await cms.contentService().createTranslation({ sourceId: params.id, locale: body.locale });
	return json(entry, { status: 201 });
});
