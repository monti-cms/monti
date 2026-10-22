import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { type AiActionsStore, actionWithDraft, createCustomAction, listActions, updateAction } from "../actions";
import {
	type AiSnippetStore,
	addSnippet,
	deleteSnippet,
	getSnippetView,
	loadSnippetKeys,
	loadSnippets,
	updateSnippetItem,
	updateSnippets,
} from "../snippets";

/** A store holding the prompt snippet row. A version mismatch is rejected. */
function memoryStore(initial: { value: unknown; version: number } | null = null): AiSnippetStore & { saved: unknown } {
	let row = initial;
	return {
		get saved() {
			return row?.value;
		},
		getAiSettings: async () => row,
		saveAiSettings: async ({ expectedVersion, value }) => {
			if ((row?.version ?? 0) !== expectedVersion) throw new Error("conflict");
			row = { value, version: expectedVersion + 1 };
			return row.version;
		},
	};
}

type Row = { key: string; value: unknown; version: number; updatedAt: Date };

/** A store that also holds action overrides and screen actions. */
function actionsStore(shared = memoryStore()): AiActionsStore & AiSnippetStore {
	const overrides = new Map<string, Row>();
	const custom = new Map<string, Row>();
	const save =
		(rows: Map<string, Row>) =>
		async ({ key, expectedVersion, value }: { key: string; expectedVersion: number; value: unknown }) => {
			if ((rows.get(key)?.version ?? 0) !== expectedVersion) throw new Error("conflict");
			const row = { key, value, version: expectedVersion + 1, updatedAt: new Date(0) };
			rows.set(key, row);
			return row;
		};
	return {
		getAiSettings: shared.getAiSettings,
		saveAiSettings: shared.saveAiSettings,
		listAiActionOverrides: async () => [...overrides.values()],
		saveAiActionOverride: save(overrides),
		listAiCustomActions: async () => [...custom.values()],
		saveAiCustomAction: save(custom),
		deleteAiCustomAction: async ({ key }) => {
			custom.delete(key);
		},
	};
}

// Prompt snippet of the example config (`test/cms.config.ts`): `styleGuide` (default is empty text).
describe("prompt snippets", () => {
	it("a config text stores only the edited content and clears it when equal to the default (reset)", async () => {
		const store = memoryStore();
		expect((await getSnippetView(testSite, store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "", overridden: false },
		]);
		const saved = await updateSnippets(testSite, store, 0, { texts: { styleGuide: "'~다'체" } });
		expect(saved.items[0]).toMatchObject({ text: "'~다'체", overridden: true });
		expect(await loadSnippets(testSite, store)).toEqual({ styleGuide: "'~다'체" });

		await updateSnippets(testSite, store, 1, { texts: { styleGuide: "" } });
		expect(store.saved).toEqual({ texts: {}, added: [] });
	});

	it("adds, edits and deletes texts; added texts are included in runs", async () => {
		const store = memoryStore();
		const added = await addSnippet(testSite, store, 0, { key: "tone", label: " 말투 ", text: "친근하게" });
		expect(added.items.at(-1)).toEqual({ source: "added", key: "tone", label: "말투", text: "친근하게" });
		expect(await loadSnippets(testSite, store)).toEqual({ styleGuide: "", tone: "친근하게" });
		expect(await loadSnippetKeys(testSite, store)).toEqual(["styleGuide", "tone"]);

		const renamed = await updateSnippetItem(testSite, store, 1, { key: "tone", label: "어조", text: "정중하게" });
		expect(renamed.items.at(-1)).toEqual({ source: "added", key: "tone", label: "어조", text: "정중하게" });
		// A config text only changes its content even if a name is sent.
		const config = await updateSnippetItem(testSite, store, 2, { key: "styleGuide", label: "바꾼 이름", text: "짧게" });
		expect(config.items[0]).toMatchObject({ label: "문체 가이드", text: "짧게", overridden: true });

		const deleted = await deleteSnippet(testSite, store, 3, "tone", []);
		expect(deleted.items.map((item) => item.key)).toEqual(["styleGuide"]);
		expect(store.saved).toEqual({ texts: { styleGuide: "짧게" }, added: [] });
	});

	it("rejects bad key format, duplicate keys, empty names, unknown texts and version mismatches", async () => {
		const store = memoryStore();
		await addSnippet(testSite, store, 0, { key: "tone", label: "말투", text: "" });
		const rejects = (promise: Promise<unknown>, message?: RegExp) =>
			expect(promise).rejects.toMatchObject({
				code: "invalid_input",
				...(message ? { message: expect.stringMatching(message) } : {}),
			});
		await rejects(addSnippet(testSite, store, 1, { key: "1tone", label: "말투", text: "" }), /영문자로 시작/);
		await rejects(addSnippet(testSite, store, 1, { key: "snippet.x", label: "말투", text: "" }));
		await rejects(addSnippet(testSite, store, 1, { key: "tone", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addSnippet(testSite, store, 1, { key: "styleGuide", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addSnippet(testSite, store, 1, { key: "other", label: "  ", text: "" }), /이름/);
		await rejects(updateSnippetItem(testSite, store, 1, { key: "nope", text: "x" }), /없는 프롬프트 조각/);
		await rejects(updateSnippets(testSite, store, 1, { texts: { nope: "x" } }), /없는 프롬프트 조각/);
		await rejects(deleteSnippet(testSite, store, 1, "styleGuide", []), /삭제할 수 없어요/);
		await rejects(deleteSnippet(testSite, store, 1, "nope", []), /없는 프롬프트 조각/);
		await expect(updateSnippetItem(testSite, store, 0, { key: "tone", text: "x" })).rejects.toThrow("conflict");
	});

	it("cannot delete a text used in a prompt and reports the action names", async () => {
		const store = memoryStore();
		await addSnippet(testSite, store, 0, { key: "tone", label: "말투", text: "" });
		const features = [
			{ label: "요약 만들기", prompt: "요약한다.\n{{ snippet.tone }}" },
			{ label: "문체 다듬기", prompt: "{{snippet.styleGuide}}" },
			{ label: "초안 쓰기", prompt: "{{snippet.tone}}" },
			{ label: "다른 키", prompt: "{{snippet.toneLong}}" },
		];
		await expect(deleteSnippet(testSite, store, 1, "tone", features)).rejects.toMatchObject({
			code: "invalid_input",
			message: "이 조각을 쓰는 기능이 있어 삭제할 수 없어요: 요약 만들기, 초안 쓰기",
		});
		expect((await getSnippetView(testSite, store)).items).toHaveLength(2);
	});

	it("when the config later gains the same key, the config text wins; invalid entries are dropped one by one", async () => {
		const store = memoryStore({
			value: {
				texts: { styleGuide: "고친 값", broken: 1 },
				added: [
					{ key: "styleGuide", label: "겹침", text: "버림" },
					{ key: "tone", label: "말투", text: "남김" },
					{ key: "bad key", label: "틀림", text: "" },
				],
			},
			version: 2,
		});
		expect((await getSnippetView(testSite, store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "고친 값", overridden: true },
			{ source: "added", key: "tone", label: "말투", text: "남김" },
		]);
	});
});

describe("admin screen prompts and added prompt snippets", () => {
	it("added text keys are accepted when saving or testing prompts, and unknown keys are rejected", async () => {
		const shared = memoryStore();
		const store = actionsStore(shared);
		const prompt = "요약한다.\n\n{{snippet.tone}}";
		await expect(updateAction(testSite, store, "summary", 0, { prompt })).rejects.toMatchObject({
			code: "invalid_input",
			message: expect.stringContaining("{{snippet.tone}}"),
		});

		await addSnippet(testSite, shared, 0, { key: "tone", label: "말투", text: "정중하게" });
		expect((await updateAction(testSite, store, "summary", 0, { prompt })).prompt).toBe(prompt);
		expect((await actionWithDraft(testSite, store, "polish", { prompt })).prompt).toBe(prompt);
		const custom = await createCustomAction(
			testSite,
			store,
			{ label: "말투 맞추기", surface: { slot: "selection" }, result: "mdx" },
			{ prompt: "{{snippet.tone}}" },
		);
		expect(custom.prompt).toBe("{{snippet.tone}}");

		// Cannot be deleted because an edited prompt and a screen action use it.
		await expect(deleteSnippet(testSite, shared, 1, "tone", await listActions(testSite, store))).rejects.toMatchObject({
			message: "이 조각을 쓰는 기능이 있어 삭제할 수 없어요: 요약 만들기, 말투 맞추기",
		});
	});
});
