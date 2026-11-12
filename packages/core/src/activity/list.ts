import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import type { Database, DeliveryTable } from "../db/schema";
import { CheckError } from "../errors";
import { ACTIVITY_KINDS, type Actor, type LoggedRecord, type Message, recordKey } from "../operation";

type Db = Kysely<Database> | Transaction<Database>;

export type DeliveryState = DeliveryTable["state"];
export const DELIVERY_STATES = ["pending", "sent", "failed", "canceled"] as const satisfies readonly DeliveryState[];

/** The groups a person filters the log by: the assistant's work, and the kinds of writes (doc 13). */
export const ACTIVITY_FILTERS = ["assistant", ...ACTIVITY_KINDS] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

/** How many of a line's writes its second line names before it says how many more there are. */
const WHAT_SHOWN = 3;
/** How many records a line's details list. */
const RECORDS_SHOWN = 20;

/** The activity log's query (doc 13): what the screen's filters hold and what an agent asks ("what changed yesterday?", "what did the assistant change?"). */
export const ActivityQuery = z.object({
	/** The assistant's work, or one kind of write. */
	kind: z.enum(ACTIVITY_FILTERS).optional(),
	/** Lines with a delivery in this state. A delivery on its way is pending. */
	delivery: z.enum(DELIVERY_STATES).optional(),
	/** Lines that touched this entry, in any of its languages. */
	entry: z.string().optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(200).default(50),
	/**
	 * Where one browsing of the log stands: the `asOf` a first page answered. Later pages given it leave out the lines that began after that page was
	 * read, so a page starts where the one before it ended while new activity arrives. Left out, the log as it is now.
	 */
	asOf: z.string().regex(/^\d+$/).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

/** Whether a line can be undone: it can (`open`), it was (`done`, with when), its 30 days are over (`over`), or it never could (`none`). */
export type LineUndo = { state: "open" | "over" | "none" } | { state: "done"; at: Date };

/** A line's deliveries in one: how many are in each state, the failed ones to send again, and the most tries a failed one has had. */
export type LineDelivery = Record<DeliveryState, number> & { failedIds: string[]; attempts: number };

/**
 * One line of the activity log: one write, or every write applied from one proposal of the assistant's (its request is what the line quotes, and
 * undoing the line undoes them together).
 */
export type ActivityLine = {
	/** A write's id, or the proposal's: what `activity.get` and `activity.undo` take. */
	id: string;
	/** When its newest write ran. */
	at: Date;
	actor: Actor;
	/** The request the assistant's work came from. */
	request: string | null;
	conversationId: string | null;
	/** What was done, newest first: one message for a write, the first few for a proposal's writes. */
	what: Message[];
	/** How many more writes the line holds than `what` names. */
	more: number;
	/** Where it happened; `null` for a proposal's several writes, whose `what` says it. */
	where: Message | null;
	undo: LineUndo;
	/** `null` when the line sent nothing: the site has no receiver, or the write made no event. */
	delivery: LineDelivery | null;
};

export type ActivityList = {
	lines: ActivityLine[];
	total: number;
	/** The newest line there was when this was read: pass it with the next pages of the same browsing. */
	asOf: string;
	/** Whether the log shows deliveries at all: the site has a receiver, or once had one whose deliveries are still here. */
	deliveries: boolean;
	/** How many deliveries are in each state, for the filter's menu. */
	deliveryCounts: Record<DeliveryState, number>;
	/** The entry the lines are filtered by, as the filter's chip names it. */
	entry: { id: string; title: string } | null;
};

/** A record of a line, as its details show it. */
export type ActivityRecord = Omit<LoggedRecord, "address"> & {
	/** Whether it is still there to open (not deleted for good). */
	exists: boolean;
	/** An entry's public address as it was when the write ran; `null` without one. A path changed or a collection removed since does not change it. */
	address: string | null;
};

export type ActivityDelivery = {
	id: string;
	destination: string;
	/** The event's type: `entry.published`. */
	event: string;
	state: DeliveryState;
	attempts: number;
	lastError: string | null;
	/** When it is tried again by itself; `null` when it is not. */
	nextAttemptAt: Date | null;
};

/** A line with what its side panel shows: every write of it, the records it touched and each delivery. */
export type ActivityDetail = ActivityLine & {
	/** What each write of the line did, newest first: all of them, where the line's `what` names the first few. */
	writes: Message[];
	records: ActivityRecord[];
	/** How many records the line touched: more than `records` holds when there are many. */
	recordCount: number;
	deliveries: ActivityDelivery[];
};

type Row = {
	id: string;
	line: string;
	at: Date;
	actor: Actor;
	summary: Message;
	place: Message | null;
	targets: LoggedRecord[];
	conversation_id: string | null;
	proposal_id: string | null;
	undo_until: Date | null;
	undone_at: Date | null;
};

/** A message with what its collection is called in the admin, for texts that name it (`{collectionLabel}`). */
function named(message: Message, labels: Map<string, string>): Message {
	const collection = message.values?.collection;
	if (typeof collection !== "string") return message;
	return { ...message, values: { ...message.values, collectionLabel: labels.get(collection) ?? collection } };
}

async function collectionLabels(db: Db): Promise<Map<string, string>> {
	const rows = await db.selectFrom("collection_admin_values").select(["collection", "values"]).execute();
	return new Map(rows.flatMap((row) => (row.values.label ? [[row.collection, row.values.label] as const] : [])));
}

function undoOf(rows: Row[], now: Date): LineUndo {
	const undoable = rows.filter((row) => row.undo_until !== null);
	// Undone once something of it went back, whatever stayed: a write of the line whose record someone wrote since is left as it is and not marked
	// undone (the undo says which records it skipped), and the line still says when it was undone.
	const undone = undoable.flatMap((row) => row.undone_at ?? []);
	if (undone.length > 0) return { state: "done", at: new Date(Math.max(...undone.map((at) => at.getTime()))) };
	if (undoable.some((row) => (row.undo_until as Date) >= now)) return { state: "open" };
	return { state: undoable.length > 0 ? "over" : "none" };
}

type DeliveryRow = Pick<DeliveryTable, "id" | "activity_id" | "state"> & { attempts: number };

function deliveryOf(deliveries: DeliveryRow[]): LineDelivery | null {
	if (deliveries.length === 0) return null;
	const failed = deliveries.filter((delivery) => delivery.state === "failed");
	const count = (state: DeliveryState) => deliveries.filter((delivery) => delivery.state === state).length;
	return {
		pending: count("pending"),
		sent: count("sent"),
		failed: failed.length,
		canceled: count("canceled"),
		failedIds: failed.map((delivery) => delivery.id),
		attempts: Math.max(0, ...failed.map((delivery) => delivery.attempts)),
	};
}

/** The lines of these keys, each from its rows (newest first), in the keys' order. */
async function linesOf(db: Db, keys: string[], now: Date): Promise<{ line: ActivityLine; rows: Row[] }[]> {
	if (keys.length === 0) return [];
	const rows: Row[] = await db
		.selectFrom("monti_activity")
		.select([
			"id",
			"line",
			"at",
			"actor",
			"summary",
			"place",
			"targets",
			"conversation_id",
			"proposal_id",
			"undo_until",
			"undone_at",
		])
		.where("listed", "=", true)
		.where("line", "in", keys)
		.orderBy("seq", "desc")
		.execute();
	if (rows.length === 0) return [];
	const deliveries = await db
		.selectFrom("monti_delivery")
		.select(["id", "activity_id", "state", "attempts"])
		.where(
			"activity_id",
			"in",
			rows.map((row) => row.id),
		)
		.execute();
	const proposals = [...new Set(rows.flatMap((row) => row.proposal_id ?? []))];
	const requests =
		proposals.length === 0
			? []
			: await db.selectFrom("monti_proposal").select(["id", "request"]).where("id", "in", proposals).execute();
	const labels = await collectionLabels(db);
	return keys.flatMap((key) => {
		const own = rows.filter((row) => row.line === key);
		const [newest] = own;
		// The line's place and time are its head's, its first write: they never change, whatever joins the line later.
		const head = own.at(-1);
		if (!newest || !head) return [];
		const ids = new Set(own.map((row) => row.id));
		const line: ActivityLine = {
			id: key,
			at: head.at,
			actor: newest.actor,
			request: requests.find((proposal) => proposal.id === newest.proposal_id)?.request ?? null,
			conversationId: own.find((row) => row.conversation_id !== null)?.conversation_id ?? null,
			what: own.slice(0, WHAT_SHOWN).map((row) => named(row.summary, labels)),
			more: Math.max(0, own.length - WHAT_SHOWN),
			where: own.length === 1 && newest.place ? named(newest.place, labels) : null,
			undo: undoOf(own, now),
			delivery: deliveryOf(deliveries.filter((delivery) => ids.has(delivery.activity_id))),
		};
		return [{ line, rows: own }];
	});
}

/** The entry the log is filtered by: every language of it, and what the chip calls it. */
async function entryFilter(db: Db, id: string): Promise<{ ids: string[]; title: string }> {
	const entry = await db
		.selectFrom("entries")
		.select(["title", "translation_group"])
		.where("id", "=", id)
		.executeTakeFirst();
	if (entry) {
		const group = await db
			.selectFrom("entries")
			.select("id")
			.where("translation_group", "=", entry.translation_group)
			.execute();
		return { ids: group.map((row) => row.id), title: entry.title };
	}
	// Deleted for good: the log still has its lines, and the newest of them knows what it was called.
	const { rows } = await sql<{ targets: LoggedRecord[] }>`select targets from monti_activity
		where targets @> ${JSON.stringify([{ kind: "entry", id }])}::jsonb order by "at" desc, seq desc limit 1`.execute(
		db,
	);
	const logged = rows[0]?.targets.find((record) => record.kind === "entry" && record.id === id);
	return { ids: [id], title: logged?.title ?? "" };
}

export async function listActivity(
	db: Db,
	query: ActivityQuery,
	options: { now: Date; receivers: boolean },
): Promise<ActivityList> {
	const entry = query.entry === undefined ? null : await entryFilter(db, query.entry);
	// A page walks the heads, one row a line, in the order they were written, and asks each what its line holds: nothing groups the history.
	// A line shows when it meets every condition; a condition is met by any of the line's rows.
	const ofLine = (condition: ReturnType<typeof sql>) =>
		sql`exists (select 1 from monti_activity r where r.line = h.id and r.listed and ${condition})`;
	const conditions = [
		sql`h.listed and h.id = h.line`,
		query.asOf === undefined ? null : sql`h.seq <= ${query.asOf}`,
		query.kind === undefined
			? null
			: query.kind === "assistant"
				? sql`h.conversation_id is not null`
				: ofLine(sql`r.kind = ${query.kind}`),
		query.delivery === undefined
			? null
			: sql`exists (select 1 from monti_delivery d join monti_activity r on r.id = d.activity_id
				where r.line = h.id and r.listed and d.state = ${query.delivery})`,
		entry === null
			? null
			: ofLine(
					sql`(${sql.join(
						entry.ids.map((id) => sql`r.targets @> ${JSON.stringify([{ kind: "entry", id }])}::jsonb`),
						sql` or `,
					)})`,
				),
	].filter((condition) => condition !== null);
	const where = sql.join(conditions, sql` and `);
	const page = await sql<{ line: string }>`select h.id as line from monti_activity h where ${where}
		order by h.seq desc limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`.execute(db);
	const total = await sql<{ count: string }>`select count(*) as count from monti_activity h where ${where}`.execute(db);
	const newest = await sql<{ seq: string | null }>`select max(seq) as seq from monti_activity h
		where h.listed and h.id = h.line`.execute(db);
	const states = await db
		.selectFrom("monti_delivery")
		.select(["state", (eb) => eb.fn.countAll<string>().as("count")])
		.groupBy("state")
		.execute();
	const deliveryCounts = Object.fromEntries(
		DELIVERY_STATES.map((state) => [state, Number(states.find((row) => row.state === state)?.count ?? 0)]),
	) as Record<DeliveryState, number>;
	return {
		lines: (
			await linesOf(
				db,
				page.rows.map((row) => row.line),
				options.now,
			)
		).map(({ line }) => line),
		total: Number(total.rows[0]?.count ?? 0),
		asOf: query.asOf ?? String(newest.rows[0]?.seq ?? 0),
		deliveries: options.receivers || states.length > 0,
		deliveryCounts,
		entry: entry && query.entry !== undefined ? { id: query.entry, title: entry.title } : null,
	};
}

export async function getActivity(db: Db, id: string, now: Date): Promise<ActivityDetail> {
	const [found] = await linesOf(db, [id], now);
	if (!found) throw new CheckError({ key: "activity.unknown" });
	// Each record once, as the line's newest write left it.
	const logged = [
		...new Map(
			[...found.rows]
				.reverse()
				.flatMap((row) => row.targets)
				.filter((record) => record.title !== undefined)
				.map((record) => [recordKey(record), record]),
		).values(),
	].reverse();
	const shown = logged.slice(0, RECORDS_SHOWN);
	const idsOf = (kind: string) => shown.filter((record) => record.kind === kind).map((record) => record.id);
	const here = new Set<string>();
	for (const [kind, table] of [
		["entry", "entries"],
		["media", "media"],
		["folder", "folders"],
		["template", "templates"],
	] as const) {
		const ids = idsOf(kind);
		if (ids.length === 0) continue;
		for (const row of await db.selectFrom(table).select("id").where("id", "in", ids).execute())
			here.add(recordKey({ kind, id: row.id }));
	}
	const deliveries = await db
		.selectFrom("monti_delivery")
		.select(["id", "destination", "event", "state", "attempts", "last_error", "next_attempt_at"])
		.where(
			"activity_id",
			"in",
			found.rows.map((row) => row.id),
		)
		.orderBy("created_at")
		.orderBy("destination")
		.execute();
	const labels = await collectionLabels(db);
	return {
		...found.line,
		writes: found.rows.map((row) => named(row.summary, labels)),
		records: shown.map((record) => ({
			...record,
			exists: here.has(recordKey(record)),
			address: record.address ?? null,
		})),
		recordCount: logged.length,
		deliveries: deliveries.map((delivery) => ({
			id: delivery.id,
			destination: delivery.destination,
			event: delivery.event.type,
			state: delivery.state,
			attempts: delivery.attempts,
			lastError: delivery.last_error,
			nextAttemptAt: delivery.state === "failed" ? delivery.next_attempt_at : null,
		})),
	};
}
