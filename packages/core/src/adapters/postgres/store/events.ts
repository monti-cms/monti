import { randomUUID } from "node:crypto";
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
import type { Entry, EntryStatus } from "../../../core/store/types";
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
	for (const kind of kinds) {
		const row = eventRowOf(kind, entry);
		await client.query(
			`INSERT INTO "${qSchema}".cms_events (id, kind, entry_id, collection, locale, content_hash, version, payload)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				randomUUID(),
				row.kind,
				row.entryId,
				row.collection,
				row.locale,
				row.contentHash,
				row.version,
				JSON.stringify(row.payload),
			],
		);
	}
}

interface EventColumns {
	id: string;
	kind: ContentChangeKind;
	entry_id: string;
	collection: string;
	locale: string;
	content_hash: string | null;
	version: number;
	occurred_at: Date;
	payload: {
		translationGroupId: string;
		status: EntryStatus;
		publishedSlug: string | null;
		workingSlug: string | null;
	};
}

interface DeliveryColumns extends EventColumns {
	subscriber: string;
	state: EventDeliveryState;
	attempts: number;
	last_error: string | null;
	last_attempt_at: Date | null;
	next_attempt_at: Date | null;
	delivered_at: Date | null;
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

const EVENT_SELECT =
	"e.id, e.kind, e.entry_id, e.collection, e.locale, e.content_hash, e.version, e.occurred_at, e.payload";

/** The outbox reads and writes of the delivery side (`EventStore`). The events themselves are written by `recordEvents` inside each change's transaction. */
export function createEventOps(ctx: StoreContext): EventStore {
	const { pool, qSchema } = ctx;
	const events = `"${qSchema}".cms_events`;
	const deliveries = `"${qSchema}".cms_event_deliveries`;

	return {
		enqueueEvents: async ({ subscribers, entryId, since, now }) => {
			if (subscribers.length === 0) return 0;
			const res = await pool.query(
				`INSERT INTO ${deliveries} (event_id, subscriber, state, next_attempt_at)
				 SELECT e.id, s.name, 'pending', $1
				 FROM ${events} e CROSS JOIN unnest($2::text[]) AS s(name)
				 WHERE NOT EXISTS (SELECT 1 FROM ${deliveries} d WHERE d.event_id = e.id)
				   AND ($3::uuid IS NULL OR e.entry_id = $3)
				   AND ($4::timestamptz IS NULL OR e.occurred_at >= $4)
				 ON CONFLICT DO NOTHING`,
				[now, subscribers, entryId ?? null, since ?? null],
			);
			return res.rowCount ?? 0;
		},

		claimDeliveries: async ({ subscribers, now, leaseMs, limit, entryIds, ignoreBackoff }) => {
			if (subscribers.length === 0 || limit <= 0) return [];
			const res = await pool.query<DeliveryColumns>(
				`WITH due AS (
					SELECT d.event_id, d.subscriber
					FROM ${deliveries} d JOIN ${events} e ON e.id = d.event_id
					WHERE d.subscriber = ANY($1::text[])
					  AND (
					    (d.state IN ('pending', 'failed') AND ($6::boolean OR d.next_attempt_at <= $2))
					    OR (d.state = 'delivering' AND d.locked_until <= $2)
					  )
					  AND ($5::uuid[] IS NULL OR e.entry_id = ANY($5::uuid[]))
					  AND NOT EXISTS (
					    SELECT 1 FROM ${deliveries} p JOIN ${events} pe ON pe.id = p.event_id
					    WHERE p.subscriber = d.subscriber AND pe.entry_id = e.entry_id AND pe.seq < e.seq
					      AND p.state IN ('pending', 'delivering', 'failed')
					  )
					ORDER BY e.seq
					LIMIT $4
					FOR UPDATE OF d SKIP LOCKED
				), claimed AS (
					UPDATE ${deliveries} d
					SET state = 'delivering', attempts = d.attempts + 1, last_attempt_at = $2,
					    locked_until = $2::timestamptz + ($3::integer * interval '1 millisecond')
					FROM due WHERE d.event_id = due.event_id AND d.subscriber = due.subscriber
					RETURNING d.event_id, d.subscriber, d.attempts
				)
				SELECT ${EVENT_SELECT}, c.subscriber, c.attempts
				FROM claimed c JOIN ${events} e ON e.id = c.event_id
				ORDER BY e.seq`,
				[subscribers, now, leaseMs, limit, entryIds ? [...entryIds] : null, Boolean(ignoreBackoff)],
			);
			return res.rows.map((row) => ({ change: changeOf(row), subscriber: row.subscriber, attempts: row.attempts }));
		},

		completeDelivery: async ({ eventId, subscriber, now }) => {
			await pool.query(
				`UPDATE ${deliveries} SET state = 'delivered', delivered_at = $3, locked_until = NULL, last_error = NULL, next_attempt_at = NULL
				 WHERE event_id = $1 AND subscriber = $2 AND state = 'delivering'`,
				[eventId, subscriber, now],
			);
		},

		failDelivery: async ({ eventId, subscriber, error, retryAt, maxAttempts }) => {
			const res = await pool.query<{ state: "failed" | "dead" }>(
				`UPDATE ${deliveries}
				 SET state = CASE WHEN attempts >= $4::integer THEN 'dead' ELSE 'failed' END,
				     last_error = $3, locked_until = NULL,
				     next_attempt_at = CASE WHEN attempts >= $4::integer THEN NULL ELSE $5::timestamptz END
				 WHERE event_id = $1 AND subscriber = $2 AND state = 'delivering'
				 RETURNING state`,
				[eventId, subscriber, error.slice(0, MAX_ERROR_LENGTH), maxAttempts, retryAt],
			);
			return res.rows[0]?.state ?? "failed";
		},

		deferDelivery: async ({ eventId, subscriber, retryAt }) => {
			const res = await pool.query(
				`UPDATE ${deliveries}
				 SET state = 'pending', attempts = GREATEST(attempts - 1, 0), last_error = NULL, locked_until = NULL, next_attempt_at = $3
				 WHERE event_id = $1 AND subscriber = $2 AND state = 'delivering'`,
				[eventId, subscriber, retryAt],
			);
			return (res.rowCount ?? 0) > 0;
		},

		listEventDeliveries: async (params) => {
			const states = params?.states ?? ["failed", "dead"];
			const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
			const offset = Math.max(params?.offset ?? 0, 0);
			const [rows, total] = await Promise.all([
				pool.query<DeliveryColumns>(
					`SELECT ${EVENT_SELECT}, d.subscriber, d.state, d.attempts, d.last_error, d.last_attempt_at, d.next_attempt_at, d.delivered_at
					 FROM ${deliveries} d JOIN ${events} e ON e.id = d.event_id
					 WHERE d.state = ANY($1::text[])
					 ORDER BY e.seq DESC, d.subscriber
					 LIMIT $2 OFFSET $3`,
					[states, limit, offset],
				),
				pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM ${deliveries} WHERE state = ANY($1::text[])`, [
					states,
				]),
			]);
			const items: EventDelivery[] = rows.rows.map((row) => ({
				change: changeOf(row),
				subscriber: row.subscriber,
				state: row.state,
				attempts: row.attempts,
				lastError: row.last_error,
				lastAttemptAt: row.last_attempt_at,
				nextAttemptAt: row.next_attempt_at,
				deliveredAt: row.delivered_at,
			}));
			return { items, total: Number(total.rows[0]?.total ?? 0) };
		},

		countEventDeliveries: async () => {
			const res = await pool.query<{ state: EventDeliveryState; total: string }>(
				`SELECT state, COUNT(*) AS total FROM ${deliveries} GROUP BY state`,
			);
			const counts: Record<EventDeliveryState, number> = {
				pending: 0,
				delivering: 0,
				delivered: 0,
				failed: 0,
				dead: 0,
				dismissed: 0,
			};
			for (const row of res.rows) counts[row.state] = Number(row.total);
			return counts satisfies EventDeliveryCounts;
		},

		retryDelivery: async ({ eventId, subscriber, now }) => {
			const res = await pool.query(
				`UPDATE ${deliveries} SET state = 'pending', attempts = 0, next_attempt_at = $3, locked_until = NULL
				 WHERE event_id = $1 AND subscriber = $2 AND state IN ('failed', 'dead')`,
				[eventId, subscriber, now],
			);
			return (res.rowCount ?? 0) > 0;
		},

		dismissDelivery: async ({ eventId, subscriber }) => {
			const res = await pool.query(
				`UPDATE ${deliveries} SET state = 'dismissed', next_attempt_at = NULL, locked_until = NULL
				 WHERE event_id = $1 AND subscriber = $2 AND state IN ('failed', 'dead')`,
				[eventId, subscriber],
			);
			return (res.rowCount ?? 0) > 0;
		},

		pruneEvents: async ({ before }) => {
			const res = await pool.query(
				`DELETE FROM ${events} e
				 WHERE e.occurred_at < $1
				   AND NOT EXISTS (SELECT 1 FROM ${deliveries} d WHERE d.event_id = e.id AND d.state NOT IN ('delivered', 'dismissed'))`,
				[before],
			);
			return res.rowCount ?? 0;
		},
	};
}
