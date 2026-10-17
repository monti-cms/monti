import { aiActionOverrideSchemaOf, EDITABLE_KEYS, overrideFrom, resolveAction, unknownPlaceholders, } from "./action.js";
import { readOverride, viewOf } from "./action-view.js";
import { actionsMessages } from "./actions.messages.js";
import { coreMessages } from "./core.messages.js";
import { customBaseSchemaOf, customDefinition, customValueSchemaOf, isCustomKey, newCustomKey, surfaceProblem, } from "./custom.js";
import { AiError } from "./errors.js";
import { aiRegistryOf } from "./registry.js";
import { loadSnippetKeys } from "./snippets.js";
/** One stored custom action row. `null` if its shape does not fit (when the definition changed and no longer matches). */
const readCustom = (site, value) => {
    const parsed = customValueSchemaOf(site).safeParse(value);
    return parsed.success ? parsed.data : null;
};
async function customRow(site, store, key) {
    const row = (await store.listAiCustomActions()).find((item) => item.key === key);
    const value = row ? readCustom(site, row.value) : null;
    if (!row || !value)
        throw new AiError("not_found", site.createTranslator(actionsMessages)("unknownAction"));
    return { row, value };
}
const definitionOf = (site, key) => {
    const definition = aiRegistryOf(site).actionDefinition(key);
    if (!definition)
        throw new AiError("not_found", site.createTranslator(actionsMessages)("unknownAction"));
    return definition;
};
/** One action (with edited values applied). Custom actions have the same shape. */
export async function getAction(site, store, key) {
    if (isCustomKey(key)) {
        const { value } = await customRow(site, store, key);
        return resolveAction(key, customDefinition(site, value.base), value.override);
    }
    const definition = definitionOf(site, key);
    const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
    return resolveAction(key, definition, readOverride(row?.value));
}
/** All coded actions in config order, then custom actions in creation order. */
export async function listActions(site, store) {
    const rows = new Map((await store.listAiActionOverrides()).map((row) => [row.key, row]));
    const code = Object.entries(aiRegistryOf(site).actions).map(([key, definition]) => {
        const row = rows.get(key);
        return viewOf(site, resolveAction(key, definition, readOverride(row?.value)), row, undefined, definition);
    });
    const custom = (await store.listAiCustomActions()).flatMap((row) => {
        const value = readCustom(site, row.value);
        if (!value)
            return [];
        return [viewOf(site, resolveAction(row.key, customDefinition(site, value.base), value.override), row, value)];
    });
    return [...code, ...custom];
}
/**
 * Builds an action to test or save with editable values. `{{name}}` in the prompt only accepts locale inputs and prompt snippets (`snippetKeys`: the config's texts and
 * those added in the admin UI). Values that cannot be edited (name, result shape, etc.) are ignored if sent.
 */
export function actionWithEdits(site, key, edited, definition = definitionOf(site, key), snippetKeys = aiRegistryOf(site).snippetKeys) {
    const t = site.createTranslator(actionsMessages);
    const parsed = aiActionOverrideSchemaOf(site.createTranslator(coreMessages)).safeParse(edited && typeof edited === "object"
        ? Object.fromEntries(EDITABLE_KEYS.filter((name) => name in edited && (name !== "label" || edited[name] !== "")).map((name) => [name, edited[name]]))
        : {});
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AiError("invalid_input", issue?.message ?? t("invalidValue"), {
            detail: issue?.path.length ? issue.path.join(".") : undefined,
            issues: parsed.error.issues,
        });
    }
    const unknown = parsed.data.prompt ? unknownPlaceholders(parsed.data.prompt, definition.input, snippetKeys) : [];
    if (unknown.length > 0) {
        throw new AiError("invalid_input", t("unknownPlaceholder", { name: unknown[0] ?? "" }));
    }
    return resolveAction(key, definition, overrideFrom(definition, parsed.data));
}
/**
 * Action to test with unsaved edited values (the AI screen's `Test`). A custom action is built from the base info (`base`) if given (e.g. a new, still
 * unsaved action), otherwise from the saved base info.
 */
export async function actionWithDraft(site, store, key, edited, baseInput) {
    const snippetKeys = await loadSnippetKeys(site, store);
    if (!isCustomKey(key))
        return actionWithEdits(site, key, edited, definitionOf(site, key), snippetKeys);
    if (baseInput !== undefined) {
        return actionWithEdits(site, key, edited, customDefinition(site, readBase(site, baseInput)), snippetKeys);
    }
    const { value } = await customRow(site, store, key);
    return actionWithEdits(site, key, edited, customDefinition(site, value.base), snippetKeys);
}
/** Validates the base info of a custom action. */
function readBase(site, input) {
    const parsed = customBaseSchemaOf(site).safeParse(input);
    if (!parsed.success) {
        throw new AiError("invalid_input", parsed.error.issues[0]?.message ?? site.createTranslator(actionsMessages)("invalidBase"));
    }
    const problem = surfaceProblem(site, parsed.data.surface);
    if (problem)
        throw new AiError("invalid_input", problem);
    return parsed.data;
}
/** Creates a custom action. Takes the base info and the edited values (connection, model, prompt, checks, etc.) at once. */
export async function createCustomAction(site, store, baseInput, edited = {}) {
    const base = readBase(site, baseInput);
    const key = newCustomKey();
    const definition = customDefinition(site, base);
    const action = actionWithEdits(site, key, edited, definition, await loadSnippetKeys(site, store));
    const value = { base, override: overrideFrom(definition, action) };
    const row = await store.saveAiCustomAction({ key, expectedVersion: 0, value });
    return viewOf(site, resolveAction(key, definition, value.override), row, value);
}
/** Deletes a custom action. */
export async function deleteCustomAction(site, store, key, expectedVersion) {
    if (!isCustomKey(key)) {
        throw new AiError("invalid_input", site.createTranslator(actionsMessages)("cannotDeleteCoded"));
    }
    await store.deleteAiCustomAction({ key, expectedVersion });
}
/**
 * Saves edited values. Values equal to the default are not stored.
 * For a custom action, the base info (`base`: name, attach point, result shape) can be edited too.
 */
export async function updateAction(site, store, key, expectedVersion, edited, baseInput) {
    if (isCustomKey(key)) {
        const { value: current } = await customRow(site, store, key);
        const base = baseInput === undefined ? current.base : readBase(site, baseInput);
        const definition = customDefinition(site, base);
        const action = actionWithEdits(site, key, edited, definition, await loadSnippetKeys(site, store));
        const value = { base, override: overrideFrom(definition, action) };
        const row = await store.saveAiCustomAction({ key, expectedVersion, value });
        return viewOf(site, resolveAction(key, definition, value.override), row, value);
    }
    const definition = definitionOf(site, key);
    const action = actionWithEdits(site, key, edited, definition, await loadSnippetKeys(site, store));
    const value = overrideFrom(definition, action);
    const row = await store.saveAiActionOverride({ key, expectedVersion, value });
    return viewOf(site, action, row, undefined, definition);
}
/** Resets to defaults. The enabled state keeps its current value. A custom action has no default to reset to. */
export async function resetAction(site, store, key, expectedVersion) {
    if (isCustomKey(key)) {
        throw new AiError("invalid_input", site.createTranslator(actionsMessages)("noDefaultForCustom"));
    }
    const current = await getAction(site, store, key);
    const definition = definitionOf(site, key);
    const value = overrideFrom(definition, { enabled: current.enabled });
    const row = await store.saveAiActionOverride({ key, expectedVersion, value });
    return viewOf(site, resolveAction(key, definition, value), row, undefined, definition);
}
