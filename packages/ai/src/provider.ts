import type { OpenKey } from "@monti-cms/core";

/** How much a model thinks before it answers; `off` for a model that cannot, or when the person turned it off. */
export type Thinking = "off" | "low" | "medium" | "high";

export const THINKING: readonly Thinking[] = ["off", "low", "medium", "high"];

/** Tokens a call spent, as its service counted them. */
export type Usage = { input: number; output: number };

/** A tool as the model is told of it: a name its API accepts, what it does, and its input's JSON Schema. */
export type ToolSpec = { name: string; description: string; inputSchema: unknown };

export type ToolCall = { id: string; name: string; input: unknown };

export type ToolAnswer = { id: string; name: string; output: unknown; error: boolean };

export type Picture = { mime: string; base64: string };

/**
 * One message of a conversation, the same for every service. `raw` is what the service itself gave for an assistant message: handed back unchanged
 * on the next request to the same service, so what it needs to see again (its thinking) is there.
 */
export type ChatMessage =
	| { role: "user"; text: string; pictures?: Picture[] }
	| { role: "assistant"; text: string; calls: ToolCall[]; raw?: unknown }
	| { role: "tools"; answers: ToolAnswer[] };

export type TurnRequest = {
	model: string;
	system: string;
	messages: ChatMessage[];
	tools: ToolSpec[];
	thinking: Thinking;
	/** Whether the model can think at all: one that cannot is asked for no thinking, whatever `thinking` says. */
	thinks: boolean;
	signal: AbortSignal;
};

/**
 * What a turn gives as it comes: words, the tools it calls, a sign of life while it thinks or writes a call (nothing to show, but the service is
 * there; `thinking` says it began to think, or is done, when the service says so), and its end with what it spent. `cut`: the service ended the answer itself, out of room or declining to go on.
 */
export type TurnEvent =
	| { type: "text"; delta: string }
	| { type: "call"; call: ToolCall }
	| { type: "alive"; thinking?: boolean }
	| { type: "end"; usage: Usage; raw?: unknown; cut?: "length" | "refusal" };

export type AnswerRequest = {
	model: string;
	system: string;
	prompt: string;
	picture?: Picture;
	/** The JSON Schema of the answer. */
	schema: unknown;
	/** Ends the call: the quick task's deadline. */
	signal?: AbortSignal;
};

/**
 * A model service, as narrow as the assistant needs it (doc 10): one turn of a conversation with tools, and one answer in a fixed shape. The run
 * engine and the quick tasks know only this; the real one is built on the AI SDK, and tests script one.
 */
export interface ModelProvider {
	turn(request: TurnRequest): AsyncIterable<TurnEvent>;
	answer(request: AnswerRequest): Promise<{ value: unknown; usage: Usage }>;
}

/** The provider for a key: the service the key is for, with the key itself. */
export type ProviderFor = (key: OpenKey) => ModelProvider;

/**
 * The service did not do what was asked. `refused`: it answered no (credits, a limit, the key, the model); the person can do something about it.
 * `unreachable`: it did not answer. `interrupted`: it began to answer and broke off, or went silent; what it said so far is no answer, and the
 * run can be gone on with. `detail` is the service's own words, shown as they are.
 */
export class ProviderError extends Error {
	constructor(
		readonly kind: "refused" | "unreachable" | "interrupted",
		readonly detail: string,
		readonly status?: number,
		/** What the service counted for an answer that broke off, when it said. */
		readonly usage?: Usage,
	) {
		super(
			`The model service ${kind === "refused" ? "refused" : kind === "interrupted" ? "broke off" : "could not be reached"}: ${detail}`,
		);
	}
}
