import { describe, expect, it } from "vitest";
import { createEventDispatcher, type EventDeliveryOptions } from "../events";

/** The events of a dispatcher with no subscribers. Its store is never read: checking the retry secret touches no event log. */
const eventsWith = (options: EventDeliveryOptions = {}) =>
	createEventDispatcher({
		store: () => {
			throw new Error("the retry secret check must not read the store");
		},
		subscribers: async () => [],
		...options,
	}).events;

describe("the retry secret", () => {
	it("API-G3 accepts only the configured secret", () => {
		const events = eventsWith({ retrySecret: "s3cret" });
		expect(events.acceptsRetryToken("s3cret")).toBe(true);
		expect(events.acceptsRetryToken("s3cret ")).toBe(false);
		expect(events.acceptsRetryToken("")).toBe(false);
		expect(events.acceptsRetryToken(null)).toBe(false);
		expect(eventsWith().acceptsRetryToken("s3cret")).toBe(false);
	});
});
