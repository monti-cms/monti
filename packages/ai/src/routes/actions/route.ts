import { adminRoute, json, readJsonBody } from "@monti-cms/core/plugin/server";
import { createCustomAction, listActions } from "../../actions";
import { usableActionKeys } from "../../settings";
import { getAiStore } from "../../store";

/** AI 기능 목록(정의 + 고친 값)과 지금 쓸 수 있는(연결이 준비된) 기능 이름. 자리는 켜진 기능 중 쓸 수 있는 것만 붙인다. */
export const GET = adminRoute(async () => {
	const store = getAiStore();
	const items = await listActions(store);
	return json({ usable: await usableActionKeys(store, items), items });
});

/**
 * 화면 기능을 만든다(D12·M8-5). 본문은 `{ base: { label, surface, result, engine? }, value?: 고친 값 }`이다.
 * 고친 값(연결·모델·지시문·검사 등)을 함께 주면 한 번에 저장한다.
 */
export const POST = adminRoute(async ({ request }) => {
	const body = (await readJsonBody(request)) as { base?: unknown; value?: unknown };
	return json(await createCustomAction(getAiStore(), body.base, body.value), { status: 201 });
});
