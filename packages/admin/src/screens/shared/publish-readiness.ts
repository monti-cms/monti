import type { CmsIssue } from "../../api/error-message";
import type { TranslatorFor } from "../../translator";
import { publishReadinessMessages } from "./publish-readiness.messages";

type ReadinessTranslator = TranslatorFor<typeof publishReadinessMessages>;
type TextKey = Parameters<ReadinessTranslator>[0];

const FRIENDLY = new Set(Object.keys(publishReadinessMessages.messages.en));
const UUID_START = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** The server's `message` of an issue names the thing it is about, unless it is only an id a person cannot read. */
const nameOf = (issue: CmsIssue): string => {
	const message = issue.message?.trim() ?? "";
	return UUID_START.test(message) ? "" : message;
};

/**
 * What a problem of the publish check asks the writer to do. A code with a plain to-do in the dictionary gets it (naming what the server's `message`
 * names); any other code, such as the issue of a plugin's hook, keeps the server's own text.
 */
export function readinessText(t: ReadinessTranslator, issue: CmsIssue): string {
	const key = `issue.${issue.code ?? ""}`;
	return FRIENDLY.has(key) ? t(key as TextKey, { name: nameOf(issue) }) : issue.text;
}

/** Whether going to the issue means something: it has a field or a place in the body. */
export const issueHasPlace = (issue: CmsIssue): boolean => Boolean(issue.path || issue.position);

/** What the publish check found, as the readiness item reads it. */
export interface PublishCheckResult {
	readonly issues: readonly CmsIssue[];
	readonly warnings: readonly CmsIssue[];
}
