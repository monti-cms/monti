import { type Site } from "@monti-cms/core/client";
/** Local shapes of the events API responses (dates arrive as ISO strings). */
export interface EventDeliveryItem {
    change: {
        eventId: string;
        kind: "created" | "saved" | "published" | "archived" | "unarchived" | "trashed" | "restored" | "deleted";
        entryId: string;
        collection: string;
        occurredAt: string;
        publishedSlug?: string | null;
        workingSlug?: string | null;
    };
    subscriber: string;
    state: "failed" | "dead";
    attempts: number;
    lastError: string | null;
    nextAttemptAt: string | null;
}
export interface EventCounts {
    pending: number;
    delivering: number;
    delivered: number;
    failed: number;
    dead: number;
    dismissed: number;
}
export interface EventsList {
    items: EventDeliveryItem[];
    total: number;
    counts: EventCounts;
}
/** Everything under this prefix is refetched after an action. */
export declare const EVENTS_KEY: readonly ["cms", "events"];
export declare const EVENTS_LIST_KEY: readonly ["cms", "events", "list"];
export declare const EVENTS_COUNT_KEY: readonly ["cms", "events", "count"];
/** Number of failed and dead deliveries, for the sidebar badge. */
export declare function countFailedEvents(site: Site): Promise<number>;
