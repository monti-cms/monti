import type { Site } from "@monti-cms/core/client";
import {
	type AiActionDefinition,
	type AiActionEditable,
	type AiActionOverride,
	type AiAttach,
	type AiChoices,
	type AiInputKind,
	aiActionOverrideSchema,
	EDITABLE_KEYS,
	type ResolvedAiAction,
	resolveAction,
	validatorLabel,
} from "./action";
import { type CustomBase, type CustomValue, customDefinition } from "./custom";
import type { AiApply, AiCheck, AiEngine, AiPick, AiResult } from "./definition";

/**
 * The shape of an action sent to the admin screen (shared by server and browser). The server builds it from saved values; the admin screen builds it as a preview of a new
 * screen action that is not yet saved.
 */

/** One action sent to the admin screen. The fixed part of the definition and the current value (the edited value applied on top). */
export interface AiActionView extends AiActionEditable {
	key: string;
	label: string;
	result: AiResult;
	apply: AiApply;
	engine: AiEngine;
	pick: AiPick;
	input: Record<string, { kind: AiInputKind; label: string; required: boolean }>;
	choices?: AiChoices;
	attach: readonly AiAttach[];
	checks: AiCheck[];
	/** Checks set by the action definition (`checkKey`, can only be turned off). The rest are checks added in the admin screen. */
	definedChecks: string[];
	/** Code check name -> display name. Code checks can only be turned on or off. */
	validatorLabels: Record<string, string>;
	/** Does the action stream its result? */
	stream: boolean;
	/**
	 * The editable values the definition alone gives (what Reset returns to). `null` for a screen action, which has no definition to return to. The server sends it, because
	 * the browser's site holds only the data parts of the config (a factory in the config does not reach it).
	 */
	defaults: Pick<AiActionView, (typeof EDITABLE_KEYS)[number]> | null;
	/** For an action created in the admin screen (screen action), its basic info (name, where it attaches, result shape). Code actions have none. */
	custom?: CustomBase;
	/** Version of the edited value. 0 if never edited. */
	version: number;
	updatedAt: string | null;
	/** Names of values that differ from the defaults. */
	overridden: string[];
}

/** Reads the saved edited value. Drops values whose shape does not match (the definition changed and no longer fits). */
export const readOverride = (value: unknown): AiActionOverride => {
	const parsed = aiActionOverrideSchema.safeParse(value);
	return parsed.success ? parsed.data : {};
};

/** The editable values of a resolved action. */
const editableOf = (action: AiActionEditable): NonNullable<AiActionView["defaults"]> =>
	Object.fromEntries(EDITABLE_KEYS.map((name) => [name, structuredClone(action[name])])) as unknown as NonNullable<
		AiActionView["defaults"]
	>;

/**
 * `definition` is the code definition of the action (not given for a screen action): the defaults of its editable values go into the view.
 */
export const viewOf = (
	site: Pick<Site, "createTranslator">,
	action: ResolvedAiAction,
	row: { value: unknown; version: number; updatedAt: Date } | undefined,
	custom?: CustomValue,
	definition?: AiActionDefinition,
): AiActionView => ({
	defaults: definition && !custom ? editableOf(resolveAction(action.key, definition)) : null,
	...(custom ? { custom: custom.base } : {}),
	key: action.key,
	label: action.label,
	result: action.result,
	apply: action.apply,
	engine: action.engine,
	pick: action.pick,
	input: Object.fromEntries(
		Object.entries(action.input).map(([name, spec]) => [
			name,
			{ kind: spec.kind, label: spec.label, required: spec.required === true },
		]),
	),
	...(action.choices ? { choices: action.choices } : {}),
	attach: action.attach,
	stream: action.stream,
	enabled: action.enabled,
	askInstruction: action.askInstruction,
	instant: action.instant,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: [...action.checks],
	definedChecks: [...action.definedChecks],
	validatorLabels: Object.fromEntries(
		Object.values(action.validators).map((check) => [check.name, validatorLabel(check, site)]),
	),
	send: [...action.send],
	version: row?.version ?? 0,
	updatedAt: row ? row.updatedAt.toISOString() : null,
	overridden: Object.keys(custom ? custom.override : readOverride(row?.value)),
});

/** Name (key) of a new, unsaved screen action. The server assigns a new name when saving. */
export const NEW_CUSTOM_KEY = "custom_new";

/** The shape of a new, unsaved screen action. The admin screen rebuilds it each time the basic info is chosen. */
export const draftCustomView = (site: Site, base: CustomBase): AiActionView =>
	viewOf(site, resolveAction(NEW_CUSTOM_KEY, customDefinition(site, base), {}), undefined, { base, override: {} });
