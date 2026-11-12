import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import type { Database, DeliveryTable } from "../db/schema";
import { deliveryError, type Receiver, receiverName } from "../engine/deliveries";
import { CheckError } from "../errors";
import { ACTIVITY_KINDS, type Actor, type LoggedRecord, type Message, recordKey } from "../operation";
import { DateRange, dateRangeSql, likePattern } from "../query";

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

/**
 * The activity log's query (doc 13): what the screen's search box and column menus hold, and what an agent asks ("what changed yesterday?", "what
 * did the assistant change?"). A line shows when it meets every condition; the values of one condition are any-of, as in every list, and a
 * condition is met by any write of the line.
 */
export const ActivityQuery = z.object({
	/** Words of a title the line touched (an entry, a file, a folder, a template) or of the assistant's request. */
	search: z.string().optional(),
	/** The assistant's work, or kinds of writes. */
	kinds: z.array(z.enum(ACTIVITY_FILTERS)).default([]),
	/** Lines with a delivery in one of these states. A delivery on its way is pending. */
	deliveries: z.array(z.enum(DELIVERY_STATES)).default([]),
	/** Lines that touched this entry, in any of its languages. */
	entry: z.string().optional(),
	/** The days the line began in, counted in `timeZone`. */
	range: DateRange.optional(),
	/** Newest first (`desc`), or oldest first. */
	sort: z.enum(["desc", "asc"]).default("desc"),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(200).default(50),
	/**
	 * Where one browsing of the log stands: the `asOf` a first page answered. Later pages given it leave out the lines that began after that page was
	 * read, so a page starts where the one before it ended while new activity arrives. Left out, the log as it is now.
	 */
	asOf: z.string().regex(/^\d+$/).optional(),
	/**
	 * The page this one is reached from in the same browsing: its number, the places of its first and last lines (`first`, `last` of its
	 * answer) and the browsing's `total`. The page is then read by place, not by counting lines from the top: a line that was being written
	 * when the browsing began and is committed since has an older place than the boundary, and counted from the top it would push every later
	 * line down one, so the next page would begin with this page's last line. Read from the last line's place, nothing repeats; that late
	 * line is on no page of this browsing, as a line that began after it is not. Left out, the page is counted from the top.
	 */
	from: z
		.object({
			page: z.number().int().min(1),
			first: z.string().regex(/^\d+$/),
			last: z.string().regex(/^\d+$/),
			total: z.number().int().min(0),
		})
		.optional(),
	/** The admin's time zone, for "today" and date ranges. */
	timeZone: z.string().default("UTC"),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

/** The columns of the log whose menus filter by value: what was done (its kind) and how its delivery went. */
export const ACTIVITY_FACETS = ["kind", "delivery"] as const;
export type ActivityFacet = (typeof ACTIVITY_FACETS)[number];

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
	/**
	 * How many lines the browsing has: counted when its first page is read, and the same number on every page reached from it (`from`), so the
	 * count under the list does not move while a person pages. A new browsing counts again.
	 */
	total: number;
	/** The places of this page's first and last lines, to reach another page from it (`from`); `null` on a page with no line. */
	first: string | null;
	last: string | null;
	/** The newest line there was when this was read: pass it with the next pages of the same browsing. */
	asOf: string;
	/** Whether the log shows deliveries at all: the site has a receiver, or once had one whose deliveries are still here. */
	deliveries: boolean;
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
	/** The receiver's name as a person reads it: its label, or a webhook's host and path. Never the stored destination, which may carry a token. */
	receiver: string | Message;
	/** The event's type: `entry.published`. */
	event: string;
	/** The event's id, the same on every try and for every receiver: what a webhook gets as `Monti-Event-Id` (and `id` in the body). */
	eventId: string;
	state: DeliveryState;
	attempts: number;
	/** Why its last try failed: the receiver's answer, no answer, or no such receiver any more. */
	lastError: Message | null;
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
	/** What the write touched, each with what it was called. Read for a line's details only: a bulk write keeps one for every record. */
	targets?: LoggedRecord[];
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

/**
 * The lines of these keys, each from its rows (newest first), in the keys' order. `records` reads what each write touched too, for a line's
 * details; a list never does (a page of bulk writes would carry every record of each).
 */
async function linesOf(
	db: Db,
	keys: string[],
	now: Date,
	{ records = false }: { records?: boolean } = {},
): Promise<{ line: ActivityLine; rows: Row[] }[]> {
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
			"conversation_id",
			"proposal_id",
			"undo_until",
			"undone_at",
		])
		.$if(records, (query) => query.select("targets"))
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

type Condition = ReturnType<typeof sql>;

/**
 * The conditions of a query on the lines' heads (`h`). A page walks the heads, one row a line, in the order they were written, and asks each what
 * its line holds: nothing groups the history. `skip` leaves one column's own values out, for that column's counts.
 */
function conditionsOf(
	query: ActivityQuery,
	entry: { ids: string[] } | null,
	now: Date,
	skip?: ActivityFacet,
): Condition {
	const ofLine = (condition: Condition) =>
		sql`exists (select 1 from monti_activity r where r.line = h.id and r.listed and ${condition})`;
	const sentIn = (states: readonly string[]) =>
		sql`exists (select 1 from monti_delivery d join monti_activity r on r.id = d.activity_id
			where r.line = h.id and r.listed and d.state in (${sql.join(states.map((state) => sql`${state}`))}))`;
	const kinds = query.kinds.filter((kind) => kind !== "assistant");
	const words = query.search?.trim() ?? "";
	const conditions = [
		sql`h.listed and h.id = h.line`,
		query.asOf === undefined ? null : sql`h.seq <= ${query.asOf}`,
		query.kinds.length === 0 || skip === "kind"
			? null
			: sql`(${sql.join(
					[
						...(query.kinds.includes("assistant") ? [sql`h.conversation_id is not null`] : []),
						...(kinds.length > 0 ? [ofLine(sql`r.kind in (${sql.join(kinds.map((kind) => sql`${kind}`))})`)] : []),
					],
					sql` or `,
				)})`,
		query.deliveries.length === 0 || skip === "delivery" ? null : sentIn(query.deliveries),
		query.range === undefined ? null : dateRangeSql(sql`h."at"`, query.range, query.timeZone, now),
		words === "" ? null : ofLine(sql`r.words ilike ${likePattern(words)}`),
		entry === null
			? null
			: ofLine(
					sql`(${sql.join(
						entry.ids.map((id) => sql`r.targets @> ${JSON.stringify([{ kind: "entry", id }])}::jsonb`),
						sql` or `,
					)})`,
				),
	].filter((condition) => condition !== null);
	return sql.join(conditions, sql` and `);
}

/**
 * One page of line heads under `where`, in the order shown (`newestFirst`, or oldest first). Reached from another page of the browsing
 * (`query.from`), it is read from that page's edge: the lines after its last one going on, the lines before its first one going back, as many
 * pages away as the two numbers say. Without `from` it is counted from the top.
 */
async function readPage(
	db: Db,
	where: Condition,
	query: Pick<ActivityQuery, "page" | "pageSize" | "from">,
	newestFirst: boolean,
): Promise<{ line: string; seq: string }[]> {
	const { page, pageSize, from } = query;
	const read = async (edge: Condition | null, forward: boolean, skip: number) => {
		// Forward is the order shown; backward reads the other way from the edge and is turned round.
		const descending = forward === newestFirst;
		const { rows } = await sql<{
			line: string;
			seq: string;
		}>`select h.id as line, h.seq::text as seq from monti_activity h
			where ${edge === null ? where : sql`${where} and ${edge}`}
			order by h.seq ${descending ? sql`desc` : sql`asc`} limit ${pageSize} offset ${skip * pageSize}`.execute(db);
		return forward ? rows : rows.reverse();
	};
	if (!from) return read(null, true, page - 1);
	const after = (seq: string) => (newestFirst ? sql`h.seq < ${seq}` : sql`h.seq > ${seq}`);
	const before = (seq: string) => (newestFirst ? sql`h.seq > ${seq}` : sql`h.seq < ${seq}`);
	if (page > from.page) return read(after(from.last), true, page - from.page - 1);
	if (page < from.page) return read(before(from.first), false, from.page - page - 1);
	// The same page again: from its own first line on.
	return read(sql`not (${before(from.first)})`, true, 0);
}

export async function listActivity(
	db: Db,
	query: ActivityQuery,
	options: {
		now: Date;
		receivers: boolean;
		/** For tests: runs once the boundary is read and before the page is, where a write of another request can fall. */
		afterBoundary?: () => Promise<void>;
	},
): Promise<ActivityList> {
	const entry = query.entry === undefined ? null : await entryFilter(db, query.entry);
	// Where this browsing stands is read before its first page, and bounds that page too: a line committed between the two readings is on no
	// page of this browsing, rather than inside the boundary and missing from page 1 (page 2 would then repeat page 1's last line).
	const asOf =
		query.asOf ??
		String(
			(
				await sql<{ seq: string | null }>`select max(seq) as seq from monti_activity h
					where h.listed and h.id = h.line`.execute(db)
			).rows[0]?.seq ?? 0,
		);
	await options.afterBoundary?.();
	const where = conditionsOf({ ...query, asOf }, entry, options.now);
	const page = await readPage(db, where, query, query.sort !== "asc");
	// Counted once for a browsing: a page reached from another answers the number that one had.
	const total =
		query.from?.total ??
		Number(
			(await sql<{ count: string }>`select count(*) as count from monti_activity h where ${where}`.execute(db)).rows[0]
				?.count ?? 0,
		);
	const any = await db.selectFrom("monti_delivery").select("id").limit(1).executeTakeFirst();
	return {
		lines: (
			await linesOf(
				db,
				page.map((row) => row.line),
				options.now,
			)
		).map(({ line }) => line),
		total,
		first: page[0]?.seq ?? null,
		last: page.at(-1)?.seq ?? null,
		asOf,
		deliveries: options.receivers || any !== undefined,
		entry: entry && query.entry !== undefined ? { id: query.entry, title: entry.title } : null,
	};
}

/**
 * For one column of a log query: each of its values with its count, the other columns' conditions applied and its own not. It is what the
 * column's menu shows, read when the menu opens, as a list's menus read theirs (`entries.facets`). A kind counts lines. A delivery state counts
 * deliveries, as the sidebar and the banner do (doc 13, 13-4): one publish that two receivers did not get is two failed, on one line.
 */
export async function activityFacets(
	db: Db,
	query: ActivityQuery,
	column: ActivityFacet,
	now: Date,
): Promise<{ value: string; count: number }[]> {
	const entry = query.entry === undefined ? null : await entryFilter(db, query.entry);
	const where = conditionsOf(query, entry, now, column);
	if (column === "delivery") {
		const counted = await sql<{ state: string; count: string }>`select d.state, count(*) as count from monti_activity h
			join monti_activity r on r.line = h.id and r.listed
			join monti_delivery d on d.activity_id = r.id
			where ${where} group by d.state`.execute(db);
		return DELIVERY_STATES.map((value) => ({
			value,
			count: Number(counted.rows.find((row) => row.state === value)?.count ?? 0),
		}));
	}
	const values: readonly string[] = ACTIVITY_FILTERS;
	const has = (value: string): Condition =>
		value === "assistant"
			? sql`h.conversation_id is not null`
			: sql`exists (select 1 from monti_activity r where r.line = h.id and r.listed and r.kind = ${value})`;
	const { rows } = await sql<Record<string, string>>`select ${sql.join(
		values.map((value, index) => sql`count(*) filter (where ${has(value)}) as ${sql.ref(`value_${index}`)}`),
	)} from monti_activity h where ${where}`.execute(db);
	return values.map((value, index) => ({ value, count: Number(rows[0]?.[`value_${index}`] ?? 0) }));
}

export async function getActivity(
	db: Db,
	id: string,
	now: Date,
	receivers: readonly Receiver[],
): Promise<ActivityDetail> {
	const [found] = await linesOf(db, [id], now, { records: true });
	if (!found) throw new CheckError({ key: "activity.unknown" });
	// Each record once, as the line's newest write left it.
	const logged = [
		...new Map(
			[...found.rows]
				.reverse()
				.flatMap((row) => row.targets ?? [])
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
			receiver: receiverName(delivery.destination, receivers),
			event: delivery.event.type,
			eventId: delivery.event.id,
			state: delivery.state,
			attempts: delivery.attempts,
			lastError: deliveryError(delivery.last_error),
			nextAttemptAt: delivery.state === "failed" ? delivery.next_attempt_at : null,
		})),
	};
}
