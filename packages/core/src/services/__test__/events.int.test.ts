import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../test/any-site";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testSite } from "../../../test/site";
import { withActor } from "../../core/actor";
import {
	type AfterCommit,
	CONTENT_CHANGE_KINDS,
	type ContentEvent,
	type ContentStore,
	DeferDelivery,
	type Entry,
	withEventDispatch,
} from "../../core/store";
import { seedEntry, seedSave } from "../../core/store/__test__/seed";
import { createFormatRegistry } from "../../format/registry";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../testing";
import { createBulkService } from "../bulk-service";
import { createContentService } from "../content-service";
import { createEventDispatcher, type EventDeliveryOptions, type EventSubscriber } from "../events";

/**
 * Delivery of `afterCommit` events, against real PostgreSQL and the production store: the outbox the store writes with each change, the dispatcher that delivers it
 * after the commit, and what a failing subscriber does. Each test has its own subscribers (the delivery state is per subscriber name) and looks only at its own
 * entries. The entries share one database, but every test starts with an empty event log and the test clock at the real time: an event another test left
 * undelivered would otherwise reach this test's subscribers through the retries a write carries along.
 */
describe("afterCommit delivery", () => {
	let pool: Pool;
	let schemaName: string;
	let raw: ContentStore;
	let counter = 0;
	/** Seconds the test clock is ahead of the real one. */
	let offsetMs = 0;
	const clock = () => new Date(Date.now() + offsetMs);
	const advance = (ms: number) => {
		offsetMs += ms;
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		raw = createContentStore(pool, { site: testSite, schema: schemaName });
		fillRequiredMetadata(raw);
		// The first content entry also creates the entries its required relations point at, through the store alone. Made here, their events are
		// cleared before each test; made in the first test, they would reach its subscribers as undelivered events.
		await seedEntry(raw, {
			collection: contentCollection,
			slug: "relation-targets",
			metadata: { title: "relation-targets" },
			text: "본문",
		});
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	beforeEach(async () => {
		offsetMs = 0;
		await pool.query(`DELETE FROM "${schemaName}".cms_events`);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	type Handler = (event: ContentEvent) => ReturnType<AfterCommit>;

	/** A dispatcher over the shared store with named subscribers. Backoff is a minute on the test clock, so a test moves the clock to make a retry due. */
	const setup = (handlers: Record<string, Handler>, options: EventDeliveryOptions = {}) => {
		const prefix = `s${++counter}`;
		const subscribers: EventSubscriber[] = Object.entries(handlers).map(([name, handler]) => ({
			name: `${prefix}-${name}`,
			kinds: CONTENT_CHANGE_KINDS,
			handler,
		}));
		const dispatcher = createEventDispatcher({
			store: () => raw,
			subscribers: async () => subscribers,
			now: clock,
			backoffMs: () => 60_000,
			...options,
		});
		const store = withEventDispatch(raw, dispatcher.dispatchEntry);
		return { dispatcher, store, events: dispatcher.events, name: (name: string) => `${prefix}-${name}` };
	};

	/** Records what a subscriber receives for the entries a test cares about. */
	const recorder = (fail: (event: ContentEvent) => boolean = () => false) => {
		const received: { kind: string; entryId: string; eventId: string; attempt: number; version: number }[] = [];
		const handler: Handler = (event) => {
			received.push({
				kind: event.kind,
				entryId: event.entryId,
				eventId: event.eventId,
				attempt: event.attempt,
				version: event.version,
			});
			if (fail(event)) throw new Error(`down on try ${event.attempt}`);
		};
		return { handler, received, of: (entryId: string) => received.filter((item) => item.entryId === entryId) };
	};

	const create = (store: ContentStore, slug: string) =>
		seedEntry(store, { collection: contentCollection, slug, metadata: { title: slug }, text: "본문" });
	const save = (store: ContentStore, entry: Entry, title: string) =>
		seedSave(store, entry.id, { expectedVersion: entry.version, metadata: { title }, text: `${title} 본문` });

	it("EVENT-D1 delivers right after the write, in the same call, with the event id, version, content hash and a way to read the entry", async () => {
		const seen = recorder();
		let read: Entry | null | undefined;
		let event: ContentEvent | undefined;
		const { store } = setup({
			a: async (incoming) => {
				seen.handler(incoming);
				if (incoming.kind === "created" && incoming.workingSlug === "delivery-now") {
					event = incoming;
					read = await incoming.read();
				}
			},
		});
		const entry = await create(store, "delivery-now");

		// Delivered before `create` returned: no waiting for a worker.
		expect(seen.of(entry.id)).toEqual([
			expect.objectContaining({ kind: "created", attempt: 1, version: entry.version, eventId: expect.any(String) }),
		]);
		expect(event).toMatchObject({
			collection: contentCollection,
			contentHash: entry.working.contentHash,
			version: entry.version,
			workingSlug: "delivery-now",
		});
		expect(read?.id).toBe(entry.id);
		expect(read?.version).toBe(entry.version);
		expect(read?.working.doc).toEqual(entry.working.doc);

		// Read later, it shows the entry as it is then, and the event's version says it is stale.
		const saved = await save(store, entry, "changed");
		const later = await event?.read();
		expect(later?.version).toBe(saved.version);
		expect(later?.version).toBeGreaterThan(event?.version ?? Number.POSITIVE_INFINITY);
	});

	it("EVENT-D1 reads null for an entry that was deleted", async () => {
		let deletedEvent: ContentEvent | undefined;
		const { store } = setup({
			a: (event) => {
				if (event.kind === "deleted") deletedEvent = event;
			},
		});
		const entry = await create(store, "delivery-deleted");
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		await store.permanentDeleteEntry({ id: entry.id, expectedVersion: trashed.version });
		expect(deletedEvent?.entryId).toBe(entry.id);
		expect(await deletedEvent?.read()).toBeNull();
	});

	it("EVENT-D1 never undoes the write when a subscriber fails, and records the failure", async () => {
		const seen = recorder(() => true);
		const { store, events, name } = setup({ a: seen.handler });
		const entry = await create(store, "delivery-failing");
		expect((await store.getEntry(entry.id)).id).toBe(entry.id);

		const { items } = await events.list();
		const failed = items.find((item) => item.change.entryId === entry.id);
		expect(failed).toMatchObject({
			subscriber: name("a"),
			state: "failed",
			attempts: 1,
			lastError: "down on try 1",
		});
		expect(failed?.nextAttemptAt).toBeInstanceOf(Date);
	});

	it.each([
		["returns a retryAt", (retryAt: Date) => ({ retryAt })],
		[
			"throws a DeferDelivery",
			(retryAt: Date) => {
				throw new DeferDelivery(retryAt);
			},
		],
	])("EVENT-D2 a subscriber that %s is rescheduled, not failed: no attempt used, not listed, no dead letter", async (_name, defer) => {
		const tries: number[] = [];
		const { store, events, name } = setup(
			{
				a: (event) => {
					tries.push(event.attempt);
					// Defers more often than the default allowed attempts (8), then delivers.
					if (tries.length <= 10) return defer(new Date(clock().getTime() + 60_000));
				},
			},
			{ maxAttempts: 2 },
		);
		const entry = await create(store, `delivery-defer-${++counter}`);
		expect(tries).toEqual([1]);

		// Rescheduled: nothing failed, nothing dead, the delivery is pending and due at the time it asked for.
		expect((await events.list()).items.filter((item) => item.change.entryId === entry.id)).toEqual([]);
		const pending = await events.list({ states: ["pending"] });
		expect(pending.items.find((item) => item.change.entryId === entry.id)).toMatchObject({
			subscriber: name("a"),
			state: "pending",
			attempts: 0,
			lastError: null,
		});

		// Not due before the time it asked for.
		expect(await events.retry()).toMatchObject({ delivered: 0, deferred: 0 });
		expect(tries).toHaveLength(1);

		// Due again: deferred again, still not a failure, and the attempt number stays 1 however often it is deferred.
		for (let round = 0; round < 9; round += 1) {
			advance(61_000);
			expect(await events.retry()).toMatchObject({ failed: 0, dead: 0 });
		}
		expect(tries.slice(0, 10).every((attempt) => attempt === 1)).toBe(true);
		expect((await events.list({ states: ["dead"] })).items.filter((item) => item.change.entryId === entry.id)).toEqual(
			[],
		);

		advance(61_000);
		expect(await events.retry()).toMatchObject({ delivered: 1 });
		expect((await events.list()).items.filter((item) => item.change.entryId === entry.id)).toEqual([]);
	});

	it("EVENT-D3 keeps the order of an entry while one of its events is deferred", async () => {
		const seen = recorder();
		let defer = true;
		const { store, events } = setup({
			a: (event) => {
				if (event.kind === "created" && defer) return { retryAt: new Date(clock().getTime() + 60_000) };
				seen.handler(event);
			},
		});
		const entry = await create(store, "delivery-defer-order");
		await save(store, entry, "later");
		// The save waits for the deferred creation.
		expect(seen.of(entry.id)).toEqual([]);
		defer = false;
		advance(61_000);
		await events.retry();
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created", "saved"]);
	});

	it("EVENT-D2 retries a failed delivery with the same event id once its backoff passed, and not before", async () => {
		const seen = recorder((event) => event.attempt < 2);
		const { store, events } = setup({ a: seen.handler });
		const entry = await create(store, "delivery-retry");
		expect(seen.of(entry.id).map((item) => item.attempt)).toEqual([1]);

		// Not due yet.
		expect(await events.retry()).toMatchObject({ delivered: 0 });
		expect(seen.of(entry.id)).toHaveLength(1);

		advance(120_000);
		const result = await events.retry();
		expect(result.delivered).toBeGreaterThanOrEqual(1);
		const tries = seen.of(entry.id);
		expect(tries.map((item) => item.attempt)).toEqual([1, 2]);
		// The same event: a subscriber dedupes on this id.
		expect(tries[1]?.eventId).toBe(tries[0]?.eventId);
		expect((await events.list()).items.some((item) => item.change.entryId === entry.id)).toBe(false);
	});

	it("EVENT-D2 skips the backoff with `all`", async () => {
		const seen = recorder((event) => event.attempt < 2);
		const { store, events } = setup({ a: seen.handler }, { backoffMs: () => 3600_000 });
		const entry = await create(store, "delivery-all");
		expect(await events.retry()).toMatchObject({ delivered: 0 });
		await events.retry({ all: true });
		expect(seen.of(entry.id).map((item) => item.attempt)).toEqual([1, 2]);
	});

	it("EVENT-D2 dead-letters after the allowed tries and then stops, until someone retries it by hand", async () => {
		let healthy = false;
		const seen = recorder(() => !healthy);
		const { store, events, name } = setup({ a: seen.handler }, { maxAttempts: 3 });
		const entry = await create(store, "delivery-dead");
		for (let round = 0; round < 3; round += 1) {
			advance(120_000);
			await events.retry();
		}
		expect(seen.of(entry.id).map((item) => item.attempt)).toEqual([1, 2, 3]);

		const dead = (await events.list({ states: ["dead"] })).items.find((item) => item.change.entryId === entry.id);
		expect(dead).toMatchObject({ state: "dead", attempts: 3, lastError: "down on try 3", nextAttemptAt: null });
		expect((await events.counts()).dead).toBeGreaterThan(0);

		// Dead is final for the automatic retries, whatever the clock or `all`.
		advance(24 * 3600_000);
		await events.retry({ all: true });
		expect(seen.of(entry.id)).toHaveLength(3);

		healthy = true;
		expect(await events.retryDelivery({ eventId: dead?.change.eventId ?? "", subscriber: name("a") })).toBe(true);
		expect(seen.of(entry.id).map((item) => item.attempt)).toEqual([1, 2, 3, 1]);
		expect((await events.list({ states: ["dead"] })).items.some((item) => item.change.entryId === entry.id)).toBe(
			false,
		);
		expect(await events.retryDelivery({ eventId: dead?.change.eventId ?? "", subscriber: name("a") })).toBe(false);
	});

	it("EVENT-D3 delivers an entry's events in commit order: a failing earlier event holds the later ones", async () => {
		const seen = recorder((event) => event.kind === "created" && event.attempt === 1);
		const { store, events } = setup({ a: seen.handler });
		const entry = await create(store, "delivery-order");
		await save(store, entry, "second");
		await save(store, (await store.getEntry(entry.id)) as Entry, "third");
		// The create failed, so the saves were not delivered ahead of it.
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created"]);

		advance(120_000);
		await events.retry();
		expect(seen.of(entry.id).map((item) => [item.kind, item.attempt])).toEqual([
			["created", 1],
			["created", 2],
			["saved", 1],
			["saved", 1],
		]);
		const versions = seen.of(entry.id).map((item) => item.version);
		expect(versions.slice(1)).toEqual([...versions.slice(1)].sort((a, b) => a - b));
	});

	it("EVENT-D3 does not let one entry's failure hold another entry's events", async () => {
		const seen = recorder((event) => event.workingSlug === "delivery-bad");
		const { store } = setup({ a: seen.handler });
		const first = await create(store, "delivery-bad");
		const second = await create(store, "delivery-good");
		await save(store, second, "again");
		expect(seen.of(first.id).map((item) => item.kind)).toEqual(["created"]);
		expect(seen.of(second.id).map((item) => item.kind)).toEqual(["created", "saved"]);
	});

	describe("once", () => {
		const onlyFor =
			(slug: string, handler: Handler): Handler =>
			(event) =>
				event.kind === "created" && event.workingSlug === slug ? handler(event) : undefined;

		it("EVENT-D2 runs the work once however often the delivery is tried, also when the delivery fails after the work", async () => {
			let effects = 0;
			let first = true;
			const ran: boolean[] = [];
			const { store, events } = setup({
				a: onlyFor("once-after-work", async (event) => {
					ran.push(
						await event.once(() => {
							effects += 1;
						}),
					);
					if (first) {
						first = false;
						throw new Error("failed after the work");
					}
				}),
			});
			await create(store, "once-after-work");
			advance(120_000);
			await events.retry();
			expect(effects).toBe(1);
			expect(ran).toEqual([true, false]);
		});

		it("EVENT-D2 does not mark work that threw, so the retry does it again", async () => {
			let effects = 0;
			const { store, events } = setup({
				a: onlyFor("once-throws", (event) =>
					event
						.once(() => {
							effects += 1;
							if (effects === 1) throw new Error("not yet");
						})
						.then(() => undefined),
				),
			});
			await create(store, "once-throws");
			advance(120_000);
			await events.retry();
			expect(effects).toBe(2);
		});

		it("EVENT-D2 keeps a mark per subscriber and per event", async () => {
			const counts = { a: 0, b: 0 };
			const { store } = setup({
				a: onlyFor("once-apart", async (event) => {
					await event.once(() => {
						counts.a += 1;
					});
					await event.once(() => {
						counts.a += 1;
					});
				}),
				b: onlyFor("once-apart", async (event) => {
					await event.once(() => {
						counts.b += 1;
					});
				}),
			});
			await create(store, "once-apart");
			await create(store, "once-apart-2");
			expect(counts).toEqual({ a: 1, b: 1 });
		});
	});

	it("EVENT-D3 keeps subscribers apart: one failing does not repeat or hold another", async () => {
		const good = recorder();
		const flaky = recorder((event) => event.attempt < 2);
		const { store, events } = setup({ good: good.handler, flaky: flaky.handler });
		const entry = await create(store, "delivery-two");
		advance(120_000);
		await events.retry();
		expect(good.of(entry.id).map((item) => item.attempt)).toEqual([1]);
		expect(flaky.of(entry.id).map((item) => item.attempt)).toEqual([1, 2]);
	});

	it("EVENT-D3 dismissing a failed delivery stops its retries and frees the later events of the entry", async () => {
		const seen = recorder((event) => event.kind === "created");
		const { store, events, name } = setup({ a: seen.handler });
		const entry = await create(store, "delivery-dismiss");
		await save(store, entry, "later");
		const failed = (await events.list()).items.find((item) => item.change.entryId === entry.id);
		expect(await events.dismiss({ eventId: failed?.change.eventId ?? "", subscriber: name("a") })).toBe(true);
		expect(await events.dismiss({ eventId: failed?.change.eventId ?? "", subscriber: name("a") })).toBe(false);
		advance(120_000);
		await events.retry();
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created", "saved"]);
		expect((await events.list()).items.some((item) => item.change.entryId === entry.id)).toBe(false);
	});

	it("EVENT-D2 starts the retries that are due with the next write of the process", async () => {
		const seen = recorder((event) => event.attempt < 2);
		const { store } = setup({ a: seen.handler });
		const first = await create(store, "delivery-opportunistic-a");
		expect(seen.of(first.id).map((item) => item.attempt)).toEqual([1]);

		// Past the backoff and the pause between two sweeps: a write on another entry carries the retry along.
		advance(600_000);
		const other = await create(store, "delivery-opportunistic-b");
		expect(seen.of(first.id).map((item) => item.attempt)).toEqual([1, 2]);
		// The new entry's own first try failed too, and its retry is not due yet.
		expect(seen.of(other.id).map((item) => item.attempt)).toEqual([1]);
	});

	it("EVENT-D1 delivers events whose process stopped after the commit, on the next retry", async () => {
		// The test clock is at the real time (every test starts there): the window for such events is counted back from the clock the dispatcher reads.
		const seen = recorder();
		const { events } = setup({ a: seen.handler });
		// Written through the store without the dispatcher: committed, never delivered.
		const entry = await create(raw, "delivery-orphan");
		expect(seen.of(entry.id)).toEqual([]);
		await events.retry();
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created"]);
	});

	it("EVENT-D1 leaves no event for a write that fails", async () => {
		const seen = recorder();
		const { store, events } = setup({ a: seen.handler });
		const entry = await create(store, "delivery-rolled-back");
		await expect(store.trashEntry({ id: entry.id, expectedVersion: entry.version + 3 })).rejects.toMatchObject({
			code: "conflict",
		});
		await events.retry({ all: true });
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created"]);
	});

	describe("bulk and restore", () => {
		const formats = async () => createFormatRegistry([paragraphsFormat]);

		it("EVENT-D1 a bulk change delivers one event per item, in each entry's order", async () => {
			const seen = recorder();
			const { store } = setup({ a: seen.handler });
			const bulk = createBulkService(store, { site: testSite, hooks: () => [], formats });
			const drafts = [await create(store, "bulk-a"), await create(store, "bulk-b"), await create(store, "bulk-c")];
			const items = drafts.map((draft) => ({ id: draft.id, expectedVersion: draft.version }));

			const published = await bulk.run({ op: "publish", items });
			expect(published.results.every((result) => result.ok)).toBe(true);
			const archived = await bulk.run({
				op: "archive",
				items: published.results.flatMap((result) =>
					result.ok ? [{ id: result.id, expectedVersion: result.version }] : [],
				),
			});
			expect(archived.results.every((result) => result.ok)).toBe(true);

			for (const draft of drafts) {
				expect(seen.of(draft.id).map((item) => item.kind)).toEqual(["created", "published", "archived"]);
			}
		});
	});

	describe("the event log without subscribers", () => {
		const DAY = 24 * 60 * 60 * 1000;
		const formats = async () => createFormatRegistry([paragraphsFormat]);
		const ALL = ["pending", "delivering", "delivered", "failed", "dead", "dismissed", "recorded"] as const;
		const logOf = async (events: ReturnType<typeof setup>["events"], entryId: string) =>
			(await events.list({ states: ALL, limit: 200 })).items.filter((item) => item.change.entryId === entryId);

		it("EVENT-D4 records every kind of change once, with entry, collection, locale, time and actor, and lists it as recorded", async () => {
			const { store, events } = setup({});
			const service = createContentService(store, { site: testSite, hooks: () => [], formats });
			const entry = await withActor("Mina", () => create(store, "log-no-subscribers"));
			const saved = await withActor("Mina", () => save(store, entry, "second"));
			const trashed = await store.trashEntry({ id: entry.id, expectedVersion: saved.version });
			await service.restore({ id: entry.id, expectedVersion: trashed.version });

			expect(await events.retry()).toEqual({ delivered: 0, failed: 0, dead: 0, deferred: 0 });
			const log = await logOf(events, entry.id);
			// Newest first, one row per event, none of them a delivery.
			expect(log.map((item) => item.change.kind)).toEqual(["restored", "trashed", "saved", "created"]);
			for (const item of log) {
				expect(item).toMatchObject({ subscriber: null, state: "recorded", attempts: 0 });
				expect(item.change).toMatchObject({ entryId: entry.id, collection: entry.collection });
				expect(item.change.locale).toBe(entry.locale);
				expect(item.change.occurredAt).toBeInstanceOf(Date);
			}
			expect(log.find((item) => item.change.kind === "saved")?.change.actor).toBe("Mina");
			expect(log.find((item) => item.change.kind === "created")?.change.actor).toBe("Mina");
			// A write outside a request has no actor.
			expect(log.find((item) => item.change.kind === "trashed")?.change.actor).toBeNull();
			// Not part of the default list (the failed and dead deliveries).
			expect((await events.list()).items.filter((item) => item.change.entryId === entry.id)).toEqual([]);
		});

		it("EVENT-D4 makes deliveries only for subscribers, and an event is recorded once either way", async () => {
			const seen = recorder();
			const { store, events, name } = setup({ a: seen.handler });
			const entry = await create(store, "log-with-subscriber");
			const log = await logOf(events, entry.id);
			expect(log).toHaveLength(1);
			expect(log[0]).toMatchObject({ subscriber: name("a"), state: "delivered" });
		});

		it("EVENT-D4 removes old finished and recorded events but keeps the ones a retry can still deliver", async () => {
			const subscribe = (handler: Handler) => [{ name: `keep${++counter}`, kinds: CONTENT_CHANGE_KINDS, handler }];
			let subscribers: EventSubscriber[] = [];
			const make = (now: () => Date) =>
				createEventDispatcher({ store: () => raw, subscribers: async () => subscribers, now, backoffMs: () => 60_000 });

			const recordedEntry = await create(setup({}).store, "log-old-recorded");
			subscribers = subscribe(() => undefined);
			const doneDispatcher = make(() => new Date());
			const doneEntry = await create(withEventDispatch(raw, doneDispatcher.dispatchEntry), "log-old-delivered");
			subscribers = subscribe(() => {
				throw new Error("down");
			});
			const failingDispatcher = make(() => new Date());
			const failedEntry = await create(withEventDispatch(raw, failingDispatcher.dispatchEntry), "log-old-failed");
			const readLog = (id: string) => logOf(failingDispatcher.events, id);

			// Not old enough yet: a sweep 89 days on removes nothing.
			await make(() => new Date(Date.now() + 89 * DAY)).dispatchEntry(failedEntry.id);
			expect((await readLog(recordedEntry.id)).length).toBe(1);
			expect((await readLog(doneEntry.id)).length).toBe(1);

			subscribers = [];
			await make(() => new Date(Date.now() + 91 * DAY)).dispatchEntry(failedEntry.id);
			expect(await readLog(recordedEntry.id)).toEqual([]);
			expect(await readLog(doneEntry.id)).toEqual([]);
			expect((await readLog(failedEntry.id)).map((item) => item.state)).toEqual(["failed"]);
		});
	});
});
