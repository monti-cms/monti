import type { BlockDefinition, CollectionsConfig } from "@monti-cms/core";
import type { Site } from "@monti-cms/core/client";
import { z } from "zod";
import {
	type AiApply,
	type AiCandidate,
	type AiCheck,
	type AiCheckInput,
	type AiEngine,
	type AiPick,
	type AiResult,
	type AiSlot,
	aiCheckSchema,
	aiCheckSchemaOf,
	CODE_CHECK_NAME,
	type CoreText,
	checkKey,
	englishCoreText,
	isAddableCheck,
	MAX_PROMPT_LENGTH,
	MAX_REQUEST_LENGTH,
	migrateCheck,
} from "./definition";

/**
 * AI action definition. An action is registered under its name (key) in the site config's `ai.actions`.
 *
 * - **Inputs**: the material the caller supplies (title, body, image, language...). Inputs are sent separately, not spliced into
 *   the prompt (so the model does not follow instruction-like sentences inside the text). Only language inputs can go into `{{name}}` in the prompt.
 * - **Result**: one of several candidates, a single text, an MDX fragment, or a note, plus a list of checks.
 * - **Attach point (`attach`)**: a fixed place in the admin UI (beside a field, image, media, code block, translation). An action can attach
 *   only when the material that place provides can fill its inputs (checked by the types and `defineConfig`).
 *
 * The admin AI screen only edits enabled state, extra requests, connection, model, inputs to send, prompt, threshold and check values; only edited values are stored in the DB.
 * The definition is read by both server and browser. The function of a code check (`defineValidator`) is only called on the server.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Input kinds. `text`, `mdx` and `code` are text, `value` is a field's current value (text or list), `image` is an image the server reads
 * (a media ID or a path on this site), and `locale` is a language code (it goes into the prompt as a language name).
 */
export type AiInputKind = "text" | "mdx" | "code" | "value" | "image" | "locale";

export interface AiInputSpec<K extends AiInputKind = AiInputKind> {
	readonly kind: K;
	/** Name used in the admin UI's `Send` list and in the language line attached to the prompt. */
	readonly label: string;
	/** If missing, the action does not run. Without this flag the input may be empty (when empty, it is not sent). */
	readonly required?: boolean;
}

export type AiInputs = Readonly<Record<string, AiInputSpec>>;

type InputOptions = { readonly label: string; readonly required?: boolean };

const inputOf =
	<K extends AiInputKind>(kind: K) =>
	<const O extends InputOptions>(options: O) =>
		({ kind, ...options }) as const satisfies AiInputSpec<K>;

export const aiInput = {
	text: inputOf("text"),
	mdx: inputOf("mdx"),
	code: inputOf("code"),
	value: inputOf("value"),
	image: inputOf("image"),
	locale: inputOf("locale"),
};

/** Input value type. For images, only the location for the server to read is given. */
export type AiInputValue<S> = S extends { readonly kind: "image" }
	? { readonly mediaId?: string; readonly src?: string }
	: S extends { readonly kind: "value" }
		? string | readonly string[]
		: string;

/** Maximum length of one input (characters). */
const INPUT_LIMITS: Record<Exclude<AiInputKind, "image" | "value" | "locale">, number> = {
	text: 20_000,
	mdx: 200_000,
	code: 100_000,
};

// ---------------------------------------------------------------------------
// Attach points
// ---------------------------------------------------------------------------

/**
 * The material each slot provides. An action can attach to a slot only if all its required inputs are here.
 * Non-required inputs are sent empty when the slot lacks them (e.g. the media screen's alt text has no surrounding paragraphs).
 */
export const SLOT_INPUTS = {
	field: { title: "text", summary: "text", body: "mdx", current: "value" },
	image: { image: "image", around: "text", current: "value" },
	media: { image: "image", filename: "text", current: "value" },
	codeRules: { code: "code" },
	translation: { block: "mdx", from: "locale", to: "locale" },
	selection: { selection: "mdx", title: "text" },
	insert: { title: "text", body: "mdx" },
	block: { block: "mdx", title: "text" },
} as const satisfies Record<AiSlot, Readonly<Record<string, AiInputKind>>>;

type SlotInputNames = { [S in AiSlot]: keyof (typeof SLOT_INPUTS)[S] };

export type AiAttach =
	/** Beside a field. Without `collections`, every collection that has the field. */
	| { readonly slot: "field"; readonly field: string; readonly collections?: readonly string[] }
	| { readonly slot: "image"; readonly target: "alt" | "caption" }
	| { readonly slot: "media"; readonly target: "filename" | "defaultAlt" | "defaultCaption" }
	| { readonly slot: "codeRules"; readonly target: "fold" }
	/** Block translation in the translation editor (block menu, `Translate all`). */
	| { readonly slot: "translation" }
	/** Menu on the body selection. The result (MDX) shows what changed, then replaces the selected text. */
	| { readonly slot: "selection" }
	/** Slash menu / empty document. The result (MDX) is inserted at the cursor. */
	| { readonly slot: "insert" }
	/** Beside the handle of one body block (`block` is the block name, e.g. `mermaid`). The result (MDX) shows what changed, then replaces that block. */
	| { readonly slot: "block"; readonly block: string };

type RequiredInputNames<I> = { [K in keyof I]: I[K] extends { readonly required: true } ? K : never }[keyof I];
/** Slots where all required inputs can be filled. */
type AttachableSlot<I> = {
	[S in AiSlot]: [Exclude<RequiredInputNames<I>, SlotInputNames[S]>] extends [never] ? S : never;
}[AiSlot];

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/**
 * The choices for the decide mode, also used for the `exists` check and candidate names. Read directly by the server.
 * - `collection`: the published entries of that collection (value is the entry ID, name is the title)
 * - `select`: the options of a select field
 * - `list`: a hand-written list
 */
export type AiChoices =
	| { readonly from: "collection"; readonly collection: string }
	| { readonly from: "select"; readonly collection: string; readonly field: string }
	| { readonly from: "list"; readonly items: readonly string[] };

// ---------------------------------------------------------------------------
// Action definition
// ---------------------------------------------------------------------------

/**
 * Lookup of core content that code checks read on the server. The run API fills it from the core's public lookup (`createContentLookup` in
 * `@monti-cms/core/plugin/server`). Plugins do not read core tables directly.
 */
export interface AiContentLookup {
	/** Slugs already used in the same collection and locale. Slugs used by the `excludeEntryId` entry are excluded. */
	slugsInUse(params: {
		readonly collection: string;
		readonly locale: string;
		readonly slugs: readonly string[];
		readonly excludeEntryId?: string;
	}): Promise<ReadonlySet<string>>;
}

/** The situation a code check receives. */
export interface AiValidatorContext {
	/** The inputs used for the run. */
	readonly input: Readonly<Record<string, unknown>>;
	readonly collection?: string;
	/** Content locale. If not in the request, the site config's default locale. */
	readonly locale: string;
	readonly entryId?: string;
	/** For actions with choices: value -> display name. */
	readonly choices?: ReadonlyMap<string, string>;
	/** Core content lookup (server). */
	readonly content: AiContentLookup;
	/** The site the action runs for (its admin language for a note a check attaches to a candidate). */
	readonly site: Site;
}

/**
 * Result of a code check. `true`, `null` or `undefined` passes, `false` discards, and a string discards with that reason.
 * To pass while attaching a note beside the candidate, return `{ detail }`.
 */
export type AiValidatorResult = boolean | string | null | undefined | { readonly detail: string };

/**
 * Code check (`defineValidator`). Checks what the fixed checks (format, length, choices) cannot, using a function. Put in an action's `checks`, it
 * shows by name in the admin UI and can be toggled (its value cannot be edited). Called on the server once per value (one candidate, or the whole text/MDX result).
 */
export interface AiValidator {
	readonly kind: "code";
	/** Name unique within the action (lowercase, digits, hyphen). The edited value (enabled state) is stored under this name. */
	readonly name: string;
	/**
	 * Name shown in the admin UI. A function receives the site and returns the text in its admin language (the site is where the translator is), so a label written in
	 * a module the config file reads does not depend on a language set elsewhere. Read it with `validatorLabel`.
	 */
	readonly label: string | ((site: Pick<Site, "createTranslator">) => string);
	/** Enabled initially? Defaults to enabled. */
	readonly enabled?: boolean;
	readonly run: (value: string, context: AiValidatorContext) => AiValidatorResult | Promise<AiValidatorResult>;
}

/** Creates a code check. Put it in an action definition's `checks` together with the fixed checks. */
export const defineValidator = (check: Omit<AiValidator, "kind">): AiValidator => ({ kind: "code", ...check });

/** The display name of a code check in the site's admin language. */
export const validatorLabel = (check: Pick<AiValidator, "label">, site: Pick<Site, "createTranslator">): string =>
	typeof check.label === "function" ? check.label(site) : check.label;

const isValidator = (check: AiCheckInput | AiValidator): check is AiValidator => "run" in check;

export interface AiActionDefinition<I extends AiInputs = AiInputs> {
	/** Name shown in the admin UI and on buttons. */
	readonly label: string;
	readonly input: I;
	/** Inputs sent initially. Defaults to all. Toggled in the admin UI. */
	readonly send?: readonly (keyof I & string)[];
	/** Prompt. In decide mode it is the decision criterion. `{{language input name}}` is replaced with the language name. */
	readonly prompt: string;
	readonly result: AiResult;
	/** How the result is applied. Defaults to `none` for notes and `replace` otherwise. */
	readonly apply?: AiApply;
	/** Defaults to `generate`. `decide` requires `choices`. */
	readonly engine?: AiEngine;
	readonly choices?: AiChoices;
	/** In decide mode, pick only one? Defaults to `many`. */
	readonly pick?: AiPick;
	/** Threshold probability for decide mode (0-1). Defaults to 0.6. */
	readonly threshold?: number;
	/** Maximum number of candidates in decide mode. Defaults to 5. */
	readonly maxCount?: number;
	/**
	 * Result checks. Fixed checks are applied first, then code checks (`defineValidator`), in the listed order.
	 * The admin UI edits enabled state and values, and can add format, length and in-choices checks.
	 */
	readonly checks?: readonly (Exclude<AiCheckInput, { kind: "code" }> | AiValidator)[];
	/** Accepts an extra request at run time. If missing, none is accepted. */
	readonly askInstruction?: boolean;
	/** On click, inserts the result directly without showing it (the candidate is the first one). If missing, the result is shown and applied by clicking. */
	readonly instant?: boolean;
	/** Streams the result (shown incrementally). Only for text/MDX results in generate mode. */
	readonly stream?: boolean;
	/** Enabled initially? Defaults to enabled. */
	readonly enabled?: boolean;
	readonly attach?: readonly AiAttach[];
	/**
	 * Text the dev-only fake connection (`CMS_AI_FAKE=1`) uses as this action's answer, built from the received inputs (name -> text). If missing, the fake connection
	 * builds an answer from the result shape and input kinds. Set only for actions whose code check expects a specific shape (e.g. diagram syntax).
	 * For candidate results, one candidate per line.
	 */
	readonly fake?: (input: Readonly<Record<string, string>>) => string;
}

/** One shared snippet (e.g. a style guide). Inserted into prompts as `{{shared.name}}` and edited in the admin AI screen. */
export interface AiSharedText {
	readonly label: string;
	/** Default text. If an edited value exists in the admin UI, that is used. */
	readonly text: string;
}

/** Site config seen by the function that creates actions. */
export interface AiSiteView {
	readonly collections: CollectionsConfig;
	/** Body block definitions used by the site (core + extensions + site). */
	readonly blocks: readonly BlockDefinition[];
	readonly locales: readonly { readonly code: string }[];
	/** Translator of one dictionary in the site's admin language (`site.createTranslator`), for the labels of the actions a function creates. */
	readonly createTranslator: Site["createTranslator"];
	/** Names of the AI config's shared snippets (`aiPlugin({ shared })`). */
	readonly sharedKeys: readonly string[];
}

/**
 * A function that looks at the site config and creates one action. Default actions (`aiPresets`) and actions added by extensions have this shape (they find the field to attach to by
 * field kind, role and relation target). If there is nothing to attach to it returns `undefined` and the action is not enabled.
 */
export type AiActionFactory<D extends AiActionDefinition = AiActionDefinition> = (site: AiSiteView) => D | undefined;

/** An action definition or a function that creates one. */
export type AiActionSource = AiActionDefinition | AiActionFactory;

/**
 * The shape in which other plugins add AI actions. Placed in a plugin definition's `contributes: { ai: { actions } }` (unused if there is no AI plugin).
 * Examples: the block extension's diagram generation, the SEO extension's search title suggestion.
 */
export interface AiContribution {
	readonly actions?: Readonly<Record<string, AiActionSource>>;
}

export interface AiConfig {
	/** Site description. Goes into the leading instruction of every action ("You are the editing assistant of the CMS for this site: {this}"). Defaults to "website". */
	readonly siteDescription?: string;
	/**
	 * Shared snippets used by several actions. Insert into a prompt as `{{shared.name}}`. If `styleGuide` exists, it goes into the prompts of the
	 * default style polish and draft actions.
	 */
	readonly shared?: Readonly<Record<string, AiSharedText>>;
	/**
	 * Actions to replace or add. Default actions (`aiPresets`, those with an attach point on the site) and actions added by other plugins are enabled without being listed.
	 * Giving a definition (or `aiPresets.name(options)`) under the same name replaces it, `false` removes it, and a new name adds it.
	 */
	readonly actions?: Readonly<Record<string, AiActionSource | false>>;
}

/** The resolved list of actions (name -> definition). Read by the runner, the UI and the checks. */
export interface ResolvedAiConfig {
	readonly shared?: Readonly<Record<string, AiSharedText>>;
	readonly actions: Readonly<Record<string, AiActionDefinition>>;
}

/** `{{name}}` in the prompt. */
type Placeholders<S extends string> = S extends `${string}{{${infer P}}}${infer Rest}` ? P | Placeholders<Rest> : never;
type LocaleInputNames<I> = { [K in keyof I]: I[K] extends { readonly kind: "locale" } ? K : never }[keyof I];
/** Raises a type error if the prompt has a `{{name}}` that is neither a locale input nor a shared text (`shared.name`). Shared text names are checked by the plugin config. */
type PromptCheck<P extends string, I> = string extends P
	? unknown
	: [Exclude<Placeholders<P>, LocaleInputNames<I> | `shared.${string}`>] extends [never]
		? unknown
		: {
				readonly "The prompt can only use locale inputs and shared texts as {{name}}": Exclude<
					Placeholders<P>,
					LocaleInputNames<I> | `shared.${string}`
				>;
			};

/**
 * Defines an action. Types check the prompt's `{{name}}` and the attach point (whether the slot can fill all inputs).
 */
export function aiAction<
	const I extends AiInputs,
	const P extends string,
	const D extends Omit<AiActionDefinition<I>, "input" | "prompt" | "attach"> & {
		readonly attach?: readonly Extract<AiAttach, { readonly slot: AttachableSlot<I> }>[];
	},
>(definition: D & { readonly input: I; readonly prompt: P & PromptCheck<P, I> }): D & { input: I; prompt: P } {
	return definition;
}

/** The result type of an action. */
export type AiActionResult<D> = D extends { readonly result: "candidates" }
	? { kind: "candidates"; items: AiCandidate[] }
	: D extends { readonly result: "text" }
		? { kind: "text"; text: string }
		: D extends { readonly result: "mdx" }
			? { kind: "mdx"; text: string }
			: D extends { readonly result: "note" }
				? { kind: "note"; text: string }
				: never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The type of inputs passed when calling an action. Only `required` inputs must be given. */
export type AiActionInput<D> = D extends { readonly input: infer I }
	? Simplify<
			{
				-readonly [K in keyof I as I[K] extends { readonly required: true } ? K : never]: AiInputValue<I[K]>;
			} & {
				-readonly [K in keyof I as I[K] extends { readonly required: true } ? never : K]?: AiInputValue<I[K]>;
			}
		>
	: never;

// ---------------------------------------------------------------------------
// Edited values and the definition to run
// ---------------------------------------------------------------------------

/** Values editable in the admin UI. Only values that differ from the definition are stored in the DB. */
export const aiActionOverrideSchemaOf = (t: CoreText) =>
	z
		.object({
			enabled: z.boolean(),
			askInstruction: z.boolean(),
			instant: z.boolean(),
			/** Id of the connection to use. If `null`, the first connection matching the mode. */
			providerId: z.string().max(60).nullable(),
			/** Model name to use. If empty, the connection's default model. */
			modelName: z.string().trim().max(200),
			prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
			send: z.array(z.string().max(40)).max(20),
			threshold: z.number().min(0.01).max(0.99),
			maxCount: z.number().int().min(1).max(20),
			checks: z.array(z.preprocess(migrateCheck, aiCheckSchemaOf(t))).max(10),
		})
		.partial();

/** The edited-value schema with English messages: reads stored values and builds definitions, where no message is shown. */
export const aiActionOverrideSchema = aiActionOverrideSchemaOf(englishCoreText);
export type AiActionOverride = z.output<typeof aiActionOverrideSchema>;

/** The action to run: the definition with edited values applied. */
export interface ResolvedAiAction {
	readonly key: string;
	readonly label: string;
	readonly input: AiInputs;
	readonly send: readonly string[];
	readonly prompt: string;
	readonly result: AiResult;
	readonly apply: AiApply;
	readonly engine: AiEngine;
	readonly choices?: AiChoices;
	readonly pick: AiPick;
	readonly threshold: number;
	readonly maxCount: number;
	readonly checks: readonly AiCheck[];
	/** Checks set by the action definition (`checkKey`). The admin UI can only turn these off; the rest (checks the user added) can be removed. */
	readonly definedChecks: readonly string[];
	/** Code check name -> check. Pointed to by the `{ kind: "code" }` entries of `checks`. */
	readonly validators: Readonly<Record<string, AiValidator>>;
	readonly askInstruction: boolean;
	readonly instant: boolean;
	readonly stream: boolean;
	readonly enabled: boolean;
	readonly providerId: string | null;
	readonly modelName: string;
	readonly attach: readonly AiAttach[];
	/** Answer for the fake connection to use (`AiActionDefinition.fake`). */
	readonly fake?: (input: Readonly<Record<string, string>>) => string;
}

/** Names of editable values. */
export const EDITABLE_KEYS = [
	"enabled",
	"askInstruction",
	"instant",
	"providerId",
	"modelName",
	"prompt",
	"send",
	"threshold",
	"maxCount",
	"checks",
] as const satisfies readonly (keyof AiActionOverride & keyof ResolvedAiAction)[];

export type AiActionEditable = Pick<ResolvedAiAction, (typeof EDITABLE_KEYS)[number]>;

const defaultChecks = (definition: AiActionDefinition): AiCheck[] =>
	(definition.checks ?? []).map((check) =>
		isValidator(check)
			? { kind: "code", name: check.name, enabled: check.enabled ?? true }
			: aiCheckSchema.parse(check),
	);

/**
 * Applies edited values onto the definition. Checks keep the definition's kinds in the definition's order with the user's edited enabled state and values applied, then
 * the user-added checks (format, length, in-choices; one per kind) are appended.
 * Inputs to send keep only names present in the definition, and required inputs are always sent.
 */
export function resolveAction(
	key: string,
	definition: AiActionDefinition,
	override: AiActionOverride = {},
): ResolvedAiAction {
	const inputNames = Object.keys(definition.input);
	const base = defaultChecks(definition);
	const required = inputNames.filter((name) => definition.input[name]?.required);
	const chosen = override.send ?? definition.send ?? inputNames;
	const send = inputNames.filter((name) => chosen.includes(name) || required.includes(name));
	return {
		key,
		label: definition.label,
		input: definition.input,
		send,
		prompt: override.prompt ?? definition.prompt,
		result: definition.result,
		apply: definition.apply ?? (definition.result === "note" ? "none" : "replace"),
		engine: definition.engine ?? "generate",
		...(definition.choices ? { choices: definition.choices } : {}),
		pick: definition.pick ?? "many",
		threshold: override.threshold ?? definition.threshold ?? 0.6,
		maxCount: override.maxCount ?? definition.maxCount ?? 5,
		checks: [
			...base.map((check) => {
				const mine = override.checks?.find((item) => checkKey(item) === checkKey(check));
				return mine ? ({ ...check, ...mine } as AiCheck) : check;
			}),
			...(override.checks ?? []).filter(
				(check, index, all) =>
					isAddableCheck(check.kind) &&
					!base.some((item) => item.kind === check.kind) &&
					all.findIndex((item) => item.kind === check.kind) === index,
			),
		],
		definedChecks: base.map(checkKey),
		validators: Object.fromEntries((definition.checks ?? []).filter(isValidator).map((check) => [check.name, check])),
		askInstruction: override.askInstruction ?? definition.askInstruction ?? false,
		instant: override.instant ?? definition.instant ?? false,
		stream: definition.stream ?? false,
		enabled: override.enabled ?? definition.enabled ?? true,
		providerId: override.providerId ?? null,
		modelName: override.modelName ?? "",
		attach: definition.attach ?? [],
		...(definition.fake ? { fake: definition.fake } : {}),
	};
}

/** Keeps only the edited values that differ from the definition (defaults). This is the shape stored in the DB. */
export function overrideFrom(definition: AiActionDefinition, edited: Partial<AiActionEditable>): AiActionOverride {
	const base = resolveAction("", definition);
	const override: Record<string, unknown> = {};
	for (const key of EDITABLE_KEYS) {
		const value = edited[key];
		if (value === undefined) continue;
		if (JSON.stringify(value) !== JSON.stringify(base[key])) override[key] = value;
	}
	return aiActionOverrideSchema.parse(override);
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const PLACEHOLDER = /\{\{\s*((?:shared\.)?[A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
const SHARED_PREFIX = "shared.";

/**
 * Of the prompt's `{{name}}`, those that are neither a locale input nor an existing shared text (`shared.name`). Used for definition checks and pre-save checks.
 */
export function unknownPlaceholders(prompt: string, input: AiInputs, sharedKeys: readonly string[] = []): string[] {
	const names = [...prompt.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
	return [
		...new Set(
			names.filter((name) =>
				name.startsWith(SHARED_PREFIX)
					? !sharedKeys.includes(name.slice(SHARED_PREFIX.length))
					: input[name]?.kind !== "locale",
			),
		),
	];
}

/**
 * The prompt to run. Replaces `{{locale input}}` with the language name and `{{shared.name}}` with the shared text, and appends locale inputs not used in the prompt
 * as `name: language` lines. Finally appends the extra request given at run time (only for actions with `askInstruction` on).
 */
export function renderPrompt(
	action: Pick<ResolvedAiAction, "prompt" | "input" | "askInstruction">,
	values: Readonly<Record<string, unknown>>,
	languageName: (code: string) => string,
	request?: string,
	shared: Readonly<Record<string, string>> = {},
): string {
	const used = new Set<string>();
	const prompt = action.prompt.replace(PLACEHOLDER, (whole, name: string) => {
		if (name.startsWith(SHARED_PREFIX)) {
			const text = shared[name.slice(SHARED_PREFIX.length)];
			return text === undefined ? whole : text.trim() || "(none)";
		}
		const value = values[name];
		if (action.input[name]?.kind !== "locale" || typeof value !== "string") return whole;
		used.add(name);
		return languageName(value);
	});
	const lines = Object.entries(action.input)
		.filter(([name, spec]) => spec.kind === "locale" && !used.has(name) && typeof values[name] === "string")
		.map(([name]) => `${name}: ${languageName(values[name] as string)}`);
	const extra = action.askInstruction ? request?.trim() : "";
	return [
		prompt,
		...lines,
		...(extra ? [`Request for this run (takes priority over the instructions above):\n${extra}`] : []),
	].join("\n\n");
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const imageValueSchemaOf = (t: CoreText) =>
	z
		.object({ mediaId: z.uuid().optional(), src: z.string().max(2000).optional() })
		.refine((value) => Boolean(value.mediaId || value.src), { error: () => t("image.missing") });

function inputValueSchema(spec: AiInputSpec, t: CoreText): z.ZodType {
	switch (spec.kind) {
		case "image":
			return imageValueSchemaOf(t);
		case "value":
			return z.union([z.string().max(10_000), z.array(z.string().max(200)).max(200)]);
		case "locale":
			return z.string().min(1).max(10);
		default:
			return z.string().max(INPUT_LIMITS[spec.kind]);
	}
}

/** Validation of action inputs. Names not in the definition are dropped. */
export function inputSchemaFor(input: AiInputs, t: CoreText) {
	return z.object(
		Object.fromEntries(
			Object.entries(input).map(([name, spec]) => {
				const schema = inputValueSchema(spec, t);
				return [name, spec.required ? schema : schema.optional()];
			}),
		),
	);
}

/** Common info of a run request (outside the inputs). */
export const aiRunEnvSchema = z.object({
	collection: z.string().max(40).optional(),
	locale: z.string().max(10).optional(),
	entryId: z.uuid().optional(),
	/** Language of a `code` input (code block). */
	language: z.string().max(40).optional(),
});
export type AiRunEnv = z.output<typeof aiRunEnvSchema>;

/** Number of inputs sent together in one request (e.g. the translation's `Translate all`). */
export const MAX_BATCH_INPUTS = 8;

export const aiRunBodySchemaOf = (t: CoreText) =>
	z
		.object({
			action: z.string().min(1).max(60),
			/** One input. */
			input: z.record(z.string(), z.unknown()).optional(),
			/** Runs the same action over several inputs. Results come back one per input in input order (failures too). */
			inputs: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_BATCH_INPUTS).optional(),
			env: aiRunEnvSchema.default({}),
			/** Extra request given at run time. Appended to the prompt only if the action has `askInstruction`. */
			request: z.string().max(MAX_REQUEST_LENGTH).optional(),
			/** Tests with unsaved edited values (the AI screen's `Test`). */
			draft: z.unknown().optional(),
			/** Unsaved base info of a custom action (when testing a new action before saving). Sent together with `draft`. */
			draftBase: z.unknown().optional(),
			/** Streams the result (`application/x-ndjson`). Only for a single input of a streamable action. */
			stream: z.boolean().optional(),
		})
		.refine((body) => (body.input === undefined) !== (body.inputs === undefined), {
			error: () => t("run.inputOrInputs"),
		});
export type AiRunBody = z.output<ReturnType<typeof aiRunBodySchemaOf>>;

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

/** The parts of the config's collection definitions needed for validation. */
interface CollectionsView {
	readonly [name: string]: {
		readonly fields: Readonly<
			Record<string, { readonly kind: string; readonly discriminant?: { readonly kind: string } }>
		>;
	};
}

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** Finds a field definition of that collection by field name (including fields nested in conditional fields). */
function findField(
	collections: CollectionsView,
	collection: string,
	field: string,
): { readonly kind: string } | undefined {
	const fields = collections[collection]?.fields;
	if (!fields) return undefined;
	if (fields[field]) return fields[field];
	for (const definition of Object.values(fields)) {
		const values = (definition as { values?: Record<string, Record<string, { kind: string }> | undefined> }).values;
		for (const group of Object.values(values ?? {})) if (group?.[field]) return group[field];
	}
	return undefined;
}

/** Checks that the AI config matches the collection definitions, slots and result shapes. If wrong, reports right away when the app starts. */
export function validateAiConfig(ai: ResolvedAiConfig, collections: CollectionsView, blocks?: readonly string[]): void {
	const sharedKeys = Object.keys(ai.shared ?? {});
	for (const key of sharedKeys) {
		if (!NAME.test(key)) throw new Error(`cms.config: ai.shared.${key}: name must be letters, digits or _`);
	}
	for (const [key, action] of Object.entries(ai.actions)) {
		const where = `cms.config: ai.actions.${key}`;
		if (!NAME.test(key)) throw new Error(`${where}: name must be letters, digits or _`);
		const inputs = Object.entries(action.input);
		for (const [name] of inputs) if (!NAME.test(name)) throw new Error(`${where}: bad input name "${name}"`);
		for (const name of action.send ?? []) {
			if (!action.input[name]) throw new Error(`${where}: send lists unknown input "${name}"`);
		}
		const unknown = unknownPlaceholders(action.prompt, action.input, sharedKeys);
		if (unknown.length > 0) {
			throw new Error(`${where}: prompt can only use locale inputs and shared texts, not {{${unknown[0]}}}`);
		}

		const choices = action.choices;
		if (choices?.from === "collection" && !collections[choices.collection]) {
			throw new Error(`${where}: choices use unknown collection "${choices.collection}"`);
		}
		if (choices?.from === "select") {
			const field = findField(collections, choices.collection, choices.field);
			const select =
				field?.kind === "conditional" ? (field as { discriminant?: { kind: string } }).discriminant : field;
			if (select?.kind !== "select") {
				throw new Error(`${where}: choices need a select field ${choices.collection}.${choices.field}`);
			}
		}
		const engine = action.engine ?? "generate";
		if (engine === "decide") {
			if (!choices) throw new Error(`${where}: decide engine needs choices`);
			if (action.result !== "candidates") throw new Error(`${where}: decide engine answers candidates only`);
			if (inputs.some(([, spec]) => spec.kind === "image"))
				throw new Error(`${where}: decide engine cannot read images`);
		}
		if (action.stream && (engine !== "generate" || (action.result !== "text" && action.result !== "mdx"))) {
			throw new Error(`${where}: stream needs the generate engine and a text or mdx result`);
		}
		if (action.fake !== undefined && typeof action.fake !== "function") {
			throw new Error(`${where}: fake must be a function`);
		}
		if (action.result === "note" && action.apply && action.apply !== "none") {
			throw new Error(`${where}: note results are not applied`);
		}
		const codeNames = new Set<string>();
		for (const check of action.checks ?? []) {
			if (check.kind === "exists" && !choices) throw new Error(`${where}: exists check needs choices`);
			if (isValidator(check)) {
				if (!CODE_CHECK_NAME.test(check.name))
					throw new Error(`${where}: check name "${check.name}" must be kebab-case`);
				if (codeNames.has(check.name)) throw new Error(`${where}: check "${check.name}" is listed twice`);
				if (typeof check.run !== "function") throw new Error(`${where}: check "${check.name}" needs a run function`);
				codeNames.add(check.name);
			}
		}

		for (const attach of action.attach ?? []) {
			const provides: Readonly<Record<string, AiInputKind>> = SLOT_INPUTS[attach.slot];
			for (const [name, spec] of inputs) {
				const given = provides[name];
				if (given === undefined ? spec.required : given !== spec.kind) {
					throw new Error(`${where}: ${attach.slot} slot cannot fill input "${name}" (${spec.kind})`);
				}
			}
			if (attach.slot === "block") {
				if (action.result !== "mdx") throw new Error(`${where}: block slot needs an mdx result`);
				if (blocks && !blocks.includes(attach.block)) {
					throw new Error(`${where}: attach uses unknown block "${attach.block}"`);
				}
				continue;
			}
			if (attach.slot !== "field") continue;
			for (const collection of attach.collections ?? []) {
				if (!collections[collection]) throw new Error(`${where}: attach uses unknown collection "${collection}"`);
				if (!findField(collections, collection, attach.field)) {
					throw new Error(`${where}: ${collection} has no field "${attach.field}"`);
				}
			}
			if (!Object.keys(collections).some((collection) => findField(collections, collection, attach.field))) {
				throw new Error(`${where}: attach uses unknown field "${attach.field}"`);
			}
		}
	}
}
