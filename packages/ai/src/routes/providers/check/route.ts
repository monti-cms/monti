import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { type AiCheckResult, aiProviderCheckSchema } from "../../../connection";
import { AiError } from "../../../errors";
import { connectionForCheck } from "../../../settings";
import { getAiStore } from "../../../store";

/**
 * 연결 확인. 저장하기 전 입력값(주소·키·기본 모델)으로 짧은 요청을 한 번 보낸다. 확인한 뒤 저장한다.
 * 실패도 200이고 `ok: false`와 이유를 준다.
 */
export const POST = adminRoute(async ({ request }) => {
	const { providerId, provider } = parseWith(aiProviderCheckSchema, await readJsonBody(request));
	const started = Date.now();
	try {
		const target = await connectionForCheck(getAiStore(), {
			providerId,
			kind: provider.kind,
			url: provider.url,
			apiKey: provider.apiKey,
			model: provider.defaultModel,
		});
		if (target.generator) {
			await target.generator.generate({
				system: 'This is a connection check. Answer with the JSON {"ok": true}.',
				content: [{ type: "text", text: "ping" }],
				schema: z.object({ ok: z.boolean() }),
				// 생각을 먼저 하는 모델은 짧은 답에도 출력 한도를 많이 쓴다.
				maxTokens: 4_000,
				result: "note",
				fake: { inputs: {} },
				signal: request.signal,
			});
		} else if (target.decider) {
			await target.decider.decide({
				state: { text: "The sky is blue." },
				questions: { check: { type: "noul", instructions: "Is the text about the sky?" } },
				signal: request.signal,
			});
		}
		return json({ ok: true, ms: Date.now() - started, model: target.model } satisfies AiCheckResult);
	} catch (error) {
		if (error instanceof AiError) return json({ ok: false, message: error.message } satisfies AiCheckResult);
		throw error;
	}
});
