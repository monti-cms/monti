import { type Kysely, sql, type Transaction } from "kysely";
import { hex, randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import type { Message, MontiEvent } from "../operation";

type Db = Kysely<Database> | Transaction<Database>;

/** Somewhere events go after a write commits: a webhook from the config file, or a plugin. */
export type Receiver = {
	/**
	 * What its deliveries are stored under and found by: `webhook:<name>` (a webhook's own name, or its address's host and path),
	 * `plugin:algolia`. It is a name, never an address: nothing secret is in it. No two receivers of a site share one.
	 */
	destination: string;
	/**
	 * Its name as a person reads it in the activity log ("Site cache", "Search index"): words, or a message of a dictionary. Left out, it is
	 * what follows `webhook:` or `plugin:` in `destination`.
	 */
	label?: string | Message;
	/** Which events it wants; all when left out. */
	accepts?: (event: MontiEvent) => boolean;
	/**
	 * Its work is the same whatever the event (it refreshes everything): of the events one write emits it is sent the first it accepts, once.
	 * A bulk publish of fifty entries is then one send to it, not fifty.
	 */
	oncePerWrite?: boolean;
	/**
	 * Its first send is waited for before the write answers, also on a host that sends after its response (`waitUntil`): what the person sees
	 * next depends on it. The site's own cached pages are this (the Next adapter's receiver): a publish that answered must be on the site. It
	 * should be quick, and has the send's time limit like any other.
	 */
	beforeAnswer?: boolean;
	/**
	 * Sends one event. It throws when the event did not arrive. `signal` aborts when the send has taken too long (`SEND_TIMEOUT_MS`). `delivery`
	 * names this delivery (the same id on every try) and which try it is.
	 *
	 * An event can arrive twice: the receiver handled it, its answer was lost, and Monti sent it again. `event.id` is the same on every try and for
	 * every receiver, so a receiver that must not act twice keeps the ids it has handled.
	 */
	send: (event: MontiEvent, signal: AbortSignal, delivery: DeliveryTry) => Promise<void>;
};

/** One try of a delivery: its id, which stays through its retries, and the number of the try (1 for the first). */
export type DeliveryTry = { id: string; attempt: number };

/** How many deliveries are sent at once: a receiver that does not answer holds one place for ten seconds, not the whole run. */
const SEND_TOGETHER = 10;

/** How many failed deliveries one "send again" takes: with `SEND_TOGETHER` it answers within about one time limit, and says how many are left. */
export const RETRY_BATCH = SEND_TOGETHER;

/** How many due deliveries one sweep takes (the admin opening, `monti deliveries:run`): the next sweep goes on. */
const SWEEP_BATCH = 50;

/** Minutes before each automatic retry. After the last one fails, the delivery stays failed until a person sends it again. */
export const RETRY_MINUTES = [1, 5, 30, 60, 120, 360, 720, 1440] as const;

/** How long one send may take. The first send runs inside the write's request, so a receiver that never answers must not hold the admin's save. */
export const SEND_TIMEOUT_MS = 10_000;

/**
 * How long a write waits, in all, for the receivers that are to be done before it answers (`beforeAnswer`), however many events it emitted: as
 * long as one send may take. Past it the write answers and what is left is sent behind the answer.
 */
export const BEFORE_ANSWER_MS = 10_000;

/** How long a sender holds a delivery: past the time one send may take, so a sender that died lets go by itself. */
const HOLD_MS = SEND_TIMEOUT_MS * 3;

/**
 * A webhook's address, read when the site is made. One that does not parse, or that carries a user or a password, is refused there: the
 * platform's `fetch` refuses both when it sends, with an error that quotes the whole address. The refusal does not quote it.
 */
function webhookAddress(url: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("webhook(): the address is no URL. Give a whole address (https://host/path).");
	}
	if (parsed.username !== "" || parsed.password !== "")
		throw new Error(
			"webhook(): the address carries a user or a password, which a request cannot be sent with. Send them in `headers` (Authorization), or sign with `secret`.",
		);
	return parsed;
}

/**
 * A webhook's name when it is given none: its host alone. Never the path or the query: hook services keep their token in either (a deploy
 * hook's last path segment, a chat hook's `/services/…/<secret>`), and the name is stored, shown in the log and handed to the assistant.
 */
const hostOf = (parsed: URL) => parsed.host;

/** HMAC-SHA256 of `text` under `secret`, in hex. */
async function hmac(secret: string, text: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await globalThis.crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return hex(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(text)));
}

/**
 * A webhook as a receiver (`monti.config.ts`, `receivers: [webhook("https://example.dev/api/revalidate")]`): the event is posted as JSON, and any
 * answer but a 2xx is a failure (a redirect too: it is not followed). `events` keeps it to some event types; `headers` carry what the other
 * side checks (a token).
 *
 * - `name` is what its deliveries are stored and shown under (`webhook:<name>`); left out, the address's host alone. The address itself, with
 *   whatever token its path or query carries, is never stored or shown. Two receivers of one site cannot share a name: two webhooks on one
 *   host each need a `name`.
 * - `secret` signs every send: header `Monti-Signature: t=<seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `<t>.<body>` under the secret,
 *   `t` the time of the send and `<body>` the bytes posted. The receiver makes the same HMAC and compares, and may refuse a `t` that is old.
 *   Without `secret` nothing is signed. It is the webhook's own secret, never `MONTI_SECRET`.
 *
 * Every try of one delivery carries the same ids, in the body (`id`, the event's) and in headers: `Monti-Event-Id`, `Monti-Delivery-Id` and
 * `Monti-Attempt`. A handler whose answer got lost sees the event again under the same `Monti-Event-Id` and can leave it.
 */
export function webhook(
	url: string,
	options: {
		name?: string;
		events?: readonly string[];
		headers?: Record<string, string>;
		secret?: string;
		fetch?: typeof fetch;
		/** The time a send is signed with; the clock's, unless a test says otherwise. */
		now?: () => Date;
	} = {},
): Receiver {
	const { events } = options;
	const address = webhookAddress(url);
	return {
		destination: `webhook:${options.name ?? hostOf(address)}`,
		...(events ? { accepts: (event: MontiEvent) => events.includes(event.type) } : {}),
		async send(event, signal, delivery) {
			const body = JSON.stringify(event);
			const at = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
			const response = await receiverFetch(
				url,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"monti-event-id": event.id,
						"monti-delivery-id": delivery.id,
						"monti-attempt": String(delivery.attempt),
						...(options.secret
							? { "monti-signature": `t=${at},v1=${await hmac(options.secret, `${at}.${body}`)}` }
							: {}),
						...options.headers,
					},
					body,
					signal,
				},
				options.fetch,
			);
			// Nothing reads the answer's body: it is let go, so the connection is free at once.
			await response.body?.cancel().catch(() => {});
		},
	};
}

/**
 * A receiver's request to its other side, with a send's own answers (doc 13): a status that is no success is thrown as a `ReceiverAnswer`
 * ("503 Service Unavailable"), and a side that was not reached as "no answer" with the network's word for why. A plugin's receiver sends
 * with this, and the log then says what the other side said instead of "could not be sent". Pass the send's `signal` in `init`.
 *
 * A redirect is an answer that is no success: the request is not made again somewhere the receiver did not name. The answer is given back
 * for a receiver that reads it; one that does not lets its body go.
 */
export async function receiverFetch(
	url: string,
	init: RequestInit = {},
	fetchWith: typeof fetch = fetch,
): Promise<Response> {
	let response: Response;
	try {
		response = await fetchWith(url, { ...init, redirect: "manual" });
	} catch (error) {
		// The other side was not reached: the network's own word for why (`ECONNREFUSED`, `ENOTFOUND`) is what is kept. An error with no
		// such word is passed on, and stored as a failure with none of its text: the platform's messages quote the address.
		const code = networkCode(error);
		if (code !== null) throw new NoAnswer(code);
		throw error;
	}
	if (!response.ok) {
		// Nothing reads a refusal's body: it is let go, so the connection is free at once.
		await response.body?.cancel().catch(() => {});
		throw new ReceiverAnswer(`${response.status} ${response.statusText}`.trim());
	}
	return response;
}

/**
 * What a receiver throws when the other side answered, and not with success: `status` is the answer as it came ("503 Service Unavailable"), and
 * the log shows it (the number, and HTTP's own words for it). Anything else a receiver throws is stored as a failure with none of its text: an
 * error's own message is never stored or shown.
 */
export class ReceiverAnswer extends Error {
	constructor(readonly status: string) {
		super(status);
		this.name = "ReceiverAnswer";
	}
}

/** The name of the receiver that refreshes the site's own cached pages (an adapter's, as `@monti-cms/next`'s), in the core's dictionary. */
export const SITE_CACHE_LABEL: Message = { key: "deliveries.receiver.site" };

/** The delivery's receiver is not in the config any more. */
class GoneError extends Error {}

/** The sender gave up on a receiver that did not answer in time, or the other side was not reached (`code`: the network's own word for why). */
class NoAnswer extends Error {
	constructor(readonly code: string | null = null) {
		super("No answer");
		this.name = "NoAnswer";
	}
}

/** The network's own word for why the other side was not reached (`ECONNREFUSED`, `ENOTFOUND`), when the error carries one that is such a word. */
function networkCode(error: unknown): string | null {
	let at = error;
	for (let depth = 0; typeof at === "object" && at !== null && depth < 3; depth++) {
		const { code, cause } = at as { code?: unknown; cause?: unknown };
		// A code and nothing else: capitals, digits and underscores, never a sentence that could quote an address.
		if (typeof code === "string" && /^[A-Z][A-Z0-9_]{2,39}$/.test(code)) return code;
		at = cause;
	}
	return null;
}

/** The words HTTP has for the statuses a receiver is likely to answer with: a status is stored with these and no others. */
const STATUS_WORDS: Record<number, string> = {
	301: "Moved Permanently",
	302: "Found",
	303: "See Other",
	307: "Temporary Redirect",
	308: "Permanent Redirect",
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	413: "Content Too Large",
	422: "Unprocessable Content",
	429: "Too Many Requests",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
};

/**
 * Why a delivery failed, as it is stored (`last_error`). It is one of four kinds and never a text that came from outside: an error's own
 * message can quote the address it was sent to, with the token in it, and what is stored is shown in the log and read by the assistant.
 *
 * - `status:503 Service Unavailable`: the receiver answered. The number, and HTTP's own words for it when the answer used them; words of the
 *   other side's own are not kept.
 * - `noAnswer`, `noAnswer:ECONNREFUSED`: no answer in time, or the other side was not reached, with the network's code when there is one.
 * - `gone`: no such receiver in the config any more.
 * - `failed`: anything else a receiver threw. What it said is not kept.
 */
const failureOf = (error: unknown): string => {
	if (error instanceof GoneError) return "gone";
	if (error instanceof ReceiverAnswer) {
		const answered = /^(\d{3})(?: (.*))?$/.exec(error.status.trim());
		if (!answered) return "failed";
		const code = Number(answered[1]);
		return STATUS_WORDS[code] !== undefined && answered[2] === STATUS_WORDS[code]
			? `status:${code} ${STATUS_WORDS[code]}`
			: `status:${code}`;
	}
	if (error instanceof NoAnswer) return error.code === null ? "noAnswer" : `noAnswer:${error.code}`;
	return "failed";
};

/** A stored failure in words: one of three sentences (doc 13). */
export function deliveryError(stored: string | null): Message | null {
	if (stored === null) return null;
	if (stored === "gone") return { key: "deliveries.error.gone" };
	if (stored.startsWith("status:")) return { key: "deliveries.error.status", values: { status: stored.slice(7) } };
	if (stored.startsWith("noAnswer")) return { key: "deliveries.error.noAnswer" };
	return { key: "deliveries.error.failed" };
}

/**
 * A receiver's name as the log shows it, from the destination a delivery was stored under: the receiver's own `label`, or the name in the
 * destination without its kind (a webhook's own name or its host and path, a plugin receiver's name).
 */
export function receiverName(destination: string, receivers: readonly Receiver[]): string | Message {
	const label = receivers.find((receiver) => receiver.destination === destination)?.label;
	if (label !== undefined) return label;
	// What it is stored under is already a name (a webhook's own, or its host and path; a plugin receiver's): without the kind before it.
	return destination.replace(/^(webhook|plugin):/, "");
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
	/** The receivers that take one send for the whole write, once they have theirs. */
	const served = new Set<string>();
	const rows = events.flatMap(({ event, activity }) =>
		receivers
			.filter((receiver) => {
				if (!(receiver.accepts?.(event) ?? true)) return false;
				if (!receiver.oncePerWrite) return true;
				if (served.has(receiver.destination)) return false;
				served.add(receiver.destination);
				return true;
			})
			.map((receiver) => ({
				id: randomUUID(),
				activity_id: activity ?? activityId,
				destination: receiver.destination,
				event: JSON.stringify(event),
				state: "pending" as const,
				last_error: null,
				next_attempt_at: null,
				sending_until: null,
				held_by: null,
				attempted_at: null,
				created_at: now,
			})),
	);
	if (rows.length > 0) await trx.insertInto("monti_delivery").values(rows).execute();
	return rows.map((row) => row.id);
}

/** One send, given up on after `SEND_TIMEOUT_MS`. */
async function sendOnce(receiver: Receiver, event: MontiEvent, delivery: DeliveryTry): Promise<void> {
	const abort = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			const error = new NoAnswer();
			abort.abort(error);
			reject(error);
		}, SEND_TIMEOUT_MS);
	});
	try {
		await Promise.race([receiver.send(event, abort.signal, delivery), late]);
	} finally {
		clearTimeout(timer);
	}
}

/** How a run of sends came out: how many arrived, how many failed, and how many were left because this process has no receiver for them. */
export type SendResult = { sent: number; failed: number; left: number };

/**
 * Sends the given deliveries once each, a few at a time. A sender takes hold of a delivery before it sends, so the same delivery is never sent by two
 * at once (two admins opening, the command and a visit). A failure is counted and shown as failed at once; while retries are left it is also
 * scheduled for the next one, and after the last it stays failed until a person sends it again.
 *
 * - `due`: only what is due at the moment it is taken.
 * - `holder`: the deliveries were reserved under this name (a person's "send again"): this sender is the one that may take them.
 * - `stop`: asked before each delivery is taken; once it says so, no further one is started (a write's wait for its receivers has a deadline),
 *   and `notStarted` hears of each that was left for it.
 * - `leaveUnknown`: a delivery whose receiver this process does not have is left as it is, untried. The command line opens the site without the
 *   receivers only the running site has (the Next adapter's cache refresh): a try from there would only write a failure that is not one.
 *
 * A sender that takes a delivery whose reservation ran out takes the reserver's name off it: it is no longer a person's send.
 */
export async function sendDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	ids: string[],
	now: () => Date,
	options: {
		due?: boolean;
		holder?: string;
		leaveUnknown?: boolean;
		stop?: () => boolean;
		/** Told each delivery `stop` kept it from starting. */
		notStarted?: (id: string) => void;
	} = {},
): Promise<SendResult> {
	const result: SendResult = { sent: 0, failed: 0, left: 0 };
	const one = async (id: string) => {
		// Past the caller's deadline no further send is started: what is not taken stays queued, as it was.
		if (options.stop?.()) return void options.notStarted?.(id);
		const at = now();
		if (options.leaveUnknown) {
			const row = await db.selectFrom("monti_delivery").select("destination").where("id", "=", id).executeTakeFirst();
			if (row && !receivers.some((candidate) => candidate.destination === row.destination)) {
				result.left += 1;
				return;
			}
		}
		const held = await db
			.updateTable("monti_delivery")
			.set({ sending_until: new Date(at.getTime() + HOLD_MS), held_by: options.holder ?? null })
			.where("id", "=", id)
			.where("state", "in", ["pending", "failed"])
			.where((eb) =>
				eb.or([
					eb("sending_until", "is", null),
					eb("sending_until", "<", at),
					...(options.holder === undefined ? [] : [eb("held_by", "=", options.holder)]),
				]),
			)
			.$if(options.due === true, (query) => query.where(isDue(at)))
			.returningAll()
			.executeTakeFirst();
		if (!held) return;
		const receiver = receivers.find((candidate) => candidate.destination === held.destination);
		const attempts = held.attempts + 1;
		let failure: string | null = null;
		try {
			if (!receiver) throw new GoneError();
			await sendOnce(receiver, held.event, { id: held.id, attempt: attempts });
		} catch (error) {
			failure = failureOf(error);
			// "Could not be sent" keeps none of the error's words (they can quote an address with its token), so the log cannot say what went
			// wrong in a receiver's own code. The server's console can: it is the site's own, like the rest of what the server prints.
			if (failure === "failed")
				console.error(`Monti: the receiver ${held.destination} threw; its delivery is stored as failed:`, error);
		}
		// The first send is not a retry, so the retries run out on attempt RETRY_MINUTES.length + 1.
		const wait = failure === null ? undefined : RETRY_MINUTES[attempts - 1];
		const tried = now();
		const written = await db
			.updateTable("monti_delivery")
			.set({
				state: failure === null ? "sent" : "failed",
				attempts,
				last_error: failure,
				next_attempt_at: wait === undefined ? null : new Date(tried.getTime() + wait * 60_000),
				attempted_at: tried,
				sending_until: null,
				held_by: null,
			})
			.where("id", "=", id)
			// One a person canceled while it was on its way stays canceled.
			.where("state", "in", ["pending", "failed"])
			.returning("id")
			.executeTakeFirst();
		if (written) result[failure === null ? "sent" : "failed"] += 1;
	};
	// A few at a time, each taking the next id as it finishes.
	const waiting = [...ids];
	await Promise.all(
		Array.from({ length: Math.min(SEND_TOGETHER, waiting.length) }, async () => {
			for (let id = waiting.shift(); id !== undefined; id = waiting.shift()) await one(id);
		}),
	);
	return result;
}

/**
 * What is due: a failed delivery whose next retry has come, and one that was queued and never tried because its first sender died. A delivery
 * just queued is its own write's to send first: a sweep leaves it for as long as a sender holds one (`HOLD_MS`), or another request's sweep
 * would take it before the write does and the write would answer before the site's pages are refreshed.
 */
const isDue = (now: Date) =>
	sql<boolean>`((state = 'failed' and next_attempt_at <= ${now})
		or (state = 'pending' and next_attempt_at is null and created_at < ${new Date(now.getTime() - HOLD_MS)}))`;

/**
 * Sends the deliveries whose retry is due, oldest first, a sweep's worth at a time (the next sweep goes on). Runs when the admin opens and from
 * `monti deliveries:run`.
 */
export async function sendDueDeliveries(
	db: Kysely<Database>,
	receivers: readonly Receiver[],
	now: () => Date,
	options: { leaveUnknown?: boolean } = {},
): Promise<SendResult> {
	const at = now();
	const own = receivers.map((receiver) => receiver.destination);
	const ready = () =>
		db
			.selectFrom("monti_delivery")
			.where(isDue(at))
			.where((eb) => eb.or([eb("sending_until", "is", null), eb("sending_until", "<", at)]));
	// With `leaveUnknown` the sweep takes only what this process can send: fifty due deliveries of a receiver it does not have would otherwise
	// fill every sweep, and what it can send would wait behind them for ever.
	const due =
		options.leaveUnknown && own.length === 0
			? []
			: await ready()
					.select("id")
					.$if(options.leaveUnknown === true, (query) => query.where("destination", "in", own))
					.orderBy("created_at")
					.limit(SWEEP_BATCH)
					.execute();
	const result = await sendDeliveries(
		db,
		receivers,
		due.map((row) => row.id),
		now,
		{ due: true, leaveUnknown: options.leaveUnknown },
	);
	if (!options.leaveUnknown) return result;
	// How many it left for the running site, to say so.
	const left = await ready()
		.select((eb) => eb.fn.countAll<string>().as("count"))
		.$if(own.length > 0, (query) => query.where("destination", "not in", own))
		.executeTakeFirstOrThrow();
	return { ...result, left: result.left + Number(left.count) };
}

/**
 * How many deliveries are failed, since when, and how many a person's "send again" is sending at this moment: one reading, so the number and
 * the day never disagree. The sidebar's row, and the banner over the log, show this number (doc 13). "Since" is the day the oldest failed
 * delivery's write was made, not the day its sending failed (decided while building, 2026-11-13): it says from which change on the receiver
 * is behind, and it stays where it is however often the delivery is tried again.
 */
export async function deliveryCounts(
	db: Db,
	now: Date,
): Promise<{ failed: number; since: Date | null; sending: number; onTheWay: number }> {
	const row = await db
		.selectFrom("monti_delivery")
		// Only what is still open, which the table's partial index holds: the deliveries that arrived, most of the table, are not read.
		.where("state", "in", ["pending", "failed"])
		.select((eb) => [
			eb.fn.count<string>("id").filterWhere("state", "=", "failed").as("failed"),
			eb.fn.min("created_at").filterWhere("state", "=", "failed").as("since"),
			eb.fn
				.count<string>("id")
				.filterWhere((inner) => inner.and([inner("held_by", "is not", null), inner("sending_until", ">=", now)]))
				.as("sending"),
			// Not tried yet: queued by a write and sent once it has answered. Whoever shows the failed number looks again while any is.
			eb.fn
				.count<string>("id")
				.filterWhere("state", "=", "pending")
				.as("onTheWay"),
		])
		.executeTakeFirstOrThrow();
	return {
		failed: Number(row.failed),
		since: row.since ?? null,
		sending: Number(row.sending),
		onTheWay: Number(row.onTheWay),
	};
}

/**
 * The failed deliveries a "send again" may take now: not one a sender holds, with `run` not one already tried since that run began, and with
 * `only` not one whose receiver this process does not have.
 */
function retryable(db: Db, ids: string[] | "all", now: Date, run: Date | null, only: readonly string[] | null) {
	return db
		.selectFrom("monti_delivery")
		.where("state", "=", "failed")
		.$if(only !== null, (query) => query.where("destination", "in", only as string[]))
		.where((eb) => eb.or([eb("sending_until", "is", null), eb("sending_until", "<", now)]))
		.$if(ids !== "all", (query) => query.where("id", "in", ids as string[]))
		.$if(run !== null, (query) =>
			query.where((eb) => eb.or([eb("attempted_at", "is", null), eb("attempted_at", "<", run as Date)])),
		);
}

/**
 * Makes failed deliveries ready to send again as new, a batch of them (`RETRY_BATCH`), and reserves them under `holder`: a person's "send again"
 * counts the tries from the start (doc 13), and from this moment no scheduled sender takes them, so the one who asked sends them and reads how
 * they came out. `ids` are the ones asked for, or every failed one. One a sender holds at this moment is left to it. `run` is when this run of
 * "send all again" began: what was tried since is not taken a second time, so a receiver that is still down does not keep the run going.
 *
 * It returns the ones reserved and how many more of the run are left; asked for ones of which none can be sent, it says why: the state they
 * share, or when they differ that none can be sent, with how many are in each state.
 *
 * `only` names the receivers this process has: a delivery of any other is left untouched (its tries are not reset and no failure is written).
 * The command line gives it, since it opens the site without the receivers only the running site has.
 */
export async function reserveFailedDeliveries(
	db: Db,
	ids: string[] | "all",
	options: { now: Date; holder: string; run: Date | null; only?: readonly string[] },
): Promise<{ ids: string[]; remaining: number }> {
	const { now, holder, run } = options;
	const only = options.only ?? null;
	// The batch is picked once, in a step of its own, and then updated. Picked inside the update's `where id in (…)`, the pick is a subquery
	// the planner may run again for every row it looks at (a nested loop with no hash over it, as a database with no statistics yet may
	// plan it): each run leaves out the rows this same statement has already updated and takes the next ones in their place, so the "batch"
	// grew past its limit (23 failed deliveries, a limit of ten, 17 taken in one step on CI).
	const reserved = await db
		.with(
			(cte) => cte("picked").materialized(),
			() =>
				retryable(db, ids, now, run, only)
					.select("id")
					.orderBy("created_at")
					.orderBy("id")
					.limit(RETRY_BATCH)
					.forUpdate()
					.skipLocked(),
		)
		.updateTable("monti_delivery")
		.set({
			state: "pending",
			attempts: 0,
			next_attempt_at: null,
			held_by: holder,
			sending_until: new Date(now.getTime() + HOLD_MS),
		})
		.where("id", "in", (eb) => eb.selectFrom("picked").select("picked.id"))
		.returning("monti_delivery.id")
		.execute();
	if (ids !== "all" && reserved.length === 0 && run === null) {
		const asked = await db
			.selectFrom("monti_delivery")
			.select(["state", "destination"])
			.where("id", "in", ids)
			.execute();
		// Why each cannot be sent: it arrived, it was canceled, this process has no receiver for it, or a sender has it now.
		const why = (row: (typeof asked)[number]) =>
			row.state === "sent"
				? "alreadySent"
				: row.state === "canceled"
					? "alreadyCanceled"
					: only !== null && !only.includes(row.destination)
						? "notHere"
						: "sending";
		const reasons = asked.map(why);
		const [first] = reasons;
		if (first === undefined) throw new CheckError({ key: "deliveries.unknown" });
		// One reason for all of them is said as it is; several are counted, each by its own.
		if (reasons.every((reason) => reason === first)) throw new CheckError({ key: `deliveries.${first}` });
		const count = (reason: string) => reasons.filter((each) => each === reason).length;
		throw new CheckError({
			key: "deliveries.noneToSend",
			values: {
				sent: count("alreadySent"),
				canceled: count("alreadyCanceled"),
				sending: count("sending"),
				notHere: count("notHere"),
			},
		});
	}
	const left = await retryable(db, ids, now, run, only)
		.select((eb) => eb.fn.countAll<string>().as("count"))
		.executeTakeFirstOrThrow();
	return { ids: reserved.map((row) => row.id), remaining: Number(left.count) };
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
