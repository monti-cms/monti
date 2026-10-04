import { z } from "zod";
import { coreMessages } from "./core.messages.js";
import { aiCheckSchema, CODE_CHECK_NAME, checkKey, isAddableCheck, MAX_PROMPT_LENGTH, MAX_REQUEST_LENGTH, migrateCheck, } from "./definition.js";
import { lazyTranslator } from "./i18n.js";
const t = lazyTranslator(coreMessages);
const inputOf = (kind) => (options) => ({ kind, ...options });
export const aiInput = {
    text: inputOf("text"),
    mdx: inputOf("mdx"),
    code: inputOf("code"),
    value: inputOf("value"),
    image: inputOf("image"),
    locale: inputOf("locale"),
};
/** Maximum length of one input (characters). */
const INPUT_LIMITS = {
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
};
/** Creates a code check. Put it in an action definition's `checks` together with the fixed checks. */
// Copies the property descriptors so the `label` accessor (`get label()`, which picks the current UI language on every read) is not frozen into a value.
export const defineValidator = (check) => Object.defineProperties({ kind: "code" }, Object.getOwnPropertyDescriptors(check));
const isValidator = (check) => "run" in check;
/**
 * Defines an action. Types check the prompt's `{{name}}` and the attach point (whether the slot can fill all inputs).
 */
export function aiAction(definition) {
    return definition;
}
// ---------------------------------------------------------------------------
// Edited values and the definition to run
// ---------------------------------------------------------------------------
/** Values editable in the admin UI. Only values that differ from the definition are stored in the DB. */
export const aiActionOverrideSchema = z
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
    checks: z.array(z.preprocess(migrateCheck, aiCheckSchema)).max(10),
})
    .partial();
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
];
const defaultChecks = (definition) => (definition.checks ?? []).map((check) => isValidator(check)
    ? { kind: "code", name: check.name, enabled: check.enabled ?? true }
    : aiCheckSchema.parse(check));
/**
 * Applies edited values onto the definition. Checks keep the definition's kinds in the definition's order with the user's edited enabled state and values applied, then
 * the user-added checks (format, length, in-choices; one per kind) are appended.
 * Inputs to send keep only names present in the definition, and required inputs are always sent.
 */
export function resolveAction(key, definition, override = {}) {
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
                return mine ? { ...check, ...mine } : check;
            }),
            ...(override.checks ?? []).filter((check, index, all) => isAddableCheck(check.kind) &&
                !base.some((item) => item.kind === check.kind) &&
                all.findIndex((item) => item.kind === check.kind) === index),
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
export function overrideFrom(definition, edited) {
    const base = resolveAction("", definition);
    const override = {};
    for (const key of EDITABLE_KEYS) {
        const value = edited[key];
        if (value === undefined)
            continue;
        if (JSON.stringify(value) !== JSON.stringify(base[key]))
            override[key] = value;
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
export function unknownPlaceholders(prompt, input, sharedKeys = []) {
    const names = [...prompt.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
    return [
        ...new Set(names.filter((name) => name.startsWith(SHARED_PREFIX)
            ? !sharedKeys.includes(name.slice(SHARED_PREFIX.length))
            : input[name]?.kind !== "locale")),
    ];
}
/**
 * The prompt to run. Replaces `{{locale input}}` with the language name and `{{shared.name}}` with the shared text, and appends locale inputs not used in the prompt
 * as `name: language` lines. Finally appends the extra request given at run time (only for actions with `askInstruction` on).
 */
export function renderPrompt(action, values, languageName, request, shared = {}) {
    const used = new Set();
    const prompt = action.prompt.replace(PLACEHOLDER, (whole, name) => {
        if (name.startsWith(SHARED_PREFIX)) {
            const text = shared[name.slice(SHARED_PREFIX.length)];
            return text === undefined ? whole : text.trim() || "(none)";
        }
        const value = values[name];
        if (action.input[name]?.kind !== "locale" || typeof value !== "string")
            return whole;
        used.add(name);
        return languageName(value);
    });
    const lines = Object.entries(action.input)
        .filter(([name, spec]) => spec.kind === "locale" && !used.has(name) && typeof values[name] === "string")
        .map(([name]) => `${name}: ${languageName(values[name])}`);
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
const imageValueSchema = z
    .object({ mediaId: z.uuid().optional(), src: z.string().max(2000).optional() })
    .refine((value) => Boolean(value.mediaId || value.src), { error: () => t("image.missing") });
function inputValueSchema(spec) {
    switch (spec.kind) {
        case "image":
            return imageValueSchema;
        case "value":
            return z.union([z.string().max(10_000), z.array(z.string().max(200)).max(200)]);
        case "locale":
            return z.string().min(1).max(10);
        default:
            return z.string().max(INPUT_LIMITS[spec.kind]);
    }
}
/** Validation of action inputs. Names not in the definition are dropped. */
export function inputSchemaFor(input) {
    return z.object(Object.fromEntries(Object.entries(input).map(([name, spec]) => {
        const schema = inputValueSchema(spec);
        return [name, spec.required ? schema : schema.optional()];
    })));
}
/** Common info of a run request (outside the inputs). */
export const aiRunEnvSchema = z.object({
    collection: z.string().max(40).optional(),
    locale: z.string().max(10).optional(),
    entryId: z.uuid().optional(),
    /** Language of a `code` input (code block). */
    language: z.string().max(40).optional(),
});
/** Number of inputs sent together in one request (e.g. the translation's `Translate all`). */
export const MAX_BATCH_INPUTS = 8;
export const aiRunBodySchema = z
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
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
/** Finds a field definition of that collection by field name (including fields nested in conditional fields). */
function findField(collections, collection, field) {
    const fields = collections[collection]?.fields;
    if (!fields)
        return undefined;
    if (fields[field])
        return fields[field];
    for (const definition of Object.values(fields)) {
        const values = definition.values;
        for (const group of Object.values(values ?? {}))
            if (group?.[field])
                return group[field];
    }
    return undefined;
}
/** Checks that the AI config matches the collection definitions, slots and result shapes. If wrong, reports right away when the app starts. */
export function validateAiConfig(ai, collections, blocks) {
    const sharedKeys = Object.keys(ai.shared ?? {});
    for (const key of sharedKeys) {
        if (!NAME.test(key))
            throw new Error(`cms.config: ai.shared.${key}: name must be letters, digits or _`);
    }
    for (const [key, action] of Object.entries(ai.actions)) {
        const where = `cms.config: ai.actions.${key}`;
        if (!NAME.test(key))
            throw new Error(`${where}: name must be letters, digits or _`);
        const inputs = Object.entries(action.input);
        for (const [name] of inputs)
            if (!NAME.test(name))
                throw new Error(`${where}: bad input name "${name}"`);
        for (const name of action.send ?? []) {
            if (!action.input[name])
                throw new Error(`${where}: send lists unknown input "${name}"`);
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
            const select = field?.kind === "conditional" ? field.discriminant : field;
            if (select?.kind !== "select") {
                throw new Error(`${where}: choices need a select field ${choices.collection}.${choices.field}`);
            }
        }
        const engine = action.engine ?? "generate";
        if (engine === "decide") {
            if (!choices)
                throw new Error(`${where}: decide engine needs choices`);
            if (action.result !== "candidates")
                throw new Error(`${where}: decide engine answers candidates only`);
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
        const codeNames = new Set();
        for (const check of action.checks ?? []) {
            if (check.kind === "exists" && !choices)
                throw new Error(`${where}: exists check needs choices`);
            if (isValidator(check)) {
                if (!CODE_CHECK_NAME.test(check.name))
                    throw new Error(`${where}: check name "${check.name}" must be kebab-case`);
                if (codeNames.has(check.name))
                    throw new Error(`${where}: check "${check.name}" is listed twice`);
                if (typeof check.run !== "function")
                    throw new Error(`${where}: check "${check.name}" needs a run function`);
                codeNames.add(check.name);
            }
        }
        for (const attach of action.attach ?? []) {
            const provides = SLOT_INPUTS[attach.slot];
            for (const [name, spec] of inputs) {
                const given = provides[name];
                if (given === undefined ? spec.required : given !== spec.kind) {
                    throw new Error(`${where}: ${attach.slot} slot cannot fill input "${name}" (${spec.kind})`);
                }
            }
            if (attach.slot === "block") {
                if (action.result !== "mdx")
                    throw new Error(`${where}: block slot needs an mdx result`);
                if (blocks && !blocks.includes(attach.block)) {
                    throw new Error(`${where}: attach uses unknown block "${attach.block}"`);
                }
                continue;
            }
            if (attach.slot !== "field")
                continue;
            for (const collection of attach.collections ?? []) {
                if (!collections[collection])
                    throw new Error(`${where}: attach uses unknown collection "${collection}"`);
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
