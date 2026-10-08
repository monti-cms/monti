import { aiActionOverrideSchema, EDITABLE_KEYS, resolveAction, validatorLabel, } from "./action.js";
import { customDefinition } from "./custom.js";
/** Reads the saved edited value. Drops values whose shape does not match (the definition changed and no longer fits). */
export const readOverride = (value) => {
    const parsed = aiActionOverrideSchema.safeParse(value);
    return parsed.success ? parsed.data : {};
};
/** The editable values of a resolved action. */
const editableOf = (action) => Object.fromEntries(EDITABLE_KEYS.map((name) => [name, structuredClone(action[name])]));
/**
 * `definition` is the code definition of the action (not given for a screen action): the defaults of its editable values go into the view.
 */
export const viewOf = (site, action, row, custom, definition) => ({
    defaults: definition && !custom ? editableOf(resolveAction(action.key, definition)) : null,
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
    validatorLabels: Object.fromEntries(Object.values(action.validators).map((check) => [check.name, validatorLabel(check, site)])),
    send: [...action.send],
    version: row?.version ?? 0,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    overridden: Object.keys(custom ? custom.override : readOverride(row?.value)),
});
/** Name (key) of a new, unsaved screen action. The server assigns a new name when saving. */
export const NEW_CUSTOM_KEY = "custom_new";
/** The shape of a new, unsaved screen action. The admin screen rebuilds it each time the basic info is chosen. */
export const draftCustomView = (site, base) => viewOf(site, resolveAction(NEW_CUSTOM_KEY, customDefinition(site, base), {}), undefined, { base, override: {} });
