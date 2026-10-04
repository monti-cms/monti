import { aiActionOverrideSchema, resolveAction, } from "./action.js";
import { customDefinition } from "./custom.js";
/** Reads the saved edited value. Drops values whose shape does not match (the definition changed and no longer fits). */
export const readOverride = (value) => {
    const parsed = aiActionOverrideSchema.safeParse(value);
    return parsed.success ? parsed.data : {};
};
export const viewOf = (action, row, custom) => ({
    ...(custom ? { custom: custom.base } : {}),
    key: action.key,
    label: action.label,
    result: action.result,
    apply: action.apply,
    engine: action.engine,
    pick: action.pick,
    input: Object.fromEntries(Object.entries(action.input).map(([name, spec]) => [
        name,
        { kind: spec.kind, label: spec.label, required: spec.required === true },
    ])),
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
    validatorLabels: Object.fromEntries(Object.values(action.validators).map((check) => [check.name, check.label])),
    send: [...action.send],
    version: row?.version ?? 0,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    overridden: Object.keys(custom ? custom.override : readOverride(row?.value)),
});
/** Name (key) of a new, unsaved screen action. The server assigns a new name when saving. */
export const NEW_CUSTOM_KEY = "custom_new";
/** The shape of a new, unsaved screen action. The admin screen rebuilds it each time the basic info is chosen. */
export const draftCustomView = (base) => viewOf(resolveAction(NEW_CUSTOM_KEY, customDefinition(base), {}), undefined, { base, override: {} });
