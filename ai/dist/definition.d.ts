import { z } from "zod";
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
export declare const AI_SLOTS: readonly ["field", "image", "codeRules", "media", "translation", "selection", "insert", "block"];
export type AiSlot = (typeof AI_SLOTS)[number];
/**
 * Mode. In `generate`, a chat model (LLM) answers with text. In `decide`, a decision model (System One, e.g. Jev)
 * rates the probability that each given choice fits, and only choices above the threshold become candidates. The decision model does not write text.
 */
export declare const AI_ENGINES: readonly ["generate", "decide"];
export type AiEngine = (typeof AI_ENGINES)[number];
/** In decide mode, pick only one (`one`), or judge each choice separately and pick several (`many`). */
export declare const AI_PICKS: readonly ["one", "many"];
export type AiPick = (typeof AI_PICKS)[number];
/**
 * Result shape. `candidates` is several candidates to click, `text` is one long text, `mdx` is one body fragment (MDX),
 * `note` is a display-only note.
 */
export declare const AI_RESULTS: readonly ["candidates", "text", "mdx", "note"];
export type AiResult = (typeof AI_RESULTS)[number];
/** How the result is applied. `append` adds to a list value (tags, regex rules). */
export declare const AI_APPLIES: readonly ["replace", "append", "none"];
export type AiApply = (typeof AI_APPLIES)[number];
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
export declare const AI_CHECK_KINDS: readonly ["pattern", "maxLength", "exists", "oneOf"];
export type AiCheckKind = (typeof AI_CHECK_KINDS)[number];
/** Code check name (lowercase, digits, hyphen). */
export declare const CODE_CHECK_NAME: RegExp;
export declare const aiCheckSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strip>], "kind">;
export type AiCheck = z.output<typeof aiCheckSchema>;
export type AiCheckInput = z.input<typeof aiCheckSchema>;
/** The name that points to one check in the check list. One per name for code checks, one per kind for the others. */
export declare const checkKey: (check: Pick<AiCheck, "kind"> & {
    name?: string;
}) => string;
/** Converts one stored check to the current shape. Kinds that moved to code checks become the code check of the same name. */
export declare function migrateCheck(value: unknown): unknown;
/** Checks any action can add in the admin UI, with initial values. The rest are set by the action definition. */
export declare const ADDABLE_CHECKS: {
    readonly pattern: {
        readonly kind: "pattern";
        readonly enabled: true;
        readonly pattern: ".+";
    };
    readonly maxLength: {
        readonly kind: "maxLength";
        readonly enabled: true;
        readonly max: 100;
    };
    readonly oneOf: {
        readonly kind: "oneOf";
        readonly enabled: true;
        readonly items: ["value"];
    };
};
export type AddableCheckKind = keyof typeof ADDABLE_CHECKS;
export declare const isAddableCheck: (kind: string) => kind is AddableCheckKind;
/** Number of choices that can be asked of the decision model at once. */
export declare const MAX_DECISION_OPTIONS = 255;
export declare const MAX_PROMPT_LENGTH = 4000;
export declare const MAX_REQUEST_LENGTH = 1000;
/** One candidate shown as a result in a slot. `value` is the value to apply and `label` is the displayed text. */
export interface AiCandidate {
    value: string;
    label: string;
    /** Short note to append (e.g. the number of places a regex found). */
    detail?: string;
}
export type AiRunResult = {
    kind: "candidates";
    items: AiCandidate[];
} | {
    kind: "text";
    text: string;
} | {
    kind: "mdx";
    text: string;
} | {
    kind: "note";
    text: string;
};
/**
 * The current situation a UI slot passes on click. Each slot fills only the values it knows. Passed on as the action's input (`action.input`).
 * The tag list and images are read directly by the server (the list and addresses sent by the browser are not trusted).
 */
export interface AiRunContext {
    /** Extra request entered at run time. Appended to the prompt only if the action has `askInstruction`. */
    request?: string;
    collection?: string;
    locale?: string;
    entryId?: string;
    title?: string;
    summary?: string;
    body?: string;
    /** The target's current value. List values (tag ids, etc.) are arrays. */
    current?: string | readonly string[];
    around?: string;
    /** Text (MDX) selected in the selection menu. */
    selection?: string;
    code?: string;
    language?: string;
    mediaId?: string;
    /** Site path (`/images/...`) of an image outside the media library. The server reads it from its own site. */
    imageSrc?: string;
    filename?: string;
}
/**
 * Converts values saved before the check list existed (one `check` + `maxLength`) into a check list.
 * Used when moving legacy `ai_features` rows into edited values.
 */
export declare function migrateLegacyCheck(value: unknown): unknown;
