import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "../admin-api.js";
/** Everything under this prefix is refetched after an action. */
export const EVENTS_KEY = ["cms", "events"];
export const EVENTS_LIST_KEY = [...EVENTS_KEY, "list"];
export const EVENTS_COUNT_KEY = [...EVENTS_KEY, "count"];
/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site) {
    const data = await cmsFetch(site, cmsApiUrl("/v1/events?limit=1"));
    return data.counts.failed + data.counts.dead;
}
