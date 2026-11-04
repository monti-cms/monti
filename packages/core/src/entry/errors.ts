import { CheckError, ConflictError, ForbiddenError, InputError, isMontiError, UnknownOperationError } from "../errors";

/** An error as every entry point reports it: a code, an HTTP status, and what the caller needs to act on it. */
export function describeError(error: unknown): { status: number; body: Record<string, unknown> } | null {
	if (!isMontiError(error)) return null;
	if (error instanceof InputError) return { status: 400, body: { error: error.code, issues: error.issues } };
	if (error instanceof ConflictError) return { status: 409, body: { error: error.code, records: error.records } };
	if (error instanceof CheckError) return { status: 422, body: { error: error.code, reason: error.reason } };
	if (error instanceof ForbiddenError) return { status: 403, body: { error: error.code, reason: error.reason } };
	if (error instanceof UnknownOperationError) return { status: 404, body: { error: error.code } };
	return null;
}
