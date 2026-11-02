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
const op = "entries.updateBody";
const format = "paragraphs";

/** Body edits over a real store: one change per block, applied and reverted in place, and a block a person changed is left alone. */
describe("body edits", () => {
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
	const seed = async (text: string) =>
		seedEntry(store, {
			collection: contentCollection,
			slug: `body-${++sequence}`,
			metadata: await requiredMetadata(contentCollection, "Body", relationTarget as never),
			text,
		});
	const paragraphs = async (id: string) =>
		(await store.getEntry(id)).working.doc.content.map((block) =>
			(block.content ?? []).map((inline) => inline.text ?? "").join(""),
		);
	const plan = (id: string, edits: { find: string; replace: string }[]) =>
		cms.writes.plan(op, { id, format, edits }, { auth: admin });

	it("AGENT-W5 plans one change per block it touches without making it, applies it in place, and reverts it", async () => {
		const entry = await seed(
			"I decided to rebuild the blog.\n\nThe list keeps the title.\n\nSettings stayed as they were.",
		);
		const plans = await plan(entry.id, [
			{ find: "decided to rebuild", replace: "rebuilt" },
			{ find: "the blog", replace: "my blog" },
			{ find: "Settings stayed as they were.", replace: "" },
		]);
		expect(plans.map((p) => p.preview)).toEqual([
			{ before: "I decided to rebuild the blog.", after: "I rebuilt my blog." },
			{ before: "Settings stayed as they were.", after: null },
		]);
		expect(await paragraphs(entry.id)).toHaveLength(3);

		const rewrite = await cms.writes.apply(op, plans[0] as never, { auth: admin, agent });
		const removal = await cms.writes.apply(op, plans[1] as never, { auth: admin, agent });
		expect(await paragraphs(entry.id)).toEqual(["I rebuilt my blog.", "The list keeps the title."]);
		expect((await store.getEntry(entry.id)).changedBy).toBe("Mina Park");

		await cms.writes.revert(op, plans[1] as never, removal.undo, { auth: admin, agent });
		await cms.writes.revert(op, plans[0] as never, rewrite.undo, { auth: admin, agent });
		expect(await paragraphs(entry.id)).toEqual([
			"I decided to rebuild the blog.",
			"The list keeps the title.",
			"Settings stayed as they were.",
		]);
	});

	it("AGENT-W5 turns blank lines in a replacement into new blocks, and takes them out again on revert", async () => {
		const entry = await seed("One long paragraph. It has two parts.");
		const [split] = await plan(entry.id, [{ find: " It has", replace: "\n\nIt has" }]);
		const applied = await cms.writes.apply(op, split as never, { auth: admin, agent });
		expect(await paragraphs(entry.id)).toEqual(["One long paragraph.", "It has two parts."]);
		await cms.writes.revert(op, split as never, applied.undo, { auth: admin, agent });
		expect(await paragraphs(entry.id)).toEqual(["One long paragraph. It has two parts."]);
	});

	it("AGENT-W5 refuses text that no block holds or that more than one block holds", async () => {
		const entry = await seed("Same words.\n\nSame words.");
		await expect(plan(entry.id, [{ find: "missing", replace: "x" }])).rejects.toMatchObject({ code: "invalid_input" });
		await expect(plan(entry.id, [{ find: "Same words.", replace: "x" }])).rejects.toMatchObject({
			code: "invalid_input",
		});
	});

	it("AGENT-W5 refuses to apply a change to a block a person edited since the plan, and reports its spot as changed", async () => {
		const entry = await seed("Agent target.\n\nOther block.");
		const [agentPlan] = await plan(entry.id, [{ find: "Agent target.", replace: "Agent wording." }]);
		const before = await cms.writes.baseOf(op, agentPlan!.target, { auth: admin });
		expect(before).toBe(agentPlan!.base);
		// A person rewrites the same block in the meantime.
		const [person] = await plan(entry.id, [{ find: "Agent target.", replace: "Person's wording." }]);
		await cms.writes.apply(op, person as never, { auth: admin });
		expect(await cms.writes.baseOf(op, agentPlan!.target, { auth: admin })).not.toBe(agentPlan!.base);
		await expect(cms.writes.apply(op, agentPlan as never, { auth: admin, agent })).rejects.toMatchObject({
			code: "conflict",
		});
		expect(await paragraphs(entry.id)).toEqual(["Person's wording.", "Other block."]);
	});

	it("AGENT-W6 records a change the admin accepted in the editor and saved, so reverting it puts the block back", async () => {
		const entry = await seed("Before the edit.\n\nAfter it.");
		const [planned] = await plan(entry.id, [{ find: "Before the edit.", replace: "Edited in the editor." }]);
		const { nodes } = planned!.change as { nodes: { id?: string }[] };
		// The editor puts the planned blocks in place and saves the entry as a person does.
		const current = await store.getEntry(entry.id);
		await cms.contentService().saveDraft(entry.id, {
			collection: current.collection,
			slug: current.workingSlug,
			metadata: current.working.metadata,
			doc: { ...current.working.doc, content: [...(nodes as never[]), ...current.working.doc.content.slice(1)] },
			expectedVersion: current.version,
		} as never);
		expect(await paragraphs(entry.id)).toEqual(["Edited in the editor.", "After it."]);

		const adopted = await cms.writes.adopt(
			op,
			planned!,
			{ placed: nodes.map((node) => node.id ?? "") },
			{ auth: admin },
		);
		expect(await cms.writes.baseOf(op, planned!.target, { auth: admin })).toBe(adopted.base);
		await cms.writes.revert(op, planned!, adopted.undo, { auth: admin, agent });
		expect(await paragraphs(entry.id)).toEqual(["Before the edit.", "After it."]);
		// A move to a folder is never accepted in the editor.
		await expect(cms.writes.adopt("entries.moveToFolder", planned!, {}, { auth: admin })).rejects.toMatchObject({
			code: "invalid_input",
		});
	});
});
