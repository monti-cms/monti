import { z } from "zod";
import { getCmsContentService, getCmsContentStore } from "../../../../../container";
import { LOCALES } from "../../../../../core/locales";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler";

type IdParams = { id: string };

const createTranslationSchema = z.object({ locale: z.enum(LOCALES) }).strict();

/** 같은 번역 묶음의 원문과 번역본(v2 B4). */
export const GET = adminRoute<IdParams>(async ({ params }) =>
	json(await getCmsContentStore().getTranslationGroup({ entryId: params.id })),
);

/** 번역본을 만든다(v2 B4). 원문의 언어별 값과 본문을 복사한 초안이다. */
export const POST = adminRoute<IdParams>(async ({ request, params }) => {
	const body = parseWith(createTranslationSchema, await readJsonBody(request));
	const entry = await getCmsContentService().createTranslation({ sourceId: params.id, locale: body.locale });
	return json(entry, { status: 201 });
});
