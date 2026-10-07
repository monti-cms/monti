import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { PoolClient } from "pg";
import {
	type ContentChange,
	type ContentChangeKind,
	type EventDelivery,
	type EventDeliveryCounts,
	type EventDeliveryState,
	eventRowOf,
} from "../../../core/store/events";
import type { EventStore } from "../../../core/store/ports";
import type { Entry } from "../../../core/store/types";
import type { EventPayload } from "../db/database";
import { dbOn } from "../db/kysely";
import type { StoreContext } from "./context";

const MAX_ERROR_LENGTH = 2000;

/**
 * Writes the events of a change in the transaction that makes it, so a change that rolls back leaves no event and a change that commits always has one.
 * `entry` is the entry as the change leaves it (for a deletion, as it was).
 */
export async function recordEvents(
	client: PoolClient,
	qSchema: string,
	entry: Entry,
	kinds: readonly ContentChangeKind[],
): Promise<void> {
	const db = dbOn(client, qSchema);
	for (const kind of kinds) {
		const row = eventRowOf(kind, entry);
		await db
			.insertInto("cms_events")
			.values({
				id: randomUUID(),
				kind: row.kind,
				entry_id: row.entryId,
				collection: row.collection,
				locale: row.locale,
				content_hash: row.contentHash,
				version: row.version,
				payload: JSON.stringify(row.payload),
			})
			.execute();
	}
}

/** The columns of an event, read through the alias `e` of `cms_events`. */
const EVENT_COLUMNS = [
	"e.id",
	"e.kind",
	"e.entry_id",
	"e.collection",
	"e.locale",
	"e.content_hash",
	"e.version",
	"e.occurred_at",
	"e.payload",
] as const;

/** An event row as `EVENT_COLUMNS` selects it. */
interface EventColumns {
	id: string;
	kind: ContentChangeKind;
	entry_id: string;
	collection: string;
	locale: string;
	content_hash: string | null;
	version: number;
	occurred_at: Date;
	payload: EventPayload;
}

const changeOf = (row: EventColumns): ContentChange => ({
	eventId: row.id,
	kind: row.kind,
	entryId: row.entry_id,
	collection: row.collection,
	locale: row.locale,
	translationGroupId: row.payload.translationGroupId,
	status: row.payload.status,
	publishedSlug: row.payload.publishedSlug,
	workingSlug: row.payload.workingSlug,
	version: row.version,
	contentHash: row.content_hash,
	occurredAt: row.occurred_at,
});

/** The outbox reads and writes of the delivery side (`EventStore`). The events themselves are written by `recordEvents` inside each change's transaction. */
export function createEventOps(ctx: StoreContext): EventStore {
	const { qSchema } = ctx;
	const db = ctx.db();

	return {
		enqueueEvents: async ({ subscribers, entryId, since, now }) => {
			if (subscribers.length === 0) return 0;
			// `sql`: the builder cannot name the columns of `unnest(...) AS s(name)`, and the insert reads from the table it skips rows of.
			const res = await sql`
				INSERT INTO ${sql.id(qSchema, "cms_event_deliveries")} (event_id, subscriber, state, next_attempt_at)
				SELECT e.id, s.name, 'pending', ${now}
				FROM ${sql.id(qSchema, "cms_events")} e CROSS JOIN unnest(${[...subscribers]}::text[]) AS s(name)
				WHERE NOT EXISTS (SELECT 1 FROM ${sql.id(qSchema, "cms_event_deliveries")} d WHERE d.event_id = e.id)
				  AND (${entryId ?? null}::uuid IS NULL OR e.entry_id = ${entryId ?? null}::uuid)
				  AND (${since ?? null}::timestamptz IS NULL OR e.occurred_at >= ${since ?? null}::timestamptz)
				ON CONFLICT DO NOTHING`.execute(db);
			return Number(res.numAffectedRows ?? 0n);
		},

		claimDeliveries: async ({ subscribers, now, leaseMs, limit, entryIds, ignoreBackoff }) => {
			if (subscribers.length === 0 || limit <= 0) return [];
			const rows = await db
				.with("due", (qb) => {
					let due = qb
						.selectFrom("cms_event_deliveries as d")
						.innerJoin("cms_events as e", "e.id", "d.event_id")
						.select(["d.event_id", "d.subscriber"])
						.where(sql<boolean>`d.subscriber = any(${[...subscribers]}::text[])`)
						.where((eb) =>
							eb.or([
								eb.and([
									eb("d.state", "in", ["pending", "failed"]),
									ignoreBackoff ? sql<boolean>`true` : eb("d.next_attempt_at", "<=", now),
								]),
								eb.and([eb("d.state", "=", "delivering"), eb("d.locked_until", "<=", now)]),
							]),
						);
					if (entryIds) due = due.where(sql<boolean>`e.entry_id = any(${[...entryIds]}::uuid[])`);
					// The delivery order per entry: no earlier event of the same entry may still be waiting for the same subscriber.
					return due
						.where(({ not, exists, selectFrom }) =>
							not(
								exists(
									selectFrom("cms_event_deliveries as p")
										.innerJoin("cms_events as pe", "pe.id", "p.event_id")
										.select(sql.lit(1).as("one"))
										.whereRef("p.subscriber", "=", "d.subscriber")
										.whereRef("pe.entry_id", "=", "e.entry_id")
										.whereRef("pe.seq", "<", "e.seq")
										.where("p.state", "in", ["pending", "delivering", "failed"]),
								),
							),
						)
						.orderBy("e.seq")
						.limit(limit)
						.forUpdate("d")
						.skipLocked();
				})
				.with("claimed", (qb) =>
					qb
						.updateTable("cms_event_deliveries as d")
						.from("due")
						.set((eb) => ({
							state: "delivering",
							attempts: eb("d.attempts", "+", 1),
							last_attempt_at: now,
							locked_until: sql<Date>`${now}::timestamptz + (${leaseMs}::integer * interval '1 millisecond')`,
						}))
						.whereRef("d.event_id", "=", "due.event_id")
						.whereRef("d.subscriber", "=", "due.subscriber")
						.returning(["d.event_id", "d.subscriber", "d.attempts"]),
				)
				.selectFrom("claimed as c")
				.innerJoin("cms_events as e", "e.id", "c.event_id")
				.select([...EVENT_COLUMNS, "c.subscriber", "c.attempts"])
				.orderBy("e.seq")
				.execute();
			return rows.map((row) => ({ change: changeOf(row), subscriber: row.subscriber, attempts: row.attempts }));
		},

		completeDelivery: async ({ eventId, subscriber, now }) => {
			await db
				.updateTable("cms_event_deliveries")
				.set({ state: "delivered", delivered_at: now, locked_until: null, last_error: null, next_attempt_at: null })
				.where("event_id", "=", eventId)
				.where("subscriber", "=", subscriber)
				.where("state", "=", "delivering")
				.execute();
		},

		failDelivery: async ({ eventId, subscriber, error, retryAt, maxAttempts }) => {
			const row = await db
				.updateTable("cms_event_deliveries")
				.set({
					state: sql<"failed" | "dead">`case when attempts >= ${maxAttempts}::integer then 'dead' else 'failed' end`,
					last_error: error.slice(0, MAX_ERROR_LENGTH),
					locked_until: null,
					next_attempt_at: sql<Date | null>`case when attempts >= ${maxAttempts}::integer then null else ${retryAt}::timestamptz end`,
				})
				.where("event_id", "=", eventId)
				.where("subscriber", "=", subscriber)
				.where("state", "=", "delivering")
				.returning("state")
				.executeTakeFirst();
			return (row?.state as "failed" | "dead" | undefined) ?? "failed";
		},

		deferDelivery: async ({ eventId, subscriber, retryAt }) => {
			const res = await db
				.updateTable("cms_event_deliveries")
				.set({
					state: "pending",
					attempts: sql<number>`greatest(attempts - 1, 0)`,
					last_error: null,
					locked_until: null,
					next_attempt_at: retryAt,
				})
				.where("event_id", "=", eventId)
				.where("subscriber", "=", subscriber)
				.where("state", "=", "delivering")
				.executeTakeFirst();
			return res.numUpdatedRows > 0n;
		},

		listEventDeliveries: async (params) => {
			const states = [...(params?.states ?? ["failed", "dead"])];
			const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
			const offset = Math.max(params?.offset ?? 0, 0);
			// `= any(array)` and not `in (...)`: an empty list of states matches nothing instead of being a syntax error.
			const inStates = sql<boolean>`d.state = any(${states}::text[])`;
			const [rows, total] = await Promise.all([
				db
					.selectFrom("cms_event_deliveries as d")
					.innerJoin("cms_events as e", "e.id", "d.event_id")
					.select([
						...EVENT_COLUMNS,
						"d.subscriber",
						"d.state",
						"d.attempts",
						"d.last_error",
						"d.last_attempt_at",
						"d.next_attempt_at",
						"d.delivered_at",
					])
					.where(inStates)
					.orderBy("e.seq", "desc")
					.orderBy("d.subscriber")
					.limit(limit)
					.offset(offset)
					.execute(),
				db
					.selectFrom("cms_event_deliveries as d")
					.select((eb) => eb.fn.countAll<string>().as("total"))
					.where(inStates)
					.executeTakeFirst(),
			]);
			const items: EventDelivery[] = rows.map((row) => ({
				change: changeOf(row),
				subscriber: row.subscriber,
				state: row.state,
				attempts: row.attempts,
				lastError: row.last_error,
				lastAttemptAt: row.last_attempt_at,
				nextAttemptAt: row.next_attempt_at,
				deliveredAt: row.delivered_at,
			}));
			return { items, total: Number(total?.total ?? 0) };
		},

		countEventDeliveries: async () => {
			const rows = await db
				.selectFrom("cms_event_deliveries")
				.select(["state", (eb) => eb.fn.countAll<string>().as("total")])
				.groupBy("state")
				.execute();
			const counts: Record<EventDeliveryState, number> = {
				pending: 0,
				delivering: 0,
				delivered: 0,
				failed: 0,
				dead: 0,
				dismissed: 0,
			};
			for (const row of rows) counts[row.state] = Number(row.total);
			return counts satisfies EventDeliveryCounts;
		},

		retryDelivery: async ({ eventId, subscriber, now }) => {
			const res = await db
				.updateTable("cms_event_deliveries")
				.set({ state: "pending", attempts: 0, next_attempt_at: now, locked_until: null })
				.where("event_id", "=", eventId)
				.where("subscriber", "=", subscriber)
				.where("state", "in", ["failed", "dead"])
				.executeTakeFirst();
			return res.numUpdatedRows > 0n;
		},

		dismissDelivery: async ({ eventId, subscriber }) => {
			const res = await db
				.updateTable("cms_event_deliveries")
				.set({ state: "dismissed", next_attempt_at: null, locked_until: null })
				.where("event_id", "=", eventId)
				.where("subscriber", "=", subscriber)
				.where("state", "in", ["failed", "dead"])
				.executeTakeFirst();
			return res.numUpdatedRows > 0n;
		},

		pruneEvents: async ({ before }) => {
			const res = await db
				.deleteFrom("cms_events as e")
				.where("e.occurred_at", "<", before)
				.where(({ not, exists, selectFrom }) =>
					not(
						exists(
							selectFrom("cms_event_deliveries as d")
								.select(sql.lit(1).as("one"))
								.whereRef("d.event_id", "=", "e.id")
								.where("d.state", "not in", ["delivered", "dismissed"]),
						),
					),
				)
				.executeTakeFirst();
			return Number(res.numDeletedRows);
		},
	};
}
