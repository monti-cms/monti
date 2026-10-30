import { describe, expect, it } from "vitest";
import { fakeCms } from "../../cms";
import { readSchemaScreen } from "../edit";

const appliedAt = new Date("2026-10-01T09:30:00.000Z");

describe("readSchemaScreen applied", () => {
	it("says when the schema the store holds was applied", async () => {
		const cms = fakeCms({
			store: { readSchemaState: async () => ({ schema: {}, appliedAt }), collectionFootprint: async () => ({}) },
		});
		expect((await readSchemaScreen(cms)).applied).toEqual({ appliedAt: appliedAt.toISOString() });
	});

	it("is null for a store that has no schema applied yet, or that cannot be read", async () => {
		const none = fakeCms({ store: { readSchemaState: async () => null, collectionFootprint: async () => ({}) } });
		const unreadable = fakeCms({
			store: {
				readSchemaState: async () => {
					throw new Error("relation schema_state does not exist");
				},
				collectionFootprint: async () => ({}),
			},
		});
		expect((await readSchemaScreen(none)).applied).toBeNull();
		expect((await readSchemaScreen(unreadable)).applied).toBeNull();
	});
});
