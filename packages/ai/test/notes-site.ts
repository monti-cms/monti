import { type AnyOperation, CmsError, defineOperation } from "@monti-cms/core/server";
import { fakeCms } from "@monti-cms/core/testing";
import { z } from "zod";
import { currentAgent } from "../../core/src/core/actor";
import { AI_PLUGIN_NAME } from "../src/name";
import { createAiStore } from "../src/store";
import { testConfig, testSite } from "./site";

export const admin = { userId: "u", accountId: "a", isAdmin: true, name: "Mina Park" };

/**
 * A site with notes kept in memory and two operations on them: `notes.list` reads them, `notes.set` changes a note's text. A note named `broken` refuses to
 * change. `seen` records the agent each applied change and revert ran as.
 */
export function notesSite(initial: Record<string, string> = { a: "one", b: "two" }) {
	const notes = new Map(Object.entries(initial));
	const seen: unknown[] = [];
	const list = defineOperation({
		name: "notes.list",
		kind: "read",
		describe: "Lists the notes of the test site with their text.",
		input: () => z.object({}),
		run: async () => ({ items: [...notes].map(([id, text]) => ({ id, metadata: { text } })) }),
	});
	const set = defineOperation({
		name: "notes.set",
		kind: "write",
		describe: "Proposes a new text for notes of the test site.",
		input: () => z.object({ items: z.array(z.object({ id: z.string(), text: z.string() })) }),
		plan: async ({ items }) =>
			items.flatMap(({ id, text }) => {
				const before = notes.get(id);
				if (before === undefined) throw new CmsError(`No note ${id}`, "not_found");
				return before === text
					? []
					: [
							{
								target: { kind: "entry" as const, id, spot: "text" },
								preview: { before, after: text },
								base: before,
								change: { text },
							},
						];
			}),
		apply: async (plan) => {
			const now = notes.get(plan.target.id);
			if (now !== plan.base) throw new CmsError("The note changed", "conflict");
			if (plan.target.id === "broken") throw new CmsError("This note refuses", "invalid_status");
			const { text } = plan.change as { text: string };
			notes.set(plan.target.id, text);
			seen.push(currentAgent());
			return { base: text, undo: { text: now } };
		},
		revert: async (plan, undo) => {
			notes.set(plan.target.id, (undo as { text: string }).text);
			seen.push(currentAgent());
		},
		baseOf: async (target) => notes.get(target.id) ?? null,
		// Accepted in the editor: the editor already wrote the text, so reverting puts back what was planned against.
		adopt: async (plan) => ({ base: notes.get(plan.target.id) ?? "", undo: { text: plan.preview.before } }),
	});
	const cms = fakeCms({
		config: testConfig as never,
		plugins: [{ name: "notes", operations: [list, set] as AnyOperation[] }],
	});
	const store = createAiStore(cms.plugin(AI_PLUGIN_NAME).storage, { site: testSite });
	return { cms, store, notes, seen };
}
