import type { Site } from "@monti-cms/core/site";
/** Local shapes of the events API responses (dates arrive as ISO strings). */
export interface EventDeliveryItem {
    change: {
        eventId: string;
        kind: "created" | "saved" | "published" | "archived" | "unarchived" | "trashed" | "restored" | "deleted";
        entryId: string;
        collection: string;
        locale?: string;
        translationGroupId?: string;
        status?: string;
        version?: number;
        occurredAt: string;
        actor?: string | null;
        publishedSlug?: string | null;
        workingSlug?: string | null;
        /** The entry's title when the change was made. */
        title?: string | null;
    };
    /** `null` for an event no subscriber was made a delivery for (`recorded`). */
    subscriber: string | null;
    state: "pending" | "delivering" | "delivered" | "failed" | "dead" | "dismissed" | "recorded";
    attempts: number;
    lastError: string | null;
    nextAttemptAt: string | null;
    lastAttemptAt?: string | null;
    deliveredAt?: string | null;
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
/** Query keys. Everything under `all` is refetched after an action. */
export declare const eventsKeys: {
    all: readonly ["cms", "events"];
    list: (filter: EventsFilter, page: number, pageSize: number) => readonly ["cms", "events", "list", EventsFilter, number, number];
    count: () => readonly ["cms", "events", "count"];
};
export interface RetryAllResult {
    delivered: number;
    failed: number;
    dead: number;
}
/** One page of deliveries for a filter (`GET /v1/events`). */
export declare const listEvents: (site: Site, filter: EventsFilter, page: number, pageSize: number, signal?: AbortSignal, fallback?: string) => Promise<EventsList>;
/** Which delivery an action is about. */
export interface DeliveryKey {
    eventId: string;
    subscriber: string;
}
export declare const retryEvent: (site: Site, key: DeliveryKey, fallback?: string) => Promise<unknown>;
export declare const dismissEvent: (site: Site, key: DeliveryKey, fallback?: string) => Promise<unknown>;
/** Sends the deliveries that are due: pending ones and failed ones whose next attempt has come. */
export declare const retryAllEvents: (site: Site, fallback?: string) => Promise<RetryAllResult>;
/** Number of failed and dead deliveries, for the sidebar badge. */
export declare function countFailedEvents(site: Site, signal?: AbortSignal): Promise<number>;
