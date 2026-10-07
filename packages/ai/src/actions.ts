import type { Site } from "@monti-cms/core/client";
import {
	type AiActionDefinition,
	type AiActionOverride,
	aiActionOverrideSchema,
	aiActionOverrideSchemaOf,
	EDITABLE_KEYS,
	overrideFrom,
	type ResolvedAiAction,
	resolveAction,
	unknownPlaceholders,
} from "./action";
import { type AiActionView, readOverride, viewOf } from "./action-view";
import { actionsMessages } from "./actions.messages";
import { coreMessages } from "./core.messages";
import {
	type CustomBase,
	type CustomValue,
	customBaseSchemaOf,
	customDefinition,
	customValueSchemaOf,
	isCustomKey,
	newCustomKey,
	surfaceProblem,
} from "./custom";
import { migrateLegacyCheck } from "./definition";
import { AiError } from "./errors";
import { aiRegistryOf } from "./registry";
import { type AiSharedStore, loadSharedKeys } from "./shared";

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
const readCustom = (site: Site, value: unknown): CustomValue | null => {
	const parsed = customValueSchemaOf(site).safeParse(value);
	return parsed.success ? parsed.data : null;
};

async function customRow(site: Site, store: AiActionsStore, key: string): Promise<{ row: Row; value: CustomValue }> {
	const row = (await store.listAiCustomActions()).find((item) => item.key === key);
	const value = row ? readCustom(site, row.value) : null;
	if (!row || !value) throw new AiError("ai_unknown_action", site.createTranslator(actionsMessages)("unknownAction"));
	return { row, value };
}

const definitionOf = (site: Site, key: string): AiActionDefinition => {
	const definition = aiRegistryOf(site).actionDefinition(key);
	if (!definition) throw new AiError("ai_unknown_action", site.createTranslator(actionsMessages)("unknownAction"));
	return definition;
};

/** One action (with edited values applied). Custom actions have the same shape. */
export async function getAction(site: Site, store: AiActionsStore, key: string): Promise<ResolvedAiAction> {
	if (isCustomKey(key)) {
		const { value } = await customRow(site, store, key);
		return resolveAction(key, customDefinition(site, value.base), value.override);
	}
	const definition = definitionOf(site, key);
	const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
	return resolveAction(key, definition, readOverride(row?.value));
}

/** All coded actions in config order, then custom actions in creation order. */
export async function listActions(site: Site, store: AiActionsStore): Promise<AiActionView[]> {
	const rows = new Map((await store.listAiActionOverrides()).map((row) => [row.key, row]));
	const code = Object.entries(aiRegistryOf(site).actions).map(([key, definition]) => {
		const row = rows.get(key);
		return viewOf(site, resolveAction(key, definition, readOverride(row?.value)), row, undefined, definition);
	});
	const custom = (await store.listAiCustomActions()).flatMap((row) => {
		const value = readCustom(site, row.value);
		if (!value) return [];
		return [viewOf(site, resolveAction(row.key, customDefinition(site, value.base), value.override), row, value)];
	});
	return [...code, ...custom];
}

/**
 * Builds an action to test or save with editable values. `{{name}}` in the prompt only accepts locale inputs and shared texts (`sharedKeys`: the config's texts and
 * those added in the admin UI). Values that cannot be edited (name, result shape, etc.) are ignored if sent.
 */
export function actionWithEdits(
	site: Site,
	key: string,
	edited: unknown,
	definition: AiActionDefinition = definitionOf(site, key),
	sharedKeys: readonly string[] = aiRegistryOf(site).sharedKeys,
): ResolvedAiAction {
	const t = site.createTranslator(actionsMessages);
	const parsed = aiActionOverrideSchemaOf(site.createTranslator(coreMessages)).safeParse(
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
	site: Site,
	store: AiActionsStore,
	key: string,
	edited: unknown,
	baseInput?: unknown,
): Promise<ResolvedAiAction> {
	const sharedKeys = await loadSharedKeys(site, store);
	if (!isCustomKey(key)) return actionWithEdits(site, key, edited, definitionOf(site, key), sharedKeys);
	if (baseInput !== undefined) {
		return actionWithEdits(site, key, edited, customDefinition(site, readBase(site, baseInput)), sharedKeys);
	}
	const { value } = await customRow(site, store, key);
	return actionWithEdits(site, key, edited, customDefinition(site, value.base), sharedKeys);
}

/** Validates the base info of a custom action. */
function readBase(site: Site, input: unknown): CustomBase {
	const parsed = customBaseSchemaOf(site).safeParse(input);
	if (!parsed.success) {
		throw new AiError(
			"ai_invalid_input",
			parsed.error.issues[0]?.message ?? site.createTranslator(actionsMessages)("invalidBase"),
		);
	}
	const problem = surfaceProblem(site, parsed.data.surface);
	if (problem) throw new AiError("ai_invalid_input", problem);
	return parsed.data;
}

/** Creates a custom action. Takes the base info and the edited values (connection, model, prompt, checks, etc.) at once. */
export async function createCustomAction(
	site: Site,
	store: AiActionsStore,
	baseInput: unknown,
	edited: unknown = {},
): Promise<AiActionView> {
	const base = readBase(site, baseInput);
	const key = newCustomKey();
	const definition = customDefinition(site, base);
	const action = actionWithEdits(site, key, edited, definition, await loadSharedKeys(site, store));
	const value: CustomValue = { base, override: overrideFrom(definition, action) };
	const row = await store.saveAiCustomAction({ key, expectedVersion: 0, value });
	return viewOf(site, resolveAction(key, definition, value.override), row, value);
}

/** Deletes a custom action. */
export async function deleteCustomAction(
	site: Site,
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
): Promise<void> {
	if (!isCustomKey(key)) {
		throw new AiError("ai_invalid_input", site.createTranslator(actionsMessages)("cannotDeleteCoded"));
	}
	await store.deleteAiCustomAction({ key, expectedVersion });
}

/**
 * Saves edited values. Values equal to the default are not stored.
 * For a custom action, the base info (`base`: name, attach point, result shape) can be edited too.
 */
export async function updateAction(
	site: Site,
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
	edited: unknown,
	baseInput?: unknown,
): Promise<AiActionView> {
	if (isCustomKey(key)) {
		const { value: current } = await customRow(site, store, key);
		const base = baseInput === undefined ? current.base : readBase(site, baseInput);
		const definition = customDefinition(site, base);
		const action = actionWithEdits(site, key, edited, definition, await loadSharedKeys(site, store));
		const value: CustomValue = { base, override: overrideFrom(definition, action) };
		const row = await store.saveAiCustomAction({ key, expectedVersion, value });
		return viewOf(site, resolveAction(key, definition, value.override), row, value);
	}
	const definition = definitionOf(site, key);
	const action = actionWithEdits(site, key, edited, definition, await loadSharedKeys(site, store));
	const value = overrideFrom(definition, action);
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(site, action, row, undefined, definition);
}

/** Resets to defaults. The enabled state keeps its current value. A custom action has no default to reset to. */
export async function resetAction(
	site: Site,
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
): Promise<AiActionView> {
	if (isCustomKey(key)) {
		throw new AiError("ai_invalid_input", site.createTranslator(actionsMessages)("noDefaultForCustom"));
	}
	const current = await getAction(site, store, key);
	const definition = definitionOf(site, key);
	const value = overrideFrom(definition, { enabled: current.enabled });
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(site, resolveAction(key, definition, value), row, undefined, definition);
}

/**
 * Moves the stored values of the legacy AI action table (`ai_features`) into per-action edited values, keeping only values that differ from the definition.
 * Names missing from the definition (actions removed from the config, a previously deleted `mediaAlt`, etc.) give `null`.
 * The legacy `send` content list (`inputs`) becomes `send`, and inputs missing from the definition (e.g. `tags`) are dropped.
 */
export function legacyFeatureOverride(site: Site, key: string, spec: unknown): AiActionOverride | null {
	const definition = aiRegistryOf(site).actionDefinition(key);
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
