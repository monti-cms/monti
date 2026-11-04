import type { z } from "zod";
import type { Message, RecordRef } from "./operation";

/** The input does not match the operation's schema. */
export class InputError extends Error {
	readonly code = "invalid-input";
	constructor(readonly issues: z.core.$ZodIssue[]) {
		super(
			`Invalid input: ${issues.map((issue) => `${issue.path.join(".") || "(input)"} ${issue.message}`).join("; ")}`,
		);
	}
}

/** A record changed since the caller read it. The screen reloads; a proposal item becomes "changed in the meantime". */
export class ConflictError extends Error {
	readonly code = "conflict";
	constructor(readonly records: { ref: RecordRef; expected: number; actual: number | null }[]) {
		super(`Changed since it was read: ${records.map((record) => `${record.ref.kind}:${record.ref.id}`).join(", ")}`);
	}
}

/** An operation's `check` refused the write. */
export class CheckError extends Error {
	readonly code = "check-failed";
	constructor(readonly reason: Message) {
		super(`Check failed: ${reason.key}`);
	}
}

/** No operation by that name, or not one this entry point runs (a screen operation on the server). */
export class UnknownOperationError extends Error {
	readonly code = "unknown-operation";
	constructor(readonly operation: string) {
		super(`Unknown operation: ${operation}`);
	}
}

/** The caller may not run it: a human-only operation from the assistant, or an undo past its 30 days. */
export class ForbiddenError extends Error {
	readonly code = "forbidden";
	constructor(readonly reason: Message) {
		super(`Not allowed: ${reason.key}`);
	}
}

export type MontiError = InputError | ConflictError | CheckError | UnknownOperationError | ForbiddenError;

export const isMontiError = (error: unknown): error is MontiError =>
	error instanceof InputError ||
	error instanceof ConflictError ||
	error instanceof CheckError ||
	error instanceof UnknownOperationError ||
	error instanceof ForbiddenError;
