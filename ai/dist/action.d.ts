import { type ConfigIssue } from "@monti-cms/core";
import type { AiActionDefinition, AiActionSource, AiAttach, AiChoices, AiInputs, AiValidator } from "@monti-cms/core/ai-contract";
import type { Site } from "@monti-cms/core/site";
import { z } from "zod";
import { type AiApply, type AiCandidate, type AiCheck, type AiEngine, type AiPick, type AiResult, type AiSlot, type CoreText } from "./definition.js";
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
type InputOptions = {
    readonly label: string;
    readonly required?: boolean;
};
export declare const aiInput: {
    text: <const O extends InputOptions>(options: O) => {
        readonly kind: "text";
    } & O;
    mdx: <const O extends InputOptions>(options: O) => {
        readonly kind: "mdx";
    } & O;
    code: <const O extends InputOptions>(options: O) => {
        readonly kind: "code";
    } & O;
    value: <const O extends InputOptions>(options: O) => {
        readonly kind: "value";
    } & O;
    image: <const O extends InputOptions>(options: O) => {
        readonly kind: "image";
    } & O;
    locale: <const O extends InputOptions>(options: O) => {
        readonly kind: "locale";
    } & O;
};
/** Input value type. For images, only the location for the server to read is given. */
export type AiInputValue<S> = S extends {
    readonly kind: "image";
} ? {
    readonly mediaId?: string;
    readonly src?: string;
} : S extends {
    readonly kind: "value";
} ? string | readonly string[] : string;
/**
 * The material each slot provides. An action can attach to a slot only if all its required inputs are here.
 * Non-required inputs are sent empty when the slot lacks them (e.g. the media screen's alt text has no surrounding paragraphs).
 */
export declare const SLOT_INPUTS: {
    readonly field: {
        readonly title: "text";
        readonly summary: "text";
        readonly body: "mdx";
        readonly current: "value";
    };
    readonly image: {
        readonly image: "image";
        readonly around: "text";
        readonly current: "value";
    };
    readonly media: {
        readonly image: "image";
        readonly filename: "text";
        readonly current: "value";
    };
    readonly codeRules: {
        readonly code: "code";
    };
    readonly translation: {
        readonly block: "mdx";
        readonly from: "locale";
        readonly to: "locale";
    };
    readonly selection: {
        readonly selection: "mdx";
        readonly title: "text";
    };
    readonly insert: {
        readonly title: "text";
        readonly body: "mdx";
    };
    readonly block: {
        readonly block: "mdx";
        readonly title: "text";
    };
};
type SlotInputNames = {
    [S in AiSlot]: keyof (typeof SLOT_INPUTS)[S];
};
type RequiredInputNames<I> = {
    [K in keyof I]: I[K] extends {
        readonly required: true;
    } ? K : never;
}[keyof I];
/** Slots where all required inputs can be filled. */
type AttachableSlot<I> = {
    [S in AiSlot]: [Exclude<RequiredInputNames<I>, SlotInputNames[S]>] extends [never] ? S : never;
}[AiSlot];
/** Creates a code check. Put it in an action definition's `checks` together with the fixed checks. */
export declare const defineValidator: (check: Omit<AiValidator, "kind">) => AiValidator;
/** The display name of a code check in the site's admin language. */
export declare const validatorLabel: (check: Pick<AiValidator, "label">, site: Pick<Site, "createTranslator">) => string;
/** One prompt snippet (e.g. a style guide). Inserted into prompts as `{{snippet.name}}` and edited in the admin AI screen. */
export interface AiSnippet {
    readonly label: string;
    /** Default text. If an edited value exists in the admin UI, that is used. */
    readonly text: string;
}
export type { AiActionDefinition, AiActionFactory, AiActionSource, AiAttach, AiChoices, AiContentLookup, AiContribution, AiInputKind, AiInputSpec, AiInputs, AiSiteView, AiValidator, AiValidatorContext, AiValidatorResult, } from "@monti-cms/core/ai-contract";
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
type LocaleInputNames<I> = {
    [K in keyof I]: I[K] extends {
        readonly kind: "locale";
    } ? K : never;
}[keyof I];
/** Raises a type error if the prompt has a `{{name}}` that is neither a locale input nor a prompt snippet (`snippet.name`). Prompt snippet names are checked by the plugin config. */
type PromptCheck<P extends string, I> = string extends P ? unknown : [Exclude<Placeholders<P>, LocaleInputNames<I> | `snippet.${string}`>] extends [never] ? unknown : {
    readonly "The prompt can only use locale inputs and prompt snippets as {{name}}": Exclude<Placeholders<P>, LocaleInputNames<I> | `snippet.${string}`>;
};
/**
 * Defines an action. Types check the prompt's `{{name}}` and the attach point (whether the slot can fill all inputs).
 */
export declare function aiAction<const I extends AiInputs, const P extends string, const D extends Omit<AiActionDefinition<I>, "input" | "prompt" | "attach"> & {
    readonly attach?: readonly Extract<AiAttach, {
        readonly slot: AttachableSlot<I>;
    }>[];
}>(definition: D & {
    readonly input: I;
    readonly prompt: P & PromptCheck<P, I>;
}): D & {
    input: I;
    prompt: P;
};
/** The result type of an action. */
export type AiActionResult<D> = D extends {
    readonly result: "candidates";
} ? {
    kind: "candidates";
    items: AiCandidate[];
} : D extends {
    readonly result: "text";
} ? {
    kind: "text";
    text: string;
} : D extends {
    readonly result: "mdx";
} ? {
    kind: "mdx";
    text: string;
} : D extends {
    readonly result: "note";
} ? {
    kind: "note";
    text: string;
} : never;
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
/** The type of inputs passed when calling an action. Only `required` inputs must be given. */
export type AiActionInput<D> = D extends {
    readonly input: infer I;
} ? Simplify<{
    -readonly [K in keyof I as I[K] extends {
        readonly required: true;
    } ? K : never]: AiInputValue<I[K]>;
} & {
    -readonly [K in keyof I as I[K] extends {
        readonly required: true;
    } ? never : K]?: AiInputValue<I[K]>;
}> : never;
/** Values editable in the admin UI. Only values that differ from the definition are stored in the DB. */
export declare const aiActionOverrideSchemaOf: (t: CoreText) => z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    label: z.ZodOptional<z.ZodString>;
    askInstruction: z.ZodOptional<z.ZodBoolean>;
    instant: z.ZodOptional<z.ZodBoolean>;
    providerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    modelName: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    send: z.ZodOptional<z.ZodArray<z.ZodString>>;
    threshold: z.ZodOptional<z.ZodNumber>;
    maxCount: z.ZodOptional<z.ZodNumber>;
    checks: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"pattern">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        pattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"maxLength">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        max: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"exists">;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"oneOf">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        items: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"code">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        name: z.ZodString;
    }, z.core.$strip>], "kind">>>;
}, z.core.$strip>;
/** The edited-value schema with English messages: reads stored values and builds definitions, where no message is shown. */
export declare const aiActionOverrideSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    label: z.ZodOptional<z.ZodString>;
    askInstruction: z.ZodOptional<z.ZodBoolean>;
    instant: z.ZodOptional<z.ZodBoolean>;
    providerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    modelName: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    send: z.ZodOptional<z.ZodArray<z.ZodString>>;
    threshold: z.ZodOptional<z.ZodNumber>;
    maxCount: z.ZodOptional<z.ZodNumber>;
    checks: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"pattern">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        pattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"maxLength">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        max: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"exists">;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"oneOf">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        items: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"code">;
        enabled: z.ZodDefault<z.ZodBoolean>;
        name: z.ZodString;
    }, z.core.$strip>], "kind">>>;
}, z.core.$strip>;
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
export declare const EDITABLE_KEYS: readonly ["enabled", "hidden", "label", "askInstruction", "instant", "providerId", "modelName", "prompt", "send", "threshold", "maxCount", "checks"];
export type AiActionEditable = Pick<ResolvedAiAction, (typeof EDITABLE_KEYS)[number]>;
/**
 * Applies edited values onto the definition. Checks keep the definition's kinds in the definition's order with the user's edited enabled state and values applied, then
 * the user-added checks (format, length, in-choices; one per kind) are appended.
 * Inputs to send keep only names present in the definition, and required inputs are always sent.
 */
export declare function resolveAction(key: string, definition: AiActionDefinition, override?: AiActionOverride): ResolvedAiAction;
/** Keeps only the edited values that differ from the definition (defaults). This is the shape stored in the DB. */
export declare function overrideFrom(definition: AiActionDefinition, edited: Partial<AiActionEditable>): AiActionOverride;
/**
 * Of the prompt's `{{name}}`, those that are neither a locale input nor an existing prompt snippet (`snippet.name`). Used for definition checks and pre-save checks.
 */
export declare function unknownPlaceholders(prompt: string, input: AiInputs, snippetKeys?: readonly string[]): string[];
/**
 * The prompt to run. Replaces `{{locale input}}` with the language name and `{{snippet.name}}` with the prompt snippet, and appends locale inputs not used in the prompt
 * as `name: language` lines. Finally appends the extra request given at run time (only for actions with `askInstruction` on).
 */
export declare function renderPrompt(action: Pick<ResolvedAiAction, "prompt" | "input" | "askInstruction">, values: Readonly<Record<string, unknown>>, languageName: (code: string) => string, request?: string, snippets?: Readonly<Record<string, string>>): string;
/** Validation of action inputs. Names not in the definition are dropped. */
export declare function inputSchemaFor(input: AiInputs, t: CoreText): z.ZodObject<{
    [x: string]: z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>;
}, z.core.$strip>;
/** Common info of a run request (outside the inputs). */
export declare const aiRunEnvSchema: z.ZodObject<{
    collection: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    entryId: z.ZodOptional<z.ZodUUID>;
    language: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AiRunEnv = z.output<typeof aiRunEnvSchema>;
/** Number of inputs sent together in one request (e.g. the translation's `Translate all`). */
export declare const MAX_BATCH_INPUTS = 8;
export declare const aiRunBodySchemaOf: (t: CoreText) => z.ZodObject<{
    action: z.ZodString;
    input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    inputs: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    env: z.ZodDefault<z.ZodObject<{
        collection: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        entryId: z.ZodOptional<z.ZodUUID>;
        language: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    request: z.ZodOptional<z.ZodString>;
    draft: z.ZodOptional<z.ZodUnknown>;
    draftBase: z.ZodOptional<z.ZodUnknown>;
    stream: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AiRunBody = z.output<ReturnType<typeof aiRunBodySchemaOf>>;
/** The parts of the config's collection definitions needed for validation. */
interface CollectionsView {
    readonly [name: string]: {
        readonly fields: Readonly<Record<string, {
            readonly kind: string;
            readonly discriminant?: {
                readonly kind: string;
            };
        }>>;
    };
}
/** Checks that the AI config matches the collection definitions, slots and result shapes. */
export declare function checkAiConfig(ai: ResolvedAiConfig, collections: CollectionsView, blocks?: readonly string[]): ConfigIssue[];
