import type { z } from "zod";
import type { ReadContext, ReadOperation, WriteContext, WriteOperation } from "./types";

/** Defines a read: it runs without a transaction and sends no event. */
export function defineRead<TInput, TOutput>(def: {
	input: z.ZodType<TInput>;
	run: (input: TInput, ctx: ReadContext) => Promise<TOutput>;
}): ReadOperation<TInput, TOutput> {
	return { kind: "read", input: def.input, run: def.run };
}

/** Defines a write: it runs inside a transaction and its event is sent after the commit. */
export function defineWrite<TInput, TOutput>(def: {
	input: z.ZodType<TInput>;
	run: (input: TInput, ctx: WriteContext) => Promise<TOutput>;
}): WriteOperation<TInput, TOutput> {
	return { kind: "write", input: def.input, run: def.run };
}
