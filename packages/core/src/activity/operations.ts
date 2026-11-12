import { z } from "zod";
import { randomUUID } from "../bytes";
import { cancelDelivery, deliveryCounts, reserveFailedDeliveries, sendDeliveries } from "../engine/deliveries";
import type { Engine } from "../engine/execute";
import { lockProposals, markReverted, proposalsOfWrites } from "../engine/proposals";
import { planUndo, type UndoOf, undoWithEvents } from "../engine/undo";
import { CheckError, ForbiddenError } from "../errors";
import { type AnyOperation, defineOperation, type Preview } from "../operation";
import { ACTIVITY_FACETS, ActivityQuery, activityFacets, getActivity, listActivity } from "./list";

/**
 * What `deliveries.counts` answers: how many deliveries are failed, since when (the oldest of them), and how many a "send again" is sending at this
 * moment (the banner says "sending…" while there are some, in another tab or after a reload too).
 */
export type DeliveryCounts = { failed: number; since: Date | null; sending: number };

/**
 * What one step of sending again came to: the deliveries it took, how many arrived and how many failed again, and how many of the run are left.
 * While `remaining` is above zero, ask again with the same `run`: each step takes a batch, so no step outlasts a request, and what a step sent stays
 * sent whether or not the next one is asked for.
 */
export type DeliveriesRetried = { ids: string[]; sent: number; failed: number; remaining: number; run: string };

/** What the undo takes back: a line of the log, or every write applied from a proposal. */
const Undo = z.union([z.object({ id: z.string() }), z.object({ proposal: z.string() })]);
const undoOf = (input: z.infer<typeof Undo>): UndoOf =>
	"id" in input ? { line: input.id } : { proposal: input.proposal };

/**
 * The activity log and the deliveries (doc 13). They are made with the engine, not a plain list: undo reads the snapshots, and sending again sends
 * with the site's receivers.
 */
export function activityOperations(engine: Engine): AnyOperation[] {
	return [
		defineOperation({
			name: "activity.list",
			kind: "read",
			description:
				"The activity log, newest first (or oldest first): every write as a line with what was done and where, who did it, whether it can be undone and how its deliveries went. The writes one application of the assistant's proposal made are one line. Search by the words of a title or of the assistant's request; filter by kinds (the assistant's work, saves, publishing, the trash, imports, settings, media), by delivery states, by days, or by one entry. Use it to answer what changed and when.",
			input: ActivityQuery,
			run: (input, ctx) => listActivity(ctx.db, input, { now: ctx.now(), receivers: engine.receivers.length > 0 }),
		}),
		defineOperation({
			name: "activity.facets",
			kind: "read",
			description:
				"For one column of an activity.list query (`kind`: the assistant's work and the kinds of writes; `delivery`: the delivery states): each value with its count, the query's other conditions applied. A kind counts lines; a delivery state counts deliveries, as deliveries.counts does.",
			input: ActivityQuery.extend({ column: z.enum(ACTIVITY_FACETS) }),
			run: async (input, ctx) => ({ values: await activityFacets(ctx.db, input, input.column, ctx.now()) }),
		}),
		defineOperation({
			name: "activity.get",
			kind: "read",
			description:
				"One line of the activity log with its details: the records it touched as they were then, and each delivery with its receiver's name, state, tries and why its last try failed.",
			input: z.object({ id: z.string() }),
			run: (input, ctx) => getActivity(ctx.db, input.id, ctx.now(), engine.receivers),
		}),
		defineOperation({
			name: "activity.undo",
			kind: "write",
			// The line it undoes says "undone" with when; a line of its own would say it twice.
			log: false,
			description:
				"Undo a line of the activity log (`id`: one write, or the writes one application of the assistant's proposal made), or every write applied from a proposal (`proposal`). Each record goes back to what it was before the newest of those writes that can still be taken back; a record someone wrote since is left alone, never overwritten, and the preview says which. Works for 30 days. When it changes what the site shows, the site is told.",
			input: Undo,
			preview: async (input, ctx): Promise<Preview> => {
				const plan = await planUndo(engine, ctx.db, undoOf(input));
				return {
					summary: { key: "activity.undo", values: { count: plan.restore.length } },
					changes: plan.restore,
					blocked: plan.skip.map((ref) => ({ ref, reason: { key: "activity.changedSince" } })),
				};
			},
			async run(input, ctx) {
				// An undo that changes what the site shows (a publish taken back, a thrown-away entry put back) tells the site, as the write did (T29).
				// The deliveries show on the line that was undone: this write has no line of its own.
				// The rows of the proposals these writes came from are taken first, before the activity rows and the records (the engine's order).
				const of = undoOf(input);
				await lockProposals(ctx.db, { proposals: await proposalsOfWrites(ctx.db, of) });
				const done = await undoWithEvents(engine, ctx.db, of, (event, undone) => ctx.emit(event, { activity: undone }));
				// A write an applied proposal item made is that item's: undone here, the item is put back, as "revert all" would have said.
				await markReverted(ctx.db, done.undone);
				return done;
			},
			summary: (_input, output) => ({ key: "activity.undo", values: { count: output.restore.length } }),
		}),
		defineOperation({
			name: "deliveries.retry",
			kind: "write",
			log: false,
			description:
				"Send failed deliveries again now: the ones named by `ids` (a line's `delivery.failedIds`, or one delivery of activity.get), or with `all` every failed one (only a person sends all; the assistant names ids). The tries are counted from the start, so automatic retries follow again if it fails. One call takes a batch and answers how many arrived, how many failed again and how many are left (`remaining`); while some are left, call again with the `run` it answered.",
			input: z.union([
				z.object({ ids: z.array(z.string()).min(1), run: z.iso.datetime().optional() }),
				z.object({ all: z.literal(true), run: z.iso.datetime().optional() }),
			]),
			// A delivery that is not there is refused before anything is reserved, and before the assistant can propose it.
			async check(input, ctx) {
				// Every failed delivery at once is a person's to send: as a proposal's item it would run one batch and stop.
				if (!("ids" in input)) {
					if (ctx.actor === "assistant")
						throw new ForbiddenError({ key: "errors.humanOnly", values: { operation: "deliveries.retry" } });
					return;
				}
				const known = await ctx.db.selectFrom("monti_delivery").select("id").where("id", "in", input.ids).execute();
				if (known.length < new Set(input.ids).size) throw new CheckError({ key: "deliveries.unknown" });
			},
			async run(input, ctx): Promise<DeliveriesRetried & { holder?: string }> {
				// Reserved under a name of this call's own: from the commit on, no scheduled sender takes them before this call sends them.
				const holder = randomUUID();
				const run = input.run === undefined ? ctx.now() : new Date(input.run);
				const reserved = await reserveFailedDeliveries(ctx.db, "ids" in input ? input.ids : "all", {
					now: ctx.now(),
					holder,
					run: input.run === undefined ? null : run,
					// The command line has no Next around it: what only the running site can send is left as it is, as `deliveries:run` leaves it.
					...(ctx.actor === "cli" ? { only: engine.receivers.map((receiver) => receiver.destination) } : {}),
				});
				return { ...reserved, sent: 0, failed: 0, run: run.toISOString(), holder };
			},
			// Sent once the reservation has committed, and waited for: the person who pressed it reads how it went.
			async afterCommit({ holder, ...output }) {
				const { sent, failed } = await sendDeliveries(engine.db, engine.receivers, output.ids, engine.now, { holder });
				return { ...output, sent, failed };
			},
			summary: (_input, output) => ({ key: "deliveries.retry", values: { count: output.ids.length } }),
		}),
		defineOperation({
			name: "deliveries.cancel",
			kind: "write",
			humanOnly: true,
			log: false,
			description:
				"Cancel one delivery: it is not sent again and no longer counts as failed. It cannot be taken back, so only a person does it; it is never an agent tool.",
			input: z.object({ id: z.string() }),
			async run(input, ctx) {
				await cancelDelivery(ctx.db, input.id);
				return { id: input.id };
			},
			summary: () => ({ key: "deliveries.cancel" }),
		}),
		defineOperation({
			name: "deliveries.counts",
			kind: "read",
			description:
				"How many deliveries are failed, since when, and how many are being sent again at this moment. The sidebar's activity row and the banner over the log show the failed number.",
			input: z.object({}),
			run: (_input, ctx): Promise<DeliveryCounts> => deliveryCounts(ctx.db, ctx.now()),
		}),
	];
}
