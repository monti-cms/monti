import { z } from "zod";
import { getCmsContentService, getCmsContentStore } from "../../../../../container.js";
import { LOCALES } from "../../../../../core/locales.js";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler.js";
const createTranslationSchema = z.object({ locale: z.enum(LOCALES) }).strict();
/** The source and translations in the same translation group. */
export const GET = adminRoute(async ({ params }) => json(await getCmsContentStore().getTranslationGroup({ entryId: params.id })));
/** Creates a translation: a draft copying the source's per-locale values and body. */
export const POST = adminRoute(async ({ request, params }) => {
    const body = parseWith(createTranslationSchema, await readJsonBody(request));
    const entry = await getCmsContentService().createTranslation({ sourceId: params.id, locale: body.locale });
    return json(entry, { status: 201 });
});
