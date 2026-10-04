import { COLLECTIONS, type Collection, isCollection, schemaOf, storedField } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { type AiAttach, resolveAction } from "../action";
import type { AiProvider } from "../provider";
import { AI_ACTIONS, attachedTo } from "../registry";
import { type AiRunDeps, runAiAction } from "../run";

/**
 * Config-independent check of AI field actions (regression guard). Names of actions, collections and fields are not hardcoded; they are read from the AI plugin of the current config.
 * Runs with both the reference blog example config (`test/cms.config.ts`) and the other-site config (`test/other-site.config.ts`).
 */

type FieldAttach = Extract<AiAttach, { slot: "field" }>;

const fieldActions = Object.entries(AI_ACTIONS).flatMap(([key, definition]) =>
	(definition.attach ?? [])
		.filter((attach): attach is FieldAttach => attach.slot === "field")
		.map((attach) => ({ key, definition, attach })),
);

/** Collections an action attaches to. If none, all collections that have that field. */
const collectionsOf = (attach: FieldAttach): Collection[] =>
	(attach.collections ?? COLLECTIONS).filter(
		(name): name is Collection => isCollection(name) && Object.hasOwn(schemaOf(name).fields, attach.field),
	);

/** Field definition (the slug field is not a stored field, so it is read directly from the schema). */
const fieldOf = (collection: Collection, name: string) =>
	storedField(collection, name)?.field ?? schemaOf(collection).fields[name];

describe("any site: AI field actions", () => {
	it("the active config attaches at least one AI action to a field", () => {
		expect(fieldActions.length).toBeGreaterThan(0);
	});

	it.each(
		fieldActions.map(({ key, definition, attach }) => [key, definition, attach] as const),
	)("%s attaches to a field of the right kind in each of its collections", (_key, definition, attach) => {
		const collections = collectionsOf(attach);
		expect(collections.length).toBeGreaterThan(0);
		for (const collection of collections) {
			// A screen slot finds actions by field name and collection.
			expect(attachedTo(attach, { slot: "field", target: attach.field, collection })).toBe(true);
			expect(attachedTo(attach, { slot: "field", target: `${attach.field}-other`, collection })).toBe(false);
			const field = fieldOf(collection, attach.field);
			const choices = definition.choices;
			if (choices?.from === "collection") {
				// A picking action attaches to relation fields pointing at that collection, and one/many matches the field.
				expect(field?.kind).toBe("relation");
				if (field?.kind !== "relation") continue;
				expect(field.to).toBe(choices.collection);
				if (definition.pick) expect(definition.pick === "many").toBe(field.many === true);
			} else {
				expect(["text", "slug"]).toContain(field?.kind);
			}
		}
	});

	const generated = fieldActions.filter(({ definition }) => definition.engine !== "decide");

	it.each(
		generated.map(({ key, attach }) => [key, attach] as const),
	)("%s runs with the slot inputs for its first collection", async (key, attach) => {
		const definition = AI_ACTIONS[key];
		if (!definition) throw new Error(key);
		const action = resolveAction(key, definition);
		const provider: AiProvider = {
			name: "fake",
			model: "m",
			generate: async <T>() => ({ candidates: ["alpha-beta"], text: "Alpha beta" }) as T,
			async *stream() {
				yield "Alpha beta";
			},
		};
		const deps: AiRunDeps = {
			generator: provider,
			decider: null,
			loadRecords: async () => [],
			fieldOptions: () => [],
			loadImage: async () => null,
			content: { slugsInUse: async () => new Set() },
			languageName: (code) => code,
		};
		const [collection] = collectionsOf(attach);
		const result = await runAiAction(
			action,
			{ input: { title: "Alpha beta", body: "Body text" }, env: { collection } },
			deps,
		);
		expect(result.kind).toBe(definition.result);
	});
});
