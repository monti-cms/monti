import { type ConfigIssue, IssueList, pathOf } from "@monti-cms/core";
import type {
	AiActionDefinition,
	AiActionSource,
	AiAttach,
	AiChoices,
	AiInputKind,
	AiInputSpec,
	AiInputs,
	AiValidator,
} from "@monti-cms/core/ai-contract";
import type { Site } from "@monti-cms/core/site";
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
} from "./definition";

/**
 * AI action definition. An action is registered under its name (key) in the site config's `ai.actions`.
 *
 * - **Inputs**: the material the caller supplies (title, body, image, language...). Inputs are sent separately, not spliced into
 *   the prompt (so the model does not follow instruction-like sentences inside the text). Only language inputs can go into `{{name}}` in the prompt.
 * - **Result**: one of several candidates, a single text, an MDX fragment, or a note, plus a list of checks.
 * - **Attach point (`attach`)**: a fixed place in the admin UI (beside a field, image, media, code block, translation). An action can attach
 *   only when the material that place provides can fill its inputs (checked by the types and `defineSite`).
 *
 * The admin AI screen only edits enabled state, extra requests, connection, model, inputs to send, prompt, threshold and check values; only edited values are stored in the DB.
 * The definition is read by both server and browser. The function of a code check (`defineValidator`) is only called on the server.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

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

type RequiredInputNames<I> = { [K in keyof I]: I[K] extends { readonly required: true } ? K : never }[keyof I];
/** Slots where all required inputs can be filled. */
type AttachableSlot<I> = {
	[S in AiSlot]: [Exclude<RequiredInputNames<I>, SlotInputNames[S]>] extends [never] ? S : never;
}[AiSlot];

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Action definition
// ---------------------------------------------------------------------------

/** Creates a code check. Put it in an action definition's `checks` together with the fixed checks. */
export const defineValidator = (check: Omit<AiValidator, "kind">): AiValidator => ({ kind: "code", ...check });

/** The display name of a code check in the site's admin language. */
export const validatorLabel = (check: Pick<AiValidator, "label">, site: Pick<Site, "createTranslator">): string =>
	typeof check.label === "function" ? check.label(site) : check.label;

const isValidator = (check: AiCheckInput | AiValidator): check is AiValidator => "run" in check;

/** One prompt snippet (e.g. a style guide). Inserted into prompts as `{{snippet.name}}` and edited in the admin AI screen. */
export interface AiSnippet {
	readonly label: string;
	/** Default text. If an edited value exists in the admin UI, that is used. */
	readonly text: string;
}

export type {
	AiActionDefinition,
	AiActionFactory,
	AiActionSource,
	AiAttach,
	AiChoices,
	AiContentLookup,
	AiContribution,
	AiInputKind,
	AiInputSpec,
	AiInputs,
	AiSiteView,
	AiValidator,
	AiValidatorContext,
	AiValidatorResult,
} from "@monti-cms/core/ai-contract";

export interface AiConfig {
	/** Site description. Goes into the leading instruction of every action ("You are the editing assistant of the CMS for this site: {this}"). Defaults to "website". */
	readonly siteDescription?: string;
	/**
	 * Prompt snippets used by several actions. Insert into a prompt as `{{snippet.name}}`. If `styleGuide` exists, it goes into the prompts of the
	 * default style polish and draft actions.
	 */
	readonly snippets?: Readonly<Record<string, AiSnippet>>;
	/**
	 * Actions to replace or add. Default actions (`aiPresets`, those with an attach point on the site) and actions added by other plugins are enabled without being listed.
	 * Giving a definition (or `aiPresets.name(options)`) under the same name replaces it, `false` removes it, and a new name adds it.
	 */
	readonly actions?: Readonly<Record<string, AiActionSource | false>>;
	/**
	 * Fill in the alt text and caption of an image as it goes into the body: the editor runs the `imageAlt` and `imageCaption` actions on it and writes the
	 * first candidate of each into the field while it is still empty (the person may leave alt text empty in the image dialog). Off unless `true`.
	 */
	readonly autoImageText?: boolean;
}

/** The resolved list of actions (name -> definition). Read by the runner, the UI and the checks. */
export interface ResolvedAiConfig {
	readonly snippets?: Readonly<Record<string, AiSnippet>>;
	readonly actions: Readonly<Record<string, AiActionDefinition>>;
}

/** `{{name}}` in the prompt. */
type Placeholders<S extends string> = S extends `${string}{{${infer P}}}${infer Rest}` ? P | Placeholders<Rest> : never;
type LocaleInputNames<I> = { [K in keyof I]: I[K] extends { readonly kind: "locale" } ? K : never }[keyof I];
/** Raises a type error if the prompt has a `{{name}}` that is neither a locale input nor a prompt snippet (`snippet.name`). Prompt snippet names are checked by the plugin config. */
type PromptCheck<P extends string, I> = string extends P
	? unknown
	: [Exclude<Placeholders<P>, LocaleInputNames<I> | `snippet.${string}`>] extends [never]
		? unknown
		: {
				readonly "The prompt can only use locale inputs and prompt snippets as {{name}}": Exclude<
					Placeholders<P>,
					LocaleInputNames<I> | `snippet.${string}`
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
			hidden: z.boolean(),
			label: z.string().trim().min(1).max(60),
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
			checks: z.array(aiCheckSchemaOf(t)).max(10),
		})
		.partial();

/** The edited-value schema with English messages: reads stored values and builds definitions, where no message is shown. */
export const aiActionOverrideSchema = aiActionOverrideSchemaOf(englishCoreText);
export type AiActionOverride = z.output<typeof aiActionOverrideSchema>;

/** The action to run: the definition with edited values applied. */
export interface ResolvedAiAction {
	readonly key: string;
	readonly label: string;
	readonly hidden: boolean;
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
	"hidden",
	"label",
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
		label: override.label?.trim() || definition.label,
		hidden: override.hidden ?? definition.hidden ?? false,
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

const PLACEHOLDER = /\{\{\s*((?:snippet\.)?[A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
const SNIPPET_PREFIX = "snippet.";

/**
 * Of the prompt's `{{name}}`, those that are neither a locale input nor an existing prompt snippet (`snippet.name`). Used for definition checks and pre-save checks.
 */
export function unknownPlaceholders(prompt: string, input: AiInputs, snippetKeys: readonly string[] = []): string[] {
	const names = [...prompt.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
	return [
		...new Set(
			names.filter((name) =>
				name.startsWith(SNIPPET_PREFIX)
					? !snippetKeys.includes(name.slice(SNIPPET_PREFIX.length))
					: input[name]?.kind !== "locale",
			),
		),
	];
}

/**
 * The prompt to run. Replaces `{{locale input}}` with the language name and `{{snippet.name}}` with the prompt snippet, and appends locale inputs not used in the prompt
 * as `name: language` lines. Finally appends the extra request given at run time (only for actions with `askInstruction` on).
 */
export function renderPrompt(
	action: Pick<ResolvedAiAction, "prompt" | "input" | "askInstruction">,
	values: Readonly<Record<string, unknown>>,
	languageName: (code: string) => string,
	request?: string,
	snippets: Readonly<Record<string, string>> = {},
): string {
	const used = new Set<string>();
	const prompt = action.prompt.replace(PLACEHOLDER, (whole, name: string) => {
		if (name.startsWith(SNIPPET_PREFIX)) {
			const text = snippets[name.slice(SNIPPET_PREFIX.length)];
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

/** Checks that the AI config matches the collection definitions, slots and result shapes. */
export function checkAiConfig(
	ai: ResolvedAiConfig,
	collections: CollectionsView,
	blocks?: readonly string[],
): ConfigIssue[] {
	const list = new IssueList();
	const bad = (path: string, code: string, message: string) => list.add(path, code, message);
	const snippetKeys = Object.keys(ai.snippets ?? {});
	for (const key of snippetKeys) {
		if (!NAME.test(key)) bad(pathOf("plugins", "ai", "snippets", key), "name", "name must be letters, digits or _");
	}
	for (const [key, action] of Object.entries(ai.actions)) {
		const where = pathOf("plugins", "ai", "actions", key);
		if (!NAME.test(key)) bad(where, "name", `name must be letters, digits or _`);
		const inputs = Object.entries(action.input);
		for (const [name] of inputs) if (!NAME.test(name)) bad(where, "input", `bad input name "${name}"`);
		for (const name of action.send ?? []) {
			if (!action.input[name]) bad(where, "send", `send lists unknown input "${name}"`);
		}
		const unknown = unknownPlaceholders(action.prompt, action.input, snippetKeys);
		if (unknown.length > 0) {
			bad(where, "prompt", `prompt can only use locale inputs and prompt snippets, not {{${unknown[0]}}}`);
		}

		const choices = action.choices;
		if (choices?.from === "collection" && !collections[choices.collection]) {
			bad(where, "choices", `choices use unknown collection "${choices.collection}"`);
		}
		if (choices?.from === "select") {
			const field = findField(collections, choices.collection, choices.field);
			const select =
				field?.kind === "conditional" ? (field as { discriminant?: { kind: string } }).discriminant : field;
			if (select?.kind !== "select") {
				bad(where, "choices", `choices need a select field ${choices.collection}.${choices.field}`);
			}
		}
		const engine = action.engine ?? "generate";
		if (engine === "decide") {
			if (!choices) bad(where, "choices", `decide engine needs choices`);
			if (action.result !== "candidates") bad(where, "engine", `decide engine answers candidates only`);
			if (inputs.some(([, spec]) => spec.kind === "image")) bad(where, "engine", `decide engine cannot read images`);
		}
		if (action.stream && (engine !== "generate" || (action.result !== "text" && action.result !== "mdx"))) {
			bad(where, "stream", `stream needs the generate engine and a text or mdx result`);
		}
		if (action.fake !== undefined && typeof action.fake !== "function") {
			bad(where, "fake", `fake must be a function`);
		}
		if (action.result === "note" && action.apply && action.apply !== "none") {
			bad(where, "apply", `note results are not applied`);
		}
		const codeNames = new Set<string>();
		for (const check of action.checks ?? []) {
			if (check.kind === "exists" && !choices) bad(where, "choices", `exists check needs choices`);
			if (isValidator(check)) {
				if (!CODE_CHECK_NAME.test(check.name)) bad(where, "check", `check name "${check.name}" must be kebab-case`);
				if (codeNames.has(check.name)) bad(where, "check", `check "${check.name}" is listed twice`);
				if (typeof check.run !== "function") bad(where, "check", `check "${check.name}" needs a run function`);
				codeNames.add(check.name);
			}
		}

		for (const attach of action.attach ?? []) {
			const provides: Readonly<Record<string, AiInputKind>> = SLOT_INPUTS[attach.slot];
			for (const [name, spec] of inputs) {
				const given = provides[name];
				if (given === undefined ? spec.required : given !== spec.kind) {
					bad(where, "attach", `${attach.slot} slot cannot fill input "${name}" (${spec.kind})`);
				}
			}
			if (attach.slot === "block") {
				if (action.result !== "mdx") bad(where, "attach", `block slot needs an mdx result`);
				if (blocks && !blocks.includes(attach.block)) {
					bad(where, "attach", `attach uses unknown block "${attach.block}"`);
				}
				continue;
			}
			if (attach.slot !== "field") continue;
			for (const collection of attach.collections ?? []) {
				if (!collections[collection]) bad(where, "attach", `attach uses unknown collection "${collection}"`);
				if (!findField(collections, collection, attach.field)) {
					bad(where, "attach", `${collection} has no field "${attach.field}"`);
				}
			}
			if (!Object.keys(collections).some((collection) => findField(collections, collection, attach.field))) {
				bad(where, "attach", `attach uses unknown field "${attach.field}"`);
			}
		}
	}
	return list.issues;
}
