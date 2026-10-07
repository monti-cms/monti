import type { ContentEvent, DeferredDelivery } from "@monti-cms/core/plugin/server";
import { onDraftEvent } from "./drafts";
import { onPublishedEvent } from "./outbound";
import type { SyncContext } from "./sync";

/**
 * The `afterCommit` subscriber: one delivery per change, handled by the draft branches first (a publish is a merge of the entry's draft pull request) and then by
 * the published files (a commit, or a pull request). A target where the draft pull request took the publish is left out of the second.
 *
 * Every failure is thrown (the first one) after everything was tried, so the outbox retries the delivery; deferring is not a failure, the outbox calls again when
 * the latest of the moments the parts asked for has come.
 */
export async function onContentEvent(ctx: SyncContext, event: ContentEvent): Promise<DeferredDelivery | undefined> {
	const drafts = await onDraftEvent(ctx, event);
	const published = await onPublishedEvent(ctx, event, drafts.skip);
	const failures = [...drafts.failures, ...published.failures];
	if (failures[0] !== undefined) throw failures[0];
	const deferred = [...drafts.deferred, ...published.deferred];
	if (deferred.length > 0) return { retryAt: new Date(Math.max(...deferred.map((date) => date.getTime()))) };
	return undefined;
}
