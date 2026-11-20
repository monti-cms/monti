import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestDatabase, type TestDatabase } from "../__test__/database";
import { migrate } from "../db/migrate";
import { initial } from "../db/migrations/0001-initial";
import type { Database } from "../db/types";
import { createMonti } from "./engine";
import { MontiError } from "./errors";
import { defineRead, defineWrite } from "./operation";
import type { Monti, MontiEvent, Plugin, ReadContext, WriteContext } from "./types";

let testDb: TestDatabase;
let db: Kysely<Database>;

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
});

afterEach(async () => {
	await testDb.drop();
});

const folderInput = z.object({ id: z.uuid(), name: z.string() });

async function insertFolder(input: z.infer<typeof folderInput>, ctx: WriteContext): Promise<{ id: string }> {
	await ctx.db.insertInto("folders").values({ id: input.id, scope: "media", name: input.name }).execute();
	return { id: input.id };
}

/** The names of the folders, read through the test's own connection: only committed rows are seen. */
async function folderNames(): Promise<string[]> {
	const rows = await db.selectFrom("folders").select("name").orderBy("name").execute();
	return rows.map((row) => row.name);
}

it("ENG-OP-1 runs a read called directly without a transaction", async () => {
	await db.insertInto("folders").values({ id: randomUUID(), scope: "media", name: "Photos" }).execute();
	let inTransaction: boolean | undefined;
	const list = defineRead({
		input: z.object({ scope: z.string() }),
		run: async (input, ctx) => {
			inTransaction = ctx.db.isTransaction;
			return ctx.db.selectFrom("folders").select("name").where("scope", "=", input.scope).execute();
		},
	});
	const monti = createMonti(db, { folders: { list } });
	const listener = vi.fn();
	monti.onEvent(listener);

	const output = await monti.folders.list({ scope: "media" });

	// ENG-OP-1.1
	expect(inTransaction).toBe(false);
	// ENG-OP-1.2
	expect(output).toEqual([{ name: "Photos" }]);
	// ENG-OP-1.3
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-OP-2 runs a write called directly in a transaction and sends its event after the commit", async () => {
	let inTransaction: boolean | undefined;
	const create = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			inTransaction = ctx.db.isTransaction;
			return insertFolder(input, ctx);
		},
	});
	const monti = createMonti(db, { folders: { create } });
	const listener = vi.fn();
	let namesAtEvent: Promise<string[]> | undefined;
	monti.onEvent((event) => {
		listener(event);
		namesAtEvent = folderNames();
	});
	const input = { id: randomUUID(), name: "Photos" };

	const output = await monti.folders.create(input);

	// ENG-OP-2.1
	expect(inTransaction).toBe(true);
	// ENG-OP-2.2
	expect(await folderNames()).toEqual(["Photos"]);
	// ENG-OP-2.3
	expect(output).toEqual({ id: input.id });
	// ENG-OP-2.4
	expect(listener).toHaveBeenCalledExactlyOnceWith({ operation: "folders.create", input, output });
	// ENG-OP-2.4
	expect(await namesAtEvent).toEqual(["Photos"]);
});

it("ENG-OP-3 throws BAD_REQUEST for an input that does not match the schema and does not run", async () => {
	const run = vi.fn(insertFolder);
	const monti = createMonti(db, { folders: { create: defineWrite({ input: folderInput, run }) } });
	const listener = vi.fn();
	monti.onEvent(listener);

	const call = monti.folders.create({ id: "not-a-uuid", name: "Photos" });

	// ENG-OP-3.1
	await expect(call).rejects.toBeInstanceOf(MontiError);
	// ENG-OP-3.1
	await expect(call).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENG-OP-3.2
	expect(run).not.toHaveBeenCalled();
	// ENG-OP-3.3
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-OP-4 rolls back a write that fails while running and sends no event", async () => {
	const create = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			await insertFolder(input, ctx);
			throw new Error("the write fails");
		},
	});
	const monti = createMonti(db, { folders: { create } });
	const listener = vi.fn();
	monti.onEvent(listener);

	const call = monti.folders.create({ id: randomUUID(), name: "Photos" });

	// ENG-OP-4.1
	await expect(call).rejects.toThrow("the write fails");
	// ENG-OP-4.2
	expect(await folderNames()).toEqual([]);
	// ENG-OP-4.3
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-EVT-1 keeps the write's result and the other subscribers when a subscriber fails", async () => {
	const monti = createMonti(db, { folders: { create: defineWrite({ input: folderInput, run: insertFolder }) } });
	monti.onEvent(() => {
		throw new Error("the subscriber throws");
	});
	monti.onEvent(async () => {
		throw new Error("the subscriber's promise fails");
	});
	const listener = vi.fn();
	monti.onEvent(listener);
	const input = { id: randomUUID(), name: "Photos" };

	const output = await monti.folders.create(input);

	// ENG-EVT-1.1
	expect(output).toEqual({ id: input.id });
	// ENG-EVT-1.2
	expect(await folderNames()).toEqual(["Photos"]);
	// ENG-EVT-1.3
	expect(listener).toHaveBeenCalledExactlyOnceWith({ operation: "folders.create", input, output });
});

it("ENG-EVT-2 does not notify a subscriber that was removed", async () => {
	const monti = createMonti(db, { folders: { create: defineWrite({ input: folderInput, run: insertFolder }) } });
	const listener = vi.fn();
	const off = monti.onEvent(listener);
	off();

	await monti.folders.create({ id: randomUUID(), name: "Photos" });

	// ENG-EVT-2.1
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-TX-1 shares one transaction across a transaction callback's calls and sends their events in call order after the commit", async () => {
	const contexts: ReadContext["db"][] = [];
	const create = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			contexts.push(ctx.db);
			return insertFolder(input, ctx);
		},
	});
	const add = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			contexts.push(ctx.db);
			return insertFolder(input, ctx);
		},
	});
	const list = defineRead({
		input: z.object({}),
		run: async (_input, ctx) => {
			contexts.push(ctx.db);
			const rows = await ctx.db.selectFrom("folders").select("name").orderBy("name").execute();
			return rows.map((row) => row.name);
		},
	});
	const monti = createMonti(db, { folders: { create, add, list } });
	const events: MontiEvent[] = [];
	const namesAtEvents: Promise<string[]>[] = [];
	monti.onEvent((event) => {
		events.push(event);
		namesAtEvents.push(folderNames());
	});
	const first = { id: randomUUID(), name: "Photos" };
	const second = { id: randomUUID(), name: "Videos" };
	let namesInCallback: string[] | undefined;
	let eventsInCallback: number | undefined;

	const result = await monti.transaction(async (tx) => {
		await tx.folders.create(first);
		namesInCallback = await tx.folders.list({});
		await tx.folders.add(second);
		eventsInCallback = events.length;
		return "done";
	});

	// ENG-TX-1.1
	expect(contexts[1]).toBe(contexts[0]);
	// ENG-TX-1.1
	expect(contexts[2]).toBe(contexts[0]);
	// ENG-TX-1.1
	expect(contexts[0]?.isTransaction).toBe(true);
	// ENG-TX-1.2
	expect(namesInCallback).toEqual(["Photos"]);
	// ENG-TX-1.3
	expect(eventsInCallback).toBe(0);
	// ENG-TX-1.4
	expect(events).toEqual([
		{ operation: "folders.create", input: first, output: { id: first.id } },
		{ operation: "folders.add", input: second, output: { id: second.id } },
	]);
	// ENG-TX-1.4
	expect(await Promise.all(namesAtEvents)).toEqual([
		["Photos", "Videos"],
		["Photos", "Videos"],
	]);
	// ENG-TX-1.5
	expect(result).toBe("done");
});

it("ENG-TX-2 rolls back a transaction callback that fails midway and sends no event", async () => {
	const monti = createMonti(db, { folders: { create: defineWrite({ input: folderInput, run: insertFolder }) } });
	const listener = vi.fn();
	monti.onEvent(listener);

	const call = monti.transaction(async (tx) => {
		await tx.folders.create({ id: randomUUID(), name: "Photos" });
		throw new Error("the callback fails");
	});

	// ENG-TX-2.1
	await expect(call).rejects.toThrow("the callback fails");
	// ENG-TX-2.2
	expect(await folderNames()).toEqual([]);
	// ENG-TX-2.3
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-TX-3 shows only the writes in a dryRun callback, rolls them back and sends no event", async () => {
	const list = defineRead({
		input: z.object({}),
		run: async (_input, ctx) => ctx.db.selectFrom("folders").select("name").execute(),
	});
	const create = defineWrite({ input: folderInput, run: insertFolder });
	const monti = createMonti(db, { folders: { create, list } });
	const listener = vi.fn();
	monti.onEvent(listener);
	const input = { id: randomUUID(), name: "Photos" };
	let actions: string[] | undefined;

	const output = await monti.dryRun(async (tx) => {
		actions = Object.keys(tx.folders);
		return tx.folders.create(input);
	});

	// ENG-TX-3.1
	expect(actions).toEqual(["create"]);
	// ENG-TX-3.2
	expect(output).toEqual({ id: input.id });
	// ENG-TX-3.3
	expect(await folderNames()).toEqual([]);
	// ENG-TX-3.4
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-PLG-1 connects a plugin's operations and onEvent to the engine", async () => {
	const create = defineWrite({ input: folderInput, run: insertFolder });
	const pluginListener = vi.fn();
	let namesAtEvent: Promise<string[]> | undefined;
	const plugin: Plugin = {
		name: "albums-plugin",
		operations: { albums: { create } },
		onEvent: (event, ctx) => {
			pluginListener(event, ctx);
			namesAtEvent = folderNames();
		},
	};
	const monti = createMonti(db, { folders: { list: defineRead({ input: z.object({}), run: async () => [] }) } }, [
		plugin,
	]);
	const withPlugin = monti as unknown as Monti<{ albums: { create: typeof create } }>;
	const input = { id: randomUUID(), name: "Photos" };

	const output = await withPlugin.albums.create(input);

	// ENG-PLG-1.1
	expect(output).toEqual({ id: input.id });
	// ENG-PLG-1.2
	expect(pluginListener).toHaveBeenCalledExactlyOnceWith({ operation: "albums.create", input, output }, { monti });
	// ENG-PLG-1.2
	expect(pluginListener.mock.calls[0]?.[1].monti).toBe(monti);
	// ENG-PLG-1.2
	expect(await namesAtEvent).toEqual(["Photos"]);
});

it("ENG-PLG-2 rejects a plugin whose operation path is already taken", () => {
	const create = defineWrite({ input: folderInput, run: insertFolder });
	const plugin: Plugin = { name: "folders-plugin", operations: { folders: { create } } };

	// ENG-PLG-2.1
	expect(() => createMonti(db, { folders: { create } }, [plugin])).toThrow(
		new MontiError(
			"CONFLICT",
			'The plugin "folders-plugin" adds the operation "folders.create", whose path is already taken.',
		),
	);
});

it("ENG-TX-4 turns a PostgreSQL unique violation in a write into CONFLICT and rolls it back", async () => {
	const create = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			await insertFolder(input, ctx);
			return insertFolder(input, ctx);
		},
	});
	const monti = createMonti(db, { folders: { create } });
	const listener = vi.fn();
	monti.onEvent(listener);

	const direct = monti.folders.create({ id: randomUUID(), name: "Photos" });
	const dryRun = monti.dryRun((tx) => tx.folders.create({ id: randomUUID(), name: "Videos" }));

	// ENG-TX-4.1
	await expect(direct).rejects.toBeInstanceOf(MontiError);
	// ENG-TX-4.1
	await expect(direct).rejects.toMatchObject({ code: "CONFLICT" });
	// ENG-TX-4.1
	await expect(dryRun).rejects.toBeInstanceOf(MontiError);
	// ENG-TX-4.1
	await expect(dryRun).rejects.toMatchObject({ code: "CONFLICT" });
	// ENG-TX-4.2
	expect(await folderNames()).toEqual([]);
	// ENG-TX-4.3
	expect(listener).not.toHaveBeenCalled();
});

it("ENG-TX-5 fails transaction and dryRun with the CONFLICT a callback caught and ignored", async () => {
	const add = defineWrite({ input: folderInput, run: insertFolder });
	const create = defineWrite({
		input: folderInput,
		run: async (input, ctx) => {
			await insertFolder(input, ctx);
			return insertFolder(input, ctx);
		},
	});
	const monti = createMonti(db, { folders: { add, create } });
	const listener = vi.fn();
	monti.onEvent(listener);

	// The `add` before the duplicate queues an event that must not be sent.
	const transaction = monti.transaction(async (tx) => {
		await tx.folders.add({ id: randomUUID(), name: "Albums" });
		await tx.folders.create({ id: randomUUID(), name: "Photos" }).catch(() => undefined);
		return "done";
	});
	// ENG-TX-5.1
	await expect(transaction).rejects.toBeInstanceOf(MontiError);
	// ENG-TX-5.1
	await expect(transaction).rejects.toMatchObject({ code: "CONFLICT" });

	const dryRun = monti.dryRun(async (tx) => {
		await tx.folders.add({ id: randomUUID(), name: "Videos" });
		await tx.folders.create({ id: randomUUID(), name: "Clips" }).catch(() => undefined);
		return "done";
	});
	// ENG-TX-5.1
	await expect(dryRun).rejects.toBeInstanceOf(MontiError);
	// ENG-TX-5.1
	await expect(dryRun).rejects.toMatchObject({ code: "CONFLICT" });
	// ENG-TX-5.2
	expect(await folderNames()).toEqual([]);
	// ENG-TX-5.3
	expect(listener).not.toHaveBeenCalled();
});
