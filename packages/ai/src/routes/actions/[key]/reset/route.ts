import { adminRoute, json, readVersionedBody } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { resetAction } from "../../../../actions";
import { getAiStore } from "../../../../store";

type KeyParams = { key: string };

/** 기능을 기본값(사이트 설정의 정의)으로 되돌린다. 켜짐 여부는 지금 값을 둔다. */
export const POST = adminRoute<KeyParams>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(request, z.object({ expectedVersion: z.number().int().min(0) }));
	return json(await resetAction(getAiStore(), params.key, expectedVersion));
});
