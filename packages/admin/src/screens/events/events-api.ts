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
export const EVENTS_KEY = ["cms", "events"] as const;
export const EVENTS_LIST_KEY = [...EVENTS_KEY, "list"] as const;
export const EVENTS_COUNT_KEY = [...EVENTS_KEY, "count"] as const;

/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site: Site): Promise<number> {
	const data = await cmsFetch<EventsList>(site, cmsApiUrl("/v1/events?limit=1"));
	return data.counts.failed + data.counts.dead;
}
