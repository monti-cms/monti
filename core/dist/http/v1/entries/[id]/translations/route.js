import { z } from "zod";
import { adminRoute, ok, parseWith, readJsonBody, written } from "../../../handler.js";
/** The source and translations in the same translation group. */
export const GET = adminRoute(async ({ params, cms }) => ok(await cms.store().getTranslationGroup({ entryId: params.id })));
/** Creates a translation: a draft copying the source's per-locale values and body. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const createTranslationSchema = z.object({ locale: z.enum(cms.site.LOCALES) }).strict();
    const body = parseWith(createTranslationSchema, await readJsonBody(request));
    return written(cms, await cms.contentService().createTranslation({ sourceId: params.id, locale: body.locale }), {
        status: 201,
    });
});
