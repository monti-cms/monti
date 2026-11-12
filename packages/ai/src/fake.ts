import type { OpenKey } from "@monti-cms/core";
import {
	type AnswerRequest,
	type ModelProvider,
	ProviderError,
	type ProviderFor,
	type ToolCall,
	type TurnEvent,
	type TurnRequest,
	type Usage,
} from "./provider";

/** One scripted turn: what the model says, the tools it calls, and how it goes wrong, if it does. */
export type ScriptedTurn = {
	text?: string | string[];
	calls?: { name: string; input: unknown; id?: string }[];
	usage?: Usage;
	/** The service fails instead of answering. */
	fail?: ProviderError;
	/** Held until this settles, after its words and before its end: a turn in the middle of which something else happens. */
	hold?: Promise<unknown>;
	cut?: "length" | "refusal";
	/** After its words it gives a sign of life with nothing to show (it thinks). */
	alive?: boolean;
	/** After its words the answer breaks off: no calls, no end. */
	breaksOff?: boolean;
};

/** A turn, or what makes one from the request the engine sent (to answer by what a tool returned). */
export type Scripted = ScriptedTurn | ((request: TurnRequest) => ScriptedTurn | Promise<ScriptedTurn>);

export type ScriptedProvider = {
	provider: ModelProvider;
	for: ProviderFor;
	/** Every turn request the engine made, in order. */
	turns: TurnRequest[];
	answers: AnswerRequest[];
	/** The keys the engine asked a provider for. */
	keys: OpenKey[];
	/** Adds turns after the ones already scripted. */
	add(...more: Scripted[]): void;
};

/**
 * A model that says what it was told to (doc 10: tests never call a real model). Each turn of `script` answers one request; `answer` gives the
 * quick tasks their answers. A request past the end of the script fails the test loudly rather than going on quietly.
 */
export function scriptedProvider(
	script: Scripted[] = [],
	answer: (request: AnswerRequest) => unknown = () => ({ value: "" }),
): ScriptedProvider {
	const turns: TurnRequest[] = [];
	const answers: AnswerRequest[] = [];
	const keys: OpenKey[] = [];
	const left = [...script];
	let calls = 0;
	const provider: ModelProvider = {
		async *turn(request): AsyncGenerator<TurnEvent> {
			// A copy: the engine goes on adding to its own list.
			turns.push({ ...request, messages: structuredClone(request.messages) });
			const next = left.shift();
			if (!next)
				throw new Error(`The scripted model was asked for turn ${turns.length}, and the script has no more turns.`);
			const turn = typeof next === "function" ? await next(request) : next;
			if (turn.fail) throw turn.fail;
			for (const delta of typeof turn.text === "string" ? [turn.text] : (turn.text ?? [])) {
				if (request.signal.aborted) throw new ProviderError("unreachable", "aborted");
				yield { type: "text", delta };
			}
			if (turn.alive) yield { type: "alive" };
			if (turn.hold) await turn.hold;
			// The answer breaks off after what it said so far, as a stream that closes without its ending.
			if (turn.breaksOff) throw new ProviderError("interrupted", "The answer ended before it was whole.");
			for (const call of turn.calls ?? []) {
				calls += 1;
				yield {
					type: "call",
					call: { id: call.id ?? `call-${calls}`, name: call.name, input: call.input } satisfies ToolCall,
				};
			}
			yield { type: "end", usage: turn.usage ?? { input: 100, output: 20 }, ...(turn.cut ? { cut: turn.cut } : {}) };
		},
		async answer(request) {
			answers.push(request);
			// The scripted answer may be a promise: one that never comes is a service that never answers.
			return { value: await answer(request), usage: { input: 50, output: 10 } };
		},
	};
	return {
		provider,
		for: (key) => {
			keys.push(key);
			return provider;
		},
		turns,
		answers,
		keys,
		add: (...more) => {
			left.push(...more);
		},
	};
}
