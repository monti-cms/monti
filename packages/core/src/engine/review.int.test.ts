import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { startSession } from "../auth/session";
import type { Doc } from "../body/doc";
import { createAdminApi } from "../entry/api";
import { runCli } from "../entry/cli";
import { agentTools, callAgentTool } from "../entry/tools";
import { CheckError, ForbiddenError, UnknownOperationError } from "../errors";
import { type ApplyEvent, createMonti, type MontiOptions } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { ProposalView } from "./proposals";

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

		// The server dies during the third item, at the worst moment: the item's write is in, and the item does not say so yet.
		const [third, fourth] = await db
			.selectFrom("monti_proposal_item")
			.selectAll()
			.where("id", "in", itemIds.slice(2))
			.orderBy("position")
			.execute();
		await monti.proposals.apply(proposal, itemIds.slice(0, 2));
		await db
			.updateTable("monti_proposal_item")
			.set({ state: "pending" })
			.where("id", "in", [third.id, fourth.id])
			.execute();
		await monti.run("entries.moveToFolder", third.input, {
			actor: "assistant",
			conversationId: "c1",
			proposalItemId: third.id,
			versions: third.base_versions,
		});
		expect(await folders()).toEqual([box, box, box, null]);
		expect((await view(proposal)).items.map((item) => item.state)).toEqual([
			"applied",
			"applied",
			"pending",
			"pending",
		]);

		// While the dead apply still holds the proposal, another cannot start beside it.
		await db
			.updateTable("monti_proposal")
			.set({ applying_until: new Date(clock.getTime() + 30_000) })
			.where("id", "=", proposal)
			.execute();
		await expect(site().proposals.apply(proposal)).rejects.toMatchObject({ reason: { key: "proposals.applying" } });
		expect((await view(proposal)).applying).toBe(true);

		// It lets go after its time; the next apply, in a new process, runs only what is left: the third is known to be in, the fourth is applied.
		clock = new Date(clock.getTime() + 31_000);
		const before = (await activity()).length;
		const results = await site().proposals.apply(proposal);
		expect(results.map((result) => [result.itemId, result.state])).toEqual([
			[third.id, "applied"],
			[fourth.id, "applied"],
		]);
		expect((await activity()).length).toBe(before + 1);
		expect(await folders()).toEqual([box, box, box, box]);
		expect(await view(proposal)).toMatchObject({ status: "applied", applying: false });
		// Put back from the card, all four go back: the third's write is the proposal's as much as the others'.
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
		expect((await activity()).at(-1)).toEqual({ operation: "proposals.revert", actor: "admin" });
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
