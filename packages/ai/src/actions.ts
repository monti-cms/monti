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
 * Handles action definitions (config) and edited values (DB) together. Used by the admin AI screen and the run API.
 * Edited values under names missing from the definition are ignored (when an action was removed from the config).
 */

type Row = { key: string; value: unknown; version: number; updatedAt: Date };

export type { AiActionView } from "./action-view";

export interface AiActionsStore extends Pick<AiSharedStore, "getAiSettings"> {
	listAiActionOverrides(): Promise<Row[]>;
	saveAiActionOverride(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	/** Custom actions (created in the admin UI). */
	listAiCustomActions(): Promise<Row[]>;
	saveAiCustomAction(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	deleteAiCustomAction(params: { key: string; expectedVersion: number }): Promise<void>;
}

/** One stored custom action row. `null` if its shape does not fit (when the definition changed and no longer matches). */
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

/** One action (with edited values applied). Custom actions have the same shape. */
export async function getAction(store: AiActionsStore, key: string): Promise<ResolvedAiAction> {
	if (isCustomKey(key)) {
		const { value } = await customRow(store, key);
		return resolveAction(key, customDefinition(value.base), value.override);
	}
	const definition = definitionOf(key);
	const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
	return resolveAction(key, definition, readOverride(row?.value));
}

/** All coded actions in config order, then custom actions in creation order. */
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
 * Builds an action to test or save with editable values. `{{name}}` in the prompt only accepts locale inputs and shared texts (`sharedKeys`: the config's texts and
 * those added in the admin UI). Values that cannot be edited (name, result shape, etc.) are ignored if sent.
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
 * Action to test with unsaved edited values (the AI screen's `Test`). A custom action is built from the base info (`base`) if given (e.g. a new, still
 * unsaved action), otherwise from the saved base info.
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

/** Validates the base info of a custom action. */
function readBase(input: unknown): CustomBase {
	const parsed = customBaseSchema.safeParse(input);
	if (!parsed.success) {
		throw new AiError("ai_invalid_input", parsed.error.issues[0]?.message ?? t("invalidBase"));
	}
	const problem = surfaceProblem(parsed.data.surface);
	if (problem) throw new AiError("ai_invalid_input", problem);
	return parsed.data;
}

/** Creates a custom action. Takes the base info and the edited values (connection, model, prompt, checks, etc.) at once. */
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

/** Deletes a custom action. */
export async function deleteCustomAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<void> {
	if (!isCustomKey(key)) throw new AiError("ai_invalid_input", t("cannotDeleteCoded"));
	await store.deleteAiCustomAction({ key, expectedVersion });
}

/**
 * Saves edited values. Values equal to the default are not stored.
 * For a custom action, the base info (`base`: name, attach point, result shape) can be edited too.
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

/** Resets to defaults. The enabled state keeps its current value. A custom action has no default to reset to. */
export async function resetAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<AiActionView> {
	if (isCustomKey(key)) throw new AiError("ai_invalid_input", t("noDefaultForCustom"));
	const current = await getAction(store, key);
	const definition = definitionOf(key);
	const value = overrideFrom(definition, { enabled: current.enabled });
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(resolveAction(key, definition, value), row);
}

/**
 * Moves the stored values of the legacy AI action table (`ai_features`) into per-action edited values, keeping only values that differ from the definition.
 * Names missing from the definition (actions removed from the config, a previously deleted `mediaAlt`, etc.) give `null`.
 * The legacy `send` content list (`inputs`) becomes `send`, and inputs missing from the definition (e.g. `tags`) are dropped.
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
	// Actions that, like the legacy translation, did not choose what to send had an empty list. An empty list is not moved over.
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
