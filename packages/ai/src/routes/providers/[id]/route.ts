import { adminRoute, json, parseWith, readJsonBody, readVersionQuery } from "@monti-cms/core/plugin/server";
import { aiProviderRequestSchema } from "../../../connection";
import { removeAiProvider, updateAiProvider } from "../../../settings";
import { getAiStore } from "../../../store";

type IdParams = { id: string };

/** 연결 수정. 키가 빠지면 저장된 키를 두고(주소를 바꿨으면 지운다), `null`이면 지운다. */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
	return json(await updateAiProvider(getAiStore(), expectedVersion, params.id, provider));
});

/** 연결 삭제. 이 연결을 고른 기능은 방식에 맞는 첫 연결로 돌아간다. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) =>
	json(await removeAiProvider(getAiStore(), readVersionQuery(request), params.id)),
);
