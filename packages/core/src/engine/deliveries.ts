import type { Kysely, Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import type { MontiEvent } from "../operation";

/** Somewhere events go after a write commits: a webhook from the config file, or a plugin. */
export type Receiver = {
	/** `webhook:https://example.dev/api/revalidate`, `plugin:algolia`. */
	destination: string;
	/** Which events it wants; all when left out. */
	accepts?: (event: MontiEvent) => boolean;
	send: (event: MontiEvent) => Promise<void>;
};

/** Minutes before each automatic retry. After the last one fails, the delivery stays failed until a person sends it again. */
export const RETRY_MINUTES = [1, 5, 30, 60, 120, 360, 720, 1440] as const;

/** Queues one delivery per receiver and event, in the write's transaction, so a rolled-back write queues nothing. */
export async function queueDeliveries(
	trx: Transaction<Database>,
	receivers: readonly Receiver[],
	activityId: string,
	events: MontiEvent[],
): Promise<string[]> {
	const rows = events.flatMap((event) =>
		receivers
			.filter((receiver) => receiver.accepts?.(event) ?? true)
			.map((receiver) => ({
				id: randomUUID(),
				activity_id: activityId,
				destination: receiver.destination,
				event: JSON.stringify(event),
				state: "pending" as const,
				last_error: null,
				next_attempt_at: null,
			})),
	);
	if (rows.length > 0) await trx.insertInto("monti_delivery").values(rows).execute();
	return rows.map((row) => row.id);
}

/**
 * Sends the given pending deliveries once each. A failure is counted and scheduled for the next retry, or marked failed when the retries are used up.
 */
export async function sendDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	ids: string[],
	now: Date,
): Promise<void> {
	if (ids.length === 0) return;
	const rows = await db
		.selectFrom("monti_delivery")
		.selectAll()
		.where("id", "in", ids)
		.where("state", "=", "pending")
		.execute();
	for (const row of rows) {
		const receiver = receivers.find((candidate) => candidate.destination === row.destination);
		const attempts = row.attempts + 1;
		try {
			if (!receiver) throw new Error(`No receiver ${row.destination} any more`);
			await receiver.send(row.event);
			await db
				.updateTable("monti_delivery")
				.set({ state: "sent", attempts, last_error: null, next_attempt_at: null })
				.where("id", "=", row.id)
				.execute();
		} catch (error) {
			// The first send is not a retry, so the retries run out on attempt RETRY_MINUTES.length + 1.
			const wait = RETRY_MINUTES[attempts - 1];
			await db
				.updateTable("monti_delivery")
				.set({
					state: wait === undefined ? "failed" : "pending",
					attempts,
					last_error: error instanceof Error ? error.message : String(error),
					next_attempt_at: wait === undefined ? null : new Date(now.getTime() + wait * 60_000),
				})
				.where("id", "=", row.id)
				.execute();
		}
	}
}

/** Sends every pending delivery whose retry is due. Runs when the admin opens and from `monti deliveries:run`. */
export async function sendDueDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	now: Date,
): Promise<void> {
	const due = await db
		.selectFrom("monti_delivery")
		.select("id")
		.where("state", "=", "pending")
		.where((eb) => eb.or([eb("next_attempt_at", "is", null), eb("next_attempt_at", "<=", now)]))
		.execute();
	await sendDeliveries(
		db,
		receivers,
		due.map((row) => row.id),
		now,
	);
}
