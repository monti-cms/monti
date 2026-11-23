import type { z } from "zod";
import type { Operation, ReadContext, ReadOperation, ResourceTree, WriteContext, WriteOperation } from "./types";

/** Defines a read: it runs without a transaction and sends no event. */
export function defineRead<TInput, TOutput>(def: {
	input: z.ZodType<TInput>;
	run: (input: TInput, ctx: ReadContext) => Promise<TOutput>;
}): ReadOperation<TInput, TOutput> {
	return { kind: "read", input: def.input, run: def.run };
}

/** 쓰기 Operation을 정의한다: 트랜잭션 안에서 실행되며 `emit: true`일 때만 커밋 뒤 이벤트를 통지한다. */
export function defineWrite<TInput, TOutput>(def: {
	input: z.ZodType<TInput>;
	run: (input: TInput, ctx: WriteContext) => Promise<TOutput>;
	emit?: boolean;
}): WriteOperation<TInput, TOutput> {
	return { kind: "write", emit: def.emit, input: def.input, run: def.run };
}

/** Whether a node of the resource tree is an operation rather than a resource holding more nodes. */
export function isOperation(node: Operation | ResourceTree): node is Operation {
	return typeof node.run === "function";
}
