import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { type AiActionsStore, actionWithDraft, createCustomAction, listActions, updateAction } from "../actions";
import {
	type AiSharedStore,
	addShared,
	deleteShared,
	getSharedView,
	loadSharedKeys,
	loadSharedTexts,
	updateShared,
	updateSharedItem,
} from "../shared";

/** A store holding the shared text row. A version mismatch is rejected. */
function memoryStore(initial: { value: unknown; version: number } | null = null): AiSharedStore & { saved: unknown } {
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
function actionsStore(shared = memoryStore()): AiActionsStore & AiSharedStore {
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

// Shared text of the example config (`test/cms.config.ts`): `styleGuide` (default is empty text).
describe("shared texts", () => {
	it("a config text stores only the edited content and clears it when equal to the default (reset)", async () => {
		const store = memoryStore();
		expect((await getSharedView(testSite, store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "", overridden: false },
		]);
		const saved = await updateShared(testSite, store, 0, { texts: { styleGuide: "'~다'체" } });
		expect(saved.items[0]).toMatchObject({ text: "'~다'체", overridden: true });
		expect(await loadSharedTexts(testSite, store)).toEqual({ styleGuide: "'~다'체" });

		await updateShared(testSite, store, 1, { texts: { styleGuide: "" } });
		expect(store.saved).toEqual({ texts: {}, added: [] });
	});

	it("reads the old shape (key to edited content) and converts to the new shape on save", async () => {
		const store = memoryStore({ value: { styleGuide: "짧게 쓴다." }, version: 4 });
		const view = await getSharedView(testSite, store);
		expect(view).toMatchObject({ version: 4, items: [{ key: "styleGuide", text: "짧게 쓴다.", overridden: true }] });

		await addShared(testSite, store, 4, { key: "tone", label: "말투", text: "친근하게" });
		expect(store.saved).toEqual({
			texts: { styleGuide: "짧게 쓴다." },
			added: [{ key: "tone", label: "말투", text: "친근하게" }],
		});
	});

	it("adds, edits and deletes texts; added texts are included in runs", async () => {
		const store = memoryStore();
		const added = await addShared(testSite, store, 0, { key: "tone", label: " 말투 ", text: "친근하게" });
		expect(added.items.at(-1)).toEqual({ source: "added", key: "tone", label: "말투", text: "친근하게" });
		expect(await loadSharedTexts(testSite, store)).toEqual({ styleGuide: "", tone: "친근하게" });
		expect(await loadSharedKeys(testSite, store)).toEqual(["styleGuide", "tone"]);

		const renamed = await updateSharedItem(testSite, store, 1, { key: "tone", label: "어조", text: "정중하게" });
		expect(renamed.items.at(-1)).toEqual({ source: "added", key: "tone", label: "어조", text: "정중하게" });
		// A config text only changes its content even if a name is sent.
		const config = await updateSharedItem(testSite, store, 2, { key: "styleGuide", label: "바꾼 이름", text: "짧게" });
		expect(config.items[0]).toMatchObject({ label: "문체 가이드", text: "짧게", overridden: true });

		const deleted = await deleteShared(testSite, store, 3, "tone", []);
		expect(deleted.items.map((item) => item.key)).toEqual(["styleGuide"]);
		expect(store.saved).toEqual({ texts: { styleGuide: "짧게" }, added: [] });
	});

	it("rejects bad key format, duplicate keys, empty names, unknown texts and version mismatches", async () => {
		const store = memoryStore();
		await addShared(testSite, store, 0, { key: "tone", label: "말투", text: "" });
		const rejects = (promise: Promise<unknown>, message?: RegExp) =>
			expect(promise).rejects.toMatchObject({
				code: "ai_invalid_input",
				...(message ? { message: expect.stringMatching(message) } : {}),
			});
		await rejects(addShared(testSite, store, 1, { key: "1tone", label: "말투", text: "" }), /영문자로 시작/);
		await rejects(addShared(testSite, store, 1, { key: "shared.x", label: "말투", text: "" }));
		await rejects(addShared(testSite, store, 1, { key: "tone", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addShared(testSite, store, 1, { key: "styleGuide", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addShared(testSite, store, 1, { key: "other", label: "  ", text: "" }), /이름/);
		await rejects(updateSharedItem(testSite, store, 1, { key: "nope", text: "x" }), /없는 공통 문구/);
		await rejects(updateShared(testSite, store, 1, { texts: { nope: "x" } }), /없는 공통 문구/);
		await rejects(deleteShared(testSite, store, 1, "styleGuide", []), /삭제할 수 없습니다/);
		await rejects(deleteShared(testSite, store, 1, "nope", []), /없는 공통 문구/);
		await expect(updateSharedItem(testSite, store, 0, { key: "tone", text: "x" })).rejects.toThrow("conflict");
	});

	it("cannot delete a text used in a prompt and reports the action names", async () => {
		const store = memoryStore();
		await addShared(testSite, store, 0, { key: "tone", label: "말투", text: "" });
		const features = [
			{ label: "요약 만들기", prompt: "요약한다.\n{{ shared.tone }}" },
			{ label: "문체 다듬기", prompt: "{{shared.styleGuide}}" },
			{ label: "초안 쓰기", prompt: "{{shared.tone}}" },
			{ label: "다른 키", prompt: "{{shared.toneLong}}" },
		];
		await expect(deleteShared(testSite, store, 1, "tone", features)).rejects.toMatchObject({
			code: "ai_invalid_input",
			message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기, 초안 쓰기",
		});
		expect((await getSharedView(testSite, store)).items).toHaveLength(2);
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
		expect((await getSharedView(testSite, store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "고친 값", overridden: true },
			{ source: "added", key: "tone", label: "말투", text: "남김" },
		]);
	});
});

describe("admin screen prompts and added shared texts", () => {
	it("added text keys are accepted when saving or testing prompts, and unknown keys are rejected", async () => {
		const shared = memoryStore();
		const store = actionsStore(shared);
		const prompt = "요약한다.\n\n{{shared.tone}}";
		await expect(updateAction(testSite, store, "summary", 0, { prompt })).rejects.toMatchObject({
			code: "ai_invalid_input",
			message: expect.stringContaining("{{shared.tone}}"),
		});

		await addShared(testSite, shared, 0, { key: "tone", label: "말투", text: "정중하게" });
		expect((await updateAction(testSite, store, "summary", 0, { prompt })).prompt).toBe(prompt);
		expect((await actionWithDraft(testSite, store, "polish", { prompt })).prompt).toBe(prompt);
		const custom = await createCustomAction(
			testSite,
			store,
			{ label: "말투 맞추기", surface: { slot: "selection" }, result: "mdx" },
			{ prompt: "{{shared.tone}}" },
		);
		expect(custom.prompt).toBe("{{shared.tone}}");

		// Cannot be deleted because an edited prompt and a screen action use it.
		await expect(deleteShared(testSite, shared, 1, "tone", await listActions(testSite, store))).rejects.toMatchObject({
			message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기, 말투 맞추기",
		});
	});
});
