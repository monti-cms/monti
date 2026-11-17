import type { Monti, TryModel } from "@monti-cms/core";
import { failed, failureOf } from "./failure";
import { asksThinking, levelFor, ProviderError, type ProviderFor } from "./provider";

const OK = {
	type: "object",
	properties: { value: { type: "string" } },
	required: ["value"],
	additionalProperties: false,
};

/** A tool the assistant's trial offers: a model picked for conversations works through tools, so a service that refuses them refuses here. */
const NOTHING = {
	name: "nothing",
	description: "Does nothing. Do not call it.",
	inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

/**
 * Calls a model before the keys screen picks it (doc 14), as the job will call it: for the quick tasks, one answer in a fixed shape ("✦ Fill") and
 * one turn with a tool offered (a request on picked words, "✦ Translate"), with the least thinking the model takes; for a conversation, a turn
 * with a tool offered and a little thinking. The words asked for are a single "OK", so the
 * trial costs a few tokens; they are counted against the key as any call is. No answer within `answerMs` is a model too slow to use.
 */
export function modelTrial(site: () => Monti, providerFor: ProviderFor, answerMs: number): TryModel {
	return async ({ for: job, key, model }) => {
		const provider = providerFor(key);
		const deadline = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const late = new Promise<"late">((resolve) => {
			timer = setTimeout(() => {
				deadline.abort();
				resolve("late");
			}, answerMs);
		});
		const thinks = asksThinking(model);
		const asked = (async () => {
			// A conversation's model thinks a little; the quick tasks' model as little as it takes.
			const level = levelFor(model, job === "quick" ? "off" : "low");
			let spent = 0;
			if (job === "quick") {
				// "✦ Fill" asks for one answer in a fixed shape.
				const answered = await provider.answer({
					model: model.id,
					system: "Answer with the value OK.",
					prompt: "Reply with OK.",
					schema: OK,
					thinking: level,
					thinks,
					signal: deadline.signal,
				});
				spent += answered.usage.input + answered.usage.output;
			}
			// A conversation, and the quick tasks' requests on picked words and "✦ Translate", are turns with tools.
			for await (const event of provider.turn({
				model: model.id,
				system: "Reply with the word OK and nothing else.",
				messages: [{ role: "user", text: "Reply with OK." }],
				tools: [NOTHING],
				thinking: level,
				thinks,
				signal: deadline.signal,
			}))
				if (event.type === "end") return spent + event.usage.input + event.usage.output;
			// The stream closed without its end: no answer came.
			throw new ProviderError("interrupted", "The answer ended before it was whole.");
		})();
		// What the call still gives after its deadline is nobody's.
		asked.catch(() => {});
		const answered = await Promise.race([asked, late])
			.finally(() => clearTimeout(timer))
			.catch((error: unknown) => {
				if (deadline.signal.aborted) throw failed({ reason: "timeout", keyName: key.name });
				if (error instanceof ProviderError) throw failed(failureOf(error, key.name));
				throw error;
			});
		if (answered === "late") throw failed({ reason: "timeout", keyName: key.name });
		await site().keys.addUsage(key.id, answered);
	};
}
