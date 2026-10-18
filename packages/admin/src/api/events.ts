import type { Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

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
export const EVENTS_FILTERS: readonly EventsFilter[] = ["all", "failed", "pending", "delivered"];

const FILTER_STATES: Record<EventsFilter, readonly EventDeliveryItem["state"][]> = {
	all: ["pending", "delivering", "delivered", "failed", "dead", "dismissed", "recorded"],
	failed: ["failed", "dead"],
	pending: ["pending", "delivering"],
	delivered: ["delivered"],
};

/** Query string of `GET /v1/events` for a filter and page (newest event first). */
export function eventsQuery(filter: EventsFilter, page: number, pageSize: number): string {
	const params = new URLSearchParams();
	for (const state of FILTER_STATES[filter]) params.append("state", state);
	params.set("limit", String(pageSize));
	params.set("offset", String((page - 1) * pageSize));
	return params.toString();
}

/** Query keys. Everything under `all` is refetched after an action. */
export const eventsKeys = {
	all: ["cms", "events"] as const,
	list: (filter: EventsFilter, page: number, pageSize: number) =>
		[...eventsKeys.all, "list", filter, page, pageSize] as const,
	count: () => [...eventsKeys.all, "count"] as const,
};

export interface RetryAllResult {
	delivered: number;
	failed: number;
	dead: number;
}

/** One page of deliveries for a filter (`GET /v1/events`). */
export const listEvents = (
	site: Site,
	filter: EventsFilter,
	page: number,
	pageSize: number,
	signal?: AbortSignal,
	fallback?: string,
) => adminFetch<EventsList>(site, `/v1/events?${eventsQuery(filter, page, pageSize)}`, { signal, fallback });

/** Which delivery an action is about. */
export interface DeliveryKey {
	eventId: string;
	subscriber: string;
}

export const retryEvent = (site: Site, key: DeliveryKey, fallback?: string) =>
	adminFetch(site, `/v1/events/${encodeURIComponent(key.eventId)}/retry`, {
		method: "POST",
		json: { subscriber: key.subscriber },
		fallback,
	});

export const dismissEvent = (site: Site, key: DeliveryKey, fallback?: string) =>
	adminFetch(site, `/v1/events/${encodeURIComponent(key.eventId)}/dismiss`, {
		method: "POST",
		json: { subscriber: key.subscriber },
		fallback,
	});

/** Sends the deliveries that are due: pending ones and failed ones whose next attempt has come. */
export const retryAllEvents = (site: Site, fallback?: string) =>
	adminFetch<RetryAllResult>(site, "/v1/events/retry", { method: "POST", json: {}, fallback });

/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site: Site, signal?: AbortSignal): Promise<number> {
	const data = await adminFetch<EventsList>(site, "/v1/events?limit=1", { signal });
	return data.counts.failed + data.counts.dead;
}
