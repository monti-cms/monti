import { describe, expect, it } from "vitest";
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

/** 공통 문구 한 줄을 들고 있는 저장소. 버전이 다르면 막는다. */
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

/** 기능 고친 값·화면 기능까지 들고 있는 저장소. */
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

// 예시 설정(`test/cms.config.ts`)의 공통 문구: `styleGuide`(기본값 빈 글).
describe("공통 문구(M8-4)", () => {
	it("설정 문구는 고친 내용만 저장하고, 기본값과 같으면 지운다(되돌리기)", async () => {
		const store = memoryStore();
		expect((await getSharedView(store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "", overridden: false },
		]);
		const saved = await updateShared(store, 0, { texts: { styleGuide: "'~다'체" } });
		expect(saved.items[0]).toMatchObject({ text: "'~다'체", overridden: true });
		expect(await loadSharedTexts(store)).toEqual({ styleGuide: "'~다'체" });

		await updateShared(store, 1, { texts: { styleGuide: "" } });
		expect(store.saved).toEqual({ texts: {}, added: [] });
	});

	it("예전 모양(키 → 고친 내용)을 읽고, 저장하면 새 모양으로 바꾼다", async () => {
		const store = memoryStore({ value: { styleGuide: "짧게 쓴다." }, version: 4 });
		const view = await getSharedView(store);
		expect(view).toMatchObject({ version: 4, items: [{ key: "styleGuide", text: "짧게 쓴다.", overridden: true }] });

		await addShared(store, 4, { key: "tone", label: "말투", text: "친근하게" });
		expect(store.saved).toEqual({
			texts: { styleGuide: "짧게 쓴다." },
			added: [{ key: "tone", label: "말투", text: "친근하게" }],
		});
	});

	it("문구를 더하고 고치고 삭제한다. 실행에는 더한 문구도 들어간다", async () => {
		const store = memoryStore();
		const added = await addShared(store, 0, { key: "tone", label: " 말투 ", text: "친근하게" });
		expect(added.items.at(-1)).toEqual({ source: "added", key: "tone", label: "말투", text: "친근하게" });
		expect(await loadSharedTexts(store)).toEqual({ styleGuide: "", tone: "친근하게" });
		expect(await loadSharedKeys(store)).toEqual(["styleGuide", "tone"]);

		const renamed = await updateSharedItem(store, 1, { key: "tone", label: "어조", text: "정중하게" });
		expect(renamed.items.at(-1)).toEqual({ source: "added", key: "tone", label: "어조", text: "정중하게" });
		// 설정 문구는 이름을 보내도 내용만 고친다.
		const config = await updateSharedItem(store, 2, { key: "styleGuide", label: "바꾼 이름", text: "짧게" });
		expect(config.items[0]).toMatchObject({ label: "문체 가이드", text: "짧게", overridden: true });

		const deleted = await deleteShared(store, 3, "tone", []);
		expect(deleted.items.map((item) => item.key)).toEqual(["styleGuide"]);
		expect(store.saved).toEqual({ texts: { styleGuide: "짧게" }, added: [] });
	});

	it("키 형식·겹치는 키·빈 이름·없는 문구·버전 차이를 막는다", async () => {
		const store = memoryStore();
		await addShared(store, 0, { key: "tone", label: "말투", text: "" });
		const rejects = (promise: Promise<unknown>, message?: RegExp) =>
			expect(promise).rejects.toMatchObject({
				code: "ai_invalid_input",
				...(message ? { message: expect.stringMatching(message) } : {}),
			});
		await rejects(addShared(store, 1, { key: "1tone", label: "말투", text: "" }), /영문자로 시작/);
		await rejects(addShared(store, 1, { key: "shared.x", label: "말투", text: "" }));
		await rejects(addShared(store, 1, { key: "tone", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addShared(store, 1, { key: "styleGuide", label: "다른", text: "" }), /이미 있는 키/);
		await rejects(addShared(store, 1, { key: "other", label: "  ", text: "" }), /이름/);
		await rejects(updateSharedItem(store, 1, { key: "nope", text: "x" }), /없는 공통 문구/);
		await rejects(updateShared(store, 1, { texts: { nope: "x" } }), /없는 공통 문구/);
		await rejects(deleteShared(store, 1, "styleGuide", []), /삭제할 수 없습니다/);
		await rejects(deleteShared(store, 1, "nope", []), /없는 공통 문구/);
		await expect(updateSharedItem(store, 0, { key: "tone", text: "x" })).rejects.toThrow("conflict");
	});

	it("지시문에서 쓰는 문구는 삭제하지 못하고 그 기능 이름을 알린다", async () => {
		const store = memoryStore();
		await addShared(store, 0, { key: "tone", label: "말투", text: "" });
		const features = [
			{ label: "요약 만들기", prompt: "요약한다.\n{{ shared.tone }}" },
			{ label: "문체 다듬기", prompt: "{{shared.styleGuide}}" },
			{ label: "초안 쓰기", prompt: "{{shared.tone}}" },
			{ label: "다른 키", prompt: "{{shared.toneLong}}" },
		];
		await expect(deleteShared(store, 1, "tone", features)).rejects.toMatchObject({
			code: "ai_invalid_input",
			message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기, 초안 쓰기",
		});
		expect((await getSharedView(store)).items).toHaveLength(2);
	});

	it("나중에 설정에 같은 키가 생기면 설정 문구가 이긴다. 맞지 않는 항목은 하나씩 버린다", async () => {
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
		expect((await getSharedView(store)).items).toEqual([
			{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "", text: "고친 값", overridden: true },
			{ source: "added", key: "tone", label: "말투", text: "남김" },
		]);
	});
});

describe("관리자 화면의 지시문과 더한 공통 문구", () => {
	it("더한 문구 키는 지시문 저장·시험에서 받고, 없는 키는 막는다", async () => {
		const shared = memoryStore();
		const store = actionsStore(shared);
		const prompt = "요약한다.\n\n{{shared.tone}}";
		await expect(updateAction(store, "summary", 0, { prompt })).rejects.toMatchObject({
			code: "ai_invalid_input",
			message: expect.stringContaining("{{shared.tone}}"),
		});

		await addShared(shared, 0, { key: "tone", label: "말투", text: "정중하게" });
		expect((await updateAction(store, "summary", 0, { prompt })).prompt).toBe(prompt);
		expect((await actionWithDraft(store, "polish", { prompt })).prompt).toBe(prompt);
		const custom = await createCustomAction(
			store,
			{ label: "말투 맞추기", surface: { slot: "selection" }, result: "mdx" },
			{ prompt: "{{shared.tone}}" },
		);
		expect(custom.prompt).toBe("{{shared.tone}}");

		// 고친 지시문과 화면 기능이 쓰므로 삭제하지 못한다.
		await expect(deleteShared(shared, 1, "tone", await listActions(store))).rejects.toMatchObject({
			message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기, 말투 맞추기",
		});
	});
});
