import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { agentTools } from "../entry/tools";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});
const site = () => createMonti({ db, schema });

type Item = { id: string; request: string; operation: string; input: { title?: string } };
const forEntry = (id: string) =>
	site().run("proposals.forTarget", { kind: "entry", id }, { actor: "admin" }) as Promise<Item[]>;
const version = async (id: string) =>
	(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;

async function newPost(title: string) {
	const written = (await site().run(
		"entries.create",
		{ collection: "post", locale: "ko", title },
		{ actor: "admin" },
	)) as {
		output: { id: string };
	};
	return written.output.id;
}

/** The assistant proposes a new title for an entry, in a conversation of its own. */
async function propose(id: string, title: string, request = "retitle it") {
	const monti = site();
	const proposalId = await monti.proposals.create(`c-${title}`, request);
	const { itemId } = await monti.proposals.add(proposalId, "entries.save", { id, version: await version(id), title });
	return itemId;
}

beforeEach(async () => {
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of ["entries", "monti_proposal", "monti_delivery", "monti_activity", "schema_state"] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("proposals on a screen", () => {
	it("05-2 an entry's pending proposals stay on the server, with the request they came from, until discarded", async () => {
		const id = await newPost("Hello");
		const other = await newPost("Other");
		const first = await propose(id, "Hello, world", "make the title friendlier");
		await propose(other, "Other title");

		expect(await forEntry(id)).toEqual([
			expect.objectContaining({ id: first, operation: "entries.save", request: "make the title friendlier" }),
		]);
		// Nothing changed: a proposal waits for a person.
		expect((await db.selectFrom("entries").select("title").where("id", "=", id).executeTakeFirstOrThrow()).title).toBe(
			"Hello",
		);

		await site().run("proposals.discard", { ids: [first] }, { actor: "admin" });
		expect(await forEntry(id)).toEqual([]);
	});

	it("05-3 a proposal taken in the screen is applied with the person's save, shows its conversation in the log and is undone with it", async () => {
		const id = await newPost("Hello");
		const itemId = await propose(id, "Hello, world");
		const before = await version(id);

		// The screen took the proposal into its draft; the person saves the draft, naming the item.
		const response = await signedInApi(site())(
			new Request("https://site.test/admin/api/operations/entries.save", {
				method: "POST",
				body: JSON.stringify({ input: { id, version: before, title: "Hello, world!" }, accepted: [itemId] }),
			}),
		);
		expect(response.status).toBe(200);
		const { activityId } = (await response.json()) as { activityId: string };

		const item = await db
			.selectFrom("monti_proposal_item")
			.selectAll()
			.where("id", "=", itemId)
			.executeTakeFirstOrThrow();
		expect(item).toMatchObject({ state: "applied", activity_id: activityId });
		const row = await db
			.selectFrom("monti_activity")
			.selectAll()
			.where("id", "=", activityId)
			.executeTakeFirstOrThrow();
		expect(row.conversation_id).toBe("c-Hello, world");
		expect(await forEntry(id)).toEqual([]);

		await site().run("activity.undo", { id: activityId }, { actor: "admin" });
		expect((await db.selectFrom("entries").select("title").where("id", "=", id).executeTakeFirstOrThrow()).title).toBe(
			"Hello",
		);
	});

	it("05-3 a save that fails leaves the taken proposal pending", async () => {
		const id = await newPost("Hello");
		const itemId = await propose(id, "Hello, world");
		await expect(
			site().run("entries.save", { id, version: 999, title: "x" }, { actor: "admin", accepted: [itemId] }),
		).rejects.toMatchObject({ code: "conflict" });
		expect(await forEntry(id)).toEqual([expect.objectContaining({ id: itemId })]);
	});

	it("05-3 only a pending proposal is taken: one discarded meanwhile stays discarded", async () => {
		const id = await newPost("Hello");
		const itemId = await propose(id, "Hello, world");
		await site().run("proposals.discard", { ids: [itemId] }, { actor: "admin" });
		await site().run(
			"entries.save",
			{ id, version: await version(id), title: "Mine" },
			{ actor: "admin", accepted: [itemId] },
		);
		const item = await db
			.selectFrom("monti_proposal_item")
			.select(["state", "activity_id"])
			.where("id", "=", itemId)
			.executeTakeFirstOrThrow();
		expect(item).toEqual({ state: "discarded", activity_id: null });
	});

	it("05-3 a screen cannot attach another record's proposal to its save", async () => {
		const id = await newPost("Hello");
		const other = await newPost("Other");
		const itemId = await propose(other, "Other title");

		await expect(
			site().run(
				"entries.save",
				{ id, version: await version(id), title: "Mine" },
				{ actor: "admin", accepted: [itemId] },
			),
		).rejects.toThrow("Check failed");
		expect((await db.selectFrom("entries").select("title").where("id", "=", id).executeTakeFirstOrThrow()).title).toBe(
			"Hello",
		);
		expect(await forEntry(other)).toEqual([expect.objectContaining({ id: itemId })]);
	});

	it("05-5 only a person discards a proposal: it is no tool of the assistant", () => {
		expect(agentTools(site()).map((tool) => tool.name)).not.toContain("proposals.discard");
	});

	it("05-1 a proposed write whose caller is no longer the one to write stores nothing: not a new item, not a change in an item's place", async () => {
		const monti = site();
		const id = await newPost("Hello");
		const at = await version(id);
		const proposalId = await monti.proposals.create("c1", "retitle it");
		const asked: boolean[] = [];
		const holds = async (trx: { isTransaction: boolean }) => {
			asked.push(trx.isTransaction);
		};
		const { itemId } = await monti.proposals.add(
			proposalId,
			"entries.save",
			{ id, version: at, title: "One" },
			"",
			"call-1",
			holds,
		);
		// Asked in the transaction that stores the item, once.
		expect(asked).toEqual([true]);
		const items = () =>
			db.selectFrom("monti_proposal_item").select(["id", "input", "made_by"]).orderBy("position").execute();
		const before = await items();
		expect(before).toMatchObject([{ id: itemId, made_by: "call-1" }]);

		const gone = async () => {
			throw new Error("not the holder");
		};
		const other = await newPost("Other");
		await expect(
			monti.proposals.add(proposalId, "entries.save", { id: other, version: 1, title: "Two" }, "", "call-2", gone),
		).rejects.toThrow("not the holder");
		await expect(
			monti.proposals.replace(itemId, "entries.save", { id, version: at, title: "Three" }, "call-3", gone),
		).rejects.toThrow("not the holder");
		expect(await items()).toEqual(before);
	});
});
