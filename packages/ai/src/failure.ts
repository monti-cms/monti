import { CheckError } from "@monti-cms/core";
import type { ProviderError } from "./provider";

/**
 * Why AI work did not go, the same for a run and a quick task (doc 10, errors): `noKey` there is no key or model to run on; `refused` the service
 * said no; `limit` it said no for a rate limit, a quota or credits; `unreachable` it did not answer; `timeout` a quick task's answer did not come in
 * time; `noImages` the model does not read pictures; `noPicture` the picture is not there. `keyName` names the key the work went to, when it went to
 * one. The service's own words are never in it: they stay in the server's record of the run.
 */
export type AiFailure = {
	reason: "noKey" | "refused" | "limit" | "unreachable" | "timeout" | "noImages" | "noPicture";
	keyName: string | null;
};

/** A service's failure as the browser is told it. */
export const failureOf = (error: ProviderError, keyName: string): AiFailure => ({
	reason: error.kind === "refused" ? "refused" : error.kind === "limit" ? "limit" : "unreachable",
	keyName,
});

/** A failure thrown from an operation (a quick task, a run that cannot start): one key, `assistant.failed`, with the failure as its values. */
export const failed = (failure: AiFailure) =>
	new CheckError({
		key: "assistant.failed",
		values: { reason: failure.reason, ...(failure.keyName === null ? {} : { keyName: failure.keyName }) },
	});
