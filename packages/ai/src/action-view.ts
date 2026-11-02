import type { AiAttach, AiChoices, AiInputKind, ResolvedAiAction } from "./action";
import type { AiApply, AiEngine, AiPick, AiResult } from "./definition";

/** One action of the site config as the admin reads it (shared by server and browser): what it takes, where it attaches and how its result applies. */
export interface AiActionView {
	key: string;
	label: string;
	result: AiResult;
	apply: AiApply;
	engine: AiEngine;
	pick: AiPick;
	input: Record<string, { kind: AiInputKind; label: string; required: boolean }>;
	choices?: AiChoices;
	attach: readonly AiAttach[];
	/** Does the action stream its result? */
	stream: boolean;
	enabled: boolean;
	hidden: boolean;
	askInstruction: boolean;
}

export const viewOf = (action: ResolvedAiAction): AiActionView => ({
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
	hidden: action.hidden,
	askInstruction: action.askInstruction,
});
