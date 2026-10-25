import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { type AiCheckResult, aiProviderCheckSchema } from "../../../connection";
import { AiError } from "../../../errors";
import { checkToolSupport, isFakeAi } from "../../../provider";
import { connectionForCheck } from "../../../settings";
import { aiStoreFor } from "../../../store";

/**
 * Connection check. Sends one short request with the input values (address, key, default model) before saving. Saves after the check.
 * A failure is also 200, with `ok: false` and the reason.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { providerId, provider } = parseWith(aiProviderCheckSchema, await readJsonBody(request));
	const started = Date.now();
	try {
		const target = await connectionForCheck(cms.site, aiStoreFor(cms), {
			providerId,
			kind: provider.kind,
			url: provider.url,
			key: provider.key,
			model: provider.defaultModel,
		});
		let tools: boolean | null | undefined;
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
			// The assistant needs a model that calls tools. A failed probe concludes nothing, so nothing is stored.
			tools = isFakeAi() || !target.chat ? true : await checkToolSupport(target.chat, request.signal);
			if (typeof tools === "boolean" && target.storedAs) {
				await aiStoreFor(cms).saveToolSupport({ providerId: target.storedAs, model: target.model, supported: tools });
			}
		} else if (target.decider) {
			await target.decider.decide({
				state: { text: "The sky is blue." },
				questions: { check: { type: "noul", instructions: "Is the text about the sky?" } },
				signal: request.signal,
			});
		}
		return ok({
			ok: true,
			ms: Date.now() - started,
			model: target.model,
			...(tools === undefined ? {} : { tools }),
		} satisfies AiCheckResult);
	} catch (error) {
		if (error instanceof AiError) return ok({ ok: false, message: error.message } satisfies AiCheckResult);
		throw error;
	}
});
