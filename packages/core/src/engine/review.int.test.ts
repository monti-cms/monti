import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { testDatabase } from "../__test__/database";
import { startSession } from "../auth/session";
import type { Doc } from "../body/doc";
import { createAdminApi } from "../entry/api";
import { runCli } from "../entry/cli";
import { agentTools, callAgentTool } from "../entry/tools";
import { CheckError, ForbiddenError, UnknownOperationError } from "../errors";
import { type ApplyEvent, createMonti, definePlugin, type MontiOptions } from "../monti";
import { defineOperation, type MontiEvent } from "../operation";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import { MOST_ITEMS, type ProposalView } from "./proposals";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
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
	},
});

let clock = new Date("2026-11-12T10:00:00Z");
const site = (options: Partial<MontiOptions> = {}) => createMonti({ db, schema, now: () => clock, ...options });
const admin = { actor: "admin" } as const;
type Written<Output = { id: string }> = { output: Output; activityId: string | null };

const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const body = (...texts: string[]): Doc =>
	({ type: "doc", blocks: texts.map((text, index) => paragraph(`b_${index + 1}`, text)) }) as Doc;

let posts = 0;
async function newPost(title: string, texts: string[] = []) {
	const monti = site();
	posts += 1;
	const made = (await monti.run("entries.create", { collection: "post", locale: "ko", title }, admin)) as Written;
	if (texts.length > 0)
		await monti.run(
			"entries.save",
			{ id: made.output.id, version: 1, slug: `post-${posts}`, doc: body(...texts) },
			admin,
		);
	return made.output.id;
}
const row = (id: string) => db.selectFrom("entries").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const version = async (id: string) => (await row(id)).version;
const textOf = async (id: string) =>
	((await row(id)).doc as Doc).blocks.map((block) => (block.content?.[0] as { text?: string } | undefined)?.text);
const view = (id: string) => site().run("proposals.get", { id }, admin) as Promise<ProposalView>;
const activity = () => db.selectFrom("monti_activity").select(["operation", "actor"]).orderBy("at").execute();

async function folder(name: string) {
	const made = (await site().run(
		"folders.create",
		{ scope: { collection: "post" }, parentId: null, name },
		admin,
	)) as Written;
	return made.output.id;
}

/**
 * A plugin's write that takes as long as the test says and counts how often it ran: what an apply does with an item whose write is slow. Each
 * name has its own gate: `entered` is when its write began, `open` lets it end.
 */
function slowWork() {
	const ran: Record<string, number> = {};
	const gates = new Map<
		string,
		{ entered: Promise<void>; enter: () => void; opened: Promise<void>; open: () => void }
	>();
	const gate = (name: string) => {
		let found = gates.get(name);
		if (!found) {
			let enter = () => {};
			let open = () => {};
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const opened = new Promise<void>((resolve) => {
				open = resolve;
			});
			found = { entered, enter, opened, open };
			gates.set(name, found);
		}
		return found;
	};
	const work = defineOperation({
		name: "probe.work",
		kind: "write",
		description: "Do a named piece of work.",
		input: z.object({ name: z.string() }),
		async run(input) {
			ran[input.name] = (ran[input.name] ?? 0) + 1;
			gate(input.name).enter();
			await gate(input.name).opened;
			return { name: input.name };
		},
		summary: () => ({ key: "probe.work" }),
	});
	return {
		ran,
		plugin: definePlugin({ name: "probe", operations: [work] }),
		entered: (name: string) => gate(name).entered,
		open: (name: string) => gate(name).open(),
	};
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const itemRow = (id: string) =>
	db.selectFrom("monti_proposal_item").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

beforeEach(async () => {
	clock = new Date("2026-11-12T10:00:00Z");
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of [
		"entries",
		"folders",
		"monti_proposal",
		"monti_delivery",
		"monti_activity",
		"schema_state",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("what a proposal holds (flow 2, 11–13)", () => {
	it("10-1 a write that names several entries is one item per entry, and items of one name are one group", async () => {
		const monti = site();
		const posts = [await newPost("2024 회고"), await newPost("리액트 18 정리"), await newPost("겨울 사진")];
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "작년 글은 2024 폴더로 옮겨 줘");
		const moved = await monti.proposals.add(
			proposal,
			"entries.moveToFolder",
			{ ids: posts, folder: box },
			"2024 폴더로 옮기기",
		);
		expect(moved.itemIds).toHaveLength(3);
		// The whole write's preview still says what all of it would do.
		expect(moved.preview?.changes).toHaveLength(3);
		const summary = await monti.proposals.add(
			proposal,
			"entries.save",
			{ id: posts[0], version: await version(posts[0]), values: { summary: "한 해를 돌아본 글." } },
			"요약 채우기",
		);

		const seen = await view(proposal);
		expect(seen).toMatchObject({ request: "작년 글은 2024 폴더로 옮겨 줘", status: "pending", applying: false });
		expect(seen.groups).toEqual([
			{ label: "2024 폴더로 옮기기", itemIds: moved.itemIds },
			{ label: "요약 채우기", itemIds: [summary.itemId] },
		]);
		expect(seen.items.map((item) => (item.input as { ids?: string[] }).ids)).toEqual([
			[posts[0]],
			[posts[1]],
			[posts[2]],
			undefined,
		]);
		expect(seen.counts).toEqual({ toApply: 4, applied: 0, failed: 0, stale: 0, reverted: 0 });
		// What the records are called, for the rows: the entry's title and address, the folder's name.
		expect(seen.records[`entry:${posts[1]}`]).toEqual({ title: "리액트 18 정리", detail: null });
		expect(seen.records[`folder:${box}`]).toEqual({ title: "2024", detail: null });
		// Nothing moved.
		expect((await row(posts[0])).folder_id).toBeNull();
		expect(await activity()).toHaveLength(4);
	});

	it("10-1 an item left out is not applied, and the count of what applying would run follows", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘"), await newPost("셋")];
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemIds } = await monti.proposals.add(
			proposal,
			"entries.moveToFolder",
			{ ids: posts, folder: box },
			"옮기기",
		);

		const out = (await monti.run("proposals.include", { ids: [itemIds[1]], included: false }, admin)) as Written<{
			changed: string[];
		}>;
		expect(out.output.changed).toEqual([itemIds[1]]);
		expect(out.activityId).toBeNull();
		expect((await view(proposal)).counts.toApply).toBe(2);
		await monti.run("proposals.include", { ids: [itemIds[1]], included: true }, admin);
		expect((await view(proposal)).counts.toApply).toBe(3);
		await monti.run("proposals.include", { ids: [itemIds[1]], included: false }, admin);

		const results = await monti.proposals.apply(proposal);
		expect(results.map((result) => result.state)).toEqual(["applied", "discarded", "applied"]);
		expect(await Promise.all(posts.map(async (id) => (await row(id)).folder_id))).toEqual([box, null, box]);
		expect((await view(proposal)).status).toBe("applied");
	});

	it("10-1 two changes of one place cannot wait side by side: the assistant is told to make them one", async () => {
		const monti = site();
		const id = await newPost("발행 후 고친 글", ["첫 문단입니다.", "둘째 문단입니다."]);
		const proposal = await monti.proposals.create("c1", "다듬어 줘");
		const at = await version(id);
		await monti.proposals.add(proposal, "body.edit", {
			id,
			version: at,
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 1, text: "맨 첫" }],
		});
		await expect(
			monti.proposals.add(proposal, "body.edit", {
				id,
				version: at,
				ops: [{ op: "replaceText", block: "b_1", from: 5, to: 8, text: "." }],
			}),
		).rejects.toMatchObject({ reason: { key: "proposals.samePlace" } });
		// Another block of the same entry is another place.
		await monti.proposals.add(proposal, "body.edit", {
			id,
			version: at,
			ops: [{ op: "replaceText", block: "b_2", from: 0, to: 2, text: "두 번째" }],
		});
		await monti.proposals.add(proposal, "entries.save", { id, version: at, values: { summary: "요약" } });
		await expect(
			monti.proposals.add(proposal, "entries.save", { id, version: at, values: { summary: "또 요약" } }),
		).rejects.toBeInstanceOf(CheckError);
		expect((await view(proposal)).items).toHaveLength(3);
	});
});

describe("applying (flow 2, 12–15)", () => {
	it("10-1 changes of one entry made from one reading all apply: a summary and two blocks", async () => {
		const monti = site();
		const id = await newPost("발행 후 고친 글", ["처음 글을 발행하고 나서", "바뀐 부분은 크게 두 가지입니다."]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "더 짧게 다듬어 줘");
		await monti.proposals.add(
			proposal,
			"entries.save",
			{ id, version: at, values: { summary: "고친 뒤 정리한 메모." } },
			"다듬기",
		);
		await monti.proposals.add(
			proposal,
			"body.edit",
			{ id, version: at, ops: [{ op: "replaceText", block: "b_1", from: 0, to: 6, text: "" }] },
			"다듬기",
		);
		await monti.proposals.add(
			proposal,
			"body.edit",
			{ id, version: at, ops: [{ op: "replaceText", block: "b_2", from: 7, to: 10, text: "" }] },
			"다듬기",
		);

		const results = await monti.proposals.apply(proposal);
		expect(results.map((result) => result.state)).toEqual(["applied", "applied", "applied"]);
		expect((await row(id)).values).toMatchObject({ summary: "고친 뒤 정리한 메모." });
		expect(await textOf(id)).toEqual(["발행하고 나서", "바뀐 부분은 두 가지입니다."]);
		// Three writes, each the assistant's in the log, each with its conversation.
		const rows = (
			await db.selectFrom("monti_activity").select(["actor", "conversation_id", "proposal_item_id"]).execute()
		).filter((each) => each.actor === "assistant");
		expect(rows).toHaveLength(3);
		expect(rows.every((each) => each.conversation_id === "c1" && each.proposal_item_id !== null)).toBe(true);
	});

	it("10-1 a save that brings a whole body does not follow another change: it is found changed, not laid over it", async () => {
		const monti = site();
		const id = await newPost("글", ["하나"]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		await monti.proposals.add(proposal, "entries.save", { id, version: at, values: { summary: "요약" } });
		await monti.proposals.add(proposal, "entries.save", { id, version: at, doc: body("통째로 바꾼 본문") });
		const results = await monti.proposals.apply(proposal);
		expect(results).toMatchObject([{ state: "applied" }, { state: "stale", reason: { key: "proposals.changed" } }]);
		expect(await textOf(id)).toEqual(["하나"]);
		expect((await view(proposal)).status).toBe("partial");
	});

	it("10-1 an item whose entry changed in the meantime is marked in the review and left out of an apply; made again, it applies", async () => {
		const monti = site();
		const [fresh, edited] = [await newPost("타입 정리 메모"), await newPost("쓰는 중인 글")];
		const proposal = await monti.proposals.create("c1", "이 두 편 요약 채워 줘");
		const first = await monti.proposals.add(
			proposal,
			"entries.save",
			{ id: fresh, version: 1, values: { summary: "타입 세 가지 메모." } },
			"요약 채우기",
		);
		const second = await monti.proposals.add(
			proposal,
			"entries.save",
			{ id: edited, version: 1, values: { summary: "도구를 고친 이유." } },
			"요약 채우기",
		);
		// The person goes on writing the second one.
		await monti.run("entries.save", { id: edited, version: 1, title: "쓰는 중인 글 (고침)" }, admin);

		const seen = await view(proposal);
		expect(seen.items.map((item) => item.stale)).toEqual([false, true]);
		expect(seen.counts).toMatchObject({ toApply: 1, stale: 1 });

		const results = await monti.proposals.apply(proposal);
		expect(results).toMatchObject([
			{ itemId: first.itemId, state: "applied" },
			{ itemId: second.itemId, state: "stale" },
		]);
		expect((await row(edited)).values).not.toHaveProperty("summary");
		expect((await row(edited)).title).toBe("쓰는 중인 글 (고침)");

		// "다시 만들기": the same item, made on the entry as it is now.
		await monti.proposals.replace(second.itemId, "entries.save", {
			id: edited,
			version: await version(edited),
			values: { summary: "도구를 고친 이유." },
		});
		expect((await view(proposal)).items[1]).toMatchObject({
			id: second.itemId,
			state: "pending",
			stale: false,
			included: true,
		});
		expect(await monti.proposals.apply(proposal)).toMatchObject([{ itemId: second.itemId, state: "applied" }]);
		expect((await row(edited)).values).toMatchObject({ summary: "도구를 고친 이유." });
		expect((await view(proposal)).status).toBe("applied");
	});

	it("10-1 an item that fails says why and the rest go on", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘"), await newPost("셋")];
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		await monti.proposals.add(proposal, "entries.moveToFolder", { ids: posts, folder: box });
		// The second went to the trash in the meantime, by another hand.
		await monti.run("trash.move", { rows: [{ kind: "entry", id: posts[1] }] }, admin);

		const results = await monti.proposals.apply(proposal);
		// "못 함 · 그 사이 휴지통으로 감": the item keeps the reason the write itself gave.
		expect(results).toMatchObject([
			{ state: "applied" },
			{ state: "failed", reason: { key: "entries.unknown" } },
			{ state: "applied" },
		]);
		const seen = await view(proposal);
		expect(seen.status).toBe("partial");
		expect(seen.counts).toMatchObject({ applied: 2, failed: 1 });
		expect(seen.items[1].reason).toMatchObject({ key: "entries.unknown" });
	});

	it("10-1 an apply reports each item as it lands, over the admin API and from the command line", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemIds } = await monti.proposals.add(proposal, "entries.moveToFolder", { ids: posts, folder: box });
		const api = createAdminApi(monti);
		const { token } = await startSession(db, "admin@monti.test", clock);
		const request = (name: string, input: unknown, cookie = `monti_session=${token}`) =>
			api(
				new Request(`https://site.test/admin/api/streams/${name}`, {
					method: "POST",
					headers: { cookie },
					body: JSON.stringify({ input }),
				}),
			);

		// Nobody without a session starts a stream; a stream that does not exist and an input that does not fit are answers with a status.
		expect((await request("proposals.apply", { id: proposal }, "")).status).toBe(401);
		expect((await request("proposals.nothing", { id: proposal })).status).toBe(404);
		expect((await request("proposals.apply", {})).status).toBe(400);
		expect((await row(posts[0])).folder_id).toBeNull();

		const response = await request("proposals.apply", { id: proposal });
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/x-ndjson");
		const events = (await response.text())
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as ApplyEvent);
		expect(events).toMatchObject([
			{ type: "item", done: 1, total: 2, itemId: itemIds[0], state: "applied" },
			{ type: "item", done: 2, total: 2, itemId: itemIds[1], state: "applied" },
			{ type: "end", results: [{ state: "applied" }, { state: "applied" }] },
		]);
		expect((await row(posts[1])).folder_id).toBe(box);

		// A second proposal, from the terminal: the same events, a line each.
		const again = await monti.proposals.create("c1", "다시 꺼내 줘");
		await monti.proposals.add(again, "entries.moveToFolder", { ids: [posts[0]], folder: null });
		const lines: string[] = [];
		expect(
			await runCli(monti, ["proposals.apply", "--id", again], {
				out: (line) => lines.push(line),
				err: (line) => lines.push(line),
			}),
		).toBe(0);
		expect(lines.map((line) => JSON.parse(line).type)).toEqual(["item", "end"]);
		expect((await row(posts[0])).folder_id).toBeNull();
	});

	it("10-3 16-5 a session of the dev server's bypass opens a stream only while the bypass holds for the request, as it opens an operation", async () => {
		const monti = site();
		const post = await newPost("하나");
		const proposal = await monti.proposals.create("c1", "보관해 줘");
		await monti.proposals.add(proposal, "entries.archive", { ids: [post] });
		const api = createAdminApi(monti);
		const { token } = await startSession(db, "dev", clock);
		const none = new AbortController().signal;
		// From another machine, or with the bypass off: nothing, as with no session at all.
		expect(await api.stream("proposals.apply", { input: { id: proposal } }, token, none)).toEqual({
			status: 401,
			body: { error: "unauthenticated" },
		});
		expect((await row(post)).status).toBe("draft");
		// While it holds, the stream runs as a signed-in person's: the write it makes is the assistant's in the activity log, as under any session.
		const answer = await api.stream("proposals.apply", { input: { id: proposal } }, token, none, true);
		if (!("events" in answer)) throw new Error("the stream did not start");
		for await (const _event of answer.events);
		expect((await row(post)).status).toBe("archived");
		expect(await activity()).toContainEqual({ operation: "entries.archive", actor: "assistant" });
	});

	it("10-1 a stream that fails after it began says so as its last event", async () => {
		const monti = site();
		const api = createAdminApi(monti);
		const { token } = await startSession(db, "admin@monti.test", clock);
		const answer = await api.stream(
			"proposals.apply",
			{ input: { id: "no-such-proposal" } },
			token,
			new AbortController().signal,
		);
		// Nothing had been sent yet, so it is an answer with a status, like an operation's.
		expect(answer).toEqual({ status: 422, body: { error: "check-failed", reason: { key: "proposals.unknown" } } });
	});
});

describe("an apply cut short (flow 2, 14)", () => {
	it("10-4 goes on with what is left when it is run again, and applies nothing twice", async () => {
		const ids = [await newPost("하나"), await newPost("둘"), await newPost("셋"), await newPost("넷")];
		const box = await folder("2024");
		const monti = site();
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemIds } = await monti.proposals.add(proposal, "entries.moveToFolder", { ids, folder: box });
		const folders = async () => Promise.all(ids.map(async (id) => (await row(id)).folder_id));

		const [third, fourth] = await db
			.selectFrom("monti_proposal_item")
			.selectAll()
			.where("id", "in", itemIds.slice(2))
			.orderBy("position")
			.execute();
		// The server dies after the second item, still holding the proposal.
		await monti.proposals.apply(proposal, itemIds.slice(0, 2));
		await db
			.updateTable("monti_proposal_item")
			.set({ state: "pending" })
			.where("id", "in", [third.id, fourth.id])
			.execute();
		await db
			.updateTable("monti_proposal")
			.set({ applying_until: new Date(clock.getTime() + 30_000), applying_token: "the apply that died" })
			.where("id", "=", proposal)
			.execute();
		expect(await folders()).toEqual([box, box, null, null]);

		// While the dead apply still holds the proposal, another cannot start beside it.
		await expect(site().proposals.apply(proposal)).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		expect((await view(proposal)).applying).toBe(true);

		// It lets go after its time; the next apply, in a new process, runs only what is left.
		clock = new Date(clock.getTime() + 31_000);
		const before = (await activity()).length;
		const results = await site().proposals.apply(proposal);
		expect(results.map((result) => [result.itemId, result.state])).toEqual([
			[third.id, "applied"],
			[fourth.id, "applied"],
		]);
		expect((await activity()).length).toBe(before + 2);
		expect(await folders()).toEqual([box, box, box, box]);
		expect(await view(proposal)).toMatchObject({ status: "applied", applying: false });
		// Put back from the card, all four go back.
		const reverted = (await site().run("proposals.revert", { id: proposal }, admin)) as Written<{ reverted: string[] }>;
		expect(reverted.output.reverted).toHaveLength(4);
		expect(await folders()).toEqual([null, null, null, null]);
	});

	it("10-4 changes of one entry go on after the cut too: the later ones follow what the earlier ones left", async () => {
		const id = await newPost("글", ["하나 문단", "둘 문단", "셋 문단"]);
		const at = await version(id);
		const monti = site();
		const proposal = await monti.proposals.create("c1", "다듬어 줘");
		const items = [];
		for (const block of ["b_1", "b_2", "b_3"])
			items.push(
				(
					await monti.proposals.add(proposal, "body.edit", {
						id,
						version: at,
						ops: [{ op: "replaceText", block, from: 0, to: 1, text: "새" }],
					})
				).itemId,
			);
		// The first is applied; then the apply is cut (here: only the first was kept in that run).
		await monti.run("proposals.include", { ids: items.slice(1), included: false }, admin);
		await db.updateTable("monti_proposal_item").set({ state: "pending" }).where("id", "in", items.slice(1)).execute();
		const first = await site().proposals.apply(proposal, [items[0]]);
		expect(first[0]).toMatchObject({ state: "applied" });
		await db
			.updateTable("monti_proposal_item")
			.set({ state: "pending", included: true })
			.where("id", "in", items.slice(1))
			.execute();

		// A new process, with nothing in memory of the first run.
		expect((await view(proposal)).items.map((item) => item.stale)).toEqual([false, false, false]);
		const rest = await site().proposals.apply(proposal);
		expect(rest.map((result) => result.state)).toEqual(["applied", "applied"]);
		expect(await textOf(id)).toEqual(["새나 문단", "새 문단", "새 문단"]);
	});
});

describe("putting it back, and throwing it away (flow 2, 16)", () => {
	it("10-1 everything an apply changed is put back from the card; what was changed since stays, with its reason", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemIds } = await monti.proposals.add(proposal, "entries.moveToFolder", { ids: posts, folder: box });
		await monti.proposals.apply(proposal);
		// The person renames the second one afterwards.
		await monti.run("entries.save", { id: posts[1], version: await version(posts[1]), title: "둘 (고침)" }, admin);

		const reverted = (await monti.run("proposals.revert", { id: proposal }, admin)) as Written<{
			reverted: string[];
			kept: string[];
		}>;
		expect(reverted.output).toEqual({ reverted: [itemIds[0]], kept: [itemIds[1]] });
		expect((await row(posts[0])).folder_id).toBeNull();
		expect(await row(posts[1])).toMatchObject({ folder_id: box, title: "둘 (고침)" });
		const seen = await view(proposal);
		expect(seen.items).toMatchObject([
			{ state: "reverted", reason: null },
			{ state: "applied", reason: { key: "activity.changedSince" } },
		]);
		expect(seen.status).toBe("partial");
		// The revert is a row of the log itself, the person's.
		expect(await activity()).toContainEqual({ operation: "proposals.revert", actor: "admin" });
	});

	it("10-1 a proposal put back whole reads as reverted", async () => {
		const monti = site();
		const id = await newPost("하나");
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: box });
		await monti.proposals.apply(proposal);
		await monti.run("proposals.revert", { id: proposal }, admin);
		expect(await view(proposal)).toMatchObject({ status: "reverted", counts: { reverted: 1, applied: 0 } });
		expect((await row(id)).folder_id).toBeNull();
	});

	it("10-1 a proposal thrown away changes nothing and leaves no row in the activity log", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "휴지통으로 보내 줘");
		await monti.proposals.add(
			proposal,
			"trash.move",
			{ rows: posts.map((id) => ({ kind: "entry", id })) },
			"휴지통으로 보내기",
		);
		const before = await activity();

		const thrown = (await monti.run("proposals.discard", { proposal }, admin)) as Written<{ discarded: string[] }>;
		expect(thrown.output.discarded).toHaveLength(2);
		expect(thrown.activityId).toBeNull();
		expect(await activity()).toEqual(before);
		expect(await view(proposal)).toMatchObject({ status: "discarded", counts: { toApply: 0 } });
		expect((await row(posts[0])).trashed_at).toBeNull();
		// Thrown away, it cannot be applied after all.
		expect(await monti.proposals.apply(proposal)).toEqual([]);
		await expect(monti.run("proposals.discard", { ids: ["x"], proposal }, admin)).rejects.toThrow(/Invalid input/);
	});
});

describe("a person's decision while an apply runs (review 1 of #472)", () => {
	it("10-3 an item discarded after the apply began is not written", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "보관해 줘");
		const { itemIds } = await monti.proposals.add(proposal, "entries.archive", { ids: posts });
		// The first item lands; before the apply reaches the second, the person throws the second away.
		const results = await monti.proposals.apply(proposal, undefined, async (progress) => {
			if (progress.itemId === itemIds[0]) await site().run("proposals.discard", { ids: [itemIds[1]] }, admin);
		});
		expect(results).toMatchObject([{ itemId: itemIds[0], state: "applied" }]);
		expect((await row(posts[0])).status).toBe("archived");
		expect((await row(posts[1])).status).toBe("draft");
		expect((await view(proposal)).items.map((item) => item.state)).toEqual(["applied", "discarded"]);
	});

	it("10-3 an item left out after the apply began is not written, and one made again is applied as it is now", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘"), await newPost("셋")];
		const proposal = await monti.proposals.create("c1", "보관하고 이름 고쳐 줘");
		const archived = await monti.proposals.add(proposal, "entries.archive", { ids: posts.slice(0, 2) });
		const at = await version(posts[2]);
		const renamed = await monti.proposals.add(proposal, "entries.save", {
			id: posts[2],
			version: at,
			title: "셋 (처음 제안)",
		});
		await monti.proposals.apply(proposal, undefined, async (progress) => {
			if (progress.itemId !== archived.itemIds[0]) return;
			await site().run("proposals.include", { ids: [archived.itemIds[1]], included: false }, admin);
			// The third is changed at its place: the same change, with another name.
			await site().proposals.replace(renamed.itemId, "entries.save", {
				id: posts[2],
				version: at,
				title: "셋 (새 이름)",
			});
		});
		expect((await row(posts[1])).status).toBe("draft");
		expect((await row(posts[2])).title).toBe("셋 (새 이름)");
		expect((await view(proposal)).items.map((item) => item.state)).toEqual(["applied", "discarded", "applied"]);
	});

	it("10-3 a discard that comes while the item's write is under way waits for it, and then finds the item applied", async () => {
		const probe = slowWork();
		const monti = site({ plugins: [probe.plugin] });
		const proposal = await monti.proposals.create("c1", "해 줘");
		const { itemId } = await monti.proposals.add(proposal, "probe.work", { name: "a" });
		const applying = monti.proposals.apply(proposal);
		await probe.entered("a");
		const discarding = site({ plugins: [probe.plugin] }).run("proposals.discard", { ids: [itemId] }, admin) as Promise<
			Written<{ discarded: string[] }>
		>;
		await wait(150);
		probe.open("a");
		expect(await applying).toMatchObject([{ itemId, state: "applied" }]);
		// The discard is told the truth: it threw nothing away.
		expect((await discarding).output.discarded).toEqual([]);
		expect((await itemRow(itemId)).state).toBe("applied");
	});

	it("10-1 a whole body saved and one of its blocks edited are one place, whichever operation asks first", async () => {
		const monti = site();
		const id = await newPost("글", ["original body"]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		await monti.proposals.add(proposal, "entries.save", { id, version: at, doc: body("ZZoriginal body") });
		// Its offsets count in the text the save replaces: applied after it, it would cut the wrong words.
		await expect(
			monti.proposals.add(proposal, "body.edit", {
				id,
				version: at,
				ops: [{ op: "replaceText", block: "b_1", from: 0, to: 8, text: "" }],
			}),
		).rejects.toMatchObject({ reason: { key: "proposals.samePlace" } });
		await monti.proposals.apply(proposal);
		expect(await textOf(id)).toEqual(["ZZoriginal body"]);

		// The other way round too.
		const other = await newPost("다른 글", ["original body"]);
		const second = await monti.proposals.create("c2", "고쳐 줘");
		const version2 = await version(other);
		await monti.proposals.add(second, "body.edit", {
			id: other,
			version: version2,
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 8, text: "" }],
		});
		await expect(
			monti.proposals.add(second, "entries.save", { id: other, version: version2, doc: body("ZZoriginal body") }),
		).rejects.toMatchObject({ reason: { key: "proposals.samePlace" } });
		// A block put in beside it is another place; a field is another place.
		await monti.proposals.add(second, "body.edit", {
			id: other,
			version: version2,
			ops: [{ op: "insert", after: "b_1", blocks: [paragraph("b_9", "새 문단")] }],
		});
		await monti.proposals.add(second, "entries.save", { id: other, version: version2, values: { summary: "요약" } });
		expect(await monti.proposals.apply(second)).toMatchObject([
			{ state: "applied" },
			{ state: "applied" },
			{ state: "applied" },
		]);
		expect(await textOf(other)).toEqual([" body", "새 문단"]);
	});

	it("10-1 a block edit does not follow a write that did not say what it changed", async () => {
		// A plugin's write that changes the entry and names no places: what it left of the body is not known.
		const stamp = defineOperation({
			name: "probe.stamp",
			kind: "write",
			description: "Put a mark at the start of an entry's first block.",
			input: z.object({ id: z.string() }),
			touches: (input) => [{ kind: "entry", id: input.id }],
			async run(input, ctx) {
				const entry = await ctx.db
					.selectFrom("entries")
					.select(["doc", "version"])
					.where("id", "=", input.id)
					.executeTakeFirstOrThrow();
				const doc = entry.doc as Doc;
				const first = doc.blocks[0];
				const next = {
					...doc,
					blocks: [
						{ ...first, content: [{ type: "text", text: `ZZ${(first.content?.[0] as { text: string }).text}` }] },
						...doc.blocks.slice(1),
					],
				};
				await ctx.db
					.updateTable("entries")
					.set({ doc: JSON.stringify(next), version: entry.version + 1 })
					.where("id", "=", input.id)
					.execute();
				return { id: input.id };
			},
			summary: () => ({ key: "probe.stamp" }),
		});
		const monti = site({ plugins: [definePlugin({ name: "probe", operations: [stamp] })] });
		const id = await newPost("글", ["original body"]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		await monti.proposals.add(proposal, "probe.stamp", { id });
		await monti.proposals.add(proposal, "body.edit", {
			id,
			version: at,
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 8, text: "" }],
		});
		expect(await monti.proposals.apply(proposal)).toMatchObject([{ state: "applied" }, { state: "stale" }]);
		expect(await textOf(id)).toEqual(["ZZoriginal body"]);
	});

	it("10-1 a proposal holds a stated number of items at most, and says so to the assistant", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "보관해 줘");
		await db
			.insertInto("monti_proposal_item")
			.values(
				Array.from({ length: MOST_ITEMS - 1 }, (_, index) => ({
					id: `filler-${index}`,
					proposal_id: proposal,
					position: index,
					operation: "entries.archive",
					input: JSON.stringify({ ids: ["none"] }),
					base_versions: JSON.stringify({}),
					state: "discarded" as const,
					reason: null,
					output: null,
					activity_id: null,
				})),
			)
			.execute();
		await expect(monti.proposals.add(proposal, "entries.archive", { ids: posts })).rejects.toMatchObject({
			reason: { key: "proposals.tooMany", values: { most: MOST_ITEMS } },
		});
		expect((await monti.proposals.add(proposal, "entries.archive", { ids: [posts[0]] })).itemIds).toHaveLength(1);
		expect((await view(proposal)).items).toHaveLength(MOST_ITEMS);
	});
});

describe("one apply at a time, however long a write takes (review 1 of #472)", () => {
	it("10-4 an apply whose write outlasts its hold keeps the proposal: it says it is still there while it works", async () => {
		const probe = slowWork();
		// Real time: the hold is 300 ms and the write takes more than two of them.
		const monti = createMonti({ db, schema, now: () => new Date(), plugins: [probe.plugin] });
		const proposal = await monti.proposals.create("c1", "해 줘");
		await monti.proposals.add(proposal, "probe.work", { name: "a" });
		const first = monti.proposals.apply(proposal, undefined, undefined, 300);
		await probe.entered("a");
		await wait(750);
		await expect(monti.proposals.apply(proposal, undefined, undefined, 300)).rejects.toMatchObject({
			reason: { key: "proposals.applying" },
		});
		probe.open("a");
		expect(await first).toMatchObject([{ state: "applied" }]);
		expect(probe.ran).toEqual({ a: 1 });
	});

	it("10-4 an apply that stopped saying so loses the proposal to the next one, writes nothing twice, and stops when it comes back", async () => {
		const probe = slowWork();
		const monti = site({ plugins: [probe.plugin] });
		const proposal = await monti.proposals.create("c1", "해 줘");
		const a = (await monti.proposals.add(proposal, "probe.work", { name: "a" })).itemId;
		const b = (await monti.proposals.add(proposal, "probe.work", { name: "b" })).itemId;
		const first = monti.proposals.apply(proposal);
		await probe.entered("a");
		// The first hangs in its first write, past its hold (the test's clock moves; its own "still here" never comes). A second apply takes over.
		clock = new Date(clock.getTime() + 61_000);
		const second = site({ plugins: [probe.plugin] }).proposals.apply(proposal);
		// The second waits at the item the first is still writing.
		await wait(200);
		expect(probe.ran).toEqual({ a: 1 });
		probe.open("a");
		probe.open("b");
		await expect(first).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		expect(await second).toMatchObject([{ itemId: b, state: "applied" }]);
		expect(probe.ran).toEqual({ a: 1, b: 1 });
		expect([(await itemRow(a)).state, (await itemRow(b)).state]).toEqual(["applied", "applied"]);
		expect(await view(proposal)).toMatchObject({ status: "applied", applying: false });
	});

	it("10-4 an item is recorded as applied by its own write: what it gave is there the moment the write is, for the items that need it", async () => {
		// A receiver is told after the write has committed and before the apply goes on: what it reads of the item then is what a crash would leave.
		const seen: { state: string; output: unknown; after: unknown }[] = [];
		let watched = "";
		const monti = site({
			receivers: [
				{
					destination: "plugin:watch",
					send: async (_event: MontiEvent) => {
						const item = await itemRow(watched);
						seen.push({ state: item.state, output: item.output, after: item.after_versions });
					},
				},
			],
		});
		const id = await newPost("글", ["본문"]);
		const proposal = await monti.proposals.create("c1", "발행해 줘");
		watched = (await monti.proposals.add(proposal, "entries.publish", { ids: [id] })).itemId;
		await monti.proposals.apply(proposal);
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ state: "applied", after: { [`entry:${id}`]: expect.any(Number) } });
		expect(seen[0].output).not.toBeNull();
	});

	it("10-4 an apply a host froze after a folder was made: its hold runs out, the next apply takes over and moves the entries into it", async () => {
		const monti = site();
		const id = await newPost("글");
		const proposal = await monti.proposals.create("c1", "새 폴더로 옮겨 줘");
		const made = await monti.proposals.add(proposal, "folders.create", {
			scope: { collection: "post" },
			parentId: null,
			name: "2024",
		});
		await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: { $item: made.itemId } });
		// The host freezes the process right after the first item; when it thaws, another apply has the proposal, and it stops.
		await expect(
			monti.proposals.apply(proposal, undefined, async () => {
				await db
					.updateTable("monti_proposal")
					.set({ applying_token: "the apply that took over" })
					.where("id", "=", proposal)
					.execute();
			}),
		).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		expect((await row(id)).folder_id).toBeNull();
		// Nothing lets go of the proposal by hand: the hold runs out, and the next apply goes on with what is left.
		await expect(site().proposals.apply(proposal)).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		clock = new Date(clock.getTime() + 61_000);
		expect(await site().proposals.apply(proposal)).toMatchObject([{ state: "applied" }]);
		const box = await db.selectFrom("folders").select("id").where("name", "=", "2024").executeTakeFirstOrThrow();
		expect((await row(id)).folder_id).toBe(box.id);
	});

	it("10-1 an apply runs to its end when whoever watched it is gone", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "보관해 줘");
		await monti.proposals.add(proposal, "entries.archive", { ids: posts });
		// The browser left: telling it of each item fails from the first one on.
		const results = await monti.proposals.apply(proposal, undefined, () => {
			throw new Error("nobody is listening");
		});
		expect(results).toMatchObject([{ state: "applied" }, { state: "applied" }]);
		expect([(await row(posts[0])).status, (await row(posts[1])).status]).toEqual(["archived", "archived"]);
		expect(await view(proposal)).toMatchObject({ status: "applied", applying: false });
	});

	it("10-4 an apply that took the proposal over reads what the other one's last write left: a change that follows it applies", async () => {
		// A plugin's write that renames an entry, slowly, and says what it changed.
		let entered = () => {};
		let open = () => {};
		const began = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const opened = new Promise<void>((resolve) => {
			open = resolve;
		});
		const retitle = defineOperation({
			name: "probe.retitle",
			kind: "write",
			description: "Rename an entry.",
			input: z.object({ id: z.string(), title: z.string() }),
			touches: (input) => [{ kind: "entry", id: input.id }],
			places: (input) => [`entry:${input.id}/title`],
			async run(input, ctx) {
				entered();
				await opened;
				await ctx.db
					.updateTable("entries")
					.set((eb) => ({ title: input.title, version: eb("version", "+", 1) }))
					.where("id", "=", input.id)
					.execute();
				return { id: input.id };
			},
			summary: () => ({ key: "probe.retitle" }),
		});
		const plugins = [definePlugin({ name: "probe", operations: [retitle] })];
		const monti = site({ plugins });
		const id = await newPost("처음 제목", ["처음 본문"]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		await monti.proposals.add(proposal, "probe.retitle", { id, title: "바꾼 제목" });
		const edit = await monti.proposals.add(proposal, "body.edit", {
			id,
			version: at,
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 2, text: "바꾼" }],
		});
		const first = monti.proposals.apply(proposal);
		await began;
		// The first hangs in its write past its hold; the second takes over, and waits at the entry the first is writing.
		clock = new Date(clock.getTime() + 61_000);
		const second = site({ plugins }).proposals.apply(proposal);
		await wait(200);
		open();
		await expect(first).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		// The second saw the first's write only after it began: it reads again, and the edit follows the rename instead of being "changed".
		expect(await second).toMatchObject([{ itemId: edit.itemId, state: "applied" }]);
		expect(await row(id)).toMatchObject({ title: "바꾼 제목" });
		expect(await textOf(id)).toEqual(["바꾼 본문"]);
	});
});

describe("a write of the assistant's own books", () => {
	it("10-1 given accepted proposal items it is refused at once, for the developer: it has no row of the log to tie them to", async () => {
		const books = definePlugin({
			name: "books",
			operations: [
				defineOperation({
					name: "books.note",
					kind: "write",
					bookkeeping: true,
					description: "Note something in the assistant's own books.",
					input: z.object({}),
					run: async () => ({}),
					summary: () => ({ key: "books.note" }),
				}),
			],
		});
		const monti = site({ plugins: [books] });
		await expect(monti.run("books.note", {}, { actor: "admin", accepted: ["any-item"] })).rejects.toThrow(
			"cannot save accepted proposal items",
		);
		// Alone it runs.
		await monti.run("books.note", {}, admin);
	});
});

describe("putting back more than one change of an entry (review 1 of #472)", () => {
	it("10-1 a title change and a body change of one entry both go back, and both writes are undone", async () => {
		const monti = site();
		const id = await newPost("처음 제목", ["처음 본문"]);
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		await monti.proposals.add(proposal, "entries.save", { id, version: at, title: "바꾼 제목" });
		await monti.proposals.add(proposal, "body.edit", {
			id,
			version: at,
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 2, text: "바꾼" }],
		});
		await monti.proposals.apply(proposal);
		expect(await row(id)).toMatchObject({ title: "바꾼 제목" });
		expect(await textOf(id)).toEqual(["바꾼 본문"]);

		const reverted = (await monti.run("proposals.revert", { id: proposal }, admin)) as Written<{
			reverted: string[];
			kept: string[];
		}>;
		expect(reverted.output.kept).toEqual([]);
		expect(reverted.output.reverted).toHaveLength(2);
		expect(await row(id)).toMatchObject({ title: "처음 제목" });
		expect(await textOf(id)).toEqual(["처음 본문"]);
		expect(await view(proposal)).toMatchObject({ status: "reverted" });
	});

	it("10-1 a later item that wrote a record again with what it already held does not stop the revert: both are put back, and the first change is undone", async () => {
		// A record whose snapshot is its contents alone (as the settings' and a collection's admin values are), with a write two items of one
		// proposal can both make: the entries' snapshot holds the version too, so no two of theirs are ever the same.
		await sql`create table if not exists plain_word (id text primary key, version integer not null, word text not null)`.execute(
			db,
		);
		await sql`delete from plain_word`.execute(db);
		await sql`insert into plain_word (id, version, word) values ('w', 2, 'A')`.execute(db);
		const word = async () =>
			(await sql<{ version: number; word: string }>`select version, word from plain_word`.execute(db)).rows[0];
		const plain = definePlugin({
			name: "plain",
			recordKinds: [
				{
					kind: "plainWord",
					async load(on, ids) {
						const { rows } = await sql<{
							id: string;
							version: number;
							word: string;
						}>`select * from plain_word where id = any(${ids})`.execute(on);
						return rows.map((row) => ({ id: row.id, version: row.version, data: { word: row.word } }));
					},
					async restore(on, id, data) {
						await sql`update plain_word set word = ${(data as { word: string }).word}, version = version + 1 where id = ${id}`.execute(
							on,
						);
					},
				},
			],
			operations: [
				defineOperation({
					name: "plain.write",
					kind: "write",
					description: "Write the word, from one of two hands.",
					input: z.object({ id: z.string(), word: z.string(), hand: z.string() }),
					touches: (input) => [{ kind: "plainWord", id: input.id }],
					follows: (input) => input,
					places: (input) => [`plainWord:${input.id}/${input.hand}`],
					async run(input, ctx) {
						await sql`update plain_word set word = ${input.word}, version = version + 1 where id = ${input.id}`.execute(
							ctx.db,
						);
					},
					summary: () => ({ key: "plain.write" }),
				}),
			],
		});
		const monti = site({ plugins: [plain] });
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		// Item 1 changes the word, 2 to 3 (A to B). Item 2 writes the same word again, 3 to 4 (B to B).
		await monti.proposals.add(proposal, "plain.write", { id: "w", word: "B", hand: "left" });
		await monti.proposals.add(proposal, "plain.write", { id: "w", word: "B", hand: "right" });
		await monti.proposals.apply(proposal);
		expect(await word()).toEqual({ version: 4, word: "B" });

		const reverted = (await monti.run("proposals.revert", { id: proposal }, admin)) as Written<{
			reverted: string[];
			kept: string[];
		}>;
		// Item 2 had nothing to put back and is reverted, not "changed since"; item 1 then finds the record as its own step left it.
		expect(reverted.output.kept).toEqual([]);
		expect(reverted.output.reverted).toHaveLength(2);
		expect((await word())?.word).toBe("A");
		const seen = await view(proposal);
		expect(seen).toMatchObject({ status: "reverted" });
		expect(seen.items.map((item: { reason: unknown }) => item.reason)).toEqual([null, null]);
	});

	it("10-1 a change someone made between two of the proposal's stays: the later one goes back, the earlier one is left and can still be undone", async () => {
		const monti = site();
		const id = await newPost("처음 제목", ["처음 본문"]);
		const proposal = await monti.proposals.create("c1", "고쳐 줘");
		const first = await monti.proposals.add(proposal, "entries.save", {
			id,
			version: await version(id),
			title: "바꾼 제목",
		});
		await monti.proposals.apply(proposal);
		// A person changes the summary; then the assistant's second change is made on that.
		await monti.run("entries.save", { id, version: await version(id), values: { summary: "사람이 쓴 요약" } }, admin);
		await monti.proposals.add(proposal, "body.edit", {
			id,
			version: await version(id),
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 2, text: "바꾼" }],
		});
		await monti.proposals.apply(proposal);

		const reverted = (await monti.run("proposals.revert", { id: proposal }, admin)) as Written<{
			reverted: string[];
			kept: string[];
		}>;
		expect(reverted.output.kept).toEqual([first.itemId]);
		expect(await textOf(id)).toEqual(["처음 본문"]);
		expect(await row(id)).toMatchObject({ title: "바꾼 제목" });
		// The write it left is not used up: the activity log can still undo it when the person's change is out of the way.
		const kept = await itemRow(first.itemId);
		const write = await db
			.selectFrom("monti_activity")
			.select("undone_at")
			.where("id", "=", kept.activity_id as string)
			.executeTakeFirstOrThrow();
		expect(write.undone_at).toBeNull();
	});

	it("10-1 T29 putting a publication back takes the entry off the site and tells the receivers", async () => {
		const events: MontiEvent[] = [];
		const monti = site({
			receivers: [{ destination: "plugin:watch", send: async (event: MontiEvent) => void events.push(event) }],
		});
		const id = await newPost("글", ["본문"]);
		const proposal = await monti.proposals.create("c1", "발행해 줘");
		await monti.proposals.add(proposal, "entries.publish", { ids: [id] });
		await monti.proposals.apply(proposal);
		expect(events.map((event) => event.type)).toEqual(["entry.published"]);

		await monti.run("proposals.revert", { id: proposal }, admin);
		expect(await db.selectFrom("entry_published").select("entry_id").where("entry_id", "=", id).execute()).toEqual([]);
		expect(events.map((event) => event.type)).toEqual(["entry.published", "entry.unpublished"]);
		expect(events[1]).toMatchObject({ ids: [id] });
	});
});

describe("what the second review of the core found (#472)", () => {
	/** A plugin's write that renames several entries at once: one item that changes more than one record. */
	const retitleAll = defineOperation({
		name: "probe.retitleAll",
		kind: "write",
		description: "Rename entries.",
		input: z.object({ ids: z.array(z.string()), title: z.string() }),
		touches: (input) => input.ids.map((id) => ({ kind: "entry", id })),
		async run(input, ctx) {
			await ctx.db
				.updateTable("entries")
				.set((eb) => ({ title: input.title, version: eb("version", "+", 1) }))
				.where("id", "in", input.ids)
				.execute();
			return { ids: input.ids };
		},
		summary: () => ({ key: "probe.retitleAll" }),
	});
	/** A plugin's write that touches no record: its row in the activity log cannot be undone. */
	const ping = defineOperation({
		name: "probe.ping",
		kind: "write",
		description: "Do something outside the site's records.",
		input: z.object({}),
		run: async () => ({}),
		summary: () => ({ key: "probe.ping" }),
	});
	const probe = definePlugin({ name: "probe", operations: [retitleAll, ping] });
	const revert = (monti: ReturnType<typeof site>, id: string) =>
		monti.run("proposals.revert", { id }, admin) as Promise<Written<{ reverted: string[]; kept: string[] }>>;

	it("10-1 an item of which a part went back is put back, with how much of it stayed; a second revert finds nothing to do", async () => {
		const monti = site({ plugins: [probe] });
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "이름 맞춰 줘");
		const { itemId } = await monti.proposals.add(proposal, "probe.retitleAll", { ids: posts, title: "같은 이름" });
		await monti.proposals.apply(proposal);
		// A person renames the second one afterwards.
		await monti.run(
			"entries.save",
			{ id: posts[1], version: await version(posts[1]), title: "둘 (사람이 고침)" },
			admin,
		);

		const first = await revert(monti, proposal);
		expect(first.output).toEqual({ reverted: [itemId], kept: [] });
		expect([(await row(posts[0])).title, (await row(posts[1])).title]).toEqual(["하나", "둘 (사람이 고침)"]);
		const seen = await view(proposal);
		expect(seen.items).toMatchObject([
			{ state: "reverted", reason: { key: "proposals.partlyReverted", values: { count: 1 } } },
		]);
		expect(seen).toMatchObject({ status: "reverted", counts: { reverted: 1, applied: 0 } });

		// Again: nothing is left that a revert could put back, and nothing fails.
		expect((await revert(monti, proposal)).output).toEqual({ reverted: [], kept: [] });
		expect((await view(proposal)).items).toMatchObject([
			{ state: "reverted", reason: { key: "proposals.partlyReverted" } },
		]);
	});

	it("10-1 a write that cannot be undone, and one whose 30 days are over, each stay applied with the undo's own reason", async () => {
		const monti = site({ plugins: [probe] });
		const post = await newPost("하나");
		const proposal = await monti.proposals.create("c1", "해 줘");
		const pinged = await monti.proposals.add(proposal, "probe.ping", {});
		const archived = await monti.proposals.add(proposal, "entries.archive", { ids: [post] });
		await monti.proposals.apply(proposal);

		// The archive is put back; the write that touched no record cannot be.
		expect((await revert(monti, proposal)).output).toEqual({ reverted: [archived.itemId], kept: [pinged.itemId] });
		expect((await view(proposal)).items).toMatchObject([
			{ state: "applied", reason: { key: "errors.notUndoable" } },
			{ state: "reverted", reason: null },
		]);

		const old = await monti.proposals.create("c2", "보관해 줘");
		const late = await monti.proposals.add(old, "entries.archive", { ids: [post] });
		await monti.proposals.apply(old);
		clock = new Date(clock.getTime() + 31 * 86_400_000);
		expect((await revert(site({ plugins: [probe] }), old)).output).toEqual({ reverted: [], kept: [late.itemId] });
		expect((await view(old)).items).toMatchObject([{ state: "applied", reason: { key: "errors.undoExpired" } }]);
		expect((await row(post)).status).toBe("archived");
	});

	it("10-1 a proposal is not put back while an apply holds it, and two reverts at once put each item back once", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const proposal = await monti.proposals.create("c1", "보관해 줘");
		const { itemIds } = await monti.proposals.add(proposal, "entries.archive", { ids: posts });
		await monti.proposals.apply(proposal, [itemIds[0]]);
		await db
			.updateTable("monti_proposal")
			.set({ applying_until: new Date(clock.getTime() + 30_000), applying_token: "an apply" })
			.where("id", "=", proposal)
			.execute();
		await expect(revert(monti, proposal)).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		expect((await row(posts[0])).status).toBe("archived");

		await db
			.updateTable("monti_proposal")
			.set({ applying_until: null, applying_token: null })
			.where("id", "=", proposal)
			.execute();
		const both = await Promise.all([revert(site(), proposal), revert(site(), proposal)]);
		// One of them put it back; the other waited for it and found nothing left.
		expect(both.flatMap((each) => each.output.reverted)).toEqual([itemIds[0]]);
		expect(both.flatMap((each) => each.output.kept)).toEqual([]);
		expect((await row(posts[0])).status).toBe("draft");
		expect((await view(proposal)).items[0]).toMatchObject({ state: "reverted", reason: null });
	});

	it("10-1 a change of an entry and then its publication apply in order; the same in the other order; a move too", async () => {
		const monti = site();
		const id = await newPost("글", ["본문"]);
		const box = await folder("2024");
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "요약 채우고 폴더로 옮기고 발행해 줘");
		await monti.proposals.add(proposal, "entries.save", { id, version: at, values: { summary: "새 요약" } });
		await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: box });
		await monti.proposals.add(proposal, "entries.publish", { ids: [id] });
		// Before anything is applied, the review shows none of them as changed in the meantime.
		expect((await view(proposal)).counts).toMatchObject({ toApply: 3, stale: 0 });
		expect(await monti.proposals.apply(proposal)).toMatchObject([
			{ state: "applied" },
			{ state: "applied" },
			{ state: "applied" },
		]);
		const published = await db
			.selectFrom("entry_published")
			.select("values")
			.where("entry_id", "=", id)
			.executeTakeFirstOrThrow();
		expect(published.values).toMatchObject({ summary: "새 요약" });
		expect((await row(id)).folder_id).toBe(box);

		// Published first, then changed: both apply, and the entry has a change the site does not show yet.
		const other = await newPost("다른 글", ["본문"]);
		const second = await monti.proposals.create("c2", "발행하고 요약 고쳐 줘");
		await monti.proposals.add(second, "entries.publish", { ids: [other] });
		await monti.proposals.add(second, "entries.save", {
			id: other,
			version: await version(other),
			values: { summary: "발행 뒤 요약" },
		});
		expect(await monti.proposals.apply(second)).toMatchObject([{ state: "applied" }, { state: "applied" }]);
		expect(await row(other)).toMatchObject({ status: "published", has_unpublished_changes: true });
	});

	it("10-1 two writes of the same thing of one record do not wait side by side: publish twice, publish and archive, two moves, anything beside the trash", async () => {
		const monti = site();
		const id = await newPost("글", ["본문"]);
		const boxes = [await folder("2024"), await folder("2025")];
		const at = await version(id);
		const same = { reason: { key: "proposals.samePlace" } };
		const proposal = await monti.proposals.create("c1", "발행해 줘");
		await monti.proposals.add(proposal, "entries.publish", { ids: [id] });
		await expect(monti.proposals.add(proposal, "entries.publish", { ids: [id] })).rejects.toMatchObject(same);
		await expect(monti.proposals.add(proposal, "entries.archive", { ids: [id] })).rejects.toMatchObject(same);
		await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: boxes[0] });
		await expect(
			monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: boxes[1] }),
		).rejects.toMatchObject(same);
		// The trash takes the whole record: it waits beside nothing else of it, and nothing else waits beside it.
		await expect(monti.proposals.add(proposal, "trash.move", { rows: [{ kind: "entry", id }] })).rejects.toMatchObject(
			same,
		);
		const trash = await monti.proposals.create("c2", "지워 줘");
		await monti.proposals.add(trash, "trash.move", { rows: [{ kind: "entry", id }] });
		await expect(
			monti.proposals.add(trash, "entries.save", { id, version: at, title: "새 제목" }),
		).rejects.toMatchObject(same);
	});

	it("10-3 a change made again at its place stays the same change: another operation or another record is refused", async () => {
		const monti = site();
		const posts = [await newPost("하나"), await newPost("둘")];
		const at = await version(posts[0]);
		const proposal = await monti.proposals.create("c1", "이름 고쳐 줘");
		const { itemId } = await monti.proposals.add(proposal, "entries.save", {
			id: posts[0],
			version: at,
			title: "하나 (제안)",
		});
		const other = { reason: { key: "proposals.otherChange" } };
		await expect(monti.proposals.replace(itemId, "entries.archive", { ids: [posts[0]] })).rejects.toMatchObject(other);
		await expect(
			monti.proposals.replace(itemId, "trash.move", { rows: [{ kind: "entry", id: posts[0] }] }),
		).rejects.toMatchObject(other);
		await expect(
			monti.proposals.replace(itemId, "entries.save", {
				id: posts[1],
				version: await version(posts[1]),
				title: "둘 (제안)",
			}),
		).rejects.toMatchObject(other);
		expect((await view(proposal)).items).toMatchObject([
			{ operation: "entries.save", input: { id: posts[0], title: "하나 (제안)" } },
		]);
		await monti.proposals.replace(itemId, "entries.save", { id: posts[0], version: at, title: "하나 (다시)" });
		expect((await view(proposal)).items).toMatchObject([{ input: { title: "하나 (다시)" } }]);
	});

	it("10-4 a tool call run again finds the item it made also after a request at the item's place changed it", async () => {
		const monti = site();
		const id = await newPost("하나");
		const at = await version(id);
		const proposal = await monti.proposals.create("c1", "이름 고쳐 줘");
		const made = await monti.proposals.add(
			proposal,
			"entries.save",
			{ id, version: at, title: "제안" },
			"이름",
			"run-1:call-1",
		);
		await monti.proposals.replace(
			made.itemId,
			"entries.save",
			{ id, version: at, title: "자리에서 고친 제안" },
			"run-2:call-1",
		);
		const again = await monti.proposals.add(
			proposal,
			"entries.save",
			{ id, version: at, title: "제안" },
			"이름",
			"run-1:call-1",
		);
		expect(again.itemIds).toEqual(made.itemIds);
		expect((await view(proposal)).items).toMatchObject([{ input: { title: "자리에서 고친 제안" } }]);
	});
});

describe("what the review after the merge found (#472)", () => {
	it("05-1 a save that accepts items takes their proposal before any record, also the record its own `touches` holds: it does not hold a folder while it waits", async () => {
		const monti = site();
		const post = await newPost("옮길 글");
		const target = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemId } = await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [post], folder: target });
		let free: boolean | null = null;
		let saving: Promise<unknown> = Promise.resolve();
		// Something that decides about the proposal holds its row (a discard, a revert), and the save comes meanwhile.
		await db.transaction().execute(async (held) => {
			await held.selectFrom("monti_proposal").select("id").where("id", "=", proposal).forUpdate().execute();
			saving = monti
				.run("entries.moveToFolder", { ids: [post], folder: target }, { ...admin, accepted: [itemId] })
				.catch((error: unknown) => error);
			await wait(300);
			// The save waits for the proposal with nothing in its hands: the folder its `touches` would hold is free for whoever holds the proposal.
			await db.transaction().execute(async (other) => {
				const { rows } = await sql<{ free: boolean }>`
					select pg_try_advisory_xact_lock(hashtext(${`monti:record:folder:${target}`})) as free
				`.execute(other);
				free = rows[0]?.free ?? null;
			});
		});
		await saving;
		expect(free).toBe(true);
	});
});

describe("only a person takes a proposal", () => {
	it("10-3 applying, leaving out, putting back and throwing away are no tools of the assistant, by any way in", async () => {
		const monti = site();
		const id = await newPost("하나");
		const box = await folder("2024");
		const proposal = await monti.proposals.create("c1", "옮겨 줘");
		const { itemId } = await monti.proposals.add(proposal, "entries.moveToFolder", { ids: [id], folder: box });
		const tools = agentTools(monti).map((tool) => tool.name);
		expect(tools).toContain("proposals.get");
		const session = { conversationId: "c1", proposalId: proposal };
		for (const [name, input] of [
			["proposals.include", { ids: [itemId], included: false }],
			["proposals.revert", { id: proposal }],
			["proposals.discard", { proposal }],
			["proposals.apply", { id: proposal }],
		] as const) {
			expect(tools).not.toContain(name);
			await expect(callAgentTool(monti, name, input, session)).rejects.toBeInstanceOf(UnknownOperationError);
			if (name !== "proposals.apply") {
				await expect(monti.run(name, input, { actor: "assistant" })).rejects.toBeInstanceOf(ForbiddenError);
				await expect(monti.proposals.add(proposal, name, input)).rejects.toBeInstanceOf(ForbiddenError);
			}
		}
		expect((await row(id)).folder_id).toBeNull();
		expect((await view(proposal)).items[0]).toMatchObject({ state: "pending", included: true });
	});
});
