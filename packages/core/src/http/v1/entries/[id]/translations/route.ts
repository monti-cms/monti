import { z } from "zod";
import { adminRoute, ok, parseWith, readJsonBody, written } from "../../../handler";

type IdParams = { id: string };

/** The source and translations in the same translation group. The operation `entries.translations`. */
export const GET = adminRoute<IdParams>(async ({ params, cms, auth }) =>
	ok(await cms.runOperation("entries.translations", { id: params.id }, { auth })),
);

/** Creates a translation: a draft copying the source's per-locale values and body. */
export const POST = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const createTranslationSchema = z.object({ locale: z.enum(cms.site.LOCALES as [string, ...string[]]) }).strict();
	const body = parseWith(createTranslationSchema, await readJsonBody(request));
	return written(cms, await cms.contentService().createTranslation({ sourceId: params.id, locale: body.locale }), {
		status: 201,
	});
});
