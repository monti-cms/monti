import { z } from "zod";
import { coreMessages } from "./core.messages.js";
import { lazyTranslator } from "./i18n.js";
const t = lazyTranslator(coreMessages);
/**
 * AI common definitions. The choices and result shapes shared by the action definition (`action.ts`), the runner and the admin UI.
 * Used by both server and browser, so no secrets or SDKs go here.
 */
/**
 * The UI slots an action attaches to. Each slot provides fixed material (`SLOT_INPUTS`).
 * `translation` is block translation in the translation editor (block menu and `Translate all`), `selection` is the menu shown when selecting text in the body
 * (e.g. style polish, replaces the selected text), and `insert` is the slash (`/`) menu and the empty document (e.g. draft writing, inserts at the cursor).
 * `block` is a button beside the handle of one body block (e.g. a Mermaid diagram). It sends the block source and replaces the block with the changed one.
 */
export const AI_SLOTS = [
    "field",
    "image",
    "codeRules",
    "media",
    "translation",
    "selection",
    "insert",
    "block",
];
/**
 * Mode. In `generate`, a chat model (LLM) answers with text. In `decide`, a decision model (System One, e.g. Jev)
 * rates the probability that each given choice fits, and only choices above the threshold become candidates. The decision model does not write text.
 */
export const AI_ENGINES = ["generate", "decide"];
/** In decide mode, pick only one (`one`), or judge each choice separately and pick several (`many`). */
export const AI_PICKS = ["one", "many"];
/**
 * Result shape. `candidates` is several candidates to click, `text` is one long text, `mdx` is one body fragment (MDX),
 * `note` is a display-only note.
 */
export const AI_RESULTS = ["candidates", "text", "mdx", "note"];
/** How the result is applied. `append` adds to a list value (tags, regex rules). */
export const AI_APPLIES = ["replace", "append", "none"];
/**
 * Result checks. Set per action as a list (all shown in the action editor); candidates that do not pass are discarded.
 * Fixed checks include only those usable by any action.
 * - `pattern`: only values matching the regex
 * - `maxLength`: only values not over the maximum length
 * - `exists`: only values that actually exist in the choices (`choices`)
 * - `oneOf`: only values that are one of a given list (`items`)
 *
 * Checks that differ per action (slug duplicates, regex execution, translation structure, etc.) are built as code checks (`defineValidator`) and put in the action's `checks`.
 * Only its name (`{ kind: "code", name }`) and the enabled state remain in the edited value.
 */
export const AI_CHECK_KINDS = ["pattern", "maxLength", "exists", "oneOf"];
/** Code check name (lowercase, digits, hyphen). */
export const CODE_CHECK_NAME = /^[a-z][a-z0-9-]*$/;
const patternSchema = z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((pattern) => {
    try {
        new RegExp(pattern, "u");
        return true;
    }
    catch {
        return false;
    }
}, { error: () => t("check.invalidRegex") });
/** One check. Fixed checks are toggled per action, and format and length edit a value. */
const enabled = z.boolean().default(true);
export const aiCheckSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("pattern"), enabled, pattern: patternSchema }),
    z.object({ kind: z.literal("maxLength"), enabled, max: z.number().int().min(1).max(5000) }),
    z.object({ kind: z.literal("exists"), enabled }),
    z.object({ kind: z.literal("oneOf"), enabled, items: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }),
    z.object({ kind: z.literal("code"), enabled, name: z.string().max(60).regex(CODE_CHECK_NAME) }),
]);
/** The name that points to one check in the check list. One per name for code checks, one per kind for the others. */
export const checkKey = (check) => check.kind === "code" ? `code:${check.name}` : check.kind;
/** Fixed checks that moved to code checks (moved when reading stored edited values). */
const MOVED_TO_CODE = {
    unique: "unique-slug",
    regexRuns: "regex-runs",
    structure: "same-structure",
};
/** Converts one stored check to the current shape. Kinds that moved to code checks become the code check of the same name. */
export function migrateCheck(value) {
    if (!value || typeof value !== "object" || !("kind" in value))
        return value;
    const { kind, enabled } = value;
    const name = typeof kind === "string" ? MOVED_TO_CODE[kind] : undefined;
    return name ? { kind: "code", name, ...(typeof enabled === "boolean" ? { enabled } : {}) } : value;
}
/** Checks any action can add in the admin UI, with initial values. The rest are set by the action definition. */
export const ADDABLE_CHECKS = {
    pattern: { kind: "pattern", enabled: true, pattern: ".+" },
    maxLength: { kind: "maxLength", enabled: true, max: 100 },
    oneOf: { kind: "oneOf", enabled: true, items: ["value"] },
};
export const isAddableCheck = (kind) => Object.hasOwn(ADDABLE_CHECKS, kind);
/** Number of choices that can be asked of the decision model at once. */
export const MAX_DECISION_OPTIONS = 255;
export const MAX_PROMPT_LENGTH = 4000;
export const MAX_REQUEST_LENGTH = 1000;
/**
 * Converts values saved before the check list existed (one `check` + `maxLength`) into a check list.
 * Used when moving legacy `ai_features` rows into edited values.
 */
export function migrateLegacyCheck(value) {
    if (!value || typeof value !== "object" || "checks" in value || !("check" in value))
        return value;
    // The format the legacy `slug` and `filename` checks used (the value as it was then).
    const LEGACY_KEBAB = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    const { check, maxLength, ...rest } = value;
    const legacy = {
        slug: [
            { kind: "pattern", pattern: LEGACY_KEBAB },
            { kind: "code", name: "unique-slug" },
        ],
        tags: [{ kind: "exists" }],
        regex: [{ kind: "code", name: "regex-runs" }],
        filename: [{ kind: "pattern", pattern: LEGACY_KEBAB }],
        maxLength: typeof maxLength === "number" ? [{ kind: "maxLength", max: maxLength }] : [],
    };
    return { ...rest, checks: typeof check === "string" ? (legacy[check] ?? []) : [] };
}
