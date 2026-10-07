import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import type { ClaimedDelivery, ContentChange, ContentStore } from "../..";
import { publishDraft, restoreDraft, seedEntry, seedSave } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

/**
 * Contract of the event outbox: every committed change leaves an event written in the transaction of the change (a rolled-back change leaves none), and the
 * delivery rows of a subscriber are claimed in the commit order per entry, retried with a delay, dead-lettered after the allowed tries, and can be retried or
 * dismissed by hand. Every test uses its own subscriber name and looks only at its own entries, so the tests do not see one another's events.
 */
export const eventsContract: ContractSuite = (factory) => {
	describe("event outbox", () => {
		let session: StoreSession;
		let store: ContentStore;
		const base = new Date("2030-01-01T00:00:00Z");
		const later = (ms: number) => new Date(base.getTime() + ms);

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			fillRequiredMetadata(store);
		});

		afterAll(async () => {
			await session.close();
		});

		const create = (slug: string) =>
			seedEntry(store, { collection: contentCollection, slug, metadata: { title: slug }, text: "본문" });
		const subscriberName = () => `test-${randomUUID()}`;
		const enqueue = (subscriber: string, entryId: string) =>
			store.enqueueEvents({ subscribers: [subscriber], entryId, now: base });
		const claim = (subscriber: string, entryId: string, at = base, limit = 10): Promise<ClaimedDelivery[]> =>
			store.claimDeliveries({ subscribers: [subscriber], entryIds: [entryId], now: at, leaseMs: 60_000, limit });

		/** Delivers everything of the entry for the subscriber, one claim at a time (the order of the entry is held between claims). */
		const deliverAll = async (subscriber: string, entryId: string): Promise<ContentChange[]> => {
			const delivered: ContentChange[] = [];
			for (;;) {
				const claims = await claim(subscriber, entryId);
				if (claims.length === 0) return delivered;
				for (const claimed of claims) {
					await store.completeDelivery({ eventId: claimed.change.eventId, subscriber, now: base });
					delivered.push(claimed.change);
				}
			}
		};

		it("writes one event per committed change, in commit order, with the version and content hash", async () => {
			const entry = await create("event-flow");
			const published = await publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });
			const archived = await store.archiveEntry({ id: entry.id, expectedVersion: published.version });
			const trashed = await store.trashEntry({ id: entry.id, expectedVersion: archived.version });
			const restored = await restoreDraft(testSite, store, { id: entry.id, expectedVersion: trashed.version });
			const again = await store.trashEntry({ id: entry.id, expectedVersion: restored.version });
			await store.permanentDeleteEntry({ id: entry.id, expectedVersion: again.version });

			const subscriber = subscriberName();
			expect(await enqueue(subscriber, entry.id)).toBe(7);
			const changes = await deliverAll(subscriber, entry.id);
			expect(changes.map((change) => change.kind)).toEqual([
				"created",
				"published",
				"archived",
				"trashed",
				"restored",
				"trashed",
				"deleted",
			]);
			expect(changes.map((change) => change.version)).toEqual([
				entry.version,
				published.version,
				archived.version,
				trashed.version,
				restored.version,
				again.version,
				again.version,
			]);
			expect(changes[0]).toMatchObject({
				entryId: entry.id,
				collection: contentCollection,
				locale: entry.locale,
				translationGroupId: entry.id,
				status: "draft",
				workingSlug: "event-flow",
				publishedSlug: null,
				contentHash: entry.working.contentHash,
			});
			expect(changes[1]).toMatchObject({
				status: "published",
				publishedSlug: "event-flow",
				contentHash: published.published?.contentHash,
			});
			expect(new Set(changes.map((change) => change.eventId)).size).toBe(changes.length);
			expect(changes[0]?.occurredAt).toBeInstanceOf(Date);
			// The event of a deletion outlives the entry.
			await expect(store.getEntry(entry.id)).rejects.toMatchObject({ code: "not_found" });
			expect(changes.at(-1)).toMatchObject({ kind: "deleted", status: "trashed" });
		});

		it("writes an event for a save, with the content hash of the saved draft", async () => {
			const entry = await create("event-saves");
			const saved = await seedSave(store, entry.id, {
				expectedVersion: entry.version,
				metadata: { title: "event-saves-2" },
				text: "다른 본문",
			});
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const changes = await deliverAll(subscriber, entry.id);
			expect(changes.map((change) => [change.kind, change.version])).toEqual([
				["created", entry.version],
				["saved", saved.version],
			]);
			expect(changes[1]?.contentHash).toBe(saved.working.contentHash);
		});

		it("leaves no event for a change that rolled back", async () => {
			const entry = await create("event-rollback");
			await expect(
				publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version + 5 }),
			).rejects.toMatchObject({ code: "conflict" });
			await expect(store.trashEntry({ id: entry.id, expectedVersion: entry.version + 5 })).rejects.toMatchObject({
				code: "conflict",
			});
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			expect((await deliverAll(subscriber, entry.id)).map((change) => change.kind)).toEqual(["created"]);
		});

		it("makes one delivery row per subscriber, once", async () => {
			const entry = await create("event-enqueue");
			const [a, b] = [subscriberName(), subscriberName()];
			expect(await store.enqueueEvents({ subscribers: [a, b], entryId: entry.id, now: base })).toBe(2);
			expect(await store.enqueueEvents({ subscribers: [a, b], entryId: entry.id, now: base })).toBe(0);
			expect((await claim(a, entry.id)).map((claimed) => claimed.change.kind)).toEqual(["created"]);
			expect((await claim(b, entry.id)).map((claimed) => claimed.change.kind)).toEqual(["created"]);
			expect(await store.enqueueEvents({ subscribers: [], entryId: entry.id, now: base })).toBe(0);
		});

		it("holds an entry's later events while an earlier one is in flight or failing, and lets other entries through", async () => {
			const first = await create("event-order-a");
			const other = await create("event-order-b");
			await seedSave(store, first.id, { expectedVersion: first.version, metadata: { title: "x" }, text: "둘" });
			const subscriber = subscriberName();
			await store.enqueueEvents({ subscribers: [subscriber], entryId: first.id, now: base });
			await store.enqueueEvents({ subscribers: [subscriber], entryId: other.id, now: base });

			const claimed = await claim(subscriber, first.id);
			expect(claimed.map((item) => item.change.kind)).toEqual(["created"]);
			// In flight: the save waits.
			expect(await claim(subscriber, first.id)).toEqual([]);
			expect((await claim(subscriber, other.id)).map((item) => item.change.kind)).toEqual(["created"]);

			await store.failDelivery({
				eventId: (claimed[0] as ClaimedDelivery).change.eventId,
				subscriber,
				error: "down",
				now: base,
				retryAt: later(30_000),
				maxAttempts: 5,
			});
			// Failed and waiting for its retry: the save still waits, and nothing is claimable before the retry is due.
			expect(await claim(subscriber, first.id, later(10_000))).toEqual([]);
			const retried = await claim(subscriber, first.id, later(31_000));
			expect(retried.map((item) => [item.change.kind, item.attempts])).toEqual([["created", 2]]);
			await store.completeDelivery({
				eventId: (retried[0] as ClaimedDelivery).change.eventId,
				subscriber,
				now: later(31_000),
			});
			expect((await claim(subscriber, first.id, later(31_000))).map((item) => item.change.kind)).toEqual(["saved"]);
		});

		it("defers a delivery: pending at the asked time, no attempt used, not failed, never dead, and it still holds the order", async () => {
			const entry = await create("event-defer");
			await seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title: "y" }, text: "둘" });
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const [first] = await claim(subscriber, entry.id);
			const eventId = (first as ClaimedDelivery).change.eventId;
			expect(first?.attempts).toBe(1);

			// Deferring twice in a row (with maxAttempts 1 a failure would have dead-lettered at once) leaves the attempts where they were.
			for (const round of [1, 2]) {
				expect(await store.deferDelivery({ eventId, subscriber, retryAt: later(round * 60_000) })).toBe(true);
				const pending = await store.listEventDeliveries({ states: ["pending"], limit: 200 });
				expect(
					pending.items.find((item) => item.change.eventId === eventId && item.subscriber === subscriber),
				).toMatchObject({
					state: "pending",
					attempts: 0,
					lastError: null,
					nextAttemptAt: later(round * 60_000),
				});
				// Not listed as failed or dead, and not due before the time it asked for.
				const failing = await store.listEventDeliveries({ states: ["failed", "dead"], limit: 200 });
				expect(failing.items.find((item) => item.subscriber === subscriber)).toBeUndefined();
				expect(await claim(subscriber, entry.id, later(round * 60_000 - 1))).toEqual([]);
				const [again] = await claim(subscriber, entry.id, later(round * 60_000));
				expect(again?.attempts).toBe(1);
				expect(again?.change.eventId).toBe(eventId);
			}
			// While deferred, the later event of the entry waits; once delivered it goes on.
			await store.deferDelivery({ eventId, subscriber, retryAt: later(10 * 60_000) });
			expect(await claim(subscriber, entry.id, later(5 * 60_000))).toEqual([]);
			const [due] = await claim(subscriber, entry.id, later(10 * 60_000));
			await store.completeDelivery({
				eventId: (due as ClaimedDelivery).change.eventId,
				subscriber,
				now: later(10 * 60_000),
			});
			expect((await claim(subscriber, entry.id, later(10 * 60_000))).map((item) => item.change.kind)).toEqual([
				"saved",
			]);
		});

		it("does not defer a delivery that is not in flight", async () => {
			const entry = await create("event-defer-idle");
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const [claimed] = await claim(subscriber, entry.id);
			const eventId = (claimed as ClaimedDelivery).change.eventId;
			await store.completeDelivery({ eventId, subscriber, now: base });
			expect(await store.deferDelivery({ eventId, subscriber, retryAt: later(1000) })).toBe(false);
		});

		it("dead-letters a delivery after the allowed tries, and a dead delivery no longer holds the order", async () => {
			const entry = await create("event-dead");
			await seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title: "y" }, text: "둘" });
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const [first] = await claim(subscriber, entry.id);
			const eventId = (first as ClaimedDelivery).change.eventId;
			expect(first?.attempts).toBe(1);
			expect(
				await store.failDelivery({
					eventId,
					subscriber,
					error: "first",
					now: base,
					retryAt: later(1000),
					maxAttempts: 2,
				}),
			).toBe("failed");
			const [second] = await claim(subscriber, entry.id, later(2000));
			expect(second?.attempts).toBe(2);
			expect(
				await store.failDelivery({
					eventId,
					subscriber,
					error: "second",
					now: later(2000),
					retryAt: later(3000),
					maxAttempts: 2,
				}),
			).toBe("dead");

			const listed = await store.listEventDeliveries({ states: ["dead"], limit: 200 });
			const dead = listed.items.find((item) => item.change.eventId === eventId && item.subscriber === subscriber);
			expect(dead).toMatchObject({ state: "dead", attempts: 2, lastError: "second", nextAttemptAt: null });
			expect(dead?.change.entryId).toBe(entry.id);
			// Dead and never due again, but the later event of the entry is delivered.
			expect((await claim(subscriber, entry.id, later(10 * 3600_000))).map((item) => item.change.kind)).toEqual([
				"saved",
			]);
		});

		it("retries a dead delivery by hand from zero attempts, and dismisses one for good", async () => {
			const entry = await create("event-manual");
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const [claimed] = await claim(subscriber, entry.id);
			const eventId = (claimed as ClaimedDelivery).change.eventId;
			await store.failDelivery({ eventId, subscriber, error: "x", now: base, retryAt: later(1), maxAttempts: 1 });
			expect((await store.countEventDeliveries()).dead).toBeGreaterThan(0);

			expect(await store.retryDelivery({ eventId, subscriber, now: later(5) })).toBe(true);
			// Not failed or dead any more: nothing to retry or dismiss.
			expect(await store.retryDelivery({ eventId, subscriber, now: later(5) })).toBe(false);
			expect(await store.dismissDelivery({ eventId, subscriber })).toBe(false);
			const [again] = await claim(subscriber, entry.id, later(5));
			expect(again?.attempts).toBe(1);

			await store.failDelivery({ eventId, subscriber, error: "y", now: later(6), retryAt: later(7), maxAttempts: 1 });
			expect(await store.dismissDelivery({ eventId, subscriber })).toBe(true);
			expect(await claim(subscriber, entry.id, later(10 * 3600_000))).toEqual([]);
			const listed = await store.listEventDeliveries({ states: ["failed", "dead"], limit: 200 });
			expect(listed.items.some((item) => item.change.eventId === eventId && item.subscriber === subscriber)).toBe(
				false,
			);
		});

		it("claims a delivery again when its claim ran out (a try that never finished)", async () => {
			const entry = await create("event-lease");
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const [first] = await claim(subscriber, entry.id);
			expect(first?.attempts).toBe(1);
			expect(await claim(subscriber, entry.id, later(30_000))).toEqual([]);
			const [second] = await claim(subscriber, entry.id, later(61_000));
			expect(second?.change.eventId).toBe(first?.change.eventId);
			expect(second?.attempts).toBe(2);
		});

		it("does not hand the same delivery to claims running at once", async () => {
			const entry = await create("event-concurrent");
			const subscriber = subscriberName();
			await enqueue(subscriber, entry.id);
			const results = await Promise.all([
				claim(subscriber, entry.id),
				claim(subscriber, entry.id),
				claim(subscriber, entry.id),
			]);
			expect(results.flat()).toHaveLength(1);
		});

		it("removes events that are finished, and keeps those still waiting", async () => {
			const done = await create("event-prune-done");
			const waiting = await create("event-prune-waiting");
			const subscriber = subscriberName();
			await enqueue(subscriber, done.id);
			await enqueue(subscriber, waiting.id);
			await deliverAll(subscriber, done.id);
			const removed = await store.pruneEvents({ before: later(365 * 24 * 3600_000) });
			expect(removed).toBeGreaterThan(0);
			expect((await claim(subscriber, waiting.id)).map((item) => item.change.kind)).toEqual(["created"]);
			expect(await claim(subscriber, done.id)).toEqual([]);
		});
	});
};
