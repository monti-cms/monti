import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { type AiCheckResult, aiProviderCheckSchema } from "../../../connection";
import { AiError } from "../../../errors";
import { connectionForCheck } from "../../../settings";
import { getAiStore } from "../../../store";

/**
 * Connection check. Sends one short request with the input values (address, key, default model) before saving. Saves after the check.
 * A failure is also 200, with `ok: false` and the reason.
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
				// Models that think first use a lot of the output limit even for short answers.
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
