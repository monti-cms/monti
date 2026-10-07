import { CmsError } from "../../core/store";
import { type Issue, ServiceError } from "../../core/types";

/** A readable description of why a write failed: the error code and what the pipeline found, not a stack trace. */
export function describeError(error: unknown): string {
	if (error instanceof ServiceError) {
		const issues = (error.issues ?? []) as readonly Issue[];
		const found = issues
			.map((issue) => [issue.path, issue.code, issue.message].filter(Boolean).join(" "))
			.filter(Boolean);
		return found.length > 0 ? `${error.code}: ${found.slice(0, 5).join("; ")}` : error.code;
	}
	if (error instanceof CmsError) return `${error.code}: ${error.message}`;
	return error instanceof Error ? error.message || error.name : String(error);
}
