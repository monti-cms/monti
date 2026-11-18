import type { ErrorCode } from "./types";

/** The one error of the core. The HTTP entry turns `code` into a response status. */
export class MontiError extends Error {
	constructor(
		public readonly code: ErrorCode,
		message: string,
		public readonly details?: unknown,
	) {
		super(message);
	}
}
