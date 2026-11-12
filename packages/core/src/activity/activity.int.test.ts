import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { RETRY_MINUTES, type Receiver, SEND_TIMEOUT_MS, sendDeliveries, webhook } from "../engine/deliveries";
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
		if (down.has(destination)) throw new Error("503");
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
		expect(delivery).toMatchObject({ state: "failed", attempts: 1, last_error: "503" });
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
				if (down.has(SITE)) throw new Error("503");
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
				if (down.has(SITE)) throw new Error("503");
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
			last_error: "No answer in 10 seconds",
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
		expect((await deliveries())[1]).toMatchObject({ state: "failed", last_error: "503 Service Unavailable" });
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
		expect(again.output).toEqual({ ids: [used.id], sent: 0, failed: 1 });
		const [counted] = await deliveries();
		expect(counted).toMatchObject({ state: "failed", attempts: 1 });
		expect(counted.next_attempt_at).toEqual(new Date(clock.getTime() + RETRY_MINUTES[0] * MINUTE));

		later(RETRY_MINUTES[0] * MINUTE);
		await monti.deliveries.sendDue();
		expect((await deliveries())[0].attempts).toBe(2);

		down.clear();
		expect((await write<DeliveriesRetried>("deliveries.retry", { ids: [used.id] }, monti)).output).toEqual({
			ids: [used.id],
			sent: 1,
			failed: 0,
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
				if (down.has(SITE)) throw new Error("503");
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
		expect(all.deliveryCounts).toEqual({ pending: 0, sent: 1, failed: 1, canceled: 0 });
		expect(all.deliveries).toBe(true);

		// 01b: the failed filter leaves the failed line.
		const only = await list({ delivery: "failed" }, monti);
		expect(only.lines.map((line) => line.id)).toEqual([failed.id]);
		expect(only.total).toBe(1);

		// 02–02b: sent again from the line; it arrives, nothing is failed, and the filtered log is empty.
		down.clear();
		const again = await write<DeliveriesRetried>("deliveries.retry", { ids: failed.delivery?.failedIds }, monti);
		expect(again.output).toMatchObject({ sent: 1, failed: 0 });
		expect((await list({ delivery: "failed" }, monti)).lines).toEqual([]);
		expect((await list({ delivery: "failed" }, monti)).total).toBe(0);
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
				destination: SEARCH,
				event: "entry.published",
				state: "failed",
				attempts: 1,
				lastError: "503",
				nextAttemptAt: new Date(clock.getTime() + RETRY_MINUTES[0] * MINUTE),
			},
			{
				id: expect.any(String),
				destination: SITE,
				event: "entry.published",
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
		expect((await list({ delivery: "canceled" }, monti)).lines.map((each) => each.id)).toEqual([line.id]);

		// Final: no retry by itself, none by hand, no second cancel, and no undo of the cancel.
		down.clear();
		later(DAY);
		await monti.deliveries.sendDue();
		await expect(write("deliveries.retry", { ids: [failed.id] }, monti)).rejects.toMatchObject({
			reason: { key: "deliveries.alreadyCanceled" },
		});
		expect((await write<DeliveriesRetried>("deliveries.retry", { all: true }, monti)).output).toEqual({
			ids: [],
			sent: 0,
			failed: 0,
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
		expect((await list({ delivery: "failed" }, monti)).lines).toHaveLength(3);

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
		const [left] = (await list({ delivery: "failed" }, back)).lines;
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
		expect(await whats({ kind: "save" })).toEqual(["en 번역 시작", '"두 번째 글" 만듦', '"첫 번째 글" 만듦']);
		expect(await whats({ kind: "publish" })).toEqual(['"첫 번째 글" 보관', '"첫 번째 글" 발행']);
		expect(await whats({ kind: "trash" })).toEqual(['"두 번째 글" 휴지통으로']);
		expect(await whats({ kind: "settings" })).toEqual(["템플릿 기본 틀 저장", "게시글 컬렉션 설정 저장"]);
		expect(await whats({ kind: "media" })).toEqual(["Blog Assets 폴더 만듦"]);
		expect(await whats({ kind: "import" })).toEqual([]);
		expect(await whats({ kind: "assistant" })).toEqual([]);
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
		expect((await list({ entry: first, kind: "publish" }, monti)).lines).toHaveLength(2);

		// 09b: a delivery on its way is pending, and the pending filter finds its line.
		let release!: () => void;
		hold = new Promise((resolve) => {
			release = resolve;
		});
		const third = await newPost("세 번째 글", "third-post", monti);
		const pending = await list({ delivery: "pending" }, monti);
		expect(pending.lines.map((line) => said(line)[0])).toEqual(['"세 번째 글" 만듦']);
		expect(pending.lines[0].delivery).toMatchObject({ pending: 1, sent: 0, failed: 0 });
		expect(pending.deliveryCounts.pending).toBe(1);
		release();
		await Promise.all(kept);
		expect((await list({ delivery: "pending" }, monti)).lines).toEqual([]);
		expect((await list({ delivery: "sent", entry: third }, monti)).lines).toHaveLength(1);

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

	it("13-3 flow 12·11: a new site's log is empty", async () => {
		expect(await list()).toEqual({
			lines: [],
			total: 0,
			deliveries: true,
			deliveryCounts: { pending: 0, sent: 0, failed: 0, canceled: 0 },
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

		const lines = (await list({ kind: "assistant" }, monti)).lines;
		expect(lines.map((line) => [line.id, line.request, line.conversationId, line.actor])).toEqual([
			[followUp, "첫 글 요약 더 짧게", "conversation-1", "assistant"],
			[proposal, "이 두 편 요약 채워 줘", "conversation-1", "assistant"],
		]);
		expect(said(lines[1])).toEqual(['"두 번째 글" 저장 · "첫 번째 글" 저장', null]);
		expect(lines[1].undo).toEqual({ state: "open" });
		expect((await list({}, monti)).total).toBe(4);
		expect((await detail(proposal, monti)).records.map((record) => record.title)).toEqual(["두 번째 글", "첫 번째 글"]);

		// The older request's line: the first entry was written again since, so it stays; the second goes back. The preview says so first.
		const summaries = async () =>
			Object.fromEntries(
				(await db.selectFrom("entries").select(["id", "values"]).execute()).map((row) => [row.id, row.values.summary]),
			);
		const undone = await write<{ restore: unknown[]; skip: unknown[] }>("activity.undo", { id: proposal }, monti);
		expect(undone.output).toEqual({ restore: [{ kind: "entry", id: second }], skip: [{ kind: "entry", id: first }] });
		expect(await summaries()).toEqual({ [first]: "짧게", [second]: undefined });
		expect((await list({ kind: "assistant" }, monti)).lines[1].undo).toEqual({ state: "done", at: clock });
	});

	it("13-3 undoing a line whose writes changed one record several times puts back what was there before the first of them", async () => {
		const monti = site();
		const id = await newPost("첫 번째 글", "first-post", monti);
		const proposal = await monti.proposals.create("conversation-1", "요약 쓰고 제목 다듬어 줘");
		const summary = await monti.proposals.add(proposal, "entries.save", {
			id,
			version: 1,
			values: { summary: "요약" },
		});
		await monti.proposals.apply(proposal, [summary.itemId]);
		// The second item is applied later, on the entry as the first left it.
		const title = await monti.proposals.create("conversation-1", "제목 다듬어 줘");
		await monti.proposals.add(title, "entries.save", { id, version: 2, title: "다듬은 제목" });
		await monti.proposals.apply(title);
		// Both writes are of the first request's line once the second proposal's row carries its id.
		await db.updateTable("monti_activity").set({ proposal_id: proposal }).where("proposal_id", "=", title).execute();

		const undone = await write<{ restore: unknown[]; skip: unknown[] }>("activity.undo", { id: proposal }, monti);
		expect(undone.output).toEqual({ restore: [{ kind: "entry", id }], skip: [] });
		const entry = await db
			.selectFrom("entries")
			.select(["title", "values"])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		expect([entry.title, entry.values.summary]).toEqual(["첫 번째 글", undefined]);
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

		// The first publish was written over since (a save, a publish, an undo): its undo skips the entry, the site keeps it, and nobody is told.
		sent.length = 0;
		const skipped = await write<{ skip: unknown[] }>("activity.undo", { id: first.activityId }, monti);
		expect(skipped.output.skip).toEqual([{ kind: "entry", id }]);
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
			const log = await list({ delivery: "failed" }, monti);
			return [
				await sidebar(),
				await failedCount(monti),
				log.deliveryCounts.failed,
				log.lines.reduce((sum, line) => sum + (line.delivery?.failed ?? 0), 0),
			];
		};
		expect(await everywhere()).toEqual([0, 0, 0, 0]);

		down.add(SITE);
		down.add(SEARCH);
		const one = await newPost("하나", "one", monti);
		await newPost("둘", "two", monti);
		expect(await everywhere()).toEqual([4, 4, 4, 4]);
		const counts = await read<DeliveryCounts>("deliveries.counts", {}, monti);
		expect(counts).toEqual({ failed: 4, since: START });

		// One receiver is back: sending all again leaves the other's two.
		down.delete(SITE);
		later(MINUTE);
		await write("deliveries.retry", { all: true }, monti);
		expect(await everywhere()).toEqual([2, 2, 2, 2]);

		const lines = (await list({ entry: one }, monti)).lines;
		await write("deliveries.cancel", { id: lines[0].delivery?.failedIds[0] }, monti);
		expect(await everywhere()).toEqual([1, 1, 1, 1]);

		// The retry that comes due by itself gets through.
		down.clear();
		later(DAY);
		await monti.deliveries.sendDue();
		expect(await everywhere()).toEqual([0, 0, 0, 0]);
		expect(await read<DeliveryCounts>("deliveries.counts", {}, monti)).toEqual({ failed: 0, since: null });
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
		expect(log.deliveryCounts).toEqual({ pending: 0, sent: 0, failed: 0, canceled: 0 });
		expect(await deliveries()).toEqual([]);
		expect((await detail(log.lines[1].id, monti)).deliveries).toEqual([]);
		expect(await read<DeliveryCounts>("deliveries.counts", {}, monti)).toEqual({ failed: 0, since: null });

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
			last_error: `No receiver ${SITE} any more`,
		});
	});
});
