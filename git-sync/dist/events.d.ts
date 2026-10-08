import type { ContentEvent, DeferredDelivery } from "@monti-cms/core/plugin/server";
import type { SyncContext } from "./sync.js";
/**
 * The `afterCommit` subscriber: one delivery per change, handled by the published files (a commit, or a pull request).
 *
 * The first failure is thrown after everything was tried, so the outbox retries the delivery; deferring is not a failure, the outbox calls again when
 * the latest of the moments the parts asked for has come.
 */
export declare function onContentEvent(ctx: SyncContext, event: ContentEvent): Promise<DeferredDelivery | undefined>;
