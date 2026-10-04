import { z } from "zod";
import { getCmsContentStore } from "../../../../../container";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler";

/** `title`: 복제본 제목(관리자 화면이 원본 제목에 "(복사)" 같은 말을 붙여 보낸다). 없으면 원본 제목 그대로다. */
const duplicateSchema = z.object({ title: z.string().optional() }).strict();

/** 최신 초안을 새 ID의 초안으로 복제한다(§6.3). */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { title } = parseWith(duplicateSchema, await readJsonBody(request));
	return json(await getCmsContentStore().duplicateEntry({ id: params.id, title }), { status: 201 });
});
