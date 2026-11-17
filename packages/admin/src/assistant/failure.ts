import type { AiFailure } from "@monti-cms/ai";
import type { Message } from "@monti-cms/core";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const REASONS: readonly AiFailure["reason"][] = [
	"noKey",
	"refused",
	"limit",
	"unreachable",
	"timeout",
	"noImages",
	"noPicture",
];

/** Why AI work did not go, in one short line: the same words wherever it failed (doc 10, errors). The service's own words are never shown. */
export const failureText = (t: Translate, failure: AiFailure): string =>
	t(`failure.${failure.reason}`, { key: failure.keyName ?? "AI" });

/**
 * Whether asking the same again can go, where AI work outside the panel failed (a fill, a request at a place, a translation): every
 * failure but a missing key or a missing picture. A quick-task model changed on the keys screen meanwhile is the one the next try uses.
 */
export const canRetry = (failure: AiFailure | null): boolean =>
	failure === null || (failure.reason !== "noKey" && failure.reason !== "noPicture");

/** The failure a refusal from the server holds (`assistant.failed`), or `null` for any other reason. */
export function failureIn(reason: Message | null | undefined): AiFailure | null {
	if (reason?.key !== "assistant.failed") return null;
	const found = REASONS.find((each) => each === reason.values?.reason);
	if (!found) return null;
	const keyName = reason.values?.keyName;
	return { reason: found, keyName: typeof keyName === "string" ? keyName : null };
}

/** A refusal from the server in the admin's words: an AI failure in its one short line, anything else as the server's reason. */
export const reasonText = (t: Translate, reason: Message): string => {
	const failure = failureIn(reason);
	return failure ? failureText(t, failure) : t(reason.key, reason.values);
};
