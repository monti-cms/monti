import { adminFetch } from "./client.js";
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
/** Query keys. Everything under `all` is refetched after an action. */
export const eventsKeys = {
    all: ["cms", "events"],
    list: (filter, page, pageSize) => [...eventsKeys.all, "list", filter, page, pageSize],
    count: () => [...eventsKeys.all, "count"],
};
/** One page of deliveries for a filter (`GET /v1/events`). */
export const listEvents = (site, filter, page, pageSize, signal, fallback) => adminFetch(site, `/v1/events?${eventsQuery(filter, page, pageSize)}`, { signal, fallback });
export const retryEvent = (site, key, fallback) => adminFetch(site, `/v1/events/${encodeURIComponent(key.eventId)}/retry`, {
    method: "POST",
    json: { subscriber: key.subscriber },
    fallback,
});
export const dismissEvent = (site, key, fallback) => adminFetch(site, `/v1/events/${encodeURIComponent(key.eventId)}/dismiss`, {
    method: "POST",
    json: { subscriber: key.subscriber },
    fallback,
});
/** Sends the deliveries that are due: pending ones and failed ones whose next attempt has come. */
export const retryAllEvents = (site, fallback) => adminFetch(site, "/v1/events/retry", { method: "POST", json: {}, fallback });
/** Number of failed and dead deliveries, for the sidebar badge. */
export async function countFailedEvents(site, signal) {
    const data = await adminFetch(site, "/v1/events?limit=1", { signal });
    return data.counts.failed + data.counts.dead;
}
