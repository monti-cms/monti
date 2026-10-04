import {
	adminRoute,
	assertVersionPresent,
	json,
	parseWith,
	readJsonBody,
	readVersionQuery,
} from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { deleteCustomAction, updateAction } from "../../../actions";
import { getAiStore } from "../../../store";

type KeyParams = { key: string };

const patchSchema = z.object({ expectedVersion: z.number().int().min(0), value: z.unknown(), base: z.unknown() });

/**
 * 고칠 수 있는 값(켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사)을 저장한다. 기본값과 같은 값은 남기지 않는다.
 * 화면 기능은 `base`(이름·붙을 곳·결과 모양)도 고친다.
 */
export const PATCH = adminRoute<KeyParams>(async ({ request, params }) => {
	const body = await readJsonBody(request);
	assertVersionPresent((body as { expectedVersion?: unknown })?.expectedVersion);
	const { expectedVersion, value, base } = parseWith(patchSchema, body);
	return json(await updateAction(getAiStore(), params.key, expectedVersion, value, base));
});

/** 화면 기능을 지운다(`?expectedVersion=`). 코드 기능은 지울 수 없다. */
export const DELETE = adminRoute<KeyParams>(async ({ request, params }) => {
	await deleteCustomAction(getAiStore(), params.key, readVersionQuery(request));
	return new Response(null, { status: 204 });
});
