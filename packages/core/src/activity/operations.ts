import { z } from "zod";
import {
	cancelDelivery,
	failedDeliveryCount,
	resetFailedDeliveries,
	sendDeliveries,
	sentAgain,
} from "../engine/deliveries";
import type { Engine } from "../engine/execute";
import { planUndo, undoWithEvents } from "../engine/undo";
import { type AnyOperation, defineOperation, type Preview } from "../operation";
import { keepSeenTracked } from "../schema/apply";
import { ActivityQuery, getActivity, listActivity } from "./list";

/** What `deliveries.counts` answers: how many deliveries are failed, and since when (the oldest of them). */
export type DeliveryCounts = { failed: number; since: Date | null };

/** What sending again came to: how many arrived and how many failed again. */
export type DeliveriesRetried = { ids: string[]; sent: number; failed: number };

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
				"The activity log, newest first: every write as a line with what was done and where, who did it, whether it can be undone and how its deliveries went. The assistant's work is one line per request. Filter by kind (the assistant's work, saves, publishing, the trash, imports, settings, media), by a delivery state, or by one entry. Use it to answer what changed and when.",
			input: ActivityQuery,
			run: (input, ctx) => listActivity(ctx.db, input, { now: ctx.now(), receivers: engine.receivers.length > 0 }),
		}),
		defineOperation({
			name: "activity.get",
			kind: "read",
			description:
				"One line of the activity log with its details: the records it touched as they were then, and each delivery with its receiver, state, tries and last error.",
			input: z.object({ id: z.string() }),
			run: (input, ctx) => getActivity(ctx.db, ctx.site.schema(), input.id, ctx.now()),
		}),
		defineOperation({
			name: "activity.undo",
			kind: "write",
			// The line it undoes says "undone" with when; a line of its own would say it twice.
			log: false,
			description:
				"Undo a line of the activity log: one write, or every write applied from one request of the assistant's (give the line's id). Records changed since are skipped, never overwritten; the preview says which. Works for 30 days. When it changes what the site shows, the site is told.",
			input: z.object({ id: z.string() }),
			preview: async (input, ctx): Promise<Preview> => {
				const plan = await planUndo(engine, ctx.db, input.id);
				return {
					summary: { key: "activity.undo", values: { count: plan.restore.length } },
					changes: plan.restore,
					blocked: plan.skip.map((ref) => ({ ref, reason: { key: "activity.changedSince" } })),
				};
			},
			async run(input, ctx) {
				// An undo that changes what the site shows (a publish taken back, a thrown-away entry put back) tells the site, as the write did (T29).
				// The deliveries show on the line that was undone: this write has no line of its own.
				const output = await undoWithEvents(engine, ctx.db, input.id, (event, undone) =>
					ctx.emit(event, { activity: undone }),
				);
				// What an entry saw back then may be of a field that has since left the schema.
				await keepSeenTracked(ctx.db, ctx.site.schema());
				return output;
			},
			summary: (_input, output) => ({ key: "activity.undo", values: { count: output.restore.length } }),
		}),
		defineOperation({
			name: "deliveries.retry",
			kind: "write",
			log: false,
			description:
				"Send failed deliveries again now: the ones named by `ids` (a line's `delivery.failedIds`, or one delivery of activity.get), or with `all` every failed one. The tries are counted from the start, so automatic retries follow again if it fails. The answer says how many arrived and how many failed again.",
			input: z.union([z.object({ ids: z.array(z.string()).min(1) }), z.object({ all: z.literal(true) })]),
			async run(input, ctx): Promise<DeliveriesRetried> {
				return {
					ids: await resetFailedDeliveries(ctx.db, "ids" in input ? input.ids : "all", ctx.now()),
					sent: 0,
					failed: 0,
				};
			},
			// Sent once the reset has committed, and waited for: the person who pressed it reads how it went.
			async afterCommit(output) {
				await sendDeliveries(engine.db, engine.receivers, output.ids, engine.now);
				return { ids: output.ids, ...(await sentAgain(engine.db, output.ids)) };
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
			run: (input, ctx) => cancelDelivery(ctx.db, input.id),
			summary: (_input, output) => ({ key: "deliveries.cancel", values: { destination: output.destination } }),
		}),
		defineOperation({
			name: "deliveries.counts",
			kind: "read",
			description:
				"How many deliveries are failed, and since when. The sidebar's tools row, the activity tab and the banner over the log show this number.",
			input: z.object({}),
			async run(_input, ctx): Promise<DeliveryCounts> {
				const oldest = await ctx.db
					.selectFrom("monti_delivery")
					.select("created_at")
					.where("state", "=", "failed")
					.orderBy("created_at")
					.limit(1)
					.executeTakeFirst();
				return { failed: await failedDeliveryCount(ctx.db), since: oldest?.created_at ?? null };
			},
		}),
	];
}
