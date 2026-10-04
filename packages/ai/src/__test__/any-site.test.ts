import { COLLECTIONS, type Collection, isCollection, schemaOf, storedField } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { type AiAttach, resolveAction } from "../action";
import type { AiProvider } from "../provider";
import { AI_ACTIONS, attachedTo } from "../registry";
import { type AiRunDeps, runAiAction } from "../run";

/**
 * 설정과 상관없는 AI 필드 기능 확인(M10-1 재발 방지). 기능·컬렉션·필드 이름을 적지 않고 지금 설정의 AI 플러그인에서
 * 읽는다. 블로그 예시 설정(`test/cms.config.ts`)과 다른 사이트 설정(`test/other-site.config.ts`) 둘 다로 돈다.
 */

type FieldAttach = Extract<AiAttach, { slot: "field" }>;

const fieldActions = Object.entries(AI_ACTIONS).flatMap(([key, definition]) =>
	(definition.attach ?? [])
		.filter((attach): attach is FieldAttach => attach.slot === "field")
		.map((attach) => ({ key, definition, attach })),
);

/** 기능이 붙는 컬렉션. 없으면 그 필드가 있는 모든 컬렉션. */
const collectionsOf = (attach: FieldAttach): Collection[] =>
	(attach.collections ?? COLLECTIONS).filter(
		(name): name is Collection => isCollection(name) && Object.hasOwn(schemaOf(name).fields, attach.field),
	);

/** 필드 정의(주소 필드는 저장 필드가 아니라서 스키마에서 직접 읽는다). */
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
			// 화면 자리는 필드 이름과 컬렉션으로 기능을 찾는다.
			expect(attachedTo(attach, { slot: "field", target: attach.field, collection })).toBe(true);
			expect(attachedTo(attach, { slot: "field", target: `${attach.field}-other`, collection })).toBe(false);
			const field = fieldOf(collection, attach.field);
			const choices = definition.choices;
			if (choices?.from === "collection") {
				// 고르는 기능은 그 컬렉션을 가리키는 관계 필드에 붙고, 하나/여럿은 필드와 맞는다.
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
