import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, requiredMetadata } from "../../../../test/any-site";
import { paragraphsFormat } from "../../../../test/paragraphs-format";
import { testConfig } from "../../../../test/site";
import type { AuthContext } from "../../../adapters/auth";
import { type Cms, fakeCms } from "../../../cms";
import type { ContentStore } from "../../../core/store";
import { seedEntry } from "../../../core/store/__test__/seed";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../../testing";

const admin: AuthContext = { userId: "u", accountId: "a", isAdmin: true, name: "Mina Park" };
const agent = { runId: "run-1", proposalId: "proposal-1" };

/** The write operations over a real store: plan changes nothing, apply makes the change, revert undoes it, and a moved base is refused or left alone. */
describe("write operations", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let cms: Cms;
	let relationTarget: (to: string) => Promise<string>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		const { testSite } = await import("../../../../test/site");
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		relationTarget = fillRequiredMetadata(store).relationTarget as (to: string) => Promise<string>;
		cms = fakeCms({ config: testConfig, store, formats: [paragraphsFormat] }) as unknown as Cms;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	let sequence = 0;
	const seed = async (title: string) =>
		seedEntry(store, {
			collection: contentCollection,
			slug: `write-${++sequence}`,
			metadata: await requiredMetadata(contentCollection, title, relationTarget as never),
			text: "Body.",
		});
	const titleOf = async (id: string) => (await store.getEntry(id)).working.metadata.title;
	const writes = () => cms.writes;

	it("AGENT-W1 plans a field change without making it, applies it as the agent's change, and reverts it", async () => {
		const entry = await seed("Before");
		const plans = await writes().plan(
			"entries.updateFields",
			{ id: entry.id, fields: { title: "After" } },
			{ auth: admin },
		);
		expect(plans).toHaveLength(1);
		expect(plans[0]).toMatchObject({
			target: { kind: "entry", id: entry.id, spot: "title" },
			preview: { before: "Before", after: "After" },
		});
		expect(await titleOf(entry.id)).toBe("Before");

		const applied = await writes().apply("entries.updateFields", plans[0] as never, { auth: admin, agent });
		const saved = await store.getEntry(entry.id);
		expect(saved.working.metadata.title).toBe("After");
		expect(saved.changedBy).toBe("Mina Park");
		expect(await writes().baseOf("entries.updateFields", plans[0]!.target, { auth: admin })).toBe(applied.base);

		await writes().revert("entries.updateFields", plans[0] as never, applied.undo, { auth: admin, agent });
		expect(await titleOf(entry.id)).toBe("Before");
	});

	it("AGENT-W1 leaves out fields that would not change and refuses a field the collection does not have", async () => {
		const entry = await seed("Same");
		expect(
			await writes().plan("entries.updateFields", { id: entry.id, fields: { title: "Same" } }, { auth: admin }),
		).toEqual([]);
		await expect(
			writes().plan("entries.updateFields", { id: entry.id, fields: { nope: 1 } }, { auth: admin }),
		).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("AGENT-W2 refuses to apply a change whose spot moved since the plan, and applies changes to two fields of one entry one after the other", async () => {
		const entry = await seed("Old");
		const [plan] = await writes().plan(
			"entries.updateFields",
			{ id: entry.id, fields: { title: "Agent's" } },
			{ auth: admin },
		);
		// A person edits the title in the meantime.
		await writes().apply(
			"entries.updateFields",
			(
				await writes().plan("entries.updateFields", { id: entry.id, fields: { title: "Person's" } }, { auth: admin })
			)[0]!,
			{ auth: admin },
		);
		await expect(writes().apply("entries.updateFields", plan!, { auth: admin, agent })).rejects.toMatchObject({
			code: "conflict",
		});
		expect(await titleOf(entry.id)).toBe("Person's");
	});

	it("AGENT-W3 moves entries to a folder and back, and trashes and restores them", async () => {
		const entry = await seed("Movable");
		const folder = await store.createFolder({ collection: contentCollection, parentId: null, name: "2024" });
		const [move] = await writes().plan(
			"entries.moveToFolder",
			{ ids: [entry.id], folderId: folder.id },
			{ auth: admin },
		);
		const moved = await writes().apply("entries.moveToFolder", move!, { auth: admin, agent });
		expect((await store.getEntry(entry.id)).folderId).toBe(folder.id);
		await writes().revert("entries.moveToFolder", move!, moved.undo, { auth: admin, agent });
		expect((await store.getEntry(entry.id)).folderId).toBeNull();

		const [trash] = await writes().plan("entries.trash", { ids: [entry.id] }, { auth: admin });
		const trashed = await writes().apply("entries.trash", trash!, { auth: admin, agent });
		expect((await store.getEntry(entry.id)).deletedAt).toBeInstanceOf(Date);
		await writes().revert("entries.trash", trash!, trashed.undo, { auth: admin, agent });
		expect((await store.getEntry(entry.id)).deletedAt ?? null).toBeNull();
	});

	it("AGENT-W4 never runs a write in one step: run refuses it and plan refuses a read", async () => {
		const entry = await seed("Guarded");
		await expect(cms.runOperation("entries.trash", { ids: [entry.id] }, { auth: admin })).rejects.toMatchObject({
			code: "invalid_input",
		});
		await expect(writes().plan("entries.list", {}, { auth: admin })).rejects.toMatchObject({ code: "invalid_input" });
		expect((await store.getEntry(entry.id)).deletedAt ?? null).toBeNull();
	});
});
