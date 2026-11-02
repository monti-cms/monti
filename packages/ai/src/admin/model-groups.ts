import type { AiKeyView, AiModelChoice } from "../connection";

/** A model of a key as one menu value (`<key id>\n<model>`): model names hold `/` and `:`, never a line break. */
export const modelValue = (choice: AiModelChoice): string => `${choice.keyId}\n${choice.model}`;

export const parseModelValue = (value: string): AiModelChoice => {
	const at = value.indexOf("\n");
	return { keyId: value.slice(0, at), model: value.slice(at + 1) };
};

/** The recent models of the chat input, newest first, at most this many. */
export const RECENT_MODELS = 3;

/** Puts a pick first among the recent models, without repeating it. */
export const withRecent = (recent: readonly AiModelChoice[], pick: AiModelChoice): AiModelChoice[] =>
	[pick, ...recent.filter((entry) => modelValue(entry) !== modelValue(pick))].slice(0, RECENT_MODELS);

/** The recent models that still belong to a key, so a deleted key's model drops out. */
export const liveRecent = (recent: readonly AiModelChoice[], keys: readonly AiKeyView[]): AiModelChoice[] =>
	recent.filter((entry) => keys.some((key) => key.id === entry.keyId));
