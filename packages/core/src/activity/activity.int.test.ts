import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import {
	RETRY_BATCH,
	RETRY_MINUTES,
	type Receiver,
	ReceiverAnswer,
	reserveFailedDeliveries,
	SEND_TIMEOUT_MS,
	sendDeliveries,
	webhook,
} from "../engine/deliveries";
import type { UndoPlan } from "../engine/undo";
import { createReader } from "../entries/reader";
import { ForbiddenError } from "../errors";
import { coreMessages, formatMessage } from "../messages";
import { createMonti, type MontiOptions } from "../monti";
import type { Message, MontiEvent } from "../operation";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { ActivityDetail, ActivityLine, ActivityList } from "./list";
import type { DeliveriesRetried, DeliveryCounts } from "./operations";

const db = await testDatabase();

const schema = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
		],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text" },
			},
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const MINUTE = 60_000;
const DAY = 86_400_000;
const START = new Date("2026-10-26T10:00:00Z");
let clock = START;
const later = (ms: number) => {
	clock = new Date(clock.getTime() + ms);
};

const SITE = "webhook:https://site.test/revalidate";
const SEARCH = "plugin:search";
/** What arrived, and which receivers are down. */
const sent: { destination: string; event: MontiEvent }[] = [];
const down = new Set<string>();
const receiver = (destination: string): Receiver => ({
	destination,
	async send(event) {
		if (down.has(destination)) throw new ReceiverAnswer("503");
		sent.push({ destination, event });
	},
});

const site = (options: Partial<MontiOptions> = {}) =>
	createMonti({ db, schema, now: () => clock, receivers: [receiver(SITE)], ...options });

type Written<Output> = { output: Output; activityId: string; versions: Record<string, number | null> };
const write = async <Output = { id: string }>(name: string, input: unknown, monti = site()) =>
	(await monti.run(name, input, { actor: "admin" })) as Written<Output>;
const read = <Output>(name: string, input: unknown = {}, monti = site()) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

const list = (input: unknown = {}, monti = site()) => read<ActivityList>("activity.list", input, monti);
const detail = (id: string, monti = site()) => read<ActivityDetail>("activity.get", { id }, monti);
/** A column menu's counts: each value with how many lines it would show. */
const facet = async (column: "kind" | "delivery", query: object = {}, monti = site()) =>
	Object.fromEntries(
		(
			await read<{ values: { value: string; count: number }[] }>("activity.facets", { ...query, column }, monti)
		).values.map((each) => [each.value, each.count]),
	);
const failedCount = async (monti = site()) => (await read<DeliveryCounts>("deliveries.counts", {}, monti)).failed;
const ko = (message: Message | null) => (message ? formatMessage([coreMessages], "ko", message) : null);
/** A line as a person reads it: what was done, then where. */
const said = (line: ActivityLine) => [line.what.map(ko).join(" · "), ko(line.where)];
const deliveries = () => db.selectFrom("monti_delivery").selectAll().orderBy("created_at").orderBy("id").execute();
const versionOf = async (id: string) =>
	(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;

async function newPost(title: string, slug: string, monti = site()) {
	return (await write("entries.create", { collection: "post", title, slug }, monti)).output.id;
}
const publish = (ids: string[], monti = site()) => write<{ published: string[] }>("entries.publish", { ids }, monti);
const save = async (id: string, values: Record<string, unknown>, monti = site()) =>
	write("entries.save", { id, version: await versionOf(id), ...values }, monti);
/** What the site shows at a post's address, or `null` when nothing is there. */
const fromSite = async (slug: string) => {
	const found = await createReader({ db, schema, now: () => clock }).entry({ collection: "post", locale: "ko", slug });
	return found && "entry" in found ? found.entry : null;
};

beforeEach(async () => {
	clock = START;
	sent.length = 0;
	down.clear();
	await sql`drop view if exists monti_post, monti_tag`.execute(db);
	for (const table of [
		"monti_delivery",
		"monti_activity",
		"monti_proposal",
		"entries",
		"reserved_paths",
		"old_paths",
		"folders",
		"schema_state",
		"schema_changes",
		"collection_admin_values",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("sending", () => {
	it("13-1 a delivery that fails is failed at once, tried again by itself eight times at growing waits, and stays failed after the last", async () => {
		const monti = site();
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		// Failed from the first try: the count does not wait for the retries to run out (principle 3).
		let [delivery] = await deliveries();
		expect(delivery).toMatchObject({ state: "failed", attempts: 1, last_error: "status:503" });
		expect(delivery.next_attempt_at).toEqual(new Date(clock.getTime() + RETRY_MINUTES[0] * MINUTE));
		expect(await failedCount(monti)).toBe(1);

		for (const [index, minutes] of RETRY_MINUTES.entries()) {
			// Before its time nothing is tried.
			await monti.deliveries.sendDue();
			expect((await deliveries())[0].attempts).toBe(index + 1);
			later(minutes * MINUTE);
			await monti.deliveries.sendDue();
			expect((await deliveries())[0].attempts).toBe(index + 2);
		}
		[delivery] = await deliveries();
		expect(delivery).toMatchObject({ state: "failed", attempts: RETRY_MINUTES.length + 1, next_attempt_at: null });

		// The retries are used up: it is not tried again, however long it waits.
		later(30 * DAY);
		await monti.deliveries.sendDue();
		expect((await deliveries())[0].attempts).toBe(RETRY_MINUTES.length + 1);
		expect(sent).toEqual([]);
		expect(await failedCount(monti)).toBe(1);
	});

	it("13-1 a retry that gets through is sent once, and two senders at the same moment send it once", async () => {
		const slow: Receiver = {
			destination: SITE,
			async send(event) {
				if (down.has(SITE)) throw new ReceiverAnswer("503");
				// Long enough for the second sender to reach the same delivery.
				await new Promise((resume) => setTimeout(resume, 30));
				sent.push({ destination: SITE, event });
			},
		};
		const monti = site({ receivers: [slow] });
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		down.clear();
		later(RETRY_MINUTES[0] * MINUTE);
		await Promise.all([monti.deliveries.sendDue(), monti.deliveries.sendDue(), monti.deliveries.sendDue()]);
		await monti.deliveries.sendDue();
		expect(sent).toHaveLength(1);
		expect((await deliveries())[0]).toMatchObject({
			state: "sent",
			attempts: 2,
			last_error: null,
			next_attempt_at: null,
		});
		expect(await failedCount(monti)).toBe(0);
	});

	it("13-1 a sender that comes late to a delivery another has just tried leaves it until its next time", async () => {
		const monti = site();
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		const [failed] = await deliveries();
		// Both read it as due; the first tried it and it failed again, so it is due later. The second, arriving now, does not try it early.
		later(RETRY_MINUTES[0] * MINUTE);
		await sendDeliveries(db, [receiver(SITE)], [failed.id], () => clock, { due: true });
		await sendDeliveries(db, [receiver(SITE)], [failed.id], () => clock, { due: true });
		expect((await deliveries())[0]).toMatchObject({ state: "failed", attempts: 2 });
	});

	it("13-1 a delivery canceled while it is on its way stays canceled, even when it arrives", async () => {
		let open!: () => void;
		let reached!: () => void;
		const calling = new Promise<void>((resolve) => {
			reached = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		let hold = false;
		const gated: Receiver = {
			destination: SITE,
			async send(event) {
				if (down.has(SITE)) throw new ReceiverAnswer("503");
				if (hold) {
					reached();
					await gate;
				}
				sent.push({ destination: SITE, event });
			},
		};
		const monti = site({ receivers: [gated] });
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		down.clear();
		hold = true;
		later(RETRY_MINUTES[0] * MINUTE);
		const sending = monti.deliveries.sendDue();
		await calling;
		const [onItsWay] = await deliveries();
		await write("deliveries.cancel", { id: onItsWay.id }, monti);
		open();
		await sending;
		expect((await deliveries())[0]).toMatchObject({ state: "canceled", attempts: 1 });
		expect(await failedCount(monti)).toBe(0);
	});

	it("13-1 a receiver that does not answer is given up on after the time limit, so a save is not held by it", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		let reached!: () => void;
		const calling = new Promise<void>((resolve) => {
			reached = resolve;
		});
		let aborted = false;
		const silent: Receiver = {
			destination: "webhook:https://silent.test",
			send: (_event, signal) =>
				new Promise(() => {
					signal.addEventListener("abort", () => {
						aborted = true;
					});
					reached();
				}),
		};
		const monti = site({ receivers: [silent] });
		const writing = newPost("첫 번째 글", "first-post", monti);
		await calling;
		vi.advanceTimersByTime(SEND_TIMEOUT_MS);
		await writing;
		expect((await deliveries())[0]).toMatchObject({
			state: "failed",
			attempts: 1,
			last_error: "noAnswer",
		});
		expect(aborted).toBe(true);
	});

	it("13-1 a webhook posts the event as JSON to its address, and any answer but a 2xx is a failure", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		let status = 200;
		const hook = webhook("https://site.test/api/revalidate", {
			events: ["entry.published"],
			headers: { authorization: "Bearer token" },
			fetch: async (url, init) => {
				calls.push({ url: String(url), init: init ?? {} });
				return new Response(null, { status, statusText: status === 200 ? "OK" : "Service Unavailable" });
			},
		});
		const monti = site({ receivers: [hook] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		// It asked for published entries only: a save queues nothing for it.
		expect(await deliveries()).toEqual([]);

		await publish([id], monti);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe("https://site.test/api/revalidate");
		expect(calls[0].init.method).toBe("POST");
		expect(calls[0].init.headers).toMatchObject({ "content-type": "application/json", authorization: "Bearer token" });
		expect(JSON.parse(String(calls[0].init.body))).toEqual({
			id: expect.any(String),
			type: "entry.published",
			at: clock.toISOString(),
			ids: [id],
			collection: "post",
			locale: "ko",
			version: 2,
			paths: ["/posts/first-post"],
		});
		expect((await deliveries())[0]).toMatchObject({
			destination: "webhook:https://site.test/api/revalidate",
			state: "sent",
		});

		status = 503;
		later(MINUTE);
		await save(id, { title: "고친 글" }, monti);
		await publish([id], monti);
		expect((await deliveries())[1]).toMatchObject({ state: "failed", last_error: "status:503 Service Unavailable" });

		// The receiver may have handled it and lost its answer: the next try says it is the same event and the same delivery, in the body and in
		// headers, so the receiver can tell and leave it.
		status = 200;
		later(RETRY_MINUTES[0] * MINUTE);
		await monti.deliveries.sendDue();
		const [, first, again] = calls;
		const headers = (call: (typeof calls)[number]) => call.init.headers as Record<string, string>;
		expect(JSON.parse(String(again.init.body)).id).toBe(JSON.parse(String(first.init.body)).id);
		expect(headers(first)["monti-event-id"]).toBe(JSON.parse(String(first.init.body)).id);
		expect(headers(again)["monti-event-id"]).toBe(headers(first)["monti-event-id"]);
		expect(headers(again)["monti-delivery-id"]).toBe(headers(first)["monti-delivery-id"]);
		expect(headers(first)["monti-delivery-id"]).toBe((await deliveries())[1].id);
		expect([headers(first)["monti-attempt"], headers(again)["monti-attempt"]]).toEqual(["1", "2"]);
		// Another event is another id.
		expect(headers(calls[0])["monti-event-id"]).not.toBe(headers(first)["monti-event-id"]);
	});

	it("13-1 one event has one id for every receiver, and each receiver's delivery has its own", async () => {
		const got: { destination: string; event: string; delivery: string; attempt: number }[] = [];
		const telling = (destination: string): Receiver => ({
			destination,
			async send(event, _signal, delivery) {
				got.push({ destination, event: event.id, delivery: delivery.id, attempt: delivery.attempt });
			},
		});
		const monti = site({ receivers: [telling(SITE), telling(SEARCH)] });
		await newPost("첫 번째 글", "first-post", monti);
		// The two are sent side by side, in no fixed order.
		expect(got.map((each) => each.destination).sort()).toEqual([SEARCH, SITE].sort());
		expect(got[0].event).toBe(got[1].event);
		expect(got[0].delivery).not.toBe(got[1].delivery);
		expect(got.map((each) => each.attempt)).toEqual([1, 1]);
	});

	it("13-1 sending again by hand counts the tries from the start, so the automatic retries follow again (T6)", async () => {
		const monti = site();
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		for (const minutes of RETRY_MINUTES) {
			later(minutes * MINUTE);
			await monti.deliveries.sendDue();
		}
		const [used] = await deliveries();
		expect(used).toMatchObject({ state: "failed", attempts: RETRY_MINUTES.length + 1, next_attempt_at: null });

		// Still down: the try a person asked for is the first of a new count, and the next one is scheduled.
		const again = await write<DeliveriesRetried>("deliveries.retry", { ids: [used.id] }, monti);
		expect(again.output).toMatchObject({ ids: [used.id], sent: 0, failed: 1, remaining: 0 });
		const [counted] = await deliveries();
		expect(counted).toMatchObject({ state: "failed", attempts: 1 });
		expect(counted.next_attempt_at).toEqual(new Date(clock.getTime() + RETRY_MINUTES[0] * MINUTE));

		later(RETRY_MINUTES[0] * MINUTE);
		await monti.deliveries.sendDue();
		expect((await deliveries())[0].attempts).toBe(2);

		down.clear();
		expect((await write<DeliveriesRetried>("deliveries.retry", { ids: [used.id] }, monti)).output).toMatchObject({
			ids: [used.id],
			sent: 1,
			failed: 0,
			remaining: 0,
		});
		expect((await deliveries())[0]).toMatchObject({ state: "sent", attempts: 1, last_error: null });
		expect(sent).toHaveLength(1);
	});

	it("13-1 opening the admin sends what is due without waiting for it, a minute apart at most (T5)", async () => {
		let open!: () => void;
		let gate: Promise<void> = Promise.resolve();
		const gated: Receiver = {
			destination: SITE,
			async send(event) {
				if (down.has(SITE)) throw new ReceiverAnswer("503");
				await gate;
				sent.push({ destination: SITE, event });
			},
		};
		const monti = site({ receivers: [gated] });
		const api = signedInApi(monti);
		const openAdmin = async () => {
			const response = await api(
				new Request("https://site.test/admin/api/operations/frame.counts", {
					method: "POST",
					body: JSON.stringify({ input: {} }),
				}),
			);
			return (await response.json()) as { failedDeliveries: number };
		};
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		down.clear();
		later(RETRY_MINUTES[0] * MINUTE);

		gate = new Promise((resolve) => {
			open = resolve;
		});
		// The frame has its counts while the receiver has not answered yet.
		expect(await openAdmin()).toMatchObject({ failedDeliveries: 1 });
		expect(sent).toEqual([]);
		open();
		await vi.waitFor(async () => expect((await deliveries())[0].state).toBe("sent"));
		expect(sent).toHaveLength(1);
		expect(await openAdmin()).toMatchObject({ failedDeliveries: 0 });

		// Another delivery fails and comes due within the same minute of the admin's clock: the next opening leaves it, the one a minute on sends it.
		down.add(SITE);
		await newPost("두 번째 글", "second-post", monti);
		down.clear();
		await db.updateTable("monti_delivery").set({ next_attempt_at: clock }).where("state", "=", "failed").execute();
		await openAdmin();
		await new Promise((resume) => setTimeout(resume, 50));
		expect((await deliveries()).map((delivery) => delivery.state)).toEqual(["sent", "failed"]);
		later(MINUTE);
		await openAdmin();
		await vi.waitFor(async () => expect((await deliveries())[1].state).toBe("sent"));
	});

	it("13-1 a delivery a person sends again is theirs from that moment: a sender that comes by first leaves it, and it is sent once", async () => {
		const monti = site();
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		down.clear();
		const [failed] = await deliveries();
		// The person's "send again" has reserved it and committed; before it sends, the sweep that an admin's visit starts comes by.
		const reserved = await reserveFailedDeliveries(db, [failed.id], { now: clock, holder: "the-person", run: null });
		expect(reserved).toEqual({ ids: [failed.id], remaining: 0 });
		expect(await monti.deliveries.sendDue()).toEqual({ sent: 0, failed: 0, left: 0 });
		expect(sent).toEqual([]);
		expect((await deliveries())[0]).toMatchObject({ state: "pending", attempts: 0 });
		// While it is reserved the banner can say so, here and in any other tab.
		expect(await read<DeliveryCounts>("deliveries.counts", {}, monti)).toMatchObject({ failed: 0, sending: 1 });
		// The one who reserved it sends it, and reads the result.
		expect(await sendDeliveries(db, [receiver(SITE)], reserved.ids, () => clock, { holder: "the-person" })).toEqual({
			sent: 1,
			failed: 0,
			left: 0,
		});
		expect(sent).toHaveLength(1);
		expect((await deliveries())[0]).toMatchObject({ state: "sent", attempts: 1, held_by: null });
		// A reservation whose holder died lets go by itself.
		down.add(SITE);
		await newPost("두 번째 글", "second-post", monti);
		down.clear();
		const other = (await deliveries()).find((delivery) => delivery.state === "failed");
		if (!other) throw new Error("No failed delivery.");
		await reserveFailedDeliveries(db, [other.id], { now: clock, holder: "gone", run: null });
		later(MINUTE);
		expect(await monti.deliveries.sendDue()).toEqual({ sent: 1, failed: 0, left: 0 });
	});

	it("13-1 sending all again goes a batch at a time, several at once, and tries each delivery once however often it is asked", async () => {
		let together = 0;
		let most = 0;
		const stillDown = new Set<string>();
		const counting: Receiver = {
			destination: SITE,
			async send(event) {
				together += 1;
				most = Math.max(most, together);
				await new Promise((resume) => setTimeout(resume, 15));
				together -= 1;
				if (down.has(SITE) || stillDown.has(event.ids[0])) throw new ReceiverAnswer("503");
				sent.push({ destination: SITE, event });
			},
		};
		const monti = site({ receivers: [counting] });
		down.add(SITE);
		const ids: string[] = [];
		for (let index = 0; index < 23; index++) ids.push(await newPost(`글 ${index}`, `post-${index}`, monti));
		down.clear();
		// Three of them will fail again.
		for (const id of ids.slice(0, 3)) stillDown.add(id);
		most = 0;
		// The run begins a moment after they failed.
		later(MINUTE);

		const steps: DeliveriesRetried[] = [];
		let step = (await write<DeliveriesRetried>("deliveries.retry", { all: true }, monti)).output;
		steps.push(step);
		// What a step sent is sent, whether or not the next step is asked for: nothing is left half-way.
		expect((await deliveries()).filter((delivery) => delivery.state === "pending")).toEqual([]);
		while (step.remaining > 0) {
			step = (await write<DeliveriesRetried>("deliveries.retry", { all: true, run: step.run }, monti)).output;
			steps.push(step);
		}
		expect(steps.map((each) => [each.ids.length, each.remaining])).toEqual([
			[RETRY_BATCH, 13],
			[RETRY_BATCH, 3],
			[3, 0],
		]);
		expect(steps.reduce((sum, each) => sum + each.sent, 0)).toBe(20);
		expect(steps.reduce((sum, each) => sum + each.failed, 0)).toBe(3);
		expect(new Set(steps.map((each) => each.run)).size).toBe(1);
		// Several at once, never more than a batch: a receiver that takes its time holds one place, not the whole step.
		expect(most).toBeGreaterThan(1);
		expect(most).toBeLessThanOrEqual(RETRY_BATCH);
		// The three that failed again were tried once in this run: asking again with the run takes nothing more.
		const more = (await write<DeliveriesRetried>("deliveries.retry", { all: true, run: step.run }, monti)).output;
		expect(more).toMatchObject({ ids: [], sent: 0, failed: 0, remaining: 0 });
		expect(sent).toHaveLength(20);
		expect((await deliveries()).filter((delivery) => delivery.state === "failed").map((each) => each.attempts)).toEqual(
			[1, 1, 1],
		);
		// A new run takes them again.
		stillDown.clear();
		later(MINUTE);
		expect((await write<DeliveriesRetried>("deliveries.retry", { all: true }, monti)).output).toMatchObject({
			sent: 3,
			failed: 0,
			remaining: 0,
		});
	});

	it("13-1 the host keeps the sends an admin's visit starts going after the answer", async () => {
		const kept: Promise<unknown>[] = [];
		const monti = site({ waitUntil: (work) => kept.push(work) });
		const api = signedInApi(monti);
		down.add(SITE);
		await newPost("첫 번째 글", "first-post", monti);
		await Promise.all(kept);
		down.clear();
		later(RETRY_MINUTES[0] * MINUTE);
		kept.length = 0;
		await api(
			new Request("https://site.test/admin/api/operations/frame.counts", {
				method: "POST",
				body: JSON.stringify({ input: {} }),
			}),
		);
		// The sweep was handed to the host, which holds the function open until it ends (the trash's clean-up of the same visit too).
		expect(kept.length).toBeGreaterThan(0);
		await Promise.all(kept);
		expect((await deliveries())[0].state).toBe("sent");
	});

	it("13-1 on a host that sends after its response, the write still waits for a receiver that asks to be done before the answer", async () => {
		const kept: Promise<unknown>[] = [];
		const arrived: string[] = [];
		let open = () => {};
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		// The site's own pages: marked a moment after the send starts, and before the write answers.
		const pages: Receiver = {
			destination: "plugin:next",
			beforeAnswer: true,
			async send() {
				await new Promise((done) => setTimeout(done, 20));
				arrived.push("plugin:next");
			},
		};
		// A webhook that does not answer until the test lets it.
		const slow: Receiver = {
			destination: SITE,
			async send() {
				await gate;
				arrived.push(SITE);
			},
		};
		const monti = site({ receivers: [slow, pages], waitUntil: (work) => kept.push(work) });
		await publish([await newPost("첫 번째 글", "first-post", monti)], monti);
		// The write answered: the pages are marked, and the webhook is still on its way, kept going by the host.
		const statesOf = async (destination: string) =>
			(await deliveries()).filter((delivery) => delivery.destination === destination).map((delivery) => delivery.state);
		const toPages = await statesOf("plugin:next");
		expect(toPages.length).toBeGreaterThan(0);
		expect(new Set(toPages)).toEqual(new Set(["sent"]));
		expect(arrived).toEqual(toPages.map(() => "plugin:next"));
		expect(new Set(await statesOf(SITE))).toEqual(new Set(["pending"]));
		expect(kept.length).toBeGreaterThan(0);
		open();
		await Promise.all(kept);
		expect(new Set(await statesOf(SITE))).toEqual(new Set(["sent"]));
		// Each went once.
		expect(arrived.filter((destination) => destination === "plugin:next")).toHaveLength(toPages.length);
		expect(arrived.filter((destination) => destination === SITE)).toHaveLength(toPages.length);
	});

	it("13-4 one publish two receivers did not get is two failed deliveries on one line: the sidebar's count and the menu's are the same number", async () => {
		const monti = site({ receivers: [receiver(SITE), receiver(SEARCH)] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		down.add(SITE);
		down.add(SEARCH);
		await publish([id], monti);
		expect(await failedCount(monti)).toBe(2);
		expect((await facet("delivery", {}, monti)).failed).toBe(2);
		// The filter still shows lines: the one line both are on.
		const failed = await list({ deliveries: ["failed"] }, monti);
		expect(failed.total).toBe(1);
		expect(failed.lines[0].delivery).toMatchObject({ failed: 2 });
		// Narrowed by another column, the menu counts the deliveries of the lines left.
		expect((await facet("delivery", { kinds: ["save"] }, monti)).failed).toBe(0);
		expect((await facet("delivery", { kinds: ["publish"] }, monti)).failed).toBe(2);
	});

	it("a receiver is shown by a name a person reads, never by its stored destination: a webhook's token stays on the server", async () => {
		const secret = webhook("https://user:pass@hooks.example.dev/deploy?token=s3cret", {
			fetch: async () => new Response(null, { status: 503, statusText: "Service Unavailable" }),
		});
		const named: Receiver = { ...receiver("plugin:next"), label: { key: "deliveries.receiver.site" } };
		const monti = site({ receivers: [secret, named] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		const { activityId } = await publish([id], monti);
		const shown = await detail(activityId, monti);
		expect(shown.deliveries.map((delivery) => delivery.receiver)).toEqual([
			{ key: "deliveries.receiver.site" },
			"hooks.example.dev/deploy",
		]);
		expect(shown.deliveries[1].lastError).toEqual({
			key: "deliveries.error.status",
			values: { status: "503 Service Unavailable" },
		});
		expect(JSON.stringify(shown)).not.toContain("s3cret");
		expect(JSON.stringify(shown)).not.toContain("pass@");
		// Canceling answers nothing of the destination either.
		const failed = shown.deliveries[1];
		expect(JSON.stringify(await write("deliveries.cancel", { id: failed.id }, monti))).not.toContain("s3cret");
	});

	it("13-1 the command line leaves what only the running site can send, untried, and says so", async () => {
		const monti = site({ receivers: [receiver(SITE), receiver("plugin:next")] });
		down.add(SITE);
		down.add("plugin:next");
		await newPost("첫 번째 글", "first-post", monti);
		down.clear();
		later(RETRY_MINUTES[0] * MINUTE);
		// The command line opens the site without the adapter's receiver.
		const fromTheCommandLine = site({ receivers: [receiver(SITE)] });
		expect(await fromTheCommandLine.deliveries.sendDue({ leaveUnknown: true })).toEqual({
			sent: 1,
			failed: 0,
			left: 1,
		});
		const left = (await deliveries()).find((delivery) => delivery.destination === "plugin:next");
		expect(left).toMatchObject({ state: "failed", attempts: 1, last_error: "status:503" });
		// The running site sends it.
		expect(await monti.deliveries.sendDue()).toEqual({ sent: 1, failed: 0, left: 0 });
	});

	it("13-2 a write that rolls back queues nothing for any receiver, and a receiver is called only after the commit", async () => {
		const seen: (string | undefined)[] = [];
		const reading: Receiver = {
			destination: SEARCH,
			async send(event) {
				// What the write saved is there to read: the event did not go out ahead of the commit.
				const row = await db.selectFrom("entries").select("title").where("id", "=", event.ids[0]).executeTakeFirst();
				seen.push(row?.title);
			},
		};
		const monti = site({ receivers: [receiver(SITE), reading] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		expect(seen).toEqual(["첫 번째 글"]);
		expect(sent.map((delivery) => delivery.event.type)).toEqual(["entry.saved"]);

		// A save with an old version is refused: its transaction rolls back, with its row and its events.
		const rows = await db.selectFrom("monti_activity").select("id").execute();
		await expect(write("entries.save", { id, version: 99, title: "못 쓴 글" }, monti)).rejects.toThrow();
		// A publish that its check refuses (no address) rolls back too.
		const blank = (await write("entries.create", { collection: "post", title: "주소 없는 글" }, monti)).output.id;
		const before = await deliveries();
		await expect(publish([blank], monti)).rejects.toThrow();
		expect(await deliveries()).toEqual(before);
		expect(await db.selectFrom("monti_activity").select("id").execute()).toHaveLength(rows.length + 1);
		expect(sent.map((delivery) => delivery.event.type)).toEqual(["entry.saved", "entry.saved"]);
		expect(seen).toEqual(["첫 번째 글", "주소 없는 글"]);
	});
});

describe("the log", () => {
	it("13-3 flow 12·01–02b: a failed delivery shows on its line and under the failed filter; sent again, the filter is empty and the count is gone", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		later(MINUTE);
		down.add(SITE);
		await publish([id], monti);
		later(RETRY_MINUTES[0] * MINUTE);
		await monti.deliveries.sendDue();
		later(RETRY_MINUTES[1] * MINUTE);
		await monti.deliveries.sendDue();

		// 01: the log opens unfiltered, newest first; the failed line says how many tries failed.
		const all = await list({}, monti);
		expect(all.lines.map(said)).toEqual([
			['"첫 번째 글" 발행', "post/first-post"],
			['"첫 번째 글" 만듦', "post/first-post"],
		]);
		const [failed, made] = all.lines;
		expect(failed.delivery).toMatchObject({ failed: 1, attempts: 3, sent: 0, pending: 0 });
		expect(made.delivery).toMatchObject({ failed: 0, sent: 1 });
		expect(await facet("delivery", {}, monti)).toEqual({ pending: 0, sent: 1, failed: 1, canceled: 0 });
		expect(all.deliveries).toBe(true);

		// 01b: the failed filter leaves the failed line.
		const only = await list({ deliveries: ["failed"] }, monti);
		expect(only.lines.map((line) => line.id)).toEqual([failed.id]);
		expect(only.total).toBe(1);

		// 02–02b: sent again from the line; it arrives, nothing is failed, and the filtered log is empty.
		down.clear();
		const again = await write<DeliveriesRetried>("deliveries.retry", { ids: failed.delivery?.failedIds }, monti);
		expect(again.output).toMatchObject({ sent: 1, failed: 0 });
		expect((await list({ deliveries: ["failed"] }, monti)).lines).toEqual([]);
		expect((await list({ deliveries: ["failed"] }, monti)).total).toBe(0);
		expect(await failedCount(monti)).toBe(0);
		expect(sent.map((delivery) => delivery.event.type)).toEqual(["entry.saved", "entry.published"]);
	});

	it("13-3 flow 12·03: a line's details hold when, who, the entry as it was, and each receiver's delivery with its tries and last error", async () => {
		const monti = site({ receivers: [receiver(SITE), receiver(SEARCH)] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		later(MINUTE);
		down.add(SEARCH);
		const published = await publish([id], monti);

		const shown = await detail(published.activityId, monti);
		expect(shown).toMatchObject({ id: published.activityId, at: clock, actor: "admin", request: null });
		expect(shown.records).toEqual([
			{
				kind: "entry",
				id,
				version: 2,
				title: "첫 번째 글",
				collection: "post",
				locale: "ko",
				slug: "first-post",
				exists: true,
				address: "/posts/first-post",
			},
		]);
		expect(shown.recordCount).toBe(1);
		expect(shown.deliveries).toEqual([
			{
				id: expect.any(String),
				// A plugin's receiver is named by what follows `plugin:`, and its failure by the answer it got.
				receiver: "search",
				event: "entry.published",
				eventId: expect.any(String),
				state: "failed",
				attempts: 1,
				lastError: { key: "deliveries.error.status", values: { status: "503" } },
				nextAttemptAt: new Date(clock.getTime() + RETRY_MINUTES[0] * MINUTE),
			},
			{
				id: expect.any(String),
				// A webhook by its host and path.
				receiver: "site.test/revalidate",
				event: "entry.published",
				eventId: expect.any(String),
				state: "sent",
				attempts: 1,
				lastError: null,
				nextAttemptAt: null,
			},
		]);

		// Renamed and deleted for good since: the line still says what it was called then, and that it is gone.
		await save(id, { title: "새 이름" }, monti);
		await write("trash.move", { rows: [{ kind: "entry", id }] }, monti);
		await write("trash.purge", { rows: [{ kind: "entry", id }] }, monti);
		const after = await detail(published.activityId, monti);
		expect(after.records[0]).toMatchObject({ title: "첫 번째 글", exists: false, address: "/posts/first-post" });
		await expect(detail("no-such-line", monti)).rejects.toMatchObject({ reason: { key: "activity.unknown" } });
	});

	it("13-3 flow 12·04–04b: canceling a delivery is a person's alone and final; the canceled one is not sent again and is not counted as failed", async () => {
		const monti = site({ receivers: [receiver(SITE), receiver(SEARCH)] });
		down.add(SEARCH);
		const made = await write("entries.create", { collection: "post", title: "첫 번째 글", slug: "first-post" }, monti);
		const failed = (await detail(made.activityId, monti)).deliveries.find((each) => each.state === "failed");
		if (!failed) throw new Error("No failed delivery.");
		expect(await failedCount(monti)).toBe(1);

		// Not the assistant's: neither run nor proposed.
		await expect(monti.run("deliveries.cancel", { id: failed.id }, { actor: "assistant" })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		const proposal = await monti.proposals.create("c1", "cancel it");
		await expect(monti.proposals.add(proposal, "deliveries.cancel", { id: failed.id })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect((await deliveries()).find((each) => each.id === failed.id)?.state).toBe("failed");

		await write("deliveries.cancel", { id: failed.id }, monti);
		const line = (await list({}, monti)).lines[0];
		expect(line.delivery).toMatchObject({ canceled: 1, failed: 0, sent: 1, failedIds: [] });
		expect(await failedCount(monti)).toBe(0);
		expect((await list({ deliveries: ["canceled"] }, monti)).lines.map((each) => each.id)).toEqual([line.id]);

		// Final: no retry by itself, none by hand, no second cancel, and no undo of the cancel.
		down.clear();
		later(DAY);
		await monti.deliveries.sendDue();
		await expect(write("deliveries.retry", { ids: [failed.id] }, monti)).rejects.toMatchObject({
			reason: { key: "deliveries.alreadyCanceled" },
		});
		expect((await write<DeliveriesRetried>("deliveries.retry", { all: true }, monti)).output).toMatchObject({
			ids: [],
			sent: 0,
			failed: 0,
			remaining: 0,
		});
		await expect(write("deliveries.cancel", { id: failed.id }, monti)).rejects.toMatchObject({
			reason: { key: "deliveries.alreadyCanceled" },
		});
		const sentOne = (await deliveries()).find((each) => each.state === "sent");
		await expect(write("deliveries.cancel", { id: sentOne?.id }, monti)).rejects.toMatchObject({
			reason: { key: "deliveries.alreadySent" },
		});
		const cancel = await db
			.selectFrom("monti_activity")
			.select(["id", "undo_until"])
			.where("operation", "=", "deliveries.cancel")
			.executeTakeFirstOrThrow();
		expect(cancel.undo_until).toBeNull();
		await expect(write("activity.undo", { id: cancel.id }, monti)).rejects.toBeInstanceOf(ForbiddenError);
		expect(sent.filter((delivery) => delivery.destination === SEARCH)).toEqual([]);
	});

	it("13-3 flow 12·05–08: sending all again sends every failed delivery, also those whose retries were used up, and says how many arrived", async () => {
		const monti = site();
		down.add(SITE);
		const ids = [
			await newPost("하나", "one", monti),
			await newPost("둘", "two", monti),
			await newPost("셋", "three", monti),
		];
		// One of the three has used up its retries.
		await db
			.updateTable("monti_delivery")
			.set({ attempts: RETRY_MINUTES.length + 1, next_attempt_at: null })
			.where(sql<boolean>`event->'ids'->>0 = ${ids[0]}`)
			.execute();
		expect(await failedCount(monti)).toBe(3);
		expect((await list({ deliveries: ["failed"] }, monti)).lines).toHaveLength(3);

		// 08: some fail again. The receiver is back for two of the three.
		const flaky: Receiver = {
			destination: SITE,
			async send(event) {
				if (event.ids[0] === ids[2]) throw new Error("502");
				sent.push({ destination: SITE, event });
			},
		};
		const back = site({ receivers: [flaky] });
		const some = await write<DeliveriesRetried>("deliveries.retry", { all: true }, back);
		expect(some.output).toMatchObject({ sent: 2, failed: 1 });
		expect(some.output.ids).toHaveLength(3);
		expect(await failedCount(back)).toBe(1);
		const [left] = (await list({ deliveries: ["failed"] }, back)).lines;
		expect(said(left)[0]).toBe('"셋" 만듦');
		expect(left.delivery).toMatchObject({ failed: 1, attempts: 1 });

		// 07: all sent; nothing is failed.
		down.clear();
		const rest = await write<DeliveriesRetried>("deliveries.retry", { all: true }, monti);
		expect(rest.output).toMatchObject({ sent: 1, failed: 0 });
		expect(await failedCount(monti)).toBe(0);
		expect(sent.map((delivery) => delivery.event.ids[0]).sort()).toEqual([...ids].sort());
	});

	it("13-3 flow 12·09–09b: the log filters by kind, by delivery state and by one entry in all its languages", async () => {
		let hold: Promise<void> | null = null;
		const holding: Receiver = {
			destination: SITE,
			async send(event) {
				if (hold) await hold;
				sent.push({ destination: SITE, event });
			},
		};
		// A host that keeps sending after the response: the write returns while its delivery is on its way.
		const kept: Promise<unknown>[] = [];
		const monti = site({ receivers: [holding], waitUntil: (work) => kept.push(work) });
		const first = await newPost("첫 번째 글", "first-post", monti);
		const second = await newPost("두 번째 글", "second-post", monti);
		const english = (await write("translations.create", { source: first, locale: "en" }, monti)).output.id;
		await publish([first], monti);
		await write("entries.archive", { ids: [first] }, monti);
		await write("collections.updateAdminValues", { collection: "post", values: { label: "게시글" } }, monti);
		await write("templates.save", { name: "기본 틀", doc: { type: "doc", blocks: [] } }, monti);
		await write("folders.create", { scope: "media", parentId: null, name: "Blog Assets" }, monti);
		await write("trash.move", { rows: [{ kind: "entry", id: second }] }, monti);
		await Promise.all(kept);

		const whats = async (input: unknown) => (await list(input, monti)).lines.map((line) => said(line)[0]);
		expect(await whats({})).toEqual([
			'"두 번째 글" 휴지통으로',
			"Blog Assets 폴더 만듦",
			"템플릿 기본 틀 저장",
			"게시글 컬렉션 설정 저장",
			'"첫 번째 글" 보관',
			'"첫 번째 글" 발행',
			"en 번역 시작",
			'"두 번째 글" 만듦',
			'"첫 번째 글" 만듦',
		]);
		expect(await whats({ kinds: ["save"] })).toEqual(["en 번역 시작", '"두 번째 글" 만듦', '"첫 번째 글" 만듦']);
		expect(await whats({ kinds: ["publish"] })).toEqual(['"첫 번째 글" 보관', '"첫 번째 글" 발행']);
		expect(await whats({ kinds: ["trash"] })).toEqual(['"두 번째 글" 휴지통으로']);
		expect(await whats({ kinds: ["settings"] })).toEqual(["템플릿 기본 틀 저장", "게시글 컬렉션 설정 저장"]);
		expect(await whats({ kinds: ["media"] })).toEqual(["Blog Assets 폴더 만듦"]);
		expect(await whats({ kinds: ["import"] })).toEqual([]);
		expect(await whats({ kinds: ["assistant"] })).toEqual([]);
		// Where it happened names the collection as the admin calls it now.
		const lines = (await list({}, monti)).lines.map(said);
		expect(lines[0][1]).toBe("휴지통");
		expect(lines[1][1]).toBe("미디어");
		expect(lines[2][1]).toBe("도구 · 템플릿");
		expect(lines[3][1]).toBe("설정");

		// One entry: its own lines and its translation's, and the chip's name for it.
		const one = await list({ entry: first }, monti);
		expect(one.entry).toEqual({ id: first, title: "첫 번째 글" });
		expect(one.lines.map((line) => said(line)[0])).toEqual([
			'"첫 번째 글" 보관',
			'"첫 번째 글" 발행',
			"en 번역 시작",
			'"첫 번째 글" 만듦',
		]);
		expect((await list({ entry: english }, monti)).lines).toHaveLength(4);
		expect((await list({ entry: first, kinds: ["publish"] }, monti)).lines).toHaveLength(2);

		// 09b: a delivery on its way is pending, and the pending filter finds its line.
		let release!: () => void;
		hold = new Promise((resolve) => {
			release = resolve;
		});
		const third = await newPost("세 번째 글", "third-post", monti);
		const pending = await list({ deliveries: ["pending"] }, monti);
		expect(pending.lines.map((line) => said(line)[0])).toEqual(['"세 번째 글" 만듦']);
		expect(pending.lines[0].delivery).toMatchObject({ pending: 1, sent: 0, failed: 0 });
		expect((await facet("delivery", {}, monti)).pending).toBe(1);
		release();
		await Promise.all(kept);
		expect((await list({ deliveries: ["pending"] }, monti)).lines).toEqual([]);
		expect((await list({ deliveries: ["sent"], entry: third }, monti)).lines).toHaveLength(1);

		// Pages: newest first, a page at a time.
		const page = await list({ page: 2, pageSize: 4 }, monti);
		expect(page.total).toBe(10);
		expect(page.lines.map((line) => said(line)[0])).toEqual([
			"게시글 컬렉션 설정 저장",
			'"첫 번째 글" 보관',
			'"첫 번째 글" 발행',
			"en 번역 시작",
		]);
	});

	it("13-3 a browsing of the log keeps its pages while new activity arrives", async () => {
		const monti = site();
		for (let index = 1; index <= 5; index++) await newPost(`글 ${index}`, `post-${index}`, monti);
		const whats = (page: ActivityList) => page.lines.map((line) => said(line)[0]);
		const first = await list({ pageSize: 2 }, monti);
		expect(whats(first)).toEqual(['"글 5" 만듦', '"글 4" 만듦']);
		expect(first.total).toBe(5);
		// Two more writes arrive before the next page is read.
		await newPost("글 6", "post-6", monti);
		await newPost("글 7", "post-7", monti);
		// Without the place of the browsing, page 2 starts with what page 1 ended with.
		expect(whats(await list({ pageSize: 2, page: 2 }, monti))).toEqual(['"글 5" 만듦', '"글 4" 만듦']);
		// With it, the pages follow each other and the total is the browsing's.
		const second = await list({ pageSize: 2, page: 2, asOf: first.asOf }, monti);
		expect(whats(second)).toEqual(['"글 3" 만듦', '"글 2" 만듦']);
		expect(second.total).toBe(5);
		expect(second.asOf).toBe(first.asOf);
		expect(whats(await list({ pageSize: 2, page: 3, asOf: first.asOf }, monti))).toEqual(['"글 1" 만듦']);
		// A proposal applied after page 1 was read is a new line, and a line never moves: its place is its first write's.
		const proposal = await monti.proposals.create("conversation-1", "제목 다듬어 줘");
		const one = await db.selectFrom("entries").select("id").where("slug", "=", "post-1").executeTakeFirstOrThrow();
		await monti.proposals.add(proposal, "entries.save", { id: one.id, version: 1, title: "다듬은 글 1" });
		await monti.proposals.apply(proposal);
		expect(whats(await list({ pageSize: 2, page: 2, asOf: first.asOf }, monti))).toEqual(whats(second));
		// A new browsing sees everything.
		const fresh = await list({ pageSize: 2 }, monti);
		expect(fresh.total).toBe(8);
		expect(whats(fresh)).toEqual(['"다듬은 글 1" 저장', '"글 7" 만듦']);
		expect(Number(fresh.asOf)).toBeGreaterThan(Number(first.asOf));
	});

	it("13-3 a line keeps the address its entry had: a path changed or a collection removed since does not rewrite it", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		const published = await publish([id], monti);
		expect((await detail(published.activityId, monti)).records[0].address).toBe("/posts/first-post");
		// The collection's path changes.
		const post = schema.collections.post;
		if (!post) throw new Error("no post collection");
		const moved = site({
			schema: { ...schema, collections: { ...schema.collections, post: { ...post, path: "/articles/:slug" } } },
		});
		expect((await detail(published.activityId, moved)).records[0].address).toBe("/posts/first-post");
		// A publish under the new path says the new one.
		await save(id, { title: "고친 글" }, moved);
		const again = await publish([id], moved);
		expect((await detail(again.activityId, moved)).records[0].address).toBe("/articles/first-post");
		// The collection is gone from the schema.
		const { post: _gone, ...rest } = schema.collections;
		const without = site({ schema: { ...schema, collections: rest } });
		expect((await detail(published.activityId, without)).records[0]).toMatchObject({
			title: "첫 번째 글",
			address: "/posts/first-post",
		});
	});

	it("13-3 the 30-day clean-up of the trash is a line of the log and tells the receivers which entries are gone", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		await write("trash.move", { rows: [{ kind: "entry", id }] }, monti);
		sent.length = 0;
		// Nothing is due yet: no line, no event.
		expect(await monti.trash.purgeDue()).toMatchObject({ purged: 0 });
		expect((await list({}, monti)).total).toBe(2);
		later(31 * DAY);
		expect(await monti.trash.purgeDue()).toMatchObject({ purged: 1 });
		expect(sent.map((delivery) => delivery.event)).toEqual([
			{
				id: expect.any(String),
				type: "entry.purged",
				at: clock.toISOString(),
				ids: [id],
				collection: "post",
				locale: "ko",
			},
		]);
		const [line] = (await list({ kinds: ["trash"] }, monti)).lines;
		expect(said(line)).toEqual(["30일 지난 1개 영구 삭제", "휴지통"]);
		expect(line).toMatchObject({ actor: "cli", undo: { state: "none" }, delivery: { sent: 1 } });
		// A receiver that is down: the event waits as a failed delivery, as a write's would.
		const next = await newPost("두 번째 글", "second-post", monti);
		await write("trash.move", { rows: [{ kind: "entry", id: next }] }, monti);
		later(31 * DAY);
		down.add(SITE);
		await monti.trash.purgeDue("admin");
		expect(await failedCount(monti)).toBe(1);
		expect((await list({}, monti)).lines[0]).toMatchObject({ actor: "admin", delivery: { failed: 1 } });
	});

	it("13-3 the log finds a page's lines and a line's rows by index, and never groups the history", async () => {
		const { rows } = await sql<{ indexname: string }>`select indexname from pg_indexes
			where schemaname = current_schema() and tablename = 'monti_activity'`.execute(db);
		expect(rows.map((row) => row.indexname)).toEqual(
			expect.arrayContaining(["monti_activity_heads", "monti_activity_line", "monti_activity_proposal"]),
		);
		// Every row names its line: a person's write its own, a proposal's writes the first of them.
		const monti = site();
		const first = await newPost("첫 번째 글", "first-post", monti);
		const second = await newPost("두 번째 글", "second-post", monti);
		const proposal = await monti.proposals.create("conversation-1", "요약 채워 줘");
		await monti.proposals.add(proposal, "entries.save", { id: first, version: 1, values: { summary: "하나" } });
		await monti.proposals.add(proposal, "entries.save", { id: second, version: 1, values: { summary: "둘" } });
		await monti.proposals.apply(proposal);
		const written = await db.selectFrom("monti_activity").select(["id", "line", "operation"]).orderBy("seq").execute();
		expect(written.map((row) => row.line === row.id)).toEqual([true, true, true, false]);
		expect(written[3].line).toBe(written[2].id);
		// A row that is not listed is a line of its own, and no line's.
		await write("activity.undo", { id: written[2].id }, monti);
		const undo = await db
			.selectFrom("monti_activity")
			.select(["id", "line", "listed"])
			.where("operation", "=", "activity.undo")
			.executeTakeFirstOrThrow();
		expect(undo).toMatchObject({ line: undo.id, listed: false });
	});

	it("13-3 the log's columns: several kinds or delivery states at once, counts under the other columns' filters, either order, days in the admin's time zone, and search", async () => {
		const monti = site({ receivers: [receiver(SITE)] });
		// Three days of work, the middle one's delivery failing.
		const first = await newPost("첫 번째 글", "first-post", monti);
		await publish([first], monti);
		later(DAY);
		down.add(SITE);
		const second = await newPost("리액트 19 마이그레이션", "react-19", monti);
		down.clear();
		await write("folders.create", { scope: "media", parentId: null, name: "Blog Assets" }, monti);
		later(DAY);
		const proposal = await monti.proposals.create("conversation-1", "첫 글 요약을 짧게 다듬어 줘");
		await monti.proposals.add(proposal, "entries.save", { id: first, version: 2, values: { summary: "짧게" } });
		await monti.proposals.apply(proposal);
		await write("trash.move", { rows: [{ kind: "entry", id: second }] }, monti);

		const whats = async (input: unknown) => (await list(input, monti)).lines.map((line) => said(line)[0]);
		const everything = [
			'"리액트 19 마이그레이션" 휴지통으로',
			'"첫 번째 글" 저장',
			"Blog Assets 폴더 만듦",
			'"리액트 19 마이그레이션" 만듦',
			'"첫 번째 글" 발행',
			'"첫 번째 글" 만듦',
		];
		expect(await whats({})).toEqual(everything);
		// Oldest first.
		expect(await whats({ sort: "asc" })).toEqual([...everything].reverse());

		// One column's values are any-of; the assistant's work is one of the kinds a person picks.
		expect(await whats({ kinds: ["trash", "publish"] })).toEqual([
			'"리액트 19 마이그레이션" 휴지통으로',
			'"첫 번째 글" 발행',
		]);
		expect(await whats({ kinds: ["assistant", "media"] })).toEqual(['"첫 번째 글" 저장', "Blog Assets 폴더 만듦"]);
		expect(await whats({ deliveries: ["failed", "canceled"] })).toEqual(['"리액트 19 마이그레이션" 만듦']);
		// Two columns are both-of.
		expect(await whats({ kinds: ["save"], deliveries: ["failed"] })).toEqual(['"리액트 19 마이그레이션" 만듦']);
		expect(await whats({ kinds: ["publish"], deliveries: ["failed"] })).toEqual([]);

		// A menu's counts: what each value would show, with the other columns as they are and its own values not narrowing them.
		expect(await facet("kind", {}, monti)).toEqual({
			assistant: 1,
			save: 3,
			publish: 1,
			trash: 1,
			import: 0,
			settings: 0,
			media: 1,
		});
		// The delivery menu counts deliveries, as the sidebar does.
		expect(await facet("delivery", {}, monti)).toEqual({ pending: 0, sent: 4, failed: 1, canceled: 0 });
		const narrowed = { deliveries: ["failed"], kinds: ["publish"] };
		expect(await facet("kind", narrowed, monti)).toMatchObject({ assistant: 0, save: 1, publish: 0, trash: 0 });
		expect(await facet("delivery", narrowed, monti)).toEqual({ pending: 0, sent: 1, failed: 0, canceled: 0 });

		// Days are the admin's: 10:00 UTC on the 26th is the 26th in Seoul, and 19:00 there; the next day's work is the 27th.
		expect(await whats({ range: { from: "2026-10-27", to: "2026-10-27" }, timeZone: "Asia/Seoul" })).toEqual([
			"Blog Assets 폴더 만듦",
			'"리액트 19 마이그레이션" 만듦',
		]);
		expect(await whats({ range: { from: "2026-10-26", to: "2026-10-27" }, timeZone: "Asia/Seoul" })).toEqual(
			everything.slice(2),
		);
		expect(await whats({ range: "today" })).toEqual(everything.slice(0, 2));
		expect(await whats({ range: "7d" })).toEqual(everything);
		// Far to the west the same instants are a day earlier: the first day's work is the 25th there.
		expect(await whats({ range: { from: "2026-10-25", to: "2026-10-25" }, timeZone: "Pacific/Pago_Pago" })).toEqual(
			everything.slice(4),
		);
		expect(await whats({ range: { from: "2026-10-26", to: "2026-10-26" }, timeZone: "Pacific/Pago_Pago" })).toEqual(
			everything.slice(2, 4),
		);

		// Search: an entry's title, a folder's or a file's name, the words of the assistant's request. Signs of a pattern are letters.
		expect(await whats({ search: "리액트" })).toEqual([
			'"리액트 19 마이그레이션" 휴지통으로',
			'"리액트 19 마이그레이션" 만듦',
		]);
		expect(await whats({ search: "blog assets" })).toEqual(["Blog Assets 폴더 만듦"]);
		expect(await whats({ search: "다듬어" })).toEqual(['"첫 번째 글" 저장']);
		expect(await whats({ search: "첫 번째", kinds: ["assistant"] })).toEqual(['"첫 번째 글" 저장']);
		expect(await whats({ search: "%" })).toEqual([]);
		expect(await whats({ search: "  " })).toEqual(everything);
		expect((await list({ search: "리액트" }, monti)).total).toBe(2);
		// The counts follow the search too.
		expect(await facet("kind", { search: "리액트" }, monti)).toMatchObject({ save: 1, trash: 1, publish: 0 });
	});

	it("13-3 flow 12·11: a new site's log is empty", async () => {
		expect(await list()).toEqual({
			lines: [],
			total: 0,
			asOf: "0",
			deliveries: true,
			entry: null,
		});
	});

	it("13-3 every core write says where the log files it, and what is no change to the site is written but not listed", async () => {
		const monti = site();
		const unfiled = [...monti.operations.values()]
			.filter((operation) => operation.kind === "write" && operation.log === undefined)
			.map((operation) => operation.name);
		expect(unfiled).toEqual([]);

		const id = await newPost("첫 번째 글", "first-post", monti);
		await write("list.savePrefs", { collection: "post", pageSize: 25 }, monti);
		const made = (await list({}, monti)).lines[0];
		await write("activity.undo", { id: made.id }, monti);
		const rows = await db.selectFrom("monti_activity").select(["operation", "listed", "kind"]).orderBy("at").execute();
		expect(rows.map((row) => [row.operation, row.listed, row.kind])).toEqual(
			expect.arrayContaining([
				["entries.create", true, "save"],
				["list.savePrefs", false, null],
				["activity.undo", false, null],
			]),
		);
		// Every write has its row (principle 1); the log lists and counts the one that changed the site.
		expect(rows).toHaveLength(3);
		expect((await list({}, monti)).lines.map((line) => line.id)).toEqual([made.id]);
		expect((await list({}, monti)).total).toBe(1);
		expect(await db.selectFrom("entries").select("id").where("id", "=", id).execute()).toEqual([]);
	});
});

describe("undo from the log", () => {
	it("13-3 a line can be undone for 30 days; it then says when it was undone, and an old line only loses its undo", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		later(MINUTE);
		const saved = await save(id, { title: "고친 글" }, monti);
		const line = async () => (await list({}, monti)).lines.find((each) => each.id === saved.activityId);
		expect((await line())?.undo).toEqual({ state: "open" });

		later(29 * DAY);
		await write("activity.undo", { id: saved.activityId }, monti);
		expect((await line())?.undo).toEqual({ state: "done", at: clock });
		expect((await db.selectFrom("entries").select("title").where("id", "=", id).executeTakeFirstOrThrow()).title).toBe(
			"첫 번째 글",
		);
		await expect(write("activity.undo", { id: saved.activityId }, monti)).rejects.toMatchObject({
			reason: { key: "errors.alreadyUndone" },
		});

		// The line that made the entry is past its 30 days: it stays in the log without its undo (2026-11-05, owner).
		later(2 * DAY);
		const made = (await list({}, monti)).lines.at(-1);
		expect(made?.undo).toEqual({ state: "over" });
		await expect(write("activity.undo", { id: made?.id }, monti)).rejects.toMatchObject({
			reason: { key: "errors.undoExpired" },
		});
		// A permanent delete never had one.
		await write("trash.move", { rows: [{ kind: "entry", id }] }, monti);
		const purged = await write("trash.purge", { rows: [{ kind: "entry", id }] }, monti);
		expect((await list({}, monti)).lines.find((each) => each.id === purged.activityId)?.undo).toEqual({
			state: "none",
		});
	});

	it("13-3 the assistant's work is one line per request: its writes together, quoted by the request, undone together", async () => {
		const monti = site();
		const first = await newPost("첫 번째 글", "first-post", monti);
		const second = await newPost("두 번째 글", "second-post", monti);
		later(MINUTE);
		const proposal = await monti.proposals.create("conversation-1", "이 두 편 요약 채워 줘");
		// Two writes to one entry and one to another: the line follows a record through several of its writes.
		await monti.proposals.add(proposal, "entries.save", { id: first, version: 1, values: { summary: "첫 요약" } });
		await monti.proposals.add(proposal, "entries.save", { id: second, version: 1, values: { summary: "둘째 요약" } });
		await monti.proposals.apply(proposal);
		later(MINUTE);
		const followUp = await monti.proposals.create("conversation-1", "첫 글 요약 더 짧게");
		await monti.proposals.add(followUp, "entries.save", { id: first, version: 2, values: { summary: "짧게" } });
		await monti.proposals.apply(followUp);

		const lines = (await list({ kinds: ["assistant"] }, monti)).lines;
		expect(lines.map((line) => [line.request, line.conversationId, line.actor])).toEqual([
			["첫 글 요약 더 짧게", "conversation-1", "assistant"],
			["이 두 편 요약 채워 줘", "conversation-1", "assistant"],
		]);
		const [, older] = lines;
		expect(said(older)).toEqual(['"두 번째 글" 저장 · "첫 번째 글" 저장', null]);
		expect(older.undo).toEqual({ state: "open" });
		// The line's time and place are those of its first write.
		expect(older.at).toEqual(new Date(START.getTime() + MINUTE));
		expect((await list({}, monti)).total).toBe(4);
		const whole = await detail(older.id, monti);
		expect(whole.records.map((record) => record.title)).toEqual(["두 번째 글", "첫 번째 글"]);
		expect(whole.writes.map(ko)).toEqual(['"두 번째 글" 저장', '"첫 번째 글" 저장']);

		// The older request's line: the first entry was written again since, so it stays; the second goes back.
		const summaries = async () =>
			Object.fromEntries(
				(await db.selectFrom("entries").select(["id", "values"]).execute()).map((row) => [row.id, row.values.summary]),
			);
		const undone = await write<UndoPlan>("activity.undo", { id: older.id }, monti);
		expect(undone.output).toEqual({
			restore: [{ kind: "entry", id: second }],
			skip: [{ kind: "entry", id: first }],
			partly: [],
		});
		expect(await summaries()).toEqual({ [first]: "짧게", [second]: undefined });
		expect((await list({ kinds: ["assistant"] }, monti)).lines[1].undo).toEqual({ state: "done", at: clock });
	});

	it("13-3 a proposal applied in two sittings is two lines; undoing the proposal takes both back, and a person's write in between stays with what was under it", async () => {
		const monti = site();
		const entry = await newPost("첫 번째 글", "first-post", monti);
		const other = await newPost("두 번째 글", "second-post", monti);
		const titleOf = async (id: string) =>
			(await db.selectFrom("entries").select("title").where("id", "=", id).executeTakeFirstOrThrow()).title;
		const proposal = await monti.proposals.create("conversation-1", "제목들을 다듬어 줘");
		// The assistant writes the entry; a person writes it; the assistant writes it again, and another entry.
		await monti.proposals.add(proposal, "entries.save", { id: entry, version: 1, title: "어시스턴트 1" });
		await monti.proposals.apply(proposal);
		later(MINUTE);
		await save(entry, { title: "사람이 고친 제목" }, monti);
		later(MINUTE);
		await monti.proposals.add(proposal, "entries.save", { id: entry, version: 3, title: "어시스턴트 2" });
		await monti.proposals.add(proposal, "entries.save", { id: other, version: 1, title: "어시스턴트 3" });
		await monti.proposals.apply(proposal);
		expect([await titleOf(entry), await titleOf(other)]).toEqual(["어시스턴트 2", "어시스턴트 3"]);
		// Two sittings, two lines, each at its own time, both quoting the request.
		const lines = (await list({ kinds: ["assistant"] }, monti)).lines;
		expect(lines.map((line) => [line.request, said(line)[0]])).toEqual([
			["제목들을 다듬어 줘", '"어시스턴트 3" 저장 · "어시스턴트 2" 저장'],
			["제목들을 다듬어 줘", '"어시스턴트 1" 저장'],
		]);

		// The preview, as a proposal of the undo reads it, and the undo itself say the same: both entries change, none is left alone.
		const plan = {
			restore: [
				{ kind: "entry", id: other },
				{ kind: "entry", id: entry },
			],
			skip: [],
		};
		const asking = await monti.proposals.create("conversation-1", "되돌려 줘");
		const { preview } = await monti.proposals.add(asking, "activity.undo", { proposal });
		expect(preview).toMatchObject({ changes: plan.restore, blocked: [] });
		const undone = await write<UndoPlan>("activity.undo", { proposal }, monti);
		expect(undone.output).toEqual({ ...plan, partly: [{ kind: "entry", id: entry }] });
		// The entry is back at the person's write, not before it: the assistant's first write is under that write and stays.
		expect([await titleOf(entry), await titleOf(other)]).toEqual(["사람이 고친 제목", "두 번째 글"]);
		expect((await list({ kinds: ["assistant"] }, monti)).lines.map((line) => line.undo.state)).toEqual([
			"done",
			"done",
		]);
	});

	it("13-3 an undo that can take back only the newer of a proposal's writes on a record does that, and is not refused", async () => {
		const monti = site();
		const entry = await newPost("첫 번째 글", "first-post", monti);
		const proposal = await monti.proposals.create("conversation-1", "제목을 다듬어 줘");
		await monti.proposals.add(proposal, "entries.save", { id: entry, version: 1, title: "어시스턴트 1" });
		await monti.proposals.apply(proposal);
		await save(entry, { title: "사람이 고친 제목" }, monti);
		await monti.proposals.add(proposal, "entries.save", { id: entry, version: 3, title: "어시스턴트 2" });
		await monti.proposals.apply(proposal);

		const undone = await write<UndoPlan>("activity.undo", { proposal }, monti);
		expect(undone.output).toEqual({
			restore: [{ kind: "entry", id: entry }],
			skip: [],
			partly: [{ kind: "entry", id: entry }],
		});
		expect(
			(await db.selectFrom("entries").select("title").where("id", "=", entry).executeTakeFirstOrThrow()).title,
		).toBe("사람이 고친 제목");
		// With nothing left that can be taken back, it is refused and nothing is marked.
		await save(entry, { title: "또 고친 제목" }, monti);
		const again = await monti.proposals.create("conversation-1", "한 번 더");
		await monti.proposals.add(again, "entries.save", { id: entry, version: 6, title: "어시스턴트 3" });
		await monti.proposals.apply(again);
		await save(entry, { title: "마지막 제목" }, monti);
		await expect(write("activity.undo", { proposal: again }, monti)).rejects.toMatchObject({
			reason: { key: "activity.allChanged" },
		});
		expect((await list({ kinds: ["assistant"] }, monti)).lines[0].undo).toEqual({ state: "open" });
	});

	it("02-7 undoing a publish tells the site: the path goes out again, on the line that was undone (T29)", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		const first = await publish([id], monti);
		await save(id, { title: "고친 글", slug: "edited-post" }, monti);
		const second = await publish([id], monti);
		expect((await fromSite("edited-post"))?.title).toBe("고친 글");
		sent.length = 0;

		// The second publish undone: the former copy is back under its former address, and both addresses are told.
		later(MINUTE);
		await write("activity.undo", { id: second.activityId }, monti);
		expect((await fromSite("first-post"))?.title).toBe("첫 번째 글");
		expect(sent.map((delivery) => delivery.event)).toEqual([
			{
				id: expect.any(String),
				type: "entry.published",
				at: clock.toISOString(),
				ids: [id],
				collection: "post",
				locale: "ko",
				paths: ["/posts/first-post", "/posts/edited-post"],
			},
		]);
		// The undo has no line of its own: its delivery shows on the line it undid.
		const line = (await list({}, monti)).lines.find((each) => each.id === second.activityId);
		expect(line?.delivery).toMatchObject({ sent: 2 });
		expect((await detail(second.activityId, monti)).deliveries.map((each) => each.event)).toEqual([
			"entry.published",
			"entry.published",
		]);

		// The first publish was written over since (a save, a publish, an undo): nothing of it is left to undo. It is refused, the line stays as it
		// was, the site keeps the entry and nobody is told.
		sent.length = 0;
		await expect(write("activity.undo", { id: first.activityId }, monti)).rejects.toMatchObject({
			reason: { key: "activity.allChanged" },
		});
		expect((await list({}, monti)).lines.find((each) => each.id === first.activityId)?.undo).toEqual({ state: "open" });
		expect((await fromSite("first-post"))?.title).toBe("첫 번째 글");
		expect(sent).toEqual([]);

		// An entry's only publish undone: it leaves the site, and its address is told.
		const other = await newPost("두 번째 글", "second-post", monti);
		const only = await publish([other], monti);
		sent.length = 0;
		await write("activity.undo", { id: only.activityId }, monti);
		expect(await fromSite("second-post")).toBeNull();
		expect(sent.map((delivery) => [delivery.event.type, delivery.event.paths])).toEqual([
			["entry.unpublished", ["/posts/second-post"]],
		]);

		// An undo that changes nothing the site shows (a draft's save) tells nobody.
		const draft = await newPost("초안", "draft", monti);
		const edited = await save(draft, { title: "고친 초안" }, monti);
		sent.length = 0;
		await write("activity.undo", { id: edited.activityId }, monti);
		expect(sent).toEqual([]);
	});

	it("02-7 putting a thrown-away published entry back with undo brings it to the site again and tells the site", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		await publish([id], monti);
		const moved = await write("trash.move", { rows: [{ kind: "entry", id }] }, monti);
		expect(await fromSite("first-post")).toBeNull();
		expect(sent.map((delivery) => delivery.event.type)).toEqual([
			"entry.saved",
			"entry.published",
			"entry.unpublished",
			"entry.trashed",
		]);
		sent.length = 0;
		await write("activity.undo", { id: moved.activityId }, monti);
		expect((await fromSite("first-post"))?.title).toBe("첫 번째 글");
		expect(sent.map((delivery) => [delivery.event.type, delivery.event.paths])).toEqual([
			["entry.published", ["/posts/first-post"]],
		]);
	});
});

describe("counts and sites without receivers", () => {
	it("13-4 the sidebar's count, the tab's count and the banner's are one number, through failing, sending again and canceling", async () => {
		const monti = site({ receivers: [receiver(SITE), receiver(SEARCH)] });
		const api = signedInApi(monti);
		const sidebar = async () =>
			(
				(await (
					await api(
						new Request("https://site.test/admin/api/operations/frame.counts", {
							method: "POST",
							body: JSON.stringify({ input: {} }),
						}),
					)
				).json()) as { failedDeliveries: number }
			).failedDeliveries;
		/** The sidebar, the tab and banner, the filter menu's number, and the failed deliveries the log's lines show. */
		const everywhere = async () => {
			const log = await list({ deliveries: ["failed"] }, monti);
			return [
				await sidebar(),
				await failedCount(monti),
				log.lines.reduce((sum, line) => sum + (line.delivery?.failed ?? 0), 0),
			];
		};
		expect(await everywhere()).toEqual([0, 0, 0]);

		down.add(SITE);
		down.add(SEARCH);
		const one = await newPost("하나", "one", monti);
		await newPost("둘", "two", monti);
		expect(await everywhere()).toEqual([4, 4, 4]);
		const counts = await read<DeliveryCounts>("deliveries.counts", {}, monti);
		expect(counts).toEqual({ failed: 4, since: START, sending: 0 });

		// One receiver is back: sending all again leaves the other's two.
		down.delete(SITE);
		later(MINUTE);
		await write("deliveries.retry", { all: true }, monti);
		expect(await everywhere()).toEqual([2, 2, 2]);

		const lines = (await list({ entry: one }, monti)).lines;
		await write("deliveries.cancel", { id: lines[0].delivery?.failedIds[0] }, monti);
		expect(await everywhere()).toEqual([1, 1, 1]);

		// The retry that comes due by itself gets through.
		down.clear();
		later(DAY);
		await monti.deliveries.sendDue();
		expect(await everywhere()).toEqual([0, 0, 0]);
		expect(await read<DeliveryCounts>("deliveries.counts", {}, monti)).toEqual({ failed: 0, since: null, sending: 0 });
	});

	it("13-5 a site with no receiver logs every write and shows no delivery anywhere", async () => {
		const monti = site({ receivers: [] });
		const id = await newPost("첫 번째 글", "first-post", monti);
		await publish([id], monti);
		await write("trash.move", { rows: [{ kind: "entry", id }] }, monti);

		const log = await list({}, monti);
		expect(log.lines.map(said)).toEqual([
			['"첫 번째 글" 휴지통으로', "휴지통"],
			['"첫 번째 글" 발행', "post/first-post"],
			['"첫 번째 글" 만듦', "post/first-post"],
		]);
		expect(log.deliveries).toBe(false);
		expect(log.lines.map((line) => line.delivery)).toEqual([null, null, null]);
		expect(await facet("delivery", {}, monti)).toEqual({ pending: 0, sent: 0, failed: 0, canceled: 0 });
		expect(await deliveries()).toEqual([]);
		expect((await detail(log.lines[1].id, monti)).deliveries).toEqual([]);
		expect(await read<DeliveryCounts>("deliveries.counts", {}, monti)).toEqual({ failed: 0, since: null, sending: 0 });

		// A receiver the site had and took out: its deliveries are still shown, and trying one says the receiver is gone.
		const withOne = site();
		down.add(SITE);
		await newPost("두 번째 글", "second-post", withOne);
		later(RETRY_MINUTES[0] * MINUTE);
		await monti.deliveries.sendDue();
		const after = await list({}, monti);
		expect(after.deliveries).toBe(true);
		expect((await deliveries())[0]).toMatchObject({
			state: "failed",
			attempts: 2,
			last_error: "gone",
		});
	});
});
