import { type Site } from "@monti-cms/core/client";
/** Local shapes of the events API responses (dates arrive as ISO strings). */
export interface EventDeliveryItem {
    change: {
        eventId: string;
        kind: "created" | "saved" | "published" | "archived" | "unarchived" | "trashed" | "restored" | "deleted";
        entryId: string;
        collection: string;
        occurredAt: string;
        actor?: string | null;
        publishedSlug?: string | null;
        workingSlug?: string | null;
    };
    /** `null` for an event no subscriber was made a delivery for (`recorded`). */
    subscriber: string | null;
    state: "pending" | "delivering" | "delivered" | "failed" | "dead" | "dismissed" | "recorded";
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
/** Which deliveries the events screen lists. */
export type EventsFilter = "all" | "failed" | "pending" | "delivered";
export declare const EVENTS_FILTERS: readonly EventsFilter[];
/** Query string of `GET /v1/events` for a filter and page (newest event first). */
export declare function eventsQuery(filter: EventsFilter, page: number, pageSize: number): string;
/** Everything under this prefix is refetched after an action. */
export declare const EVENTS_KEY: readonly ["cms", "events"];
export declare const EVENTS_LIST_KEY: readonly ["cms", "events", "list"];
export declare const EVENTS_COUNT_KEY: readonly ["cms", "events", "count"];
/** Number of failed and dead deliveries, for the sidebar badge. */
export declare function countFailedEvents(site: Site): Promise<number>;
