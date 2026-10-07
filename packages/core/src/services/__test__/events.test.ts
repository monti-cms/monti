import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import {
	type AfterCommit,
	type ContentEvent,
	type ContentStore,
	DeferDelivery,
	type Entry,
	withEventDispatch,
} from "../../core/store";
import { seedEntry, seedSave } from "../../core/store/__test__/seed";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
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
 * entries, because the database is shared by the tests of this file.
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
		vi.spyOn(console, "error").mockImplementation(() => undefined);
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

	it("delivers right after the write, in the same call, with the event id, version, content hash and a way to read the entry", async () => {
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

	it("reads null for an entry that was deleted", async () => {
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

	it("never undoes the write when a subscriber fails, and records the failure", async () => {
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
	])("a subscriber that %s is rescheduled, not failed: no attempt used, not listed, no dead letter", async (_name, defer) => {
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

	it("keeps the order of an entry while one of its events is deferred", async () => {
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

	it("retries a failed delivery with the same event id once its backoff passed, and not before", async () => {
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

	it("skips the backoff with `all`", async () => {
		const seen = recorder((event) => event.attempt < 2);
		const { store, events } = setup({ a: seen.handler }, { backoffMs: () => 3600_000 });
		const entry = await create(store, "delivery-all");
		expect(await events.retry()).toMatchObject({ delivered: 0 });
		await events.retry({ all: true });
		expect(seen.of(entry.id).map((item) => item.attempt)).toEqual([1, 2]);
	});

	it("dead-letters after the allowed tries and then stops, until someone retries it by hand", async () => {
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

	it("delivers an entry's events in commit order: a failing earlier event holds the later ones", async () => {
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

	it("does not let one entry's failure hold another entry's events", async () => {
		const seen = recorder((event) => event.workingSlug === "delivery-bad");
		const { store } = setup({ a: seen.handler });
		const first = await create(store, "delivery-bad");
		const second = await create(store, "delivery-good");
		await save(store, second, "again");
		expect(seen.of(first.id).map((item) => item.kind)).toEqual(["created"]);
		expect(seen.of(second.id).map((item) => item.kind)).toEqual(["created", "saved"]);
	});

	it("is at least once: a subscriber that did its work and then failed gets the same event id again, and can skip it", async () => {
		const done = new Set<string>();
		let effects = 0;
		let first = true;
		const { store, events } = setup({
			a: (event) => {
				if (event.kind !== "created" || event.workingSlug !== "delivery-idempotent") return;
				if (done.has(event.eventId)) return;
				effects += 1;
				done.add(event.eventId);
				if (first) {
					first = false;
					throw new Error("crashed after the work");
				}
			},
		});
		await create(store, "delivery-idempotent");
		advance(120_000);
		await events.retry();
		expect(effects).toBe(1);
	});

	it("keeps subscribers apart: one failing does not repeat or hold another", async () => {
		const good = recorder();
		const flaky = recorder((event) => event.attempt < 2);
		const { store, events } = setup({ good: good.handler, flaky: flaky.handler });
		const entry = await create(store, "delivery-two");
		advance(120_000);
		await events.retry();
		expect(good.of(entry.id).map((item) => item.attempt)).toEqual([1]);
		expect(flaky.of(entry.id).map((item) => item.attempt)).toEqual([1, 2]);
	});

	it("dismissing a failed delivery stops its retries and frees the later events of the entry", async () => {
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

	it("starts the retries that are due with the next write of the process", async () => {
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

	it("delivers events whose process stopped after the commit, on the next retry", async () => {
		// Real time again: the window for such events is counted back from the clock the dispatcher reads.
		offsetMs = 0;
		const seen = recorder();
		const { events } = setup({ a: seen.handler });
		// Written through the store without the dispatcher: committed, never delivered.
		const entry = await create(raw, "delivery-orphan");
		expect(seen.of(entry.id)).toEqual([]);
		await events.retry();
		expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created"]);
	});

	it("leaves no event for a write that fails", async () => {
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

		it("a bulk change delivers one event per item, in each entry's order", async () => {
			const seen = recorder();
			const { store } = setup({ a: seen.handler });
			const bulk = createBulkService<Entry>(store, { site: testSite, hooks: () => [], formats });
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

		it("restoring an entry from the trash delivers `restored`, after `trashed`", async () => {
			const seen = recorder();
			const { store } = setup({ a: seen.handler });
			const service = createContentService<Entry>(store, { site: testSite, hooks: () => [], formats });
			const entry = await create(store, "restore-a");
			const trashed = await store.trashEntry({ id: entry.id, expectedVersion: entry.version });
			const restored = await service.restore({ id: entry.id, expectedVersion: trashed.version });
			expect(restored.status).toBe("draft");
			expect(seen.of(entry.id).map((item) => item.kind)).toEqual(["created", "trashed", "restored"]);
			expect(seen.of(entry.id).at(-1)?.version).toBe(restored.version);
		});
	});

	describe("without subscribers", () => {
		it("writes events and delivers nothing, and a retry has nothing to do", async () => {
			const { store, events } = setup({});
			const entry = await create(store, "no-subscribers");
			expect(await events.retry()).toEqual({ delivered: 0, failed: 0, dead: 0, deferred: 0 });
			expect((await store.getEntry(entry.id)).id).toBe(entry.id);
		});
	});

	describe("the retry secret", () => {
		it("accepts only the configured secret", () => {
			const { events } = setup({}, { retrySecret: "s3cret" });
			expect(events.acceptsRetryToken("s3cret")).toBe(true);
			expect(events.acceptsRetryToken("s3cret ")).toBe(false);
			expect(events.acceptsRetryToken("")).toBe(false);
			expect(events.acceptsRetryToken(null)).toBe(false);
			expect(setup({}).events.acceptsRetryToken("s3cret")).toBe(false);
		});
	});
});
