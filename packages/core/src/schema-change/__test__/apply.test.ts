import { describe, expect, it } from "vitest";
import { type CmsConfig, defineSite } from "../../config/define";
import { defineCollection } from "../../schema/collection";
import type { SchemaMigration } from "../../schema-file/types";
import { createSite } from "../../site";
import { planSchemaChange, snapshotSchema } from "../apply";

const title = { kind: "text", label: "Title", required: true } as const;
const summary = { kind: "text", label: "Summary" } as const;

const siteWith = (fields: Record<string, typeof title | typeof summary>) =>
	createSite(
		defineSite({
			collections: { note: defineCollection({ label: "Note", kind: "item", fields }) },
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}) as CmsConfig,
	);

/** A store that has the schema of `applied` recorded and the transforms `done` run. */
const storeAt = (applied: ReturnType<typeof siteWith>, done: readonly string[] = []) => ({
	readSchemaState: async () => ({ schema: snapshotSchema(applied), appliedAt: new Date(0) }),
	appliedSchemaTransforms: async (ids: readonly string[]) => ids.filter((id) => done.includes(id)),
});

describe("planSchemaChange", () => {
	it("SCHEMA-C1 has something to apply when only the schema changed, or only a transform is pending", async () => {
		const before = siteWith({ title });
		const after = siteWith({ title, summary });
		const fill: SchemaMigration = {
			id: "fill-summary",
			op: "setDefault",
			collection: "note",
			field: "summary",
			value: "-",
		};

		// A field added, no transform: `schema:diff --check` must still say the store is behind.
		const schemaOnly = await planSchemaChange({ site: after, store: storeAt(before), migrations: [] });
		expect(schemaOnly.diff.changes).toHaveLength(1);
		expect(schemaOnly.pending).toEqual([]);
		expect(schemaOnly.changed).toBe(true);

		// The schema is applied already and a transform was added to the file afterwards.
		const transformOnly = await planSchemaChange({ site: after, store: storeAt(after), migrations: [fill] });
		expect(transformOnly.diff.changes).toEqual([]);
		expect(transformOnly.pending).toEqual([fill]);
		expect(transformOnly.changed).toBe(true);

		const neither = await planSchemaChange({
			site: after,
			store: storeAt(after, ["fill-summary"]),
			migrations: [fill],
		});
		expect(neither.changed).toBe(false);
	});
});
