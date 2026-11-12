import { type Kysely, sql, type Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import type { MontiEvent } from "../operation";

type Db = Kysely<Database> | Transaction<Database>;

/** Somewhere events go after a write commits: a webhook from the config file, or a plugin. */
export type Receiver = {
	/** `webhook:https://example.dev/api/revalidate`, `plugin:algolia`. */
	destination: string;
	/** Which events it wants; all when left out. */
	accepts?: (event: MontiEvent) => boolean;
	/** Sends one event. It throws when the event did not arrive. `signal` aborts when the send has taken too long (`SEND_TIMEOUT_MS`). */
	send: (event: MontiEvent, signal: AbortSignal) => Promise<void>;
};

/** Minutes before each automatic retry. After the last one fails, the delivery stays failed until a person sends it again. */
export const RETRY_MINUTES = [1, 5, 30, 60, 120, 360, 720, 1440] as const;

/** How long one send may take. The first send runs inside the write's request, so a receiver that never answers must not hold the admin's save. */
export const SEND_TIMEOUT_MS = 10_000;

/** How long a sender holds a delivery: past the time one send may take, so a sender that died lets go by itself. */
const HOLD_MS = SEND_TIMEOUT_MS * 3;

/** The longest error text kept on a delivery: a receiver's whole error page is no use in a side panel. */
const ERROR_LENGTH = 300;

/**
 * A webhook as a receiver (`monti.config.ts`, `receivers: [webhook("https://example.dev/api/revalidate")]`): the event is posted as JSON, and any
 * answer but a 2xx is a failure. `events` keeps it to some event types; `headers` carry what the other side checks (a token).
 */
export function webhook(
	url: string,
	options: { events?: readonly string[]; headers?: Record<string, string>; fetch?: typeof fetch } = {},
): Receiver {
	const { events } = options;
	return {
		destination: `webhook:${url}`,
		...(events ? { accepts: (event: MontiEvent) => events.includes(event.type) } : {}),
		async send(event, signal) {
			const response = await (options.fetch ?? fetch)(url, {
				method: "POST",
				headers: { "content-type": "application/json", ...options.headers },
				body: JSON.stringify(event),
				signal,
			});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
		},
	};
}

/** An event queued by a write, with the log row its delivery shows on when that is not the write's own. */
export type QueuedEvent = { event: MontiEvent; activity?: string };

/** Queues one delivery per receiver and event, in the write's transaction, so a rolled-back write queues nothing. */
export async function queueDeliveries(
	trx: Transaction<Database>,
	receivers: readonly Receiver[],
	activityId: string,
	events: QueuedEvent[],
	now: Date,
): Promise<string[]> {
	const rows = events.flatMap(({ event, activity }) =>
		receivers
			.filter((receiver) => receiver.accepts?.(event) ?? true)
			.map((receiver) => ({
				id: randomUUID(),
				activity_id: activity ?? activityId,
				destination: receiver.destination,
				event: JSON.stringify(event),
				state: "pending" as const,
				last_error: null,
				next_attempt_at: null,
				sending_until: null,
				created_at: now,
			})),
	);
	if (rows.length > 0) await trx.insertInto("monti_delivery").values(rows).execute();
	return rows.map((row) => row.id);
}

/** One send, given up on after `SEND_TIMEOUT_MS`. */
async function sendOnce(receiver: Receiver, event: MontiEvent): Promise<void> {
	const abort = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			const error = new Error(`No answer in ${SEND_TIMEOUT_MS / 1000} seconds`);
			abort.abort(error);
			reject(error);
		}, SEND_TIMEOUT_MS);
	});
	try {
		await Promise.race([receiver.send(event, abort.signal), late]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Sends the given deliveries once each. A sender takes hold of a delivery before it sends, so the same delivery is never sent by two at once (two
 * admins opening, the command and a visit). A failure is counted and shown as failed at once; while retries are left it is also scheduled for the
 * next one, and after the last it stays failed until a person sends it again. With `due`, only what is due at that moment is taken.
 */
export async function sendDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	ids: string[],
	now: () => Date,
	options: { due?: boolean } = {},
): Promise<void> {
	for (const id of ids) {
		const at = now();
		const held = await db
			.updateTable("monti_delivery")
			.set({ sending_until: new Date(at.getTime() + HOLD_MS) })
			.where("id", "=", id)
			.where("state", "in", ["pending", "failed"])
			.where((eb) => eb.or([eb("sending_until", "is", null), eb("sending_until", "<", at)]))
			.$if(options.due === true, (query) => query.where(isDue(at)))
			.returningAll()
			.executeTakeFirst();
		if (!held) continue;
		const receiver = receivers.find((candidate) => candidate.destination === held.destination);
		const attempts = held.attempts + 1;
		let failure: string | null = null;
		try {
			if (!receiver) throw new Error(`No receiver ${held.destination} any more`);
			await sendOnce(receiver, held.event);
		} catch (error) {
			failure = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_LENGTH) || "Failed";
		}
		// The first send is not a retry, so the retries run out on attempt RETRY_MINUTES.length + 1.
		const wait = failure === null ? undefined : RETRY_MINUTES[attempts - 1];
		await db
			.updateTable("monti_delivery")
			.set({
				state: failure === null ? "sent" : "failed",
				attempts,
				last_error: failure,
				next_attempt_at: wait === undefined ? null : new Date(now().getTime() + wait * 60_000),
				sending_until: null,
			})
			.where("id", "=", id)
			// One a person canceled while it was on its way stays canceled.
			.where("state", "in", ["pending", "failed"])
			.execute();
	}
}

/** What is due: a failed delivery whose next retry has come, and one that was queued and never tried (its first sender died). */
const isDue = (now: Date) =>
	sql<boolean>`((state = 'failed' and next_attempt_at <= ${now}) or (state = 'pending' and next_attempt_at is null))`;

/** Sends every delivery whose retry is due. Runs when the admin opens and from `monti deliveries:run`. */
export async function sendDueDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	now: () => Date,
): Promise<void> {
	const due = await db.selectFrom("monti_delivery").select("id").where(isDue(now())).orderBy("created_at").execute();
	await sendDeliveries(
		db,
		receivers,
		due.map((row) => row.id),
		now,
		{ due: true },
	);
}

/** How many deliveries are failed: the one number the sidebar's tools row, the activity tab and the banner over the log show (doc 13). */
export async function failedDeliveryCount(db: Db): Promise<number> {
	const row = await db
		.selectFrom("monti_delivery")
		.select((eb) => eb.fn.countAll<string>().as("count"))
		.where("state", "=", "failed")
		.executeTakeFirstOrThrow();
	return Number(row.count);
}

/**
 * Makes failed deliveries ready to send again as new: a person's "send again" counts the tries from the start (doc 13). `ids` are the ones asked
 * for, or every failed one. One a sender holds at this moment is left to it. Returns the ones that will be sent; asked for ones of which none can
 * be, it says why.
 */
export async function resetFailedDeliveries(db: Db, ids: string[] | "all", now: Date): Promise<string[]> {
	const reset = await db
		.updateTable("monti_delivery")
		.set({ state: "pending", attempts: 0, next_attempt_at: null })
		.where("state", "=", "failed")
		.where((eb) => eb.or([eb("sending_until", "is", null), eb("sending_until", "<", now)]))
		.$if(ids !== "all", (query) => query.where("id", "in", ids as string[]))
		.returning("id")
		.execute();
	if (ids !== "all" && reset.length === 0) {
		const [asked] = await db.selectFrom("monti_delivery").select("state").where("id", "in", ids).execute();
		throw new CheckError({
			key: !asked
				? "deliveries.unknown"
				: asked.state === "sent"
					? "deliveries.alreadySent"
					: asked.state === "canceled"
						? "deliveries.alreadyCanceled"
						: "deliveries.sending",
		});
	}
	return reset.map((row) => row.id);
}

/** How the deliveries sent again came out. */
export async function sentAgain(db: Db, ids: string[]): Promise<{ sent: number; failed: number }> {
	if (ids.length === 0) return { sent: 0, failed: 0 };
	const rows = await db.selectFrom("monti_delivery").select("state").where("id", "in", ids).execute();
	return {
		sent: rows.filter((row) => row.state === "sent").length,
		failed: rows.filter((row) => row.state === "failed").length,
	};
}

/** Stops one delivery for good: it is not sent again and no longer counts as failed. One already sent or canceled cannot be. */
export async function cancelDelivery(db: Db, id: string): Promise<{ destination: string }> {
	const canceled = await db
		.updateTable("monti_delivery")
		.set({ state: "canceled", next_attempt_at: null })
		.where("id", "=", id)
		.where("state", "in", ["pending", "failed"])
		.returning("destination")
		.executeTakeFirst();
	if (canceled) return canceled;
	const row = await db.selectFrom("monti_delivery").select("state").where("id", "=", id).executeTakeFirst();
	throw new CheckError({
		key: !row ? "deliveries.unknown" : row.state === "sent" ? "deliveries.alreadySent" : "deliveries.alreadyCanceled",
	});
}
