import type { Model, ThinkingLevel } from "@monti-cms/core";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * How long a model list asked of the keys' services anew serves before a model menu asks them again. A service's models change without the
 * key changing (OpenRouter's free ones, weekly), and the server asks only once a day by itself: opening a model menu asks now (doc 10).
 */
export const MODELS_ASK_AGAIN_MS = 5 * 60_000;

/** Tokens as the screens write them: as they are under a thousand, then in thousands, then in millions with two decimals ("812", "312K", "1.24M"). */
export function tokenAmount(tokens: number): string {
	if (tokens < 1000) return String(tokens);
	if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}K`;
	return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/** A sum of US dollars, short: up to two decimals with the trailing zeros gone ("$1", "$0.25", "$2.31"); under a cent, "<$0.01". */
export function dollarAmount(dollars: number): string {
	if (dollars > 0 && dollars < 0.01) return "<$0.01";
	return `$${Number(dollars.toFixed(2))}`;
}

/** A model as a person reads it: the name its service gives it ("Anthropic: Claude Sonnet 5.5"), else its id. */
export const modelName = (model: Pick<Model, "id" | "label">): string => model.label ?? model.id;

const isFree = (price: NonNullable<Model["price"]>) => price.input === 0 && price.output === 0;

/**
 * What a model costs, in the few words a menu row or a field ends with (ST-31): "Free", or what a million tokens in and out cost ("$1 · $5").
 * Nothing for a model whose service does not say (only OpenRouter does).
 */
export function priceWord(t: Translate, model: Pick<Model, "price">): string | undefined {
	const price = model.price;
	if (!price) return undefined;
	return isFree(price) ? t("models.free") : `${dollarAmount(price.input)} · ${dollarAmount(price.output)}`;
}

/**
 * A model's tooltip, one line each: its id, its price in words, the model an alias stands for now (ST-33: "~…-latest" ids said nothing of what
 * they are), and how many tokens it takes in at once.
 */
export function modelTitle(t: Translate, model: Model): string {
	const price = model.price;
	return [
		model.id,
		price
			? isFree(price)
				? t("models.free")
				: t("models.price", { input: dollarAmount(price.input), output: dollarAmount(price.output) })
			: null,
		model.aliasOf ? t("models.aliasOf", { model: model.aliasOf }) : null,
		model.context ? t("models.context", { amount: tokenAmount(model.context) }) : null,
	]
		.filter((line) => line !== null)
		.join("\n");
}

/** A key's models in the order a menu lists them: by name, so OpenRouter's "Provider: Model" names stand together by provider. */
export const byName = (models: readonly Model[]): Model[] =>
	[...models].sort((a, b) => modelName(a).localeCompare(modelName(b)));

/** How hard a model thinks, from not at all to hard: the assistant's levels. */
export const LEVELS: readonly ThinkingLevel[] = ["off", "low", "medium", "high"];

/** The levels a model takes: those its service named, or all of them when it did not say. */
export const levelsOf = (model: Pick<Model, "levels">): readonly ThinkingLevel[] => model.levels ?? LEVELS;

/**
 * Whether a model's thinking is asked for at all, so a person can pick how hard: one that thinks, unless its service named no level the assistant
 * has (only `max`, say), which is left to think as it does by itself (`asksThinking` of `@monti-cms/ai`).
 */
export const picksThinking = (model: Pick<Model, "thinking" | "levels"> | undefined): boolean =>
	(model?.thinking ?? false) && model?.levels?.length !== 0;

/**
 * The level a model thinks at: the one wanted when the model takes it, else the nearest it takes, harder first, then softer. The server asks the
 * model for the same (`levelFor` of `@monti-cms/ai`, which the browser does not load); the panel shows what is asked.
 */
export function levelFor(model: Pick<Model, "thinking" | "levels"> | undefined, wanted: ThinkingLevel): ThinkingLevel {
	if (!model?.thinking) return "off";
	const levels = model.levels;
	if (!levels || levels.length === 0 || levels.includes(wanted)) return wanted;
	const at = LEVELS.indexOf(wanted);
	return [...LEVELS.slice(at + 1), ...LEVELS.slice(0, at).reverse()].find((level) => levels.includes(level)) ?? wanted;
}

/** How long a model took to answer its trial, in seconds as a toast says them: one decimal under ten ("1.2"), whole from there ("12"). */
export function seconds(ms: number): string {
	const value = ms / 1000;
	return String(value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
}
