import { describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../../../../../cms";
import type { ContentChange, ContentStore, EventDelivery } from "../../../../../../core/store";
import { routeCaller } from "../../../../../../testing";
import { POST as retryOneHandler } from "../route";

const retryOne = routeCaller(retryOneHandler);

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

const post = (path: string, init: { headers?: Record<string, string>; body?: unknown } = {}) =>
	new Request(`http://localhost/api/monti/v1/${path}`, {
		method: "POST",
		headers: { origin: "http://localhost", "content-type": "application/json", ...init.headers },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});

describe("POST /v1/events/<id>/retry and /dismiss", () => {
	const params = Promise.resolve({ id: failed.change.eventId });
	const body = { subscriber: "plugin:mailer" };

	it("EVENT-R1 retries one delivery and answers with the counts", async () => {
		const store = storeOf();
		const response = await retryOne(post(`events/${failed.change.eventId}/retry`, { body }), {
			cms: fakeCms({ store }),
			params,
		});
		expect(response.status).toBe(200);
		expect(store.retryDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ eventId: failed.change.eventId, subscriber: "plugin:mailer" }),
		);
	});
});
