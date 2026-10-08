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
            marker: { text: "›", className: "text-sky-600 cms-dark:text-sky-400" },
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
            marker: { text: "+", className: "text-green-600 cms-dark:text-green-400" },
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
            marker: { text: "−", className: "text-red-600 cms-dark:text-red-400" },
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
/** Checks that the site config is valid. Reports at app startup if wrong. */
export function validateCodeBlockConfig(config) {
    for (const [key, value] of Object.entries(config?.features ?? {})) {
        if (!FEATURES.has(key))
            throw new Error(`cms.config: codeBlock.features.${key}: unknown feature`);
        if (typeof value !== "boolean")
            throw new Error(`cms.config: codeBlock.features.${key}: must be true or false`);
    }
    for (const name of config?.omitLineEffects ?? []) {
        if (typeof name !== "string" || !NAME.test(name)) {
            throw new Error(`cms.config: codeBlock.omitLineEffects.${String(name)}: name must be lower-case kebab`);
        }
    }
    if (config?.themes) {
        for (const key of ["light", "dark"]) {
            const name = config.themes[key];
            if (typeof name !== "string" || !name.trim())
                throw new Error(`cms.config: codeBlock.themes.${key}: theme name is empty`);
        }
    }
    for (const name of config?.languages ?? []) {
        if (typeof name !== "string" || !LANGUAGE.test(name)) {
            throw new Error(`cms.config: codeBlock.languages.${String(name)}: not a language name`);
        }
    }
    const known = new Set(resolveCodeLineEffects(config?.lineEffects).map((effect) => effect.name));
    for (const name of config?.omitLineEffects ?? []) {
        if (!known.has(name))
            throw new Error(`cms.config: codeBlock.omitLineEffects.${name}: no such line effect`);
    }
    const seen = new Set();
    for (const effect of config?.lineEffects ?? []) {
        const at = `cms.config: codeBlock.lineEffects.${effect.name}`;
        if (!NAME.test(effect.name))
            throw new Error(`${at}: name must be lower-case kebab`);
        if (RESERVED.has(effect.name.toLowerCase()))
            throw new Error(`${at}: name is reserved`);
        if (seen.has(effect.name))
            throw new Error(`${at}: name is duplicated`);
        seen.add(effect.name);
        if (!effect.label.trim())
            throw new Error(`${at}: label is empty`);
        if (typeof effect.class !== "string")
            throw new Error(`${at}: class must be a string`);
    }
}
/** Merges site definitions into the default line effects. A same name is replaced in place; a new name is appended. */
export function resolveCodeLineEffects(added) {
    const byName = new Map(DEFAULT_CODE_LINE_EFFECTS.map((effect) => [effect.name, effect]));
    for (const effect of added ?? [])
        byName.set(effect.name, effect);
    return [...byName.values()];
}
