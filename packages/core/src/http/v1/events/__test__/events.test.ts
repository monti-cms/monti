import { describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../../../cms";
import type { ContentChange, ContentStore, EventDelivery } from "../../../../core/store";
import { routeCaller } from "../../../../testing";
import { GET as listHandler } from "../route";

const list = routeCaller(listHandler);

const counts = { pending: 0, delivering: 0, delivered: 4, failed: 1, dead: 1, dismissed: 0 };
const failed: EventDelivery = {
	change: {
		eventId: "11111111-1111-4111-8111-111111111111",
		kind: "saved",
		entryId: "22222222-2222-4222-8222-222222222222",
		collection: "posts",
		locale: "en",
		translationGroupId: "22222222-2222-4222-8222-222222222222",
		status: "draft",
		publishedSlug: null,
		workingSlug: "hello",
		title: "Hello",
		version: 3,
		contentHash: "abc",
		actor: null,
		occurredAt: new Date("2030-01-01T00:00:00Z"),
	} satisfies ContentChange,
	subscriber: "plugin:mailer",
	state: "failed",
	attempts: 2,
	lastError: "push rejected",
	lastAttemptAt: new Date("2030-01-01T00:01:00Z"),
	nextAttemptAt: new Date("2030-01-01T00:05:00Z"),
	deliveredAt: null,
};

const storeOf = (overrides: Partial<Record<keyof ContentStore, unknown>> = {}) =>
	({
		listEventDeliveries: vi.fn(async () => ({ items: [failed], total: 1 })),
		countEventDeliveries: vi.fn(async () => counts),
		retryDelivery: vi.fn(async () => true),
		dismissDelivery: vi.fn(async () => true),
		enqueueEvents: vi.fn(async () => 0),
		claimDeliveries: vi.fn(async () => []),
		...overrides,
	}) as unknown as ContentStore;

describe("GET /v1/events", () => {
	it("EVENT-L1 lists the failed and dead deliveries with the counts, and asks the store for them by default", async () => {
		const store = storeOf();
		const response = await list(new Request("http://localhost/api/monti/v1/events"), { cms: fakeCms({ store }) });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.total).toBe(1);
		expect(body.counts).toEqual(counts);
		expect(body.items[0]).toMatchObject({
			subscriber: "plugin:mailer",
			state: "failed",
			lastError: "push rejected",
			change: { eventId: failed.change.eventId, kind: "saved", workingSlug: "hello" },
		});
		expect(store.listEventDeliveries).toHaveBeenCalledWith({ states: undefined, limit: undefined, offset: undefined });
	});

	it("EVENT-F2 passes the state filter and the paging on, and rejects an unknown state", async () => {
		const store = storeOf();
		const cms = fakeCms({ store });
		await list(new Request("http://localhost/api/monti/v1/events?state=dead&state=failed&limit=10&offset=20"), { cms });
		expect(store.listEventDeliveries).toHaveBeenCalledWith({ states: ["dead", "failed"], limit: 10, offset: 20 });
		const bad = await list(new Request("http://localhost/api/monti/v1/events?state=nope"), { cms });
		expect(bad.status).toBe(400);
	});
});
