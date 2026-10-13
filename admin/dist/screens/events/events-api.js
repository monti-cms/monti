import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "../admin-api.js";
export const EVENTS_FILTERS = ["all", "failed", "pending", "delivered"];
const FILTER_STATES = {
    all: ["pending", "delivering", "delivered", "failed", "dead", "dismissed", "recorded"],
    failed: ["failed", "dead"],
    pending: ["pending", "delivering"],
    delivered: ["delivered"],
};
/** Query string of `GET /v1/events` for a filter and page (newest event first). */
export function eventsQuery(filter, page, pageSize) {
    const params = new URLSearchParams();
    for (const state of FILTER_STATES[filter])
        params.append("state", state);
    params.set("limit", String(pageSize));
    params.set("offset", String((page - 1) * pageSize));
    return params.toString();
}
/** Everything under this prefix is refetched after an action. */
export const EVENTS_KEY = ["cms", "events"];
export const EVENTS_LIST_KEY = [...EVENTS_KEY, "list"];
export const EVENTS_COUNT_KEY = [...EVENTS_KEY, "count"];
/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site) {
    const data = await cmsFetch(site, cmsApiUrl("/v1/events?limit=1"));
    return data.counts.failed + data.counts.dead;
}
