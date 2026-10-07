import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import type { ContentChange, ContentStore, EventDelivery } from "../../../core/store";
import { POST as dismiss } from "../events/[id]/dismiss/route";
import { POST as retryOne } from "../events/[id]/retry/route";
import { POST as retryAll } from "../events/retry/route";
import { GET as list } from "../events/route";

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
		version: 3,
		contentHash: "abc",
		occurredAt: new Date("2030-01-01T00:00:00Z"),
	} satisfies ContentChange,
	subscriber: "plugin:git-sync",
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
	new Request(`http://localhost/api/cms/v1/${path}`, {
		method: "POST",
		headers: { origin: "http://localhost", "content-type": "application/json", ...init.headers },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});

describe("GET /v1/events", () => {
	it("lists the failed and dead deliveries with the counts, and asks the store for them by default", async () => {
		const store = storeOf();
		const response = await list(new Request("http://localhost/api/cms/v1/events"), { cms: fakeCms({ store }) });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.total).toBe(1);
		expect(body.counts).toEqual(counts);
		expect(body.items[0]).toMatchObject({
			subscriber: "plugin:git-sync",
			state: "failed",
			lastError: "push rejected",
			change: { eventId: failed.change.eventId, kind: "saved", workingSlug: "hello" },
		});
		expect(store.listEventDeliveries).toHaveBeenCalledWith({ states: undefined, limit: undefined, offset: undefined });
	});

	it("passes the state filter and the paging on, and rejects an unknown state", async () => {
		const store = storeOf();
		const cms = fakeCms({ store });
		await list(new Request("http://localhost/api/cms/v1/events?state=dead&state=failed&limit=10&offset=20"), { cms });
		expect(store.listEventDeliveries).toHaveBeenCalledWith({ states: ["dead", "failed"], limit: 10, offset: 20 });
		const bad = await list(new Request("http://localhost/api/cms/v1/events?state=nope"), { cms });
		expect(bad.status).toBe(400);
	});

	it("needs an admin", async () => {
		const cms = fakeCms({
			store: storeOf(),
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "no session");
			},
		});
		expect((await list(new Request("http://localhost/api/cms/v1/events"), { cms })).status).toBe(401);
	});
});

describe("POST /v1/events/retry", () => {
	const subscribed = (store: ContentStore, events: { retrySecret?: string } = {}) =>
		fakeCms({
			store,
			server: { events },
			plugins: [{ name: "sync", hooks: { afterCommit: () => undefined } }],
		});

	it("takes an admin session and delivers what is due", async () => {
		const store = storeOf();
		const response = await retryAll(post("events/retry", { body: {} }), { cms: subscribed(store) });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ delivered: 0, failed: 0, dead: 0, counts });
		expect(store.claimDeliveries).toHaveBeenCalledWith(
			expect.objectContaining({ subscribers: ["plugin:sync"], ignoreBackoff: undefined }),
		);
	});

	it("passes `all` and `limit` on", async () => {
		const store = storeOf();
		await retryAll(post("events/retry?all=1&limit=7", { body: {} }), { cms: subscribed(store) });
		expect(store.claimDeliveries).toHaveBeenCalledWith(expect.objectContaining({ limit: 7, ignoreBackoff: true }));
	});

	it("takes the retry secret as a bearer token, without a session or a same-origin header", async () => {
		const store = storeOf();
		const cms = fakeCms({
			store,
			server: { events: { retrySecret: "cron-secret" } },
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "no session");
			},
		});
		const request = new Request("http://localhost/api/cms/v1/events/retry", {
			method: "POST",
			headers: { authorization: "Bearer cron-secret" },
		});
		const response = await retryAll(request, { cms });
		expect(response.status).toBe(200);
		expect((await response.json()).counts).toEqual(counts);
	});

	it("refuses a wrong token, and any token when no secret is configured", async () => {
		const headers = { authorization: "Bearer guess" };
		const wrong = await retryAll(post("events/retry", { headers }), {
			cms: fakeCms({ store: storeOf(), server: { events: { retrySecret: "cron-secret" } } }),
		});
		expect(wrong.status).toBe(401);
		const none = await retryAll(post("events/retry", { headers }), { cms: fakeCms({ store: storeOf() }) });
		expect(none.status).toBe(401);
	});

	it("without a token, needs an admin session and a same-origin request", async () => {
		const guarded = fakeCms({
			store: storeOf(),
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "no session");
			},
		});
		expect((await retryAll(post("events/retry", { body: {} }), { cms: guarded })).status).toBe(401);
		const crossOrigin = await retryAll(post("events/retry", { headers: { origin: "http://evil.example" }, body: {} }), {
			cms: fakeCms({ store: storeOf() }),
		});
		expect(crossOrigin.status).toBe(403);
	});
});

describe("POST /v1/events/<id>/retry and /dismiss", () => {
	const params = Promise.resolve({ id: failed.change.eventId });
	const body = { subscriber: "plugin:git-sync" };

	it("retries one delivery and answers with the counts", async () => {
		const store = storeOf();
		const response = await retryOne(post(`events/${failed.change.eventId}/retry`, { body }), {
			cms: fakeCms({ store }),
			params,
		});
		expect(response.status).toBe(200);
		expect(store.retryDelivery).toHaveBeenCalledWith(
			expect.objectContaining({ eventId: failed.change.eventId, subscriber: "plugin:git-sync" }),
		);
	});

	it("dismisses one delivery", async () => {
		const store = storeOf();
		const response = await dismiss(post(`events/${failed.change.eventId}/dismiss`, { body }), {
			cms: fakeCms({ store }),
			params,
		});
		expect(response.status).toBe(200);
		expect(store.dismissDelivery).toHaveBeenCalledWith({
			eventId: failed.change.eventId,
			subscriber: "plugin:git-sync",
		});
	});

	it("is 404 when the delivery is not failed or dead any more, and 400 without a subscriber", async () => {
		const store = storeOf({ retryDelivery: vi.fn(async () => false), dismissDelivery: vi.fn(async () => false) });
		const cms = fakeCms({ store });
		expect((await retryOne(post("events/x/retry", { body }), { cms, params })).status).toBe(404);
		expect((await dismiss(post("events/x/dismiss", { body }), { cms, params })).status).toBe(404);
		expect((await retryOne(post("events/x/retry", { body: {} }), { cms, params })).status).toBe(400);
	});
});
