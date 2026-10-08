import type { ContentEvent, DeferredDelivery } from "@monti-cms/core/plugin/server";
import { onPublishedEvent } from "./outbound";
import type { SyncContext } from "./sync";

/**
 * The `afterCommit` subscriber: one delivery per change, handled by the published files (a commit, or a pull request).
 *
 * The first failure is thrown after everything was tried, so the outbox retries the delivery; deferring is not a failure, the outbox calls again when
 * the latest of the moments the parts asked for has come.
 */
export async function onContentEvent(ctx: SyncContext, event: ContentEvent): Promise<DeferredDelivery | undefined> {
	const published = await onPublishedEvent(ctx, event);
	if (published.failures[0] !== undefined) throw published.failures[0];
	if (published.deferred.length > 0)
		return { retryAt: new Date(Math.max(...published.deferred.map((date) => date.getTime()))) };
	return undefined;
}
