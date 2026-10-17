import { checkKnownKeys, IssueList, pathOf } from "../../config/check/issue.js";
import { createActiveTranslator } from "../../i18n/active.js";
import { codeBlockMessages } from "./messages.js";
const t = createActiveTranslator(codeBlockMessages);
/** Core default line effects. Declaration order is the order in the line effect menu. */
export const DEFAULT_CODE_LINE_EFFECTS = [
    {
        name: "highlight",
        get label() {
            return t("lineEffect.highlight");
        },
        icon: "highlighter",
        class: "inline-block w-full anno-mark-base bg-gray-400/20",
        editor: { background: "bg-gray-400/20" },
    },
    {
        // The other lines of the block are dimmed until the reader points at or into the code (`render.css`, `.code-focus`).
        name: "focus",
        get label() {
            return t("lineEffect.focus");
        },
        icon: "focus",
        class: "code-focus",
        editor: {
            background: "bg-sky-400/10",
            marker: { text: "›", className: "text-sky-600 monti-dark:text-sky-400" },
        },
    },
    {
        name: "plus",
        get label() {
            return t("lineEffect.plus");
        },
        icon: "plus",
        class: "inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
        editor: {
            background: "bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
            marker: { text: "+", className: "text-green-600 monti-dark:text-green-400" },
        },
    },
    {
        name: "minus",
        get label() {
            return t("lineEffect.minus");
        },
        icon: "minus",
        class: "inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
        editor: {
            background: "bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
            marker: { text: "−", className: "text-red-600 monti-dark:text-red-400" },
        },
    },
    {
        name: "warning",
        get label() {
            return t("lineEffect.warning");
        },
        icon: "triangle-alert",
        class: "underline decoration-wavy decoration-yellow-400/80",
        editor: { wavy: "decoration-yellow-400/80" },
    },
    {
        name: "error",
        get label() {
            return t("lineEffect.error");
        },
        icon: "circle-x",
        class: "underline decoration-wavy decoration-red-500",
        editor: { wavy: "decoration-red-500" },
    },
];
/** Names not usable as line effects: core line effects (folding, label) and text effect names. */
const RESERVED = new Set(["collapse", "anchor", "fold", "strong", "em", "del", "u", "tooltip"]);
const NAME = /^[a-z][a-z0-9-]*$/;
/** Default highlighting themes. */
export const DEFAULT_CODE_BLOCK_THEMES = { light: "one-light", dark: "one-dark-pro" };
const FEATURES = new Set(["rules", "fold", "tooltip", "textStyles"]);
const LANGUAGE = /^[a-z0-9][a-z0-9+#.-]*$/i;
/** Checks the `codeBlock` settings of the site config. */
export function checkCodeBlockConfig(config) {
    if (!config)
        return [];
    const list = new IssueList();
    checkKnownKeys(list, "codeBlock", config, ["lineEffects", "omitLineEffects", "features", "themes", "languages"]);
    for (const [key, value] of Object.entries(config.features ?? {})) {
        const at = pathOf("codeBlock", "features", key);
        if (!FEATURES.has(key))
            list.add(at, "unknown-key", `is not a feature (${[...FEATURES].join(", ")})`);
        else if (typeof value !== "boolean")
            list.add(at, "type", "must be true or false");
    }
    for (const [index, name] of (config.omitLineEffects ?? []).entries()) {
        if (typeof name !== "string" || !NAME.test(name)) {
            list.add(pathOf("codeBlock", "omitLineEffects", index), "name", "must be a lower-case kebab name");
        }
    }
    if (config.themes) {
        for (const key of ["light", "dark"]) {
            const name = config.themes[key];
            if (typeof name !== "string" || !name.trim())
                list.add(pathOf("codeBlock", "themes", key), "empty", "theme name must not be empty");
        }
    }
    for (const [index, name] of (config.languages ?? []).entries()) {
        if (typeof name !== "string" || !LANGUAGE.test(name)) {
            list.add(pathOf("codeBlock", "languages", index), "name", "must be a language name");
        }
    }
    const known = new Set(resolveCodeLineEffects(config.lineEffects).map((effect) => effect.name));
    for (const [index, name] of (config.omitLineEffects ?? []).entries()) {
        if (typeof name === "string" && NAME.test(name) && !known.has(name)) {
            list.add(pathOf("codeBlock", "omitLineEffects", index), "unknown-effect", `"${name}" is not a line effect`);
        }
    }
    const seen = new Set();
    for (const [index, effect] of (config.lineEffects ?? []).entries()) {
        const at = pathOf("codeBlock", "lineEffects", index);
        if (!NAME.test(effect.name))
            list.add(pathOf(at, "name"), "name", "must be a lower-case kebab name");
        else if (RESERVED.has(effect.name.toLowerCase()))
            list.add(pathOf(at, "name"), "reserved", `"${effect.name}" is reserved`);
        else if (seen.has(effect.name))
            list.add(pathOf(at, "name"), "duplicate", `"${effect.name}" is defined twice`);
        seen.add(effect.name);
        if (!effect.label.trim())
            list.add(pathOf(at, "label"), "empty", "must not be empty");
        if (typeof effect.class !== "string")
            list.add(pathOf(at, "class"), "type", "must be a string");
    }
    return list.issues;
}
/** Merges site definitions into the default line effects. A same name is replaced in place; a new name is appended. */
export function resolveCodeLineEffects(added) {
    const byName = new Map(DEFAULT_CODE_LINE_EFFECTS.map((effect) => [effect.name, effect]));
    for (const effect of added ?? [])
        byName.set(effect.name, effect);
    return [...byName.values()];
}
