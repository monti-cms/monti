import { z } from "zod";
import { AiError } from "./errors.js";
import { aiRegistryOf } from "./registry.js";
import { settingsMessages } from "./settings.messages.js";
export const MAX_SHARED_TEXT = 4000;
export const MAX_SHARED_LABEL = 40;
/** Number of texts that can be added. */
export const MAX_ADDED_SHARED = 30;
/** Shared text key. Same as the config's naming rule (`validateAiConfig`). */
export const SHARED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
/** What one site's shared texts need: its messages and the request schemas that report them. Built once per site. */
function createContext(site) {
    const t = site.createTranslator(settingsMessages);
    const textSchema = z.string().max(MAX_SHARED_TEXT, t("shared.textTooLong", { max: MAX_SHARED_TEXT }));
    const labelSchema = z
        .string()
        .trim()
        .min(1, t("shared.labelRequired"))
        .max(MAX_SHARED_LABEL, t("shared.labelTooLong", { max: MAX_SHARED_LABEL }));
    const keySchema = z.string().regex(SHARED_KEY_PATTERN, t("shared.keyFormat"));
    return {
        t,
        /** Config texts (`aiPlugin({ shared })`). */
        config: aiRegistryOf(site).shared,
        addedSchema: z.object({ key: keySchema, label: labelSchema, text: textSchema }),
        itemUpdateSchema: z.object({ key: z.string(), label: labelSchema.optional(), text: textSchema }),
        textsUpdateSchema: z.object({ texts: z.record(z.string(), textSchema) }),
    };
}
const contexts = new WeakMap();
const contextOf = (site) => {
    let context = contexts.get(site);
    if (!context) {
        context = createContext(site);
        contexts.set(site, context);
    }
    return context;
};
const storedSchema = z.object({ texts: z.record(z.string(), z.unknown()), added: z.array(z.unknown()) });
const stringsOf = (value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === "string" && entry[1].length <= MAX_SHARED_TEXT))
    : {};
const isConfigKey = (site, key) => Object.hasOwn(contextOf(site).config, key);
/**
 * Reads stored values. Entries that do not fit are dropped one by one (the rest are kept). For an added text whose key collides with a config text,
 * the config wins (when the same key was later added to the config).
 */
function readStored(site, value) {
    const current = storedSchema.safeParse(value);
    if (!current.success)
        return { texts: stringsOf(value), added: [] };
    const seen = new Set();
    const added = current.data.added.flatMap((item) => {
        const parsed = contextOf(site).addedSchema.safeParse(item);
        if (!parsed.success || isConfigKey(site, parsed.data.key) || seen.has(parsed.data.key))
            return [];
        seen.add(parsed.data.key);
        return [parsed.data];
    });
    return { texts: stringsOf(current.data.texts), added };
}
async function load(site, store) {
    const row = await store.getAiSettings("shared");
    return { version: row?.version ?? 0, stored: readStored(site, row?.value) };
}
const viewOf = (site, version, stored) => ({
    version,
    items: [
        ...Object.entries(contextOf(site).config).map(([key, definition]) => ({
            source: "config",
            key,
            label: definition.label,
            text: stored.texts[key] ?? definition.text,
            defaultText: definition.text,
            overridden: Object.hasOwn(stored.texts, key),
        })),
        ...stored.added.map((item) => ({ source: "added", ...item })),
    ],
});
async function write(site, store, expectedVersion, stored) {
    const version = await store.saveAiSettings({ id: "shared", expectedVersion, value: stored });
    return viewOf(site, version, stored);
}
const invalid = (message) => new AiError("ai_invalid_input", message);
const unknownKey = (site, key) => invalid(contextOf(site).t("shared.unknown", { key }));
function parse(site, schema, input) {
    const parsed = schema.safeParse(input);
    if (!parsed.success)
        throw invalid(parsed.error.issues[0]?.message ?? contextOf(site).t("shared.invalid"));
    return parsed.data;
}
/** Changes the content of a config text. If it equals the default, the edited value is removed (revert). */
function setConfigText(site, stored, key, text) {
    const { [key]: _old, ...texts } = stored.texts;
    return { ...stored, texts: text === contextOf(site).config[key]?.text ? texts : { ...texts, [key]: text } };
}
/** Shared texts to show in the admin screen. */
export async function getSharedView(site, store) {
    const { version, stored } = await load(site, store);
    return viewOf(site, version, stored);
}
/** Shared texts to put into the instructions (key -> content). Config texts have edited values applied, and added texts are included too. */
export async function loadSharedTexts(site, store) {
    const { version, stored } = await load(site, store);
    return Object.fromEntries(viewOf(site, version, stored).items.map((item) => [item.key, item.text]));
}
/** Keys usable as `{{shared.key}}` in the instructions (config texts and added texts). Checked when saving instructions in the admin screen. */
export async function loadSharedKeys(site, store) {
    return Object.keys(await loadSharedTexts(site, store));
}
/** Adds a shared text. The body is `{ key, label, text }`. The key must not collide with config texts or added texts. */
export async function addShared(site, store, expectedVersion, input) {
    const { t, addedSchema } = contextOf(site);
    const item = parse(site, addedSchema, input);
    const { stored } = await load(site, store);
    if (isConfigKey(site, item.key) || stored.added.some((added) => added.key === item.key)) {
        throw invalid(t("shared.keyTaken", { key: item.key }));
    }
    if (stored.added.length >= MAX_ADDED_SHARED)
        throw invalid(t("shared.tooMany", { max: MAX_ADDED_SHARED }));
    return write(site, store, expectedVersion, { ...stored, added: [...stored.added, item] });
}
/**
 * Edits one shared text. The body is `{ key, label?, text }`. A config text edits only content (the config decides the name),
 * and an added text edits name and content. The key is not changed.
 */
export async function updateSharedItem(site, store, expectedVersion, input) {
    const { key, label, text } = parse(site, contextOf(site).itemUpdateSchema, input);
    const { stored } = await load(site, store);
    if (isConfigKey(site, key))
        return write(site, store, expectedVersion, setConfigText(site, stored, key, text));
    const index = stored.added.findIndex((item) => item.key === key);
    const current = stored.added[index];
    if (!current)
        throw unknownKey(site, key);
    const added = stored.added.map((item, i) => (i === index ? { key, label: label ?? current.label, text } : item));
    return write(site, store, expectedVersion, { ...stored, added });
}
/**
 * Edits the content of several shared texts at once. The body is `{ texts: { key: content } }`, and texts not listed are left alone.
 * For config texts, an edited value equal to the default is removed. Unknown keys are rejected.
 */
export async function updateShared(site, store, expectedVersion, input) {
    const { texts } = parse(site, contextOf(site).textsUpdateSchema, input);
    let { stored } = await load(site, store);
    for (const [key, text] of Object.entries(texts)) {
        if (isConfigKey(site, key)) {
            stored = setConfigText(site, stored, key, text);
            continue;
        }
        if (!stored.added.some((item) => item.key === key))
            throw unknownKey(site, key);
        stored = { ...stored, added: stored.added.map((item) => (item.key === key ? { ...item, text } : item)) };
    }
    return write(site, store, expectedVersion, stored);
}
/** Whether the instructions use this text as `{{shared.key}}`. */
export function usesShared(prompt, key) {
    return new RegExp(`\\{\\{\\s*shared\\.${key}\\s*\\}\\}`).test(prompt);
}
/**
 * Deletes an added text. A config text cannot be deleted. If an action uses this text in its instructions (`features`: code action instructions and
 * edited instructions, UI actions), it is blocked and the action names are reported.
 */
export async function deleteShared(site, store, expectedVersion, key, features) {
    const { t } = contextOf(site);
    if (isConfigKey(site, key))
        throw invalid(t("shared.configCannotDelete"));
    const { stored } = await load(site, store);
    if (!stored.added.some((item) => item.key === key))
        throw unknownKey(site, key);
    const users = features.filter((feature) => usesShared(feature.prompt, key)).map((feature) => feature.label);
    if (users.length > 0)
        throw invalid(t("shared.inUse", { users: users.join(", ") }));
    return write(site, store, expectedVersion, { ...stored, added: stored.added.filter((item) => item.key !== key) });
}
