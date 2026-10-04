import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { aiProviderRequestSchema } from "../../connection";
import { addAiProvider } from "../../settings";
import { getAiStore } from "../../store";

/** 연결 추가. 설정 전체의 버전이 다르면 409다. */
export const POST = adminRoute(async ({ request }) => {
	const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
	return json(await addAiProvider(getAiStore(), expectedVersion, provider), { status: 201 });
});
