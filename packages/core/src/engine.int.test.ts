import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { signedInApi } from "./__test__/admin";
import { testDatabase } from "./__test__/database";
import { createNotesTables, type NotesTables, noteKinds, noteOperations } from "./__test__/notes";
import { RETRY_MINUTES } from "./engine/deliveries";
import { runCli } from "./entry/cli";
import { agentTools, callAgentTool } from "./entry/tools";
import { ConflictError } from "./errors";
import { createMonti, definePlugin, type MontiOptions } from "./monti";
import { defineOperation, type MontiEvent } from "./operation";

const db = await testDatabase<NotesTables>();
await createNotesTables(db);

let clock = new Date("2026-11-05T00:00:00Z");
const sent: { destination: string; event: MontiEvent }[] = [];
let hookUp = true;

const site = (options: Partial<MontiOptions> = {}) =>
	createMonti({
		db,
		operations: noteOperations,
		recordKinds: noteKinds,
		receivers: [
			{
				destination: "webhook:test",
				send: async (event) => {
					if (!hookUp) throw new Error("503");
					sent.push({ destination: "webhook:test", event });
				},
			},
		],
		now: () => clock,
		...options,
	});

const notes = () => db.selectFrom("note").selectAll().orderBy("id").execute();
const api = (monti = site()) => signedInApi(monti);
const post = (name: string, body: unknown) =>
	new Request(`https://site.test/admin/api/operations/${name}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(async () => {
	await db.deleteFrom("monti_delivery").execute();
	await db.deleteFrom("monti_activity").execute();
	await db.deleteFrom("monti_proposal").execute();
	await db.deleteFrom("note").execute();
	await db.deleteFrom("note_box").execute();
	sent.length = 0;
	hookUp = true;
	clock = new Date("2026-11-05T00:00:00Z");
});

describe("one definition, three entry points", () => {
	it("00-1 a defined write runs as an admin API route, an agent tool and a CLI command, with no code of its own for any", async () => {
		const monti = site();
		const response = await api(monti)(post("notes.create", { input: { id: "a", body: "from the screen" } }));
		expect(response.status).toBe(200);

		const tool = agentTools(monti).find((capability) => capability.name === "notes.create");
		expect(tool?.inputSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["id", "body"]) });

		const out: string[] = [];
		const code = await runCli(monti, ["notes.create", "--id", "b", "--body", "from the terminal"], {
			out: (line) => out.push(line),
			err: (line) => out.push(line),
		});
		expect(code).toBe(0);
		expect((await notes()).map((note) => note.body)).toEqual(["from the screen", "from the terminal"]);
	});

	it("00-1 every entry point refuses the same bad input", async () => {
		const monti = site();
		expect((await api(monti)(post("notes.create", { input: { id: "a" } }))).status).toBe(400);
		const err: string[] = [];
		expect(await runCli(monti, ["notes.create", "--id", "a"], { out: () => {}, err: (line) => err.push(line) })).toBe(
			1,
		);
		expect(err.join()).toContain("invalid-input");
		const proposal = await monti.proposals.create("c1", "make a note");
		await expect(
			callAgentTool(monti, "notes.create", { id: "a" }, { conversationId: "c1", proposalId: proposal }),
		).rejects.toThrow("Invalid input");
		expect(await notes()).toEqual([]);
	});

	it("00-1 a human-only write is no agent tool, and the assistant cannot run it any other way", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "x" }, { actor: "admin" });
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("notes.purge");
		await expect(
			callAgentTool(monti, "notes.purge", { ids: ["a"] }, { conversationId: "c1", proposalId: "p" }),
		).rejects.toThrow("Unknown operation");
		await expect(monti.run("notes.purge", { ids: ["a"] }, { actor: "assistant" })).rejects.toThrow("Not allowed");
		expect(await notes()).toHaveLength(1);
	});

	it("00-1 a screen operation goes back to the browser; the server and the CLI never run it", async () => {
		const monti = site();
		const proposal = await monti.proposals.create("c1", "open it");
		expect(
			await callAgentTool(monti, "notes.open", { id: "a" }, { conversationId: "c1", proposalId: proposal }),
		).toEqual({
			kind: "screen",
			name: "notes.open",
			input: { id: "a" },
		});
		expect((await api(monti)(post("notes.open", { input: { id: "a" } }))).status).toBe(404);
	});
});

describe("the assistant proposes", () => {
	it("00-2 an assistant write changes nothing until applied, then runs the person's path and is logged as the assistant's", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "old" }, { actor: "admin" });
		const proposalId = await monti.proposals.create("c1", "rewrite the note");
		const tools = { conversationId: "c1", proposalId };

		const result = await callAgentTool(monti, "notes.edit", { ids: ["a"], body: "new" }, tools);
		expect(result.kind).toBe("proposed");
		expect((await notes())[0].body).toBe("old");
		expect(sent.map((delivery) => delivery.event.type)).toEqual(["note.created"]);

		await monti.proposals.apply(proposalId);
		expect((await notes())[0].body).toBe("new");
		const row = await db
			.selectFrom("monti_activity")
			.selectAll()
			.where("operation", "=", "notes.edit")
			.executeTakeFirstOrThrow();
		expect(row).toMatchObject({ actor: "assistant", conversation_id: "c1" });
	});

	it("00-2 an item whose record changed after it was proposed is not applied over the change", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "old" }, { actor: "admin" });
		const proposalId = await monti.proposals.create("c1", "rewrite");
		await callAgentTool(monti, "notes.edit", { ids: ["a"], body: "assistant" }, { conversationId: "c1", proposalId });
		await monti.run("notes.edit", { ids: ["a"], body: "person" }, { actor: "admin" });

		const [item] = await monti.proposals.apply(proposalId);
		expect(item.state).toBe("stale");
		expect((await notes())[0].body).toBe("person");
	});

	it("00-2 an item can point at what an earlier item creates; leaving the earlier one out skips it too", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "x" }, { actor: "admin" });
		const session = async () => {
			const proposalId = await monti.proposals.create("c1", "file it");
			const box = await monti.proposals.add(proposalId, "boxes.create", { name: "2024" });
			const move = await monti.proposals.add(proposalId, "notes.move", {
				ids: ["a"],
				boxId: { $item: box.itemId },
			});
			return { proposalId, box, move };
		};

		const kept = await session();
		await monti.proposals.apply(kept.proposalId);
		expect((await notes())[0].box_id).toBe("box-2024");

		await db.updateTable("note").set({ box_id: null }).execute();
		await db.deleteFrom("note_box").execute();
		const dropped = await session();
		const results = await monti.proposals.apply(dropped.proposalId, [dropped.move.itemId]);
		expect(results.map((result) => result.state)).toEqual(["discarded", "skipped"]);
		expect((await notes())[0].box_id).toBeNull();
	});
});

describe("every write is logged and can be undone", () => {
	it("00-3 undo puts back what the write changed and removes what it created", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "one" }, { actor: "admin" });
		const created = (await monti.run("notes.create", { id: "b", body: "two" }, { actor: "admin" })) as {
			activityId: string;
		};
		const edit = (await monti.run("notes.edit", { ids: ["a"], body: "changed" }, { actor: "admin" })) as {
			activityId: string;
		};
		expect(await db.selectFrom("monti_activity").select("operation").execute()).toHaveLength(3);

		await monti.run("activity.undo", { id: edit.activityId }, { actor: "admin" });
		await monti.run("activity.undo", { id: created.activityId }, { actor: "admin" });
		expect((await notes()).map((note) => [note.id, note.body])).toEqual([["a", "one"]]);
	});

	it("00-3 undo skips a record changed since the write and says so", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "one" }, { actor: "admin" });
		await monti.run("notes.create", { id: "b", body: "one" }, { actor: "admin" });
		const edit = (await monti.run("notes.edit", { ids: ["a", "b"], body: "two" }, { actor: "admin" })) as {
			activityId: string;
		};
		await monti.run("notes.edit", { ids: ["b"], body: "three" }, { actor: "admin" });

		const undone = (await monti.run("activity.undo", { id: edit.activityId }, { actor: "admin" })) as {
			output: { restore: unknown[]; skip: unknown[] };
		};
		expect(undone.output.skip).toEqual([{ kind: "note", id: "b" }]);
		expect((await notes()).map((note) => note.body)).toEqual(["one", "three"]);
	});

	it("00-3 undo works for 30 days, once", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "one" }, { actor: "admin" });
		const edit = (await monti.run("notes.edit", { ids: ["a"], body: "two" }, { actor: "admin" })) as {
			activityId: string;
		};
		clock = new Date("2026-12-06T00:00:00Z");
		await expect(monti.run("activity.undo", { id: edit.activityId }, { actor: "admin" })).rejects.toThrow(
			"Not allowed",
		);
		clock = new Date("2026-12-04T00:00:00Z");
		await monti.run("activity.undo", { id: edit.activityId }, { actor: "admin" });
		await expect(monti.run("activity.undo", { id: edit.activityId }, { actor: "admin" })).rejects.toThrow(
			"Not allowed",
		);
	});
});

describe("an undo beside other writes", () => {
	/** The note kind with a stop right after it has read a note for the next `stops` readings, so a test can do something at that very moment. */
	function stoppingKinds(stops: number) {
		const [note, box] = noteKinds;
		let left = stops;
		let open!: () => void;
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		const reached: (() => void)[] = [];
		const arrived = Array.from({ length: stops }, () => new Promise<void>((resolve) => reached.push(resolve)));
		const kinds = [
			{
				...note,
				async load(...args: Parameters<typeof note.load>) {
					const rows = await note.load(...args);
					if (left > 0) {
						left -= 1;
						reached.shift()?.();
						await gate;
					}
					return rows;
				},
			},
			box,
		];
		return { kinds, arrived, open };
	}
	const soon = (ms: number) => new Promise<"waiting">((resolve) => setTimeout(() => resolve("waiting"), ms));

	it("13-3 a save that comes while an undo is reading waits for the undo: the undo never puts its snapshot over a save it did not see", async () => {
		const plain = site();
		await plain.run("notes.create", { id: "a", body: "one" }, { actor: "admin" });
		const edit = (await plain.run("notes.edit", { ids: ["a"], body: "two" }, { actor: "admin" })) as {
			activityId: string;
		};
		// The undo has read the note (it is as the edit left it) and stops there.
		const { kinds, arrived, open } = stoppingKinds(1);
		const stopping = site({ recordKinds: kinds });
		const undoing = stopping.run("activity.undo", { id: edit.activityId }, { actor: "admin" });
		await arrived[0];
		// A person saves the note at that moment. It must wait: the undo holds the note, as any write of it would.
		const saving = plain.run("notes.edit", { ids: ["a"], body: "three" }, { actor: "admin" });
		expect(await Promise.race([saving.then(() => "saved"), soon(300)])).toBe("waiting");
		open();
		await undoing;
		await saving;
		// The save came after the undo and is what is there. Without the wait it would have gone in first and the undo's "one" would be over it.
		expect((await notes())[0].body).toBe("three");
	});

	it("13-3 two undos of one write at the same moment: one takes it back, the other finds it undone", async () => {
		const plain = site();
		await plain.run("notes.create", { id: "a", body: "one" }, { actor: "admin" });
		const edit = (await plain.run("notes.edit", { ids: ["a"], body: "two" }, { actor: "admin" })) as {
			activityId: string;
		};
		const { kinds, arrived, open } = stoppingKinds(2);
		const stopping = site({ recordKinds: kinds });
		const both = [1, 2].map(() => stopping.run("activity.undo", { id: edit.activityId }, { actor: "admin" }));
		// One has read the note; the other must not get that far while the first holds the write.
		await arrived[0];
		expect(await Promise.race([arrived[1].then(() => "both reading"), soon(300)])).toBe("waiting");
		open();
		const results = await Promise.allSettled(both);
		expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
		expect(refused.reason).toMatchObject({ reason: { key: "errors.alreadyUndone" } });
		// Put back once: the version rose by one restore, not two.
		expect((await notes())[0]).toMatchObject({ body: "one", version: 3 });
	});
});

describe("versions", () => {
	it("00-4 a write that read an older version is refused as a conflict and changes nothing", async () => {
		const monti = site();
		const created = (await monti.run("notes.create", { id: "a", body: "one" }, { actor: "admin" })) as {
			versions: Record<string, number>;
		};
		await monti.run("notes.edit", { ids: ["a"], body: "other tab" }, { actor: "admin", versions: created.versions });

		await expect(
			monti.run("notes.edit", { ids: ["a"], body: "this tab" }, { actor: "admin", versions: created.versions }),
		).rejects.toBeInstanceOf(ConflictError);
		const response = await api(monti)(
			post("notes.edit", { input: { ids: ["a"], body: "this tab" }, versions: created.versions }),
		);
		expect(response.status).toBe(409);
		expect((await notes())[0].body).toBe("other tab");
	});

	it("00-4 concurrent writes that read the same version cannot both commit", async () => {
		let entered!: () => void;
		let release!: () => void;
		const running = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const wait = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slowEdit = defineOperation({
			name: "notes.slowEdit",
			kind: "write",
			description: "Edit a note after the test releases it.",
			input: z.object({ id: z.string(), body: z.string() }),
			touches: (input) => [{ kind: "note", id: input.id }],
			async run(input, ctx) {
				entered();
				await wait;
				await (ctx.db as unknown as Kysely<NotesTables>)
					.updateTable("note")
					.set((eb) => ({ body: input.body, version: eb("version", "+", 1) }))
					.where("id", "=", input.id)
					.execute();
			},
			summary: () => ({ key: "notes.slowEdit" }),
		});
		const monti = site({ operations: [...noteOperations, slowEdit] });
		const created = (await monti.run("notes.create", { id: "a", body: "one" }, { actor: "admin" })) as {
			versions: Record<string, number>;
		};
		const first = monti.run(
			"notes.slowEdit",
			{ id: "a", body: "first" },
			{ actor: "admin", versions: created.versions },
		);
		await running;
		const second = monti.run(
			"notes.slowEdit",
			{ id: "a", body: "second" },
			{ actor: "admin", versions: created.versions },
		);
		release();
		await first;
		await expect(second).rejects.toBeInstanceOf(ConflictError);
		expect((await notes())[0].body).toBe("first");
	});
});

describe("plugins", () => {
	it("00-5 a plugin's operation is in meta.capabilities and the agent can use it like any other", async () => {
		const shout = defineOperation({
			name: "shout.note",
			kind: "write",
			description: "Upper-case a note.",
			input: z.object({ id: z.string() }),
			touches: (input) => [{ kind: "note", id: input.id }],
			run: async (input, ctx) => {
				await (ctx.db as unknown as Kysely<NotesTables>)
					.updateTable("note")
					.set({ body: "LOUD" })
					.where("id", "=", input.id)
					.execute();
			},
			summary: () => ({ key: "shout.note" }),
		});
		const monti = site({ plugins: [definePlugin({ name: "shout", operations: [shout] })] });
		await monti.run("notes.create", { id: "a", body: "quiet" }, { actor: "admin" });

		const capabilities = (await monti.run("meta.capabilities", {}, { actor: "assistant" })) as { name: string }[];
		expect(capabilities.map((capability) => capability.name)).toContain("shout.note");
		expect(capabilities.map((capability) => capability.name)).not.toContain("notes.purge");

		const proposalId = await monti.proposals.create("c1", "make it loud");
		await callAgentTool(monti, "shout.note", { id: "a" }, { conversationId: "c1", proposalId });
		await monti.proposals.apply(proposalId);
		expect((await notes())[0].body).toBe("LOUD");
	});
});

describe("deliveries", () => {
	it("13-2 a write that rolls back sends nothing; one that commits sends its events", async () => {
		const monti = site();
		await monti.run("notes.create", { id: "a", body: "x" }, { actor: "admin" });
		await expect(monti.run("notes.create", { id: "a", body: "again" }, { actor: "admin" })).rejects.toThrow();
		expect(sent.map((delivery) => delivery.event.ids)).toEqual([["a"]]);
		expect(await db.selectFrom("monti_delivery").select("state").execute()).toEqual([{ state: "sent" }]);
	});

	it("13-1 a failed delivery is retried on schedule and marked failed when the retries run out", async () => {
		const monti = site();
		hookUp = false;
		await monti.run("notes.create", { id: "a", body: "x" }, { actor: "admin" });
		for (const minutes of RETRY_MINUTES) {
			await monti.deliveries.sendDue();
			clock = new Date(clock.getTime() + minutes * 60_000);
			await monti.deliveries.sendDue();
		}
		const row = await db.selectFrom("monti_delivery").selectAll().executeTakeFirstOrThrow();
		expect(row).toMatchObject({ state: "failed", attempts: RETRY_MINUTES.length + 1, last_error: "failed" });
		expect(sent).toEqual([]);
	});

	it("13-1 a retry that gets through is sent once", async () => {
		const monti = site();
		hookUp = false;
		await monti.run("notes.create", { id: "a", body: "x" }, { actor: "admin" });
		hookUp = true;
		await monti.deliveries.sendDue();
		clock = new Date(clock.getTime() + RETRY_MINUTES[0] * 60_000);
		await monti.deliveries.sendDue();
		await monti.deliveries.sendDue();
		expect(sent).toHaveLength(1);
	});
});
