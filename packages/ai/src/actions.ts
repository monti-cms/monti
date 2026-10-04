import { createTranslator } from "@monti-cms/core/client";
import {
	type AiActionDefinition,
	type AiActionOverride,
	aiActionOverrideSchema,
	EDITABLE_KEYS,
	overrideFrom,
	type ResolvedAiAction,
	resolveAction,
	unknownPlaceholders,
} from "./action";
import { type AiActionView, readOverride, viewOf } from "./action-view";
import { actionsMessages } from "./actions.messages";
import {
	type CustomBase,
	type CustomValue,
	customBaseSchema,
	customDefinition,
	customValueSchema,
	isCustomKey,
	newCustomKey,
	surfaceProblem,
} from "./custom";
import { migrateLegacyCheck } from "./definition";
import { AiError } from "./errors";
import { AI_ACTIONS, AI_SHARED_KEYS, actionDefinition } from "./registry";
import { type AiSharedStore, loadSharedKeys } from "./shared";

const t = createTranslator(actionsMessages);

/**
 * 기능 정의(설정)와 고친 값(DB)을 합쳐 다룬다. 관리자 AI 화면·실행 API가 쓴다.
 * 정의에 없는 이름의 고친 값은 무시한다(설정에서 기능을 지운 경우).
 */

type Row = { key: string; value: unknown; version: number; updatedAt: Date };

export type { AiActionView } from "./action-view";

export interface AiActionsStore extends Pick<AiSharedStore, "getAiSettings"> {
	listAiActionOverrides(): Promise<Row[]>;
	saveAiActionOverride(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	/** 화면 기능(M8-5). */
	listAiCustomActions(): Promise<Row[]>;
	saveAiCustomAction(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	deleteAiCustomAction(params: { key: string; expectedVersion: number }): Promise<void>;
}

/** 저장한 화면 기능 한 줄. 모양이 맞지 않으면 `null`(정의가 바뀌어 맞지 않게 된 경우). */
const readCustom = (value: unknown): CustomValue | null => {
	const parsed = customValueSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
};

async function customRow(store: AiActionsStore, key: string): Promise<{ row: Row; value: CustomValue }> {
	const row = (await store.listAiCustomActions()).find((item) => item.key === key);
	const value = row ? readCustom(row.value) : null;
	if (!row || !value) throw new AiError("ai_unknown_action", t("unknownAction"));
	return { row, value };
}

const definitionOf = (key: string): AiActionDefinition => {
	const definition = actionDefinition(key);
	if (!definition) throw new AiError("ai_unknown_action", t("unknownAction"));
	return definition;
};

/** 기능 하나(고친 값을 얹은 것). 화면 기능도 같은 모양이다. */
export async function getAction(store: AiActionsStore, key: string): Promise<ResolvedAiAction> {
	if (isCustomKey(key)) {
		const { value } = await customRow(store, key);
		return resolveAction(key, customDefinition(value.base), value.override);
	}
	const definition = definitionOf(key);
	const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
	return resolveAction(key, definition, readOverride(row?.value));
}

/** 설정 순서대로 모든 코드 기능, 그다음 만든 순서대로 화면 기능. */
export async function listActions(store: AiActionsStore): Promise<AiActionView[]> {
	const rows = new Map((await store.listAiActionOverrides()).map((row) => [row.key, row]));
	const code = Object.entries(AI_ACTIONS).map(([key, definition]) => {
		const row = rows.get(key);
		return viewOf(resolveAction(key, definition, readOverride(row?.value)), row);
	});
	const custom = (await store.listAiCustomActions()).flatMap((row) => {
		const value = readCustom(row.value);
		if (!value) return [];
		return [viewOf(resolveAction(row.key, customDefinition(value.base), value.override), row, value)];
	});
	return [...code, ...custom];
}

/**
 * 고칠 수 있는 값으로 시험·저장할 기능을 만든다. 지시문의 `{{이름}}`은 언어 입력과 공통 문구(`sharedKeys`: 설정 문구와
 * 관리자 화면에서 더한 문구)만 받는다. 고칠 수 없는 값(이름·결과 모양 등)은 보내도 무시한다.
 */
export function actionWithEdits(
	key: string,
	edited: unknown,
	definition: AiActionDefinition = definitionOf(key),
	sharedKeys: readonly string[] = AI_SHARED_KEYS,
): ResolvedAiAction {
	const parsed = aiActionOverrideSchema.safeParse(
		edited && typeof edited === "object"
			? Object.fromEntries(
					EDITABLE_KEYS.filter((name) => name in edited).map((name) => [
						name,
						(edited as Record<string, unknown>)[name],
					]),
				)
			: {},
	);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		throw new AiError("ai_invalid_input", `${where}${issue?.message ?? t("invalidValue")}`);
	}
	const unknown = parsed.data.prompt ? unknownPlaceholders(parsed.data.prompt, definition.input, sharedKeys) : [];
	if (unknown.length > 0) {
		throw new AiError("ai_invalid_input", t("unknownPlaceholder", { name: unknown[0] ?? "" }));
	}
	return resolveAction(key, definition, overrideFrom(definition, parsed.data));
}

/**
 * 저장하지 않은 고친 값으로 시험할 기능(AI 화면의 `시험`). 화면 기능은 기본 정보(`base`)를 함께 주면 그것으로(아직
 * 저장하지 않은 새 기능 등), 아니면 저장한 기본 정보로 만든다.
 */
export async function actionWithDraft(
	store: AiActionsStore,
	key: string,
	edited: unknown,
	baseInput?: unknown,
): Promise<ResolvedAiAction> {
	const sharedKeys = await loadSharedKeys(store);
	if (!isCustomKey(key)) return actionWithEdits(key, edited, definitionOf(key), sharedKeys);
	if (baseInput !== undefined) {
		return actionWithEdits(key, edited, customDefinition(readBase(baseInput)), sharedKeys);
	}
	const { value } = await customRow(store, key);
	return actionWithEdits(key, edited, customDefinition(value.base), sharedKeys);
}

/** 화면 기능의 기본 정보를 검사한다. */
function readBase(input: unknown): CustomBase {
	const parsed = customBaseSchema.safeParse(input);
	if (!parsed.success) {
		throw new AiError("ai_invalid_input", parsed.error.issues[0]?.message ?? t("invalidBase"));
	}
	const problem = surfaceProblem(parsed.data.surface);
	if (problem) throw new AiError("ai_invalid_input", problem);
	return parsed.data;
}

/** 화면 기능을 만든다. 기본 정보와 고친 값(연결·모델·지시문·검사 등)을 한 번에 받는다. */
export async function createCustomAction(
	store: AiActionsStore,
	baseInput: unknown,
	edited: unknown = {},
): Promise<AiActionView> {
	const base = readBase(baseInput);
	const key = newCustomKey();
	const definition = customDefinition(base);
	const action = actionWithEdits(key, edited, definition, await loadSharedKeys(store));
	const value: CustomValue = { base, override: overrideFrom(definition, action) };
	const row = await store.saveAiCustomAction({ key, expectedVersion: 0, value });
	return viewOf(resolveAction(key, definition, value.override), row, value);
}

/** 화면 기능을 지운다. */
export async function deleteCustomAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<void> {
	if (!isCustomKey(key)) throw new AiError("ai_invalid_input", t("cannotDeleteCoded"));
	await store.deleteAiCustomAction({ key, expectedVersion });
}

/**
 * 고친 값을 저장한다. 기본값과 같은 값은 저장하지 않는다.
 * 화면 기능은 기본 정보(`base`: 이름·붙을 곳·결과 모양)도 함께 고칠 수 있다.
 */
export async function updateAction(
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
	edited: unknown,
	baseInput?: unknown,
): Promise<AiActionView> {
	if (isCustomKey(key)) {
		const { value: current } = await customRow(store, key);
		const base = baseInput === undefined ? current.base : readBase(baseInput);
		const definition = customDefinition(base);
		const action = actionWithEdits(key, edited, definition, await loadSharedKeys(store));
		const value: CustomValue = { base, override: overrideFrom(definition, action) };
		const row = await store.saveAiCustomAction({ key, expectedVersion, value });
		return viewOf(resolveAction(key, definition, value.override), row, value);
	}
	const definition = definitionOf(key);
	const action = actionWithEdits(key, edited, definition, await loadSharedKeys(store));
	const value = overrideFrom(definition, action);
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(action, row);
}

/** 기본값으로 되돌린다. 켜짐 여부는 지금 값을 둔다. 화면 기능은 되돌릴 기본값이 없다. */
export async function resetAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<AiActionView> {
	if (isCustomKey(key)) throw new AiError("ai_invalid_input", t("noDefaultForCustom"));
	const current = await getAction(store, key);
	const definition = definitionOf(key);
	const value = overrideFrom(definition, { enabled: current.enabled });
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(resolveAction(key, definition, value), row);
}

/**
 * 예전 AI 기능 표(`ai_features`)의 저장 값을 기능 이름별 고친 값으로 옮긴다. 정의와 다른 값만 남긴다.
 * 정의에 없는 이름(설정에서 뺀 기능, 예전에 지운 `mediaAlt` 등)은 `null`이다.
 * 예전 `보낼 내용`(inputs)은 `send`가 되고, 정의에 없는 입력(예: `tags`)은 빠진다.
 */
export function legacyFeatureOverride(key: string, spec: unknown): AiActionOverride | null {
	const definition = actionDefinition(key);
	if (!definition || !spec || typeof spec !== "object") return null;
	const raw = migrateLegacyCheck(spec) as Record<string, unknown>;
	const edited: Record<string, unknown> = {};
	const take = (name: keyof AiActionOverride, value: unknown) => {
		const parsed = aiActionOverrideSchema.shape[name].safeParse(value);
		if (parsed.success) edited[name] = parsed.data;
	};
	for (const name of [
		"enabled",
		"askInstruction",
		"providerId",
		"modelName",
		"prompt",
		"threshold",
		"maxCount",
	] as const) {
		if (raw[name] !== undefined) take(name, raw[name]);
	}
	// 예전 번역처럼 보낼 내용을 고르지 않던 기능은 빈 목록이었다. 빈 목록은 옮기지 않는다.
	if (Array.isArray(raw.inputs) && raw.inputs.length > 0) {
		take(
			"send",
			raw.inputs.filter(
				(input): input is string => typeof input === "string" && Object.hasOwn(definition.input, input),
			),
		);
	}
	if (Array.isArray(raw.checks)) take("checks", raw.checks);
	return overrideFrom(definition, resolveAction(key, definition, edited as AiActionOverride));
}
