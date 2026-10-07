import { describe, expect, it } from "vitest";
import { defineConfig } from "../../config/define";
import { blogSchema } from "../../schema-file/__test__/fixture";
import type { SchemaMigration } from "../../schema-file/types";
import { createSite } from "../../site";
import { applyTransforms, checkTransforms, suggestTransforms } from "../transforms";

/** The site of the schema after the change the transforms below follow. */
const site = createSite(
	defineConfig({
		schema: {
			...blogSchema,
			collections: {
				...blogSchema.collections,
				post: {
					...blogSchema.collections.post,
					fields: {
						title: blogSchema.collections.post.fields.title,
						slug: blogSchema.collections.post.fields.slug,
						excerpt: { kind: "text", label: "Excerpt", max: 5 },
						level: { kind: "select", label: "Level", options: { low: "Low", high: "High" }, defaultValue: "low" },
						labels: { kind: "text", label: "Labels", localized: true },
						policy: blogSchema.collections.post.fields.policy,
					},
					layout: undefined,
					list: undefined,
				},
			},
		},
	}),
);

const run = (
	transforms: readonly SchemaMigration[],
	metadata: Record<string, unknown>,
	body: { collection?: string; isTranslation?: boolean } = {},
) => applyTransforms(site, transforms, { collection: "post", ...body }, metadata);

describe("applyTransforms", () => {
	it("renames a field: the value moves, the rest stays, the input is not touched", () => {
		const input = { title: "T", summary: "S" };
		const result = run([{ id: "r", op: "renameField", collection: "post", from: "summary", to: "excerpt" }], input);
		expect(result.metadata).toEqual({ title: "T", excerpt: "S" });
		expect(result.changedBy).toEqual(["r"]);
		expect(input).toEqual({ title: "T", summary: "S" });
		// Nothing to move: nothing changes.
		expect(
			run([{ id: "r", op: "renameField", collection: "post", from: "summary", to: "excerpt" }], { title: "T" })
				.changedBy,
		).toEqual([]);
	});

	it("keeps both values and reports it when the new name already holds one", () => {
		const result = run([{ id: "r", op: "renameField", collection: "post", from: "summary", to: "excerpt" }], {
			summary: "old",
			excerpt: "new",
		});
		expect(result.metadata).toEqual({ summary: "old", excerpt: "new" });
		expect(result.changedBy).toEqual([]);
		expect(result.conflicts).toEqual([{ id: "r", from: "summary", to: "excerpt" }]);
		// An empty value under the new name is not a value.
		expect(
			run([{ id: "r", op: "renameField", collection: "post", from: "summary", to: "excerpt" }], {
				summary: "old",
				excerpt: "",
			}).metadata,
		).toEqual({ excerpt: "old" });
	});

	it("chains renames in order", () => {
		const result = run(
			[
				{ id: "1", op: "renameField", collection: "post", from: "a", to: "b" },
				{ id: "2", op: "renameField", collection: "post", from: "b", to: "excerpt" },
			],
			{ a: "x" },
		);
		expect(result.metadata).toEqual({ excerpt: "x" });
		expect(result.changedBy).toEqual(["1", "2"]);
	});

	it("maps a select value, also in a list, without duplicates", () => {
		const map: SchemaMigration = {
			id: "m",
			op: "mapOption",
			collection: "post",
			field: "level",
			from: "mid",
			to: "high",
		};
		expect(run([map], { level: "mid" }).metadata).toEqual({ level: "high" });
		expect(run([map], { level: "low" }).changedBy).toEqual([]);
		expect(run([map], { level: ["mid", "low", "high"] }).metadata).toEqual({ level: ["high", "low"] });
	});

	it("drops a field's values, only when asked", () => {
		const drop: SchemaMigration = { id: "d", op: "dropField", collection: "post", field: "legacy" };
		expect(run([drop], { title: "T", legacy: "x", other: "y" }).metadata).toEqual({ title: "T", other: "y" });
		expect(run([drop], { title: "T", other: "y" }).changedBy).toEqual([]);
		// Without a transform nothing is dropped.
		expect(run([], { title: "T", legacy: "x" }).metadata).toEqual({ title: "T", legacy: "x" });
	});

	it("sets a default where there is no value, in a branch only where it shows, and on a translation only for a per-language field", () => {
		const level: SchemaMigration = { id: "l", op: "setDefault", collection: "post", field: "level", value: "low" };
		expect(run([level], { title: "T" }).metadata).toEqual({ title: "T", level: "low" });
		expect(run([level], { title: "T", level: "" }).metadata).toEqual({ title: "T", level: "low" });
		expect(run([level], { level: "high" }).changedBy).toEqual([]);
		// A shared field's value lives on the source: a translation does not get one.
		expect(run([level], { title: "T" }, { isTranslation: true }).changedBy).toEqual([]);
		const labels: SchemaMigration = { id: "b", op: "setDefault", collection: "post", field: "labels", value: "-" };
		expect(run([labels], { title: "T" }, { isTranslation: true }).metadata).toEqual({ title: "T", labels: "-" });
		// A field in a branch is only filled where the branch shows.
		const replacement: SchemaMigration = {
			id: "p",
			op: "setDefault",
			collection: "post",
			field: "replacementId",
			value: "x",
		};
		expect(run([replacement], { policy: "normal" }).changedBy).toEqual([]);
	});

	it("leaves the bodies of other collections alone", () => {
		const drop: SchemaMigration = { id: "d", op: "dropField", collection: "post", field: "legacy" };
		expect(run([drop], { legacy: "x" }, { collection: "tag" }).changedBy).toEqual([]);
	});
});

describe("checkTransforms", () => {
	const problems = (transforms: SchemaMigration[]) =>
		checkTransforms(site, transforms).map((problem) => problem.message);

	it("accepts transforms that fit the schema after the change", () => {
		expect(
			problems([
				{ id: "1", op: "renameField", collection: "post", from: "summary", to: "excerpt" },
				{ id: "2", op: "mapOption", collection: "post", field: "level", from: "mid", to: "high" },
				{ id: "3", op: "dropField", collection: "post", field: "legacy" },
				{ id: "4", op: "setDefault", collection: "post", field: "level", value: "low" },
			]),
		).toEqual([]);
	});

	it("accepts a chain of renames, and rejects one that points nowhere", () => {
		expect(
			problems([
				{ id: "1", op: "renameField", collection: "post", from: "a", to: "b" },
				{ id: "2", op: "renameField", collection: "post", from: "b", to: "excerpt" },
			]),
		).toEqual([]);
		expect(problems([{ id: "1", op: "renameField", collection: "post", from: "a", to: "b" }])).toEqual([
			"post.b is not a field of the schema",
		]);
	});

	it("rejects a transform that would be wrong", () => {
		expect(problems([{ id: "1", op: "dropField", collection: "post", field: "excerpt" }])[0]).toMatch(/still a field/);
		expect(problems([{ id: "1", op: "renameField", collection: "post", from: "excerpt", to: "level" }])[0]).toMatch(
			/still a field/,
		);
		expect(problems([{ id: "1", op: "renameField", collection: "gone", from: "a", to: "b" }])).toEqual([
			'collection "gone" is not in the schema',
		]);
		expect(
			problems([{ id: "1", op: "mapOption", collection: "post", field: "level", from: "mid", to: "none" }])[0],
		).toMatch(/no option "none"/);
		expect(
			problems([{ id: "1", op: "mapOption", collection: "post", field: "level", from: "high", to: "low" }])[0],
		).toMatch(/still has the option/);
		expect(
			problems([{ id: "1", op: "mapOption", collection: "post", field: "excerpt", from: "a", to: "b" }])[0],
		).toMatch(/not a select/);
		expect(problems([{ id: "1", op: "setDefault", collection: "post", field: "level", value: "mid" }])[0]).toMatch(
			/no option "mid"/,
		);
		expect(
			problems([{ id: "1", op: "setDefault", collection: "post", field: "excerpt", value: "too long" }])[0],
		).toMatch(/5 characters/);
		expect(problems([{ id: "1", op: "setDefault", collection: "post", field: "excerpt", value: "" }])[0]).toMatch(
			/empty default/,
		);
		expect(
			problems([{ id: "1", op: "setDefault", collection: "post", field: "replacementId", value: "x" }])[0],
		).toMatch(/not a text or select/);
	});
});

describe("suggestTransforms", () => {
	it("offers a drop and the renames that look right for a removed field", () => {
		expect(
			suggestTransforms(
				{ kind: "field_removed", collection: "post", field: "summary", fieldKind: "text" },
				{ renameTo: ["excerpt"] },
			),
		).toEqual([
			{ op: "renameField", collection: "post", from: "summary", to: "excerpt" },
			{ op: "dropField", collection: "post", field: "summary" },
		]);
	});

	it("offers each remaining option for a removed option, and a default for a field that became required", () => {
		expect(
			suggestTransforms(
				{ kind: "option_removed", collection: "post", field: "level", option: "mid" },
				{ options: ["low", "mid", "high"] },
			),
		).toEqual([
			{ op: "mapOption", collection: "post", field: "level", from: "mid", to: "low" },
			{ op: "mapOption", collection: "post", field: "level", from: "mid", to: "high" },
		]);
		expect(
			suggestTransforms({ kind: "field_required_changed", collection: "post", field: "excerpt", required: true }),
		).toEqual([{ op: "setDefault", collection: "post", field: "excerpt", value: "" }]);
		expect(
			suggestTransforms({ kind: "field_required_changed", collection: "post", field: "excerpt", required: false }),
		).toEqual([]);
		expect(suggestTransforms({ kind: "locale_added", locale: "ja" })).toEqual([]);
	});
});
