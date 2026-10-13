import { cmsApiUrl, type Site } from "@monti-cms/core/client";
import { cmsFetch } from "../admin-api";

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

/** Everything under this prefix is refetched after an action. */
export const EVENTS_KEY = ["cms", "events"] as const;
export const EVENTS_LIST_KEY = [...EVENTS_KEY, "list"] as const;
export const EVENTS_COUNT_KEY = [...EVENTS_KEY, "count"] as const;

/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site: Site): Promise<number> {
	const data = await cmsFetch<EventsList>(site, cmsApiUrl("/v1/events?limit=1"));
	return data.counts.failed + data.counts.dead;
}
