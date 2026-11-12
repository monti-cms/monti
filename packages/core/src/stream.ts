import type { z } from "zod";
import type { Session } from "./auth/session";
import type { Monti } from "./monti";

/** What a stream gets besides its input. */
export type StreamContext = {
	monti: Monti;
	/** Who started it: a person in the admin, or one at the terminal. A stream is never the assistant's tool. */
	actor: "admin" | "cli";
	session: Session | null;
	/** Ends when whoever listens goes away (the browser closed, the request was cut). */
	signal: AbortSignal;
};

/**
 * Work whose news comes as it happens, not as one answer: an assistant's run, a proposal being applied (docs 00 and 10). A stream is not an
 * operation: it is not one transaction, it leaves no activity row of its own (the writes it makes leave theirs), and only a person starts it. The
 * admin API offers each at `POST …/streams/<name>` and answers with its events, one JSON object per line; the CLI prints them the same way.
 */
export type StreamDefinition<Input, Event> = {
	/** `<area>.<verb>`, as the feature docs name it: `assistant.run`. */
	name: string;
	description: string;
	input: z.ZodType<Input>;
	run: (input: Input, ctx: StreamContext) => AsyncIterable<Event>;
};

export type Stream<Input = unknown, Event = unknown> = StreamDefinition<Input, Event> & { readonly __stream: true };

// biome-ignore lint/suspicious/noExplicitAny: a list of streams holds every input and event type.
export type AnyStream = Stream<any, any>;

const NAME = /^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/;

export function defineStream<Input, Event>(definition: StreamDefinition<Input, Event>): Stream<Input, Event> {
	if (!NAME.test(definition.name))
		throw new Error(`Stream name "${definition.name}" is not "<area>.<verb>" in camel case.`);
	return { ...definition, __stream: true };
}
